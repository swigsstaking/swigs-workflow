import crypto from 'crypto';
import BankTransaction from '../models/BankTransaction.js';
import BankImport from '../models/BankImport.js';
import BankAccount from '../models/BankAccount.js';
import Invoice from '../models/Invoice.js';
import Settings from '../models/Settings.js';
import { parseCamtXml } from '../services/camtParser.service.js';
import { reconcileTransaction } from '../services/reconciliation.service.js';
import { classifyTransaction, calcVatFromTTC } from '../services/expenseClassifier.service.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import { historyService } from '../services/historyService.js';
import { testImapConnection, fetchBankEmails } from '../services/bankImapFetcher.service.js';
import { decrypt } from '../utils/crypto.js';
import RecurringCharge from '../models/RecurringCharge.js';
import { detectRecurringCharges } from '../services/recurringDetector.service.js';

/**
 * GET /api/bank/transactions/:id
 * Fetch a single transaction with full details
 */
export const getTransaction = async (req, res, next) => {
  try {
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id })
      .populate({ path: 'matchedInvoice', select: 'number total status clientSnapshot.name' })
      .populate({ path: 'expenseCategory', select: 'name color icon vatRate' })
      .populate({ path: 'bankAccountId', select: 'name iban' })
      .lean();

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction non trouvée' });
    }

    res.json({ success: true, data: tx });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank/recurring
 * Create a recurring charge manually
 */
