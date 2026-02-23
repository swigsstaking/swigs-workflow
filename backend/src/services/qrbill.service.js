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
 * Build common QR-Bill data object from invoice + settings.
 * Conforms to Swiss QR-Bill standard (SIX Payment Services).
 */
const buildQRBillData = (invoice, project, settings) => {
  const company = settings.company || {};
  const client = project.client || {};
  const iban = company.qrIban || company.iban || '';

  // --- Creditor address ---
  // Prefer decomposed fields (street/zip/city), fall back to parsing legacy address string
  const creditorAddress = company.street || company.address?.split(',')[0]?.trim() || '';
  const creditorZip = company.zip || '';
  const creditorCity = company.city || '';
  const creditorCountry = company.country || 'CH';

  // --- Debtor address ---
  // Prefer decomposed fields on client, fall back to parsing legacy address string
  const clientAddress = client.street || client.address || '';
  const clientZip = client.zip || '';
  const clientCity = client.city || '';
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
      address: creditorAddress.substring(0, 70),
      zip: creditorZip,
      city: creditorCity.substring(0, 35),
      country: creditorCountry,
      account: iban
    },
    debtor: {
      name: (client.name || client.company || '').substring(0, 70),
      address: clientAddress.substring(0, 70),
      zip: clientZip,
      city: clientCity.substring(0, 35),
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
