import crypto from 'crypto';

/**
 * Parse Swiss bank notification emails into transaction-like objects.
 * Supports multilingual emails (FR, DE, EN, IT) from all major Swiss banks:
 * Raiffeisen, UBS, PostFinance, Cantonal banks (BCV, ZKB, BCGE, etc.), Migros Bank, etc.
 *
 * @param {Object} parsedEmail - Output from mailparser's simpleParser
 * @returns {Object|null} Transaction object compatible with reconciliation, or null
 */
export function parseBankNotificationEmail(parsedEmail) {
  const text = parsedEmail.text || '';
  const subject = parsedEmail.subject || '';
  const html = parsedEmail.html || '';

  // Use text body primarily, fall back to stripping HTML
  const body = text || stripHtml(html);
  if (!body || body.length < 30) return null;

  // Step 1: Detect credit or debit
  const creditDebit = detectCreditDebit(body, subject);
  if (!creditDebit) return null;

  // Step 2: Extract amount
  const amount = extractAmount(body);
  if (!amount) return null;

  // Step 3: Extract date
  const bookingDate = extractDate(body);
  if (!bookingDate) return null;

  // Step 4: Extract counterparty name
  const counterpartyName = extractCounterparty(body);

  // Step 5: Extract references
  const { reference, unstructuredReference } = extractReferences(body);

  // Step 6: Generate unique txId from email to prevent duplicates
  const messageId = parsedEmail.messageId || `${subject}|${parsedEmail.date}`;
  const txId = crypto.createHash('sha256')
    .update(`${messageId}|${amount}|${bookingDate.toISOString()}`)
    .digest('hex')
    .substring(0, 24);

  return {
    txId,
    bookingDate,
    amount,
    currency: 'CHF',
    creditDebit,
    counterpartyName: counterpartyName || '',
    counterpartyIban: null,
    reference,
    unstructuredReference,
    _emailSubject: subject
  };
}

// ---------------------------------------------------------------------------
// Credit / Debit detection
// ---------------------------------------------------------------------------

