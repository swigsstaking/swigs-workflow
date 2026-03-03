import crypto from 'crypto';
import BankTransaction from '../models/BankTransaction.js';
import BankImport from '../models/BankImport.js';
import BankAccount from '../models/BankAccount.js';
import Invoice from '../models/Invoice.js';
import Settings from '../models/Settings.js';
import { parseCamtXml } from '../services/camtParser.service.js';
import { reconcileTransaction } from '../services/reconciliation.service.js';
import { classifyTransaction } from '../services/expenseClassifier.service.js';
import { historyService } from '../services/historyService.js';
import { testImapConnection, fetchBankEmails } from '../services/bankImapFetcher.service.js';
import { decrypt } from '../utils/crypto.js';

/**
 * POST /api/bank/import
 * Upload XML camt file, parse, reconcile, auto-mark paid if confidence >= 80
 */
export const importCamt = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }

    const userId = req.user._id;
    const importId = crypto.randomUUID();
    const filename = req.file.originalname;

    // Parse XML
    let parsed;
    try {
      parsed = parseCamtXml(req.file.buffer);
    } catch (err) {
      return res.status(400).json({ success: false, error: `Erreur de parsing: ${err.message}` });
    }

    const { fileType, statementInfo, transactions } = parsed;

    if (transactions.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucune transaction trouvée dans le fichier' });
    }

    // Resolve bankAccountId from statement IBAN
    let bankAccountId = null;
    if (statementInfo.iban) {
      const cleanIban = statementInfo.iban.replace(/\s/g, '').toUpperCase();
      const account = await BankAccount.findOne({ iban: cleanIban, userId });
      if (account) bankAccountId = account._id;
    }

    // Reconcile each transaction
    const results = { matched: 0, suggested: 0, unmatched: 0 };
    const savedTransactions = [];

    for (const tx of transactions) {
      const reconciliation = await reconcileTransaction(tx, userId);

      // Auto-classify DBIT transactions
      let classification = null;
      if (tx.creditDebit === 'DBIT') {
        classification = await classifyTransaction(tx, userId);
      }

      const bankTx = await BankTransaction.create({
        importId,
        importFilename: filename,
        txId: tx.txId,
        bookingDate: tx.bookingDate,
        amount: tx.amount,
        currency: tx.currency,
        creditDebit: tx.creditDebit,
        counterpartyName: tx.counterpartyName,
        counterpartyIban: tx.counterpartyIban,
        reference: tx.reference,
        unstructuredReference: tx.unstructuredReference,
        matchStatus: reconciliation.matchStatus,
        matchMethod: reconciliation.matchMethod,
        matchedInvoice: reconciliation.matchedInvoice,
        matchConfidence: reconciliation.matchConfidence,
        bankAccountId,
        ...(classification ? {
          expenseCategory: classification.expenseCategory,
          autoClassified: classification.autoClassified
        } : {}),
        userId
      });

      // Record payment if confidence >= 80 (supports partial payments)
      if (reconciliation.matchedInvoice && reconciliation.matchConfidence >= 80) {
        const invoice = await Invoice.findOne({
          _id: reconciliation.matchedInvoice,
          status: { $in: ['sent', 'partial'] }
        }).populate('project');

        if (invoice) {
          const remaining = invoice.total - (invoice.paidAmount || 0);
          const paymentAmount = Math.min(Math.abs(tx.amount), remaining);

          if (paymentAmount > 0) {
            invoice.payments.push({
              amount: paymentAmount,
              date: tx.bookingDate || new Date(),
              method: 'bank_transfer',
              notes: `Import bancaire auto (${reconciliation.matchMethod}, confiance ${reconciliation.matchConfidence}%)`
            });
            invoice.paidAmount = (invoice.paidAmount || 0) + paymentAmount;

            if (invoice.paidAmount >= invoice.total) {
              invoice.status = 'paid';
              invoice.paidAt = tx.bookingDate || new Date();
            } else {
              invoice.status = 'partial';
            }
            await invoice.save();

            try {
              const statusLabel = invoice.status === 'paid' ? 'marquée payée' : `paiement partiel (${paymentAmount.toFixed(2)} CHF)`;
              await historyService.log(
                invoice.project._id || invoice.project,
                'bank_reconciled',
                `Facture ${invoice.number} ${statusLabel} via import bancaire (${reconciliation.matchMethod}, confiance ${reconciliation.matchConfidence}%)`,
                { importId, txId: tx.txId, amount: paymentAmount }
              );
            } catch (e) {
              // Non-blocking
            }
          }
        }
      }

      results[reconciliation.matchStatus === 'matched' ? 'matched' : reconciliation.matchStatus === 'suggested' ? 'suggested' : 'unmatched']++;
      savedTransactions.push(bankTx);
    }

    // Create import audit record
    const bankImport = await BankImport.create({
      importId,
      filename,
      fileType,
      totalTransactions: transactions.length,
      matchedCount: results.matched,
      suggestedCount: results.suggested,
      unmatchedCount: results.unmatched,
      statementIban: statementInfo.iban,
      statementOpeningBalance: statementInfo.openingBalance,
      statementClosingBalance: statementInfo.closingBalance,
      statementDate: statementInfo.date,
      bankAccountId,
      userId
    });

    res.json({
      success: true,
      data: {
        import: bankImport,
        results,
        transactions: savedTransactions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank/imports
 * List all imports for current user
 */
export const getImports = async (req, res, next) => {
  try {
    const imports = await BankImport.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: imports });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank/imports/:importId/transactions
 * Transactions for a specific import
 */
export const getImportTransactions = async (req, res, next) => {
  try {
    const filter = {
      importId: req.params.importId,
      userId: req.user._id
    };
    const allowedMatchStatuses = ['matched', 'unmatched', 'partial', 'ignored'];
    if (req.query.status && allowedMatchStatuses.includes(req.query.status)) {
      filter.matchStatus = req.query.status;
    }
    const transactions = await BankTransaction.find(filter)
      .populate({ path: 'matchedInvoice', select: 'number total status' })
      .sort({ bookingDate: -1 })
      .lean();
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/bank/unmatched
 * All unmatched + suggested transactions
 */
export const getUnmatched = async (req, res, next) => {
  try {
    const transactions = await BankTransaction.find({
      userId: req.user._id,
      matchStatus: { $in: ['unmatched', 'suggested'] }
    })
      .populate({ path: 'matchedInvoice', select: 'number total status' })
      .sort({ bookingDate: -1 })
      .lean();
    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bank/transactions/:id/match
 * Manually match a transaction to an invoice
 */
export const matchTransaction = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'invoiceId requis' });
    }

    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    const invoice = await Invoice.findById(invoiceId).populate('project');
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify invoice belongs to the user
    if (invoice.project.userId && invoice.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Update transaction
    tx.matchedInvoice = invoiceId;
    tx.matchMethod = 'manual';
    tx.matchConfidence = 100;
    tx.matchStatus = 'matched';
    await tx.save();

    // Record payment (supports partial: sent or partial invoices)
    if (['sent', 'partial'].includes(invoice.status)) {
      const remaining = invoice.total - (invoice.paidAmount || 0);
      const paymentAmount = Math.min(Math.abs(tx.amount), remaining);

      if (paymentAmount > 0) {
        invoice.payments.push({
          amount: paymentAmount,
          date: tx.bookingDate || new Date(),
          method: 'bank_transfer',
          notes: 'Rapprochement manuel import bancaire'
        });
        invoice.paidAmount = (invoice.paidAmount || 0) + paymentAmount;

        if (invoice.paidAmount >= invoice.total) {
          invoice.status = 'paid';
          invoice.paidAt = tx.bookingDate || new Date();
        } else {
          invoice.status = 'partial';
        }
        await invoice.save();

        try {
          const statusLabel = invoice.status === 'paid' ? 'rapprochée (payée)' : `paiement partiel (${paymentAmount.toFixed(2)} CHF)`;
          await historyService.log(
            invoice.project._id || invoice.project,
            'bank_reconciled',
            `Facture ${invoice.number} ${statusLabel} via import bancaire`,
            { txId: tx.txId, amount: paymentAmount }
          );
        } catch (e) {
          // Non-blocking
        }
      }
    }

    // Update import counters
    await recalcImportCounters(tx.importId, tx.userId);

    const updated = await BankTransaction.findById(tx._id)
      .populate({ path: 'matchedInvoice', select: 'number total status' })
      .lean();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bank/transactions/:id/ignore
 * Ignore a transaction
 */
export const ignoreTransaction = async (req, res, next) => {
  try {
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    tx.matchStatus = 'ignored';
    tx.matchMethod = null;
    tx.matchedInvoice = null;
    tx.matchConfidence = 0;
    await tx.save();

    await recalcImportCounters(tx.importId, tx.userId);

    res.json({ success: true, data: tx });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank/imap/test
 * Test IMAP connection with provided or saved credentials
 */
export const testImap = async (req, res, next) => {
  try {
    const { host, port, tls, user, pass, folder } = req.body;

    if (!host || !user) {
      return res.status(400).json({ success: false, error: 'Host et utilisateur requis' });
    }

    // If no password provided, try to use the saved one
    let password = pass;
    if (!password) {
      const settings = await Settings.getSettings(req.user._id);
      if (settings.bankImap?.pass) {
        password = decrypt(settings.bankImap.pass);
      }
    }

    if (!password) {
      return res.status(400).json({ success: false, error: 'Mot de passe requis' });
    }

    const result = await testImapConnection({
      host,
      port: port || 993,
      tls: tls !== false,
      user,
      pass: password,
      folder: folder || 'INBOX'
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank/imap/fetch
 * Manually trigger IMAP fetch now
 */
export const fetchImapNow = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings(req.user._id);

    if (!settings.bankImap?.enabled || !settings.bankImap?.host) {
      return res.status(400).json({ success: false, error: 'Import IMAP non configuré' });
    }

    const result = await fetchBankEmails(req.user._id, settings.bankImap);
    res.json({ success: true, data: result });
  } catch (error) {
    // Return IMAP errors as 400 with clear message instead of 500
    const msg = error.message || '';
    if (msg.includes('Authentication failed') || msg.includes('Invalid login') || msg.includes('LOGIN')) {
      return res.status(400).json({ success: false, error: 'Échec d\'authentification IMAP. Vérifiez l\'utilisateur et le mot de passe dans les paramètres.' });
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('getaddrinfo')) {
      return res.status(400).json({ success: false, error: `Connexion IMAP impossible: ${msg}. Vérifiez l\'hôte et le port.` });
    }
    next(error);
  }
};

/**
 * GET /api/bank/transactions
 * List transactions with filters (Compta Plus)
 */
export const getTransactions = async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    const { account, category, creditDebit, from, to, status } = req.query;

    if (account) filter.bankAccountId = account;
    if (category) filter.expenseCategory = category;
    if (creditDebit) filter.creditDebit = creditDebit;
    if (status) filter.matchStatus = status;
    if (from || to) {
      filter.bookingDate = {};
      if (from) filter.bookingDate.$gte = new Date(from);
      if (to) filter.bookingDate.$lte = new Date(to);
    }

    const transactions = await BankTransaction.find(filter)
      .populate({ path: 'matchedInvoice', select: 'number total status' })
      .populate({ path: 'expenseCategory', select: 'name icon color accountNumber' })
      .populate({ path: 'bankAccountId', select: 'name color iban' })
      .sort({ bookingDate: -1 })
      .limit(500)
      .lean();

    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bank/transactions/:id/categorize
 * Assign or change expense category on a DBIT transaction
 */
export const categorizeTransaction = async (req, res, next) => {
  try {
    const { expenseCategoryId } = req.body;
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    tx.expenseCategory = expenseCategoryId || null;
    tx.autoClassified = false;
    await tx.save();

    const updated = await BankTransaction.findById(tx._id)
      .populate({ path: 'expenseCategory', select: 'name icon color accountNumber' })
      .lean();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/bank/transactions/:id/vat
 * Set VAT info on a transaction
 */
export const setTransactionVat = async (req, res, next) => {
  try {
    const { vatRate, vatAmount } = req.body;
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    if (vatRate !== undefined) tx.vatRate = vatRate;
    if (vatAmount !== undefined) tx.vatAmount = vatAmount;
    await tx.save();

    res.json({ success: true, data: tx });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank/transactions/:id/attachments
 * Add attachment to a transaction (base64)
 */
export const addAttachment = async (req, res, next) => {
  try {
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Fichier requis' });
    }

    // Validate file
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Format non accepté. PDF, JPG ou PNG uniquement.' });
    }

    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Fichier trop volumineux (max 2 Mo)' });
    }

    if ((tx.attachments || []).length >= 5) {
      return res.status(400).json({ success: false, error: 'Maximum 5 pièces jointes par transaction' });
    }

    tx.attachments.push({
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      data: req.file.buffer.toString('base64'),
      uploadedAt: new Date()
    });

    await tx.save();
    res.json({ success: true, data: tx });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/bank/transactions/:id/attachments/:aid
 * Remove an attachment from a transaction
 */
export const removeAttachment = async (req, res, next) => {
  try {
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    tx.attachments = tx.attachments.filter(a => a._id.toString() !== req.params.aid);
    await tx.save();

    res.json({ success: true, data: tx });
  } catch (error) {
    next(error);
  }
};

async function recalcImportCounters(importId, userId) {
  const counts = await BankTransaction.aggregate([
    { $match: { importId, userId } },
    { $group: { _id: '$matchStatus', count: { $sum: 1 } } }
  ]);
  const update = { matchedCount: 0, suggestedCount: 0, unmatchedCount: 0 };
  for (const c of counts) {
    if (c._id === 'matched') update.matchedCount = c.count;
    if (c._id === 'suggested') update.suggestedCount = c.count;
    if (c._id === 'unmatched') update.unmatchedCount = c.count;
  }
  await BankImport.findOneAndUpdate({ importId }, update);
}
