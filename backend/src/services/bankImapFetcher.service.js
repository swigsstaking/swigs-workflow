import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';
import Settings from '../models/Settings.js';
import BankTransaction from '../models/BankTransaction.js';
import BankImport from '../models/BankImport.js';
import Invoice from '../models/Invoice.js';
import { parseCamtXml } from './camtParser.service.js';
import { reconcileTransaction } from './reconciliation.service.js';
import { historyService } from './historyService.js';
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
      tlsOptions: { rejectUnauthorized: false },
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
      markSeen: true,
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

        if (xmlAttachments.length === 0) continue;

        for (const att of xmlAttachments) {
          try {
            const result = await processXmlBuffer(att.content, att.filename, userId);
            if (result) totalProcessed++;
          } catch (err) {
            console.error(`[BankIMAP] Error processing attachment ${att.filename}:`, err.message);
          }
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

  for (const tx of transactions) {
    const reconciliation = await reconcileTransaction(tx, userId);

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
    userId
  });

  console.log(`[BankIMAP] Imported ${filename}: ${results.matched} matched, ${results.suggested} suggested, ${results.unmatched} unmatched`);
  return results;
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
      tlsOptions: { rejectUnauthorized: false },
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

/**
 * Initialize cron job — runs every hour at minute 30
 */
export function initBankImapCron() {
  cron.schedule('30 * * * *', () => {
    console.log('[BankIMAP] Running hourly check...');
    checkAllUsers();
  });

  console.log('Bank IMAP service initialized (hourly check at :30)');
}

export { fetchBankEmails };