export const createRecurringCharge = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { counterpartyName, frequency, expectedAmount, expenseCategory, sampleTransactionIds } = req.body;

    if (!counterpartyName || !counterpartyName.trim()) {
      return res.status(400).json({ success: false, error: 'Nom du fournisseur requis' });
    }
    if (expectedAmount == null || expectedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Montant attendu requis (> 0)' });
    }

    // Verify expenseCategory belongs to user
    if (expenseCategory) {
      const cat = await ExpenseCategory.findOne({ _id: expenseCategory, userId });
      if (!cat) {
        return res.status(400).json({ success: false, error: 'Catégorie de dépense invalide' });
      }
    }

    // Check for existing charge with same counterparty
    const existing = await RecurringCharge.findOne({ userId, counterpartyName: counterpartyName.trim() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Une charge récurrente existe déjà pour ce fournisseur' });
    }

    const charge = await RecurringCharge.create({
      userId,
      counterpartyName: counterpartyName.trim(),
      frequency: frequency || 'monthly',
      expectedAmount,
      expenseCategory: expenseCategory || undefined,
      sampleTransactionIds: sampleTransactionIds || [],
      isConfirmed: true,
      detectionConfidence: 100
    });

    const populated = await RecurringCharge.findById(charge._id)
      .populate({ path: 'expenseCategory', select: 'name color icon accountNumber' })
      .lean();

    res.json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, error: 'Une charge récurrente existe déjà pour ce fournisseur' });
    }
    next(error);
  }
};

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
    const results = { matched: 0, suggested: 0, unmatched: 0, duplicates: 0 };
    const savedTransactions = [];

    for (const tx of transactions) {
      // --- Dedup check ---
      const dedupFilter = { userId, bookingDate: tx.bookingDate, amount: tx.amount, creditDebit: tx.creditDebit };
      if (tx.txId) {
        // If txId exists, use it as primary dedup key
        const existsByTxId = await BankTransaction.exists({ userId, txId: tx.txId });
        if (existsByTxId) { results.duplicates++; continue; }
      }
      // Composite dedup: date + amount + creditDebit + counterpartyName
      if (tx.counterpartyName) dedupFilter.counterpartyName = tx.counterpartyName;
      const existsByComposite = await BankTransaction.exists(dedupFilter);
      if (existsByComposite) { results.duplicates++; continue; }

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
          autoClassified: classification.autoClassified,
          vatRate: classification.vatRate,
          vatAmount: classification.vatAmount
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
      totalTransactions: savedTransactions.length,
      matchedCount: results.matched,
      suggestedCount: results.suggested,
      unmatchedCount: results.unmatched,
      statementIban: statementInfo.iban,
      statementOpeningBalance: Number.isFinite(statementInfo.openingBalance) ? statementInfo.openingBalance : undefined,
      statementClosingBalance: Number.isFinite(statementInfo.closingBalance) ? statementInfo.closingBalance : undefined,
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
 * DELETE /api/bank/imports/:importId
 * Delete an import and all its transactions
 */
export const deleteImport = async (req, res, next) => {
  try {
    const { importId } = req.params;
    const userId = req.user._id;

    const imp = await BankImport.findOne({ importId, userId });
    if (!imp) return res.status(404).json({ error: 'Import introuvable' });

    // Check if any transactions from this import are matched to invoices
    const matchedCount = await BankTransaction.countDocuments({
      importId,
      userId,
      matchStatus: 'matched',
      matchedInvoice: { $ne: null }
    });

    if (matchedCount > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer : ${matchedCount} transaction(s) sont rapprochées avec des factures. Dissociez-les d'abord.`
      });
    }

    // Delete all transactions for this import
    const deleted = await BankTransaction.deleteMany({ importId, userId });

    // Delete the import record
    await BankImport.deleteOne({ _id: imp._id });

    res.json({
      success: true,
      data: { deletedTransactions: deleted.deletedCount, importId }
    });
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
      .populate({ path: 'expenseCategory', select: 'name color icon accountNumber vatRate' })
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
    if (!invoice || !invoice.project) {
      return res.status(404).json({ success: false, error: 'Facture non trouvée' });
    }

    // Verify invoice belongs to the user
    if (!invoice.project.userId || invoice.project.userId.toString() !== req.user._id.toString()) {
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
    if (category === 'none') filter.expenseCategory = null;
    else if (category) filter.expenseCategory = category;
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

    // Auto-calculate VAT from category rate when categorizing
    if (expenseCategoryId) {
      const cat = await ExpenseCategory.findById(expenseCategoryId).select('vatRate').lean();
      const vatRate = cat?.vatRate ?? 8.1;
      tx.vatRate = vatRate;
      tx.vatAmount = calcVatFromTTC(tx.amount, vatRate);
    } else {
      tx.vatRate = undefined;
      tx.vatAmount = undefined;
    }

    await tx.save();

    const updated = await BankTransaction.findById(tx._id)
      .populate({ path: 'expenseCategory', select: 'name icon color accountNumber vatRate' })
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

    if (vatRate !== undefined) {
      if (typeof vatRate !== 'number' || vatRate < 0 || vatRate > 100) {
        return res.status(400).json({ success: false, error: 'Taux TVA invalide (0-100)' });
      }
      tx.vatRate = vatRate;
    }
    if (vatAmount !== undefined) {
      if (typeof vatAmount !== 'number' || vatAmount < 0) {
        return res.status(400).json({ success: false, error: 'Montant TVA invalide' });
      }
      tx.vatAmount = vatAmount;
    }
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
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Format non accepté. PDF, JPG, PNG ou WebP uniquement.' });
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

/**
 * GET /api/bank/duplicates
 * Detect potential duplicate transactions (same date + amount + creditDebit + counterpartyName)
 */
export const getDuplicates = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const groups = await BankTransaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: {
            bookingDate: '$bookingDate',
            amount: '$amount',
            creditDebit: '$creditDebit',
            counterpartyName: '$counterpartyName'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { '_id.bookingDate': -1 } },
      { $limit: 50 }
    ]);

    if (groups.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Fetch full transaction details for each group
    const allIds = groups.flatMap(g => g.ids);
    const txs = await BankTransaction.find({ _id: { $in: allIds } })
      .populate({ path: 'expenseCategory', select: 'name color icon accountNumber' })
      .populate({ path: 'matchedInvoice', select: 'number total status' })
      .sort({ bookingDate: -1 })
      .lean();

    const txMap = new Map(txs.map(t => [t._id.toString(), t]));

    const duplicates = groups.map(g => ({
      key: g._id,
      count: g.count,
      transactions: g.ids.map(id => txMap.get(id.toString())).filter(Boolean)
    }));

    res.json({ success: true, data: duplicates });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank/transactions/merge
 * Merge duplicate transactions — keep one, delete the rest.
 * Preserves: categorization, attachments, match status, notes from the "best" one.
 */
export const mergeTransactions = async (req, res, next) => {
  try {
    const { keepId, deleteIds } = req.body;
    const userId = req.user._id;

    if (!keepId || !deleteIds || !Array.isArray(deleteIds) || deleteIds.length === 0) {
      return res.status(400).json({ error: 'keepId et deleteIds requis' });
    }

    const keepTx = await BankTransaction.findOne({ _id: keepId, userId });
    if (!keepTx) return res.status(404).json({ error: 'Transaction à conserver introuvable' });

    const toDelete = await BankTransaction.find({ _id: { $in: deleteIds }, userId });
    if (toDelete.length === 0) return res.status(404).json({ error: 'Aucune transaction à supprimer trouvée' });

    // Absorb data from duplicates into keepTx
    for (const dup of toDelete) {
      // Take categorization if keepTx doesn't have one
      if (!keepTx.expenseCategory && dup.expenseCategory) {
        keepTx.expenseCategory = dup.expenseCategory;
        keepTx.autoClassified = dup.autoClassified;
        keepTx.vatRate = dup.vatRate;
        keepTx.vatAmount = dup.vatAmount;
      }
      // Absorb notes
      if (!keepTx.notes && dup.notes) {
        keepTx.notes = dup.notes;
      }
      // Absorb attachments (up to 5 max)
      if (dup.attachments?.length > 0) {
        for (const att of dup.attachments) {
          if ((keepTx.attachments || []).length < 5) {
            keepTx.attachments.push(att);
          }
        }
      }
      // Take match if keepTx is unmatched
      if (keepTx.matchStatus === 'unmatched' && dup.matchStatus === 'matched' && dup.matchedInvoice) {
        keepTx.matchStatus = dup.matchStatus;
        keepTx.matchedInvoice = dup.matchedInvoice;
        keepTx.matchMethod = dup.matchMethod;
        keepTx.matchConfidence = dup.matchConfidence;
      }
    }

    await keepTx.save();

    // Delete duplicates
    const deleteResult = await BankTransaction.deleteMany({ _id: { $in: deleteIds }, userId });

    // Recalc import counters for affected imports
    const affectedImports = new Set([keepTx.importId, ...toDelete.map(t => t.importId)]);
    for (const impId of affectedImports) {
      if (impId) await recalcImportCounters(impId, userId);
    }

    const updated = await BankTransaction.findById(keepTx._id)
      .populate({ path: 'expenseCategory', select: 'name icon color accountNumber' })
      .populate({ path: 'matchedInvoice', select: 'number total status' })
      .lean();

    res.json({
      success: true,
      data: { kept: updated, deletedCount: deleteResult.deletedCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Parse CSV buffer supporting both , and ; delimiters.
 * Returns { headers: string[], rows: string[][] }
 */
function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) throw new Error('Le fichier CSV doit contenir au moins un en-tête et une ligne de données');

  // Detect delimiter from header line
  const headerLine = lines[0];
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const parseRow = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === delimiter) { fields.push(current.trim()); current = ''; }
        else { current += ch; }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(l => parseRow(l));
  return { headers, rows };
}

/**
 * POST /api/bank/transactions
 * Create a single manual transaction
 */
export const createTransaction = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { bookingDate, amount, creditDebit, counterpartyName, description, expenseCategoryId, bankAccountId, currency, notes } = req.body;

    if (!bookingDate || amount == null || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Date et montant (> 0) requis' });
    }
    if (!['CRDT', 'DBIT'].includes(creditDebit)) {
      return res.status(400).json({ success: false, error: 'creditDebit doit être CRDT ou DBIT' });
    }

    const importId = crypto.randomUUID();

    // Create import record for audit
    await BankImport.create({
      importId,
      filename: 'Saisie manuelle',
      fileType: 'manual',
      totalTransactions: 1,
      unmatchedCount: 1,
      bankAccountId: bankAccountId || undefined,
      userId
    });

    // Calculate VAT if expense category provided and DBIT
    let vatFields = {};
    if (expenseCategoryId && creditDebit === 'DBIT') {
      const cat = await ExpenseCategory.findById(expenseCategoryId).select('vatRate').lean();
      const vatRate = cat?.vatRate ?? 8.1;
      vatFields = { vatRate, vatAmount: calcVatFromTTC(amount, vatRate) };
    }

    const tx = await BankTransaction.create({
      importId,
      importFilename: 'Saisie manuelle',
      bookingDate: new Date(bookingDate),
      amount,
      currency: currency || 'CHF',
      creditDebit,
      counterpartyName: counterpartyName || '',
      unstructuredReference: description || '',
      matchStatus: 'unmatched',
      bankAccountId: bankAccountId || undefined,
      expenseCategory: expenseCategoryId || undefined,
      notes: notes || undefined,
      ...vatFields,
      userId
    });

    const populated = await BankTransaction.findById(tx._id)
      .populate({ path: 'expenseCategory', select: 'name icon color accountNumber vatRate' })
      .populate({ path: 'bankAccountId', select: 'name color iban' })
      .lean();

    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/bank/transactions/:id
 * Edit main fields of a transaction
 */
export const updateTransaction = async (req, res, next) => {
  try {
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) return res.status(404).json({ success: false, error: 'Transaction non trouvée' });

    const { bookingDate, amount, creditDebit, counterpartyName, description, expenseCategoryId, bankAccountId, currency, notes } = req.body;

    if (bookingDate) tx.bookingDate = new Date(bookingDate);
    if (amount != null && amount > 0) tx.amount = amount;
    if (creditDebit && ['CRDT', 'DBIT'].includes(creditDebit)) tx.creditDebit = creditDebit;
    if (counterpartyName !== undefined) tx.counterpartyName = counterpartyName;
    if (description !== undefined) tx.unstructuredReference = description;
    if (bankAccountId !== undefined) tx.bankAccountId = bankAccountId || undefined;
    if (currency) tx.currency = currency;
    if (notes !== undefined) tx.notes = notes || undefined;

    // Handle category change → recalc VAT
    if (expenseCategoryId !== undefined) {
      tx.expenseCategory = expenseCategoryId || null;
      tx.autoClassified = false;
      if (expenseCategoryId) {
        const cat = await ExpenseCategory.findById(expenseCategoryId).select('vatRate').lean();
        const vatRate = cat?.vatRate ?? 8.1;
        tx.vatRate = vatRate;
        tx.vatAmount = calcVatFromTTC(tx.amount, vatRate);
      } else {
        tx.vatRate = undefined;
        tx.vatAmount = undefined;
      }
    }

    await tx.save();

    const updated = await BankTransaction.findById(tx._id)
      .populate({ path: 'expenseCategory', select: 'name icon color accountNumber vatRate' })
      .populate({ path: 'bankAccountId', select: 'name color iban' })
      .lean();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/bank/transactions/:id
 * Delete a single transaction. Refuse if matched.
 */
export const deleteTransaction = async (req, res, next) => {
  try {
    const tx = await BankTransaction.findOne({ _id: req.params.id, userId: req.user._id });
    if (!tx) return res.status(404).json({ success: false, error: 'Transaction non trouvée' });

    if (tx.matchStatus === 'matched') {
      return res.status(400).json({ success: false, error: 'Impossible de supprimer une transaction rapprochée. Dissociez-la d\'abord.' });
    }

    const importId = tx.importId;
    const userId = tx.userId;
    await BankTransaction.deleteOne({ _id: tx._id });

    // Check if parent import is now empty → delete it, otherwise recalc counters
    const remaining = await BankTransaction.countDocuments({ importId, userId });
    if (remaining === 0) {
      await BankImport.deleteOne({ importId, userId });
    } else {
      await recalcImportCounters(importId, userId);
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/bank/import-csv/preview
 * Parse CSV and return headers + preview rows (no DB writes)
 */
export const previewCsv = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Fichier CSV requis' });
    }

    const { headers, rows } = parseCsvBuffer(req.file.buffer);

    res.json({
      success: true,
      data: {
        headers,
        preview: rows.slice(0, 5),
        totalRows: rows.length
      }
    });
  } catch (error) {
    if (error.message?.includes('CSV')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * POST /api/bank/import-csv/confirm
 * Re-parse CSV with column mapping and import transactions
 */
export const confirmCsvImport = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Fichier CSV requis' });
    }

    const userId = req.user._id;
    let mapping, options;
    try {
      mapping = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping;
      options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : (req.body.options || {});
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Mapping JSON invalide' });
    }

    if (!mapping?.date || !mapping?.amount) {
      return res.status(400).json({ success: false, error: 'Colonnes date et montant requises dans le mapping' });
    }

    const { headers, rows } = parseCsvBuffer(req.file.buffer);
    const colIdx = (name) => {
      const mapped = mapping[name];
      if (!mapped) return -1;
      const idx = headers.indexOf(mapped);
      return idx;
    };

    const dateIdx = colIdx('date');
    const amountIdx = colIdx('amount');
    const counterpartyIdx = colIdx('counterparty');
    const descriptionIdx = colIdx('description');

    if (dateIdx === -1 || amountIdx === -1) {
      return res.status(400).json({ success: false, error: 'Colonnes date ou montant introuvables dans le fichier' });
    }

    const importId = crypto.randomUUID();
    const filename = req.file.originalname || 'import.csv';
    const defaultCreditDebit = options.defaultCreditDebit || 'DBIT';
    const defaultCategoryId = options.defaultCategoryId || null;
    const bankAccountId = options.bankAccountId || null;

    // Pre-fetch category VAT if default category set
    let defaultVatFields = {};
    if (defaultCategoryId && defaultCreditDebit === 'DBIT') {
      const cat = await ExpenseCategory.findById(defaultCategoryId).select('vatRate').lean();
      const vatRate = cat?.vatRate ?? 8.1;
      defaultVatFields = { vatRate, expenseCategory: defaultCategoryId };
    }

    const errors = [];
    const created = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Parse date — support dd.MM.yyyy, dd/MM/yyyy, yyyy-MM-dd
        const rawDate = row[dateIdx];
        let bookingDate;
        if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
          bookingDate = new Date(rawDate);
        } else {
          const parts = rawDate.split(/[./]/);
          if (parts.length === 3) {
            bookingDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          }
        }
        if (!bookingDate || isNaN(bookingDate.getTime())) {
          errors.push({ row: i + 2, error: `Date invalide: "${rawDate}"` });
          continue;
        }

        // Parse amount — handle comma decimal separator
        const rawAmount = row[amountIdx].replace(/['\s]/g, '').replace(',', '.');
        const amount = Math.abs(parseFloat(rawAmount));
        if (!amount || isNaN(amount)) {
          errors.push({ row: i + 2, error: `Montant invalide: "${row[amountIdx]}"` });
          continue;
        }

        // Auto-detect DBIT if original amount is negative
        const originalAmount = parseFloat(rawAmount);
        const creditDebit = originalAmount < 0 ? 'DBIT' : defaultCreditDebit;

        let vatFields = {};
        if (creditDebit === 'DBIT' && defaultVatFields.vatRate) {
          vatFields = {
            expenseCategory: defaultVatFields.expenseCategory,
            vatRate: defaultVatFields.vatRate,
            vatAmount: calcVatFromTTC(amount, defaultVatFields.vatRate)
          };
        }

        const tx = await BankTransaction.create({
          importId,
          importFilename: filename,
          bookingDate,
          amount,
          currency: options.currency || 'CHF',
          creditDebit,
          counterpartyName: counterpartyIdx >= 0 ? (row[counterpartyIdx] || '') : '',
          unstructuredReference: descriptionIdx >= 0 ? (row[descriptionIdx] || '') : '',
          matchStatus: 'unmatched',
          bankAccountId: bankAccountId || undefined,
          ...vatFields,
          userId
        });
        created.push(tx);
      } catch (e) {
        errors.push({ row: i + 2, error: e.message });
      }
    }

    // Create import audit record
    if (created.length > 0) {
      await BankImport.create({
        importId,
        filename,
        fileType: 'csv',
        totalTransactions: created.length,
        unmatchedCount: created.length,
        bankAccountId: bankAccountId || undefined,
        userId
      });
    }

    res.json({
      success: true,
      data: {
        importId,
        imported: created.length,
        errors,
        totalRows: rows.length
      }
    });
  } catch (error) {
    if (error.message?.includes('CSV')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};

/**
 * GET /api/bank/recurring
 * List recurring charges. If ?refresh=true or no charges exist, run detection.
 */
export const getRecurringCharges = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let charges = await RecurringCharge.find({ userId })
      .populate({ path: 'expenseCategory', select: 'name color icon accountNumber' })
      .sort({ expectedAmount: -1 })
      .lean();

    // Auto-detect if no charges or refresh requested
    if (charges.length === 0 || req.query.refresh === 'true') {
      await detectRecurringCharges(userId);
      charges = await RecurringCharge.find({ userId })
        .populate({ path: 'expenseCategory', select: 'name color icon accountNumber' })
        .sort({ expectedAmount: -1 })
        .lean();
    }

    const active = charges.filter(c => c.isActive);
    const estimatedMonthly = active.reduce((sum, c) => {
      if (c.frequency === 'monthly') return sum + c.expectedAmount;
      if (c.frequency === 'quarterly') return sum + c.expectedAmount / 3;
      if (c.frequency === 'yearly') return sum + c.expectedAmount / 12;
      return sum;
    }, 0);

    res.json({
      success: true,
      data: {
        charges,
        summary: {
          total: charges.length,
          active: active.length,
          confirmed: charges.filter(c => c.isConfirmed).length,
          estimatedMonthly: Math.round(estimatedMonthly * 100) / 100
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/bank/recurring/:id
 * Update a recurring charge (confirm, deactivate, edit)
 */
export const updateRecurringCharge = async (req, res, next) => {
  try {
    const charge = await RecurringCharge.findOne({ _id: req.params.id, userId: req.user._id });
    if (!charge) return res.status(404).json({ success: false, error: 'Charge récurrente non trouvée' });

    const { isConfirmed, isActive, expectedAmount, frequency, dayOfMonth, expenseCategory } = req.body;

    if (isConfirmed !== undefined) charge.isConfirmed = isConfirmed;
    if (isActive !== undefined) charge.isActive = isActive;
    if (expectedAmount !== undefined) charge.expectedAmount = expectedAmount;
    if (frequency !== undefined) charge.frequency = frequency;
    if (dayOfMonth !== undefined) charge.dayOfMonth = dayOfMonth;
    if (expenseCategory !== undefined) charge.expenseCategory = expenseCategory || null;

    await charge.save();

    const updated = await RecurringCharge.findById(charge._id)
      .populate({ path: 'expenseCategory', select: 'name color icon accountNumber' })
      .lean();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/bank/recurring/:id
 * Delete a recurring charge
 */
export const deleteRecurringCharge = async (req, res, next) => {
  try {
    const result = await RecurringCharge.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Charge récurrente non trouvée' });
    }
    res.json({ success: true, data: { deleted: true } });
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
