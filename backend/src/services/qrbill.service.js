import { SwissQRBill as SwissQRBillPDF } from 'swissqrbill/pdf';
import { SwissQRBill as SwissQRBillSVG } from 'swissqrbill/svg';

/**
 * QR-Bill Service for Swiss invoices
 * Integrates Swiss QR-Bill into PDF invoices (PDFKit) or as inline SVG (Puppeteer)
 */

/**
 * Build common QR-Bill data object from invoice + settings
 */
const buildQRBillData = (invoice, project, settings) => {
  const company = settings.company || {};
  const client = project.client || {};

  return {
    currency: 'CHF',
    amount: invoice.total,
    reference: invoice.number.replace(/[^0-9]/g, ''), // Remove non-numeric chars
    creditor: {
      name: company.name || 'SWIGS',
      address: company.address || '',
      zip: '',
      city: '',
      account: company.qrIban || company.iban,
      country: 'CH'
    },
    debtor: {
      name: client.name || '',
      address: client.address || '',
      zip: '',
      city: '',
      country: 'CH'
    },
    additionalInformation: `Facture ${invoice.number}`
  };
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
