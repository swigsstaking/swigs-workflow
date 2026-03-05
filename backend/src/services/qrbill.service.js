import { SwissQRBill as SwissQRBillPDF } from 'swissqrbill/pdf';
import { SwissQRBill as SwissQRBillSVG } from 'swissqrbill/svg';

/**
 * QR-Bill Service for Swiss invoices
 * Integrates Swiss QR-Bill into PDF invoices (PDFKit) or as inline SVG (Puppeteer)
 */

/**
 * Generate a valid QR-Reference (27 digits) for QR-IBAN accounts.
 * Uses mod 10 recursive checksum algorithm as per Swiss payment standards.
 */
function generateQRReference(invoiceNumber) {
  const digits = invoiceNumber.replace(/[^0-9]/g, '');
  const padded = digits.padStart(26, '0');
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const digit of padded) {
    carry = table[(carry + parseInt(digit, 10)) % 10];
  }
  const checkDigit = (10 - carry) % 10;
  return padded + checkDigit;
}

/**
 * Detect whether an IBAN is a Swiss QR-IBAN.
 * QR-IBANs: CH or LI, bank clearing number in range 30000–31999 (positions 5-9).
 */
function isQRIBAN(iban) {
  const normalized = (iban || '').replace(/\s/g, '').toUpperCase();
  return /^(CH|LI)\d{2}3[01]\d{3}/.test(normalized);
}

/**
 * Parse a Swiss legacy address string into structured components.
 * Handles formats like:
 *   "Chemin de l'Alouette Lulu 24 1955 St-Pierre-de-Clages"
 *   "rue de la Drague 18 1950 sion"
 *   "Rue de Lausanne 15, 1950 Sion"
 *   "Route de Saclentse 385, CH-1996 Saclentse"
 * Returns { street, zip, city } or null if parsing fails.
 */
function parseSwissAddress(addressStr) {
  if (!addressStr || !addressStr.trim()) return null;
  const addr = addressStr.trim().replace(/,/g, ' ');
  // Swiss postal codes are 4 digits, optionally prefixed with CH- or CH
  const match = addr.match(/^(.+?)\s+(?:CH[- ]?)?(\d{4})\s+(.+)$/i);
  if (match) {
    return {
      street: match[1].trim(),
      zip: match[2],
      city: match[3].trim()
    };
  }
  return null;
}

/**
 * Resolve address fields: use structured (street/zip/city) if available,
 * otherwise parse the legacy address string.
 * Swiss QR-Bill requires non-empty zip + city for a valid structured address.
 */
function resolveAddress(entity) {
  const street = entity.street?.trim() || '';
  const zip = entity.zip?.toString().trim() || '';
  const city = entity.city?.trim() || '';

  if (zip && city) {
    return { address: street, zip, city };
  }

  // Try parsing legacy address field
  const legacy = entity.address?.trim() || '';
  const parsed = parseSwissAddress(legacy);
  if (parsed) {
    return { address: parsed.street, zip: parsed.zip, city: parsed.city };
  }

  // Last resort: put entire legacy address as street, use placeholder zip/city
  // A QR-Bill with empty zip/city will not scan — use "0000" / "-" as minimal fallback
  if (legacy) {
    return { address: legacy, zip: '0000', city: '-' };
  }

  return { address: street || '-', zip: zip || '0000', city: city || '-' };
}

/**
 * Build common QR-Bill data object from invoice + settings.
 * Conforms to Swiss QR-Bill standard (SIX Payment Services).
 */
const buildQRBillData = (invoice, project, settings) => {
  const company = settings.company || {};
  const client = project.client || {};
  const iban = (company.qrIban || company.iban || '').replace(/\s/g, '');

  // --- Resolve addresses (structured fields or parsed from legacy string) ---
  const creditor = resolveAddress(company);
  const debtor = resolveAddress(client);
  const creditorCountry = company.country || 'CH';
  const clientCountry = client.country || 'CH';

  // --- Reference ---
  // QR-IBAN requires a valid 27-digit QR-Reference (type QRR).
  // Regular IBAN must NOT include a QR-Reference — omit reference entirely (type NON).
  let reference;
  if (isQRIBAN(iban)) {
    reference = generateQRReference(invoice.number);
  }
  // For regular IBAN: leave reference undefined (NON type, no structured reference)

  const data = {
    currency: 'CHF',
    amount: invoice.total,
    creditor: {
      name: (company.name || 'SWIGS').substring(0, 70),
      address: creditor.address.substring(0, 70),
      zip: creditor.zip,
      city: creditor.city.substring(0, 35),
      country: creditorCountry,
      account: iban
    },
    debtor: {
      name: (client.name || client.company || '').substring(0, 70),
      address: debtor.address.substring(0, 70),
      zip: debtor.zip,
      city: debtor.city.substring(0, 35),
      country: clientCountry
    },
    additionalInformation: `Facture ${invoice.number}`.substring(0, 140)
  };

  if (reference !== undefined) {
    data.reference = reference;
  }

  return data;
};

/**
 * Add QR-Bill page to PDFKit document (legacy PDFKit integration)
 * @param {Object} doc - PDFKit document instance
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 */
export const addQRBillToDocument = async (doc, invoice, project, settings) => {
  try {
    if (!settings.company?.iban) {
      console.log('QR-Bill skipped: No IBAN configured');
      return;
    }

    // Add new page for QR-Bill
    doc.addPage({
      size: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    const qrBillData = buildQRBillData(invoice, project, settings);

    // Create QR-Bill instance (PDFKit variant)
    const qrBill = new SwissQRBillPDF(qrBillData);
    qrBill.attachTo(doc);

    console.log(`QR-Bill added to invoice ${invoice.number}`);
  } catch (error) {
    console.error('Error adding QR-Bill:', error);
  }
};

/**
 * Generate QR-Bill as inline SVG string for embedding in HTML/Puppeteer templates
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @returns {Promise<string>} SVG string or empty string if IBAN not configured
 */
export const generateQRBillSVG = async (invoice, project, settings) => {
  try {
    if (!settings.company?.iban) {
      console.log('QR-Bill SVG skipped: No IBAN configured');
      return '';
    }

    const qrBillData = buildQRBillData(invoice, project, settings);

    const qrBill = new SwissQRBillSVG(qrBillData, {
      language: 'FR',
      outlines: true,
      scissors: true
    });

    const svgString = qrBill.toString();
    console.log(`QR-Bill SVG generated for invoice ${invoice.number}`);
    return svgString;
  } catch (error) {
    console.error('Error generating QR-Bill SVG:', error);
    return '';
  }
};
