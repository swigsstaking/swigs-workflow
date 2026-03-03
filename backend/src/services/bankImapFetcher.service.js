import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';
import Settings from '../models/Settings.js';
import BankTransaction from '../models/BankTransaction.js';
import BankImport from '../models/BankImport.js';
import BankAccount from '../models/BankAccount.js';
import Invoice from '../models/Invoice.js';
import { parseCamtXml } from './camtParser.service.js';
import { parseBankNotificationEmail } from './bankEmailParser.service.js';
import { reconcileTransaction } from './reconciliation.service.js';
import { classifyTransaction } from './expenseClassifier.service.js';
import { historyService } from './historyService.js';
import { sendPaymentConfirmationEmail } from './email.service.js';
import { decrypt } from '../utils/crypto.js';
import cron from 'node-cron';

/**
 * Connect to IMAP, fetch new emails with XML camt attachments,
 * parse and reconcile automatically.
 */
async function fetchBankEmails(userId, bankImap) {
  const config = {
    imap: {
      user: bankImap.user,
      password: decrypt(bankImap.pass),
      host: bankImap.host,
      port: bankImap.port || 993,
      tls: bankImap.tls !== false,
      tlsOptions: { rejectUnauthorized: process.env.NODE_ENV !== 'production' ? false : true },
      authTimeout: 10000
    }
  };

  let connection;
  try {
    connection = await imapSimple.connect(config);
    const folder = bankImap.folder || 'INBOX';
    await connection.openBox(folder);

    // Search for unseen emails (or since last check)
    const searchCriteria = ['UNSEEN'];
    const fetchOptions = {
      bodies: [''],
      markSeen: false,  // Don't auto-mark; we mark manually after successful processing
      struct: true
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    if (messages.length === 0) {
      console.log(`[BankIMAP] No new emails for user ${userId}`);
      return { processed: 0 };
    }

    console.log(`[BankIMAP] Found ${messages.length} new email(s) for user ${userId}`);

    let totalProcessed = 0;

    for (const msg of messages) {
      try {
        const rawBody = msg.parts.find(p => p.which === '')?.body;
        if (!rawBody) continue;

        const parsed = await simpleParser(rawBody);
        const xmlAttachments = (parsed.attachments || []).filter(
          att => att.filename && att.filename.toLowerCase().endsWith('.xml')
        );

        let processed = false;
        const msgUid = msg.attributes?.uid;

        // Priority 1: XML camt attachments
        if (xmlAttachments.length > 0) {
          for (const att of xmlAttachments) {
            try {
              const result = await processXmlBuffer(att.content, att.filename, userId);
              if (result) { totalProcessed++; processed = true; }
            } catch (err) {
              console.error(`[BankIMAP] Error processing attachment ${att.filename}:`, err.message);
            }
          }
        } else {
          // Priority 2: Parse email body as bank notification
          try {
            const emailTx = parseBankNotificationEmail(parsed);
            if (emailTx) {
              // Dedup: check if this txId was already processed
              const exists = await BankTransaction.exists({ txId: emailTx.txId, userId });
              if (!exists) {
                const result = await processEmailTransaction(emailTx, parsed.subject || 'Bank notification', userId);
                if (result) { totalProcessed++; processed = true; }
              } else {
                processed = true; // Already processed, mark as seen
              }
            }
          } catch (err) {
            console.error(`[BankIMAP] Error parsing email notification:`, err.message);
          }
        }

        // Only mark as seen if we actually processed the email
        if (processed && msgUid) {
          try {
            await connection.addFlags(msgUid, ['\\Seen']);
          } catch (e) { /* non-blocking */ }
        }
      } catch (err) {
        console.error(`[BankIMAP] Error parsing email:`, err.message);
      }
    }

    // Update lastCheckedAt
    await Settings.findOneAndUpdate(
      { userId },
      { 'bankImap.lastCheckedAt': new Date() }
    );

    return { processed: totalProcessed };
  } finally {
    if (connection) {
      try { connection.end(); } catch (e) { /* ignore */ }
    }
  }
}

/**
 * Process a single XML buffer through the import pipeline
 */
async function processXmlBuffer(buffer, filename, userId) {
  const parsed = parseCamtXml(buffer);
  const { fileType, statementInfo, transactions } = parsed;

  if (transactions.length === 0) return null;

  const importId = crypto.randomUUID();
  const results = { matched: 0, suggested: 0, unmatched: 0 };

  // Resolve bankAccountId from statement IBAN
  let bankAccountId = null;
  if (statementInfo.iban) {
    const cleanIban = statementInfo.iban.replace(/\s/g, '').toUpperCase();
    const account = await BankAccount.findOne({ iban: cleanIban, userId });
    if (account) bankAccountId = account._id;
  }

  for (const tx of transactions) {
    const reconciliation = await reconcileTransaction(tx, userId);

    // Auto-classify DBIT
    let classification = null;
    if (tx.creditDebit === 'DBIT') {
      classification = await classifyTransaction(tx, userId);
    }

    await BankTransaction.create({
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

    // Auto-mark invoice as paid if confidence >= 80
    if (reconciliation.matchedInvoice && reconciliation.matchConfidence >= 80) {
      const invoice = await Invoice.findById(reconciliation.matchedInvoice).populate('project');
      if (invoice && invoice.status === 'sent') {
        invoice.status = 'paid';
        invoice.paidAt = tx.bookingDate;
        await invoice.save();

        try {
          await historyService.log(
            invoice.project._id || invoice.project,
            'bank_reconciled',
            `Facture ${invoice.number} marquée payée via import IMAP automatique (${reconciliation.matchMethod}, confiance ${reconciliation.matchConfidence}%)`,
            { importId, txId: tx.txId, amount: tx.amount, source: 'imap' }
          );
        } catch (e) { /* non-blocking */ }

        // Send payment confirmation email to client
        try {
          const userSettings = await Settings.findOne({ userId });
          if (userSettings?.smtp?.host) {
            await sendPaymentConfirmationEmail(invoice, userSettings);
            console.log(`[BankIMAP] Payment confirmation sent for ${invoice.number}`);
          }
        } catch (e) {
          console.error(`[BankIMAP] Payment confirmation email failed for ${invoice.number}:`, e.message);
        }
      }
    }

    if (reconciliation.matchStatus === 'matched') results.matched++;
    else if (reconciliation.matchStatus === 'suggested') results.suggested++;
    else results.unmatched++;
  }

  await BankImport.create({
    importId,
    filename: `[IMAP] ${filename}`,
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

  console.log(`[BankIMAP] Imported ${filename}: ${results.matched} matched, ${results.suggested} suggested, ${results.unmatched} unmatched`);
  return results;
}

/**
 * Process a single email notification through the reconciliation pipeline
 */
async function processEmailTransaction(tx, subject, userId) {
  const importId = crypto.randomUUID();
  const reconciliation = await reconcileTransaction(tx, userId);

  await BankTransaction.create({
    importId,
    importFilename: `[EMAIL] ${subject}`,
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
    userId
  });

  // Auto-mark invoice as paid if confidence >= 80
  if (reconciliation.matchedInvoice && reconciliation.matchConfidence >= 80) {
    const invoice = await Invoice.findById(reconciliation.matchedInvoice).populate('project');
    if (invoice && invoice.status === 'sent') {
      invoice.status = 'paid';
      invoice.paidAt = tx.bookingDate;
      await invoice.save();

      try {
        await historyService.log(
          invoice.project._id || invoice.project,
          'bank_reconciled',
          `Facture ${invoice.number} marquée payée via notification email bancaire (${reconciliation.matchMethod}, confiance ${reconciliation.matchConfidence}%)`,
          { importId, txId: tx.txId, amount: tx.amount, source: 'email_notification' }
        );
      } catch (e) { /* non-blocking */ }

      // Send payment confirmation email to client
      try {
        const userSettings = await Settings.findOne({ userId });
        if (userSettings?.smtp?.host) {
          await sendPaymentConfirmationEmail(invoice, userSettings);
          console.log(`[BankIMAP] Payment confirmation sent for ${invoice.number} (email notification)`);
        }
      } catch (e) {
        console.error(`[BankIMAP] Payment confirmation email failed for ${invoice.number}:`, e.message);
      }
    }
  }

  await BankImport.create({
    importId,
    filename: `[EMAIL] ${subject}`,
    fileType: 'email_notification',
    totalTransactions: 1,
    matchedCount: reconciliation.matchStatus === 'matched' ? 1 : 0,
    suggestedCount: reconciliation.matchStatus === 'suggested' ? 1 : 0,
    unmatchedCount: reconciliation.matchStatus === 'unmatched' ? 1 : 0,
    statementIban: null,
    statementOpeningBalance: null,
    statementClosingBalance: null,
    statementDate: tx.bookingDate,
    userId
  });

  const statusLabel = reconciliation.matchStatus === 'matched' ? 'matched' :
                      reconciliation.matchStatus === 'suggested' ? 'suggested' : 'unmatched';
  console.log(`[BankIMAP] Email notification: ${tx.amount} CHF from "${tx.counterpartyName}" → ${statusLabel}${reconciliation.matchedInvoice ? ` (confidence ${reconciliation.matchConfidence}%)` : ''}`);

  return true;
}

/**
 * Test IMAP connection
 */
export async function testImapConnection(imapConfig) {
  const config = {
    imap: {
      user: imapConfig.user,
      password: imapConfig.pass, // plain text for test
      host: imapConfig.host,
      port: imapConfig.port || 993,
      tls: imapConfig.tls !== false,
      tlsOptions: { rejectUnauthorized: process.env.NODE_ENV !== 'production' ? false : true },
      authTimeout: 10000
    }
  };

  let connection;
  try {
    connection = await imapSimple.connect(config);
    const folder = imapConfig.folder || 'INBOX';
    const box = await connection.openBox(folder);
    return { success: true, messageCount: box.messages?.total || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    if (connection) {
      try { connection.end(); } catch (e) { /* ignore */ }
    }
  }
}

/**
 * Run check for all users with bankImap enabled
 */
async function checkAllUsers() {
  try {
    const allSettings = await Settings.find({ 'bankImap.enabled': true });

    for (const settings of allSettings) {
      if (!settings.bankImap?.host || !settings.bankImap?.user || !settings.bankImap?.pass) continue;

      try {
        await fetchBankEmails(settings.userId, settings.bankImap);
      } catch (err) {
        console.error(`[BankIMAP] Error for user ${settings.userId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[BankIMAP] Error in checkAllUsers:', err.message);
  }
}

let isRunning = false;

/**
 * Initialize cron job — runs every hour at minute 30
 */
export function initBankImapCron() {
  cron.schedule('30 * * * *', async () => {
    if (isRunning) {
      console.log('[BankIMAP] Skipping — previous run still active');
      return;
    }
    isRunning = true;
    try {
      console.log('[BankIMAP] Running hourly check...');
      await checkAllUsers();
    } finally {
      isRunning = false;
    }
  });

  console.log('Bank IMAP service initialized (hourly check at :30)');
}

export { fetchBankEmails };
