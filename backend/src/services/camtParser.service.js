import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['Ntry', 'TxDtls', 'Stmt', 'Ntfctn'].includes(name)
});

/**
 * Parse camt.053 or camt.054 XML buffer
 * @param {Buffer} buffer - XML file content
 * @returns {{ fileType: string, statementInfo: object, transactions: object[] }}
 */
export function parseCamtXml(buffer) {
  const xml = buffer.toString('utf-8');
  const parsed = parser.parse(xml);

  // Detect file type
  const doc = parsed.Document || parsed['Document'];
  if (!doc) throw new Error('Format XML invalide: balise Document manquante');

  let fileType, statements;

  if (doc.BkToCstmrStmt) {
    fileType = 'camt.053';
    statements = doc.BkToCstmrStmt.Stmt || [];
  } else if (doc.BkToCstmrDbtCdtNtfctn) {
    fileType = 'camt.054';
    statements = doc.BkToCstmrDbtCdtNtfctn.Ntfctn || [];
  } else {
    throw new Error('Format non supporté: seuls camt.053 et camt.054 sont acceptés');
  }

  if (!Array.isArray(statements)) statements = [statements];

  const statementInfo = extractStatementInfo(statements[0], fileType);
  const transactions = [];

  for (const stmt of statements) {
    const entries = stmt.Ntry || [];
    for (const entry of entries) {
      const tx = extractTransaction(entry);
      if (tx) transactions.push(tx);
    }
  }

  return { fileType, statementInfo, transactions };
}

function extractStatementInfo(stmt, fileType) {
  if (!stmt) return {};

  const info = {};

  // Account IBAN
  const acct = stmt.Acct;
  if (acct?.Id?.IBAN) {
    info.iban = acct.Id.IBAN;
  }

  // Balances (camt.053 only)
  if (fileType === 'camt.053' && stmt.Bal) {
    const balances = Array.isArray(stmt.Bal) ? stmt.Bal : [stmt.Bal];
    for (const bal of balances) {
      const type = bal.Tp?.CdOrPrtry?.Cd;
      const amount = parseFloat(bal.Amt?.['#text'] || bal.Amt || 0);
      const creditDebit = bal.CdtDbtInd;
      const value = creditDebit === 'DBIT' ? -amount : amount;

      if (type === 'OPBD') info.openingBalance = value;
      if (type === 'CLBD') info.closingBalance = value;
    }
  }

  // Statement date
  if (stmt.CreDtTm) {
    info.date = new Date(stmt.CreDtTm);
  }

  return info;
}

function extractTransaction(entry) {
  const amount = parseFloat(entry.Amt?.['#text'] || entry.Amt || 0);
  if (!amount) return null;

  const creditDebit = entry.CdtDbtInd; // CRDT or DBIT

  // Booking date
  const bookingDate = entry.BookgDt?.Dt || entry.BookgDt?.DtTm || entry.ValDt?.Dt;
  if (!bookingDate) return null;

  // Transaction details (may be nested)
  const txDtls = entry.NtryDtls?.TxDtls;
  const detail = Array.isArray(txDtls) ? txDtls[0] : txDtls;

  // Transaction ID
  const txId = detail?.Refs?.EndToEndId || detail?.Refs?.InstrId || entry.NtryRef || null;

  // Counterparty
  let counterpartyName = null;
  let counterpartyIban = null;

  if (creditDebit === 'CRDT') {
    // Incoming: debtor is the counterparty
    counterpartyName = detail?.RltdPties?.Dbtr?.Nm || detail?.RltdPties?.Dbtr?.Pty?.Nm || null;
    counterpartyIban = detail?.RltdPties?.DbtrAcct?.Id?.IBAN || null;
  } else {
    // Outgoing: creditor is the counterparty
    counterpartyName = detail?.RltdPties?.Cdtr?.Nm || detail?.RltdPties?.Cdtr?.Pty?.Nm || null;
    counterpartyIban = detail?.RltdPties?.CdtrAcct?.Id?.IBAN || null;
  }

  // Structured reference (QR-Ref)
  const reference = detail?.RmtInf?.Strd?.CdtrRefInf?.Ref ||
    (Array.isArray(detail?.RmtInf?.Strd) ? detail.RmtInf.Strd[0]?.CdtrRefInf?.Ref : null) ||
    null;

  // Unstructured reference
  const ustrd = detail?.RmtInf?.Ustrd;
  const unstructuredReference = Array.isArray(ustrd) ? ustrd.join(' ') : (ustrd || null);

  // Currency
  const currency = entry.Amt?.['@_Ccy'] || 'CHF';

  return {
    txId,
    bookingDate: new Date(bookingDate),
    amount,
    currency,
    creditDebit,
    counterpartyName,
    counterpartyIban,
    reference,
    unstructuredReference
  };
}