function detectCreditDebit(body, subject) {
  const combined = `${subject}\n${body}`;

  const creditPatterns = [
    /cr[ée]dit[ée]?/i,
    /gutgeschrieben/i,
    /gutschrift/i,
    /credited/i,
    /accreditato/i,
    /zahlungseingang/i,
    /montant.*a\s+[ée]t[ée]\s+cr[ée]dit[ée]/i,
    /betrag.*gutgeschrieben/i,
    /einzahlung/i,
    /versement/i,
    /bonification/i
  ];

  const debitPatterns = [
    /d[ée]bit[ée]?/i,
    /belastet/i,
    /belastung/i,
    /debited/i,
    /addebito/i,
    /zahlungsausgang/i,
    /pr[ée]l[eè]vement/i,
    /retrait/i
  ];

  for (const p of creditPatterns) {
    if (p.test(combined)) return 'CRDT';
  }
  for (const p of debitPatterns) {
    if (p.test(combined)) return 'DBIT';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Amount extraction
// ---------------------------------------------------------------------------

function extractAmount(body) {
  // Labeled "Montant:", "Betrag:", "Amount:", "Importo:" — most reliable
  const labeledPatterns = [
    /(?:Montant|Betrag|Amount|Importo)\s*:\s*(?:CHF\s*)?([\d'''`,]+\.\d{2})/i,
    /(?:Montant|Betrag|Amount|Importo)\s*:\s*CHF\s*([\d'''`,]+\.\d{2})/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = body.match(pattern);
    if (match) return parseSwissAmount(match[1]);
  }

  // Line-by-line: find CHF amounts but skip balance/solde lines
  const lines = body.split('\n');
  for (const line of lines) {
    if (/solde|saldo|balance|guthaben|kontostand/i.test(line)) continue;

    const chfMatch = line.match(/CHF\s*([\d'''`,]+\.\d{2})/i) ||
                     line.match(/([\d'''`,]+\.\d{2})\s*CHF/i);
    if (chfMatch) {
      const amount = parseSwissAmount(chfMatch[1]);
      if (amount > 0 && amount < 10_000_000) return amount;
    }
  }

  return null;
}

function parseSwissAmount(str) {
  // Swiss format: 1'621.50 or 1'621.50 or 1,621.50 (thousands) or 1`621.50
  return parseFloat(str.replace(/['''`,]/g, ''));
}

// ---------------------------------------------------------------------------
// Date extraction
// ---------------------------------------------------------------------------

function extractDate(body) {
  // Labeled dates (highest priority)
  const labeledPatterns = [
    /(?:Date\s+comptable|Date\s+de\s+valeur|Buchungsdatum|Valutadatum|Booking\s+date|Data\s+contabile|Data\s+di\s+valuta|Wertstellungsdatum)\s*:\s*(\d{2}\.\d{2}\.\d{4})/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = body.match(pattern);
    if (match) return parseSwissDate(match[1]);
  }

  // Fallback: "le DD.MM.YYYY" or "am DD.MM.YYYY"
  const contextMatch = body.match(/(?:le|am|on|il)\s+(\d{2}\.\d{2}\.\d{4})/i);
  if (contextMatch) return parseSwissDate(contextMatch[1]);

  // Last resort: first DD.MM.YYYY in the body
  const genericMatch = body.match(/(\d{2}\.\d{2}\.\d{4})/);
  if (genericMatch) return parseSwissDate(genericMatch[1]);

  return null;
}

function parseSwissDate(str) {
  const [day, month, year] = str.split('.');
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  // Sanity check
  if (isNaN(d.getTime())) return null;
  return d;
}

// ---------------------------------------------------------------------------
// Counterparty extraction
// ---------------------------------------------------------------------------

function extractCounterparty(body) {
  // Raiffeisen: "Crédit (SCOR) Name" or "Crédit (QRR) Name"
  const creditLineMatch = body.match(/Cr[ée]dit\s*\([^)]+\)\s+(.+)/i);
  if (creditLineMatch) return creditLineMatch[1].trim();

  // "Donneur d'ordre:" / "Auftraggeber:" / "Ordering party:"
  const orderingPatterns = [
    /(?:Donneur\s+d['']ordre|Auftraggeber|Ordering\s+party|Ordinante)\s*:\s*(.+)/i,
    /(?:Expéditeur|Absender|Sender|Mittente)\s*:\s*(.+)/i,
  ];
  for (const p of orderingPatterns) {
    const m = body.match(p);
    if (m && m[1].trim().length > 2) return m[1].trim();
  }

  // "De:" / "Von:" / "From:" (careful: skip email headers)
  const fromMatch = body.match(/^(?:De|Von|From|Da)\s*:\s*([^<\n]+)/im);
  if (fromMatch) {
    const name = fromMatch[1].trim();
    if (name.length > 2 && name.length < 100 && !name.includes('@')) return name;
  }

  // Détails section — first meaningful line
  const detailsMatch = body.match(/D[ée]tails?\s*:\s*\n\s*(?:Cr[ée]dit\s*\([^)]+\)\s+)?(.+)/i);
  if (detailsMatch) {
    const line = detailsMatch[1].trim();
    if (line.length > 2 && line.length < 150) return line;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Reference extraction
// ---------------------------------------------------------------------------

function extractReferences(body) {
  let reference = null;
  let parts = [];

  // SCOR reference (RF + alphanumeric, ISO 11649)
  const scorMatch = body.match(/(RF\d{2}[A-Z0-9]{4,})/i);
  if (scorMatch) reference = scorMatch[1].toUpperCase();

  // QR reference (26-27 digit number, not preceded by "solde" context)
  if (!reference) {
    const qrMatch = body.match(/(?<!\d)((?:00|21|23|31)\d{23,25})(?!\d)/);
    if (qrMatch) reference = qrMatch[1];
  }

  // Invoice patterns: FAC-YYYY-NNN
  const facMatch = body.match(/(FAC-\d{4}-\d{3})/i);
  if (facMatch) parts.push(facMatch[1].toUpperCase());

  // "Payé pour:" / "Bezahlt für:" / "Paid for:" section
  const payForMatch = body.match(/(?:Pay[ée]\s+pour|Bezahlt\s+f[üu]r|Paid\s+for|Pagato\s+per)\s*:\s*([^,\n]+)/i);
  if (payForMatch) parts.push(payForMatch[1].trim());

  // Short reference patterns like "R0010 du 19.01.2026" or "Rech. 2026-001"
  const shortRefMatch = body.match(/\b(R\d{4,}(?:\s+du\s+\d{2}\.\d{2}\.\d{4})?)\b/i);
  if (shortRefMatch) parts.push(shortRefMatch[1]);

  // "Référence:" / "Referenz:" / "Reference:" labeled
  const labeledRefMatch = body.match(/(?:R[ée]f[ée]rence|Referenz|Reference|Riferimento)\s*:\s*([^\n,]+)/i);
  if (labeledRefMatch && !reference) {
    const val = labeledRefMatch[1].trim();
    if (/^RF/i.test(val)) reference = val.toUpperCase();
    else parts.push(val);
  }

  // Full "Détails:" section as unstructured reference
  const detailsSection = body.match(/(?:D[ée]tails?|Details?|Einzelheiten|Dettagli)\s*:\s*([\s\S]*?)(?:\n\s*\n|Avec\s+nos|Mit\s+freundlichen|Best\s+regards|Cordiali|Remarque|Hinweis|\*{3,})/i);
  if (detailsSection) {
    const details = detailsSection[1].replace(/\s+/g, ' ').trim();
    if (details.length > 3) parts.push(details);
  }

  // Deduplicate and join
  const uniqueParts = [...new Set(parts)].filter(Boolean);
  const unstructuredReference = uniqueParts.length > 0 ? uniqueParts.join(' | ') : null;

  return { reference, unstructuredReference };
}

// ---------------------------------------------------------------------------
// HTML stripping helper
// ---------------------------------------------------------------------------

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#?\w+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
