import { SwissQRBill } from 'swissqrbill/pdf';

/**
 * QR-Bill Service for Swiss invoices
 * Integrates Swiss QR-Bill into PDF invoices
 */

/**
 * Add QR-Bill page to PDF document
 * @param {Object} doc - PDFKit document instance
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 */
export const addQRBillToDocument = async (doc, invoice, project, settings) => {
  try {
    // Verify IBAN is configured
    if (!settings.company?.iban) {
      console.log('QR-Bill skipped: No IBAN configured');
      return;
    }

    const company = settings.company || {};
    const client = project.client || {};

    // Add new page for QR-Bill
    doc.addPage({
      size: 'A4',
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    // Prepare QR-Bill data
    const qrBillData = {
      currency: 'CHF',
      amount: invoice.total,
      reference: invoice.number.replace(/[^0-9]/g, ''), // Remove non-numeric chars
      creditor: {
        name: company.name || 'SWIGS',
        address: company.address || '',
        zip: '', // Extract from address if needed
        city: '', // Extract from address if needed
        account: company.qrIban || company.iban,
        country: 'CH'
      },
      debtor: {
        name: client.name || '',
        address: client.address || '',
        zip: '', // Extract from address if needed
        city: '', // Extract from address if needed
        country: 'CH'
      },
      additionalInformation: `Facture ${invoice.number}`
    };

    // Create QR-Bill instance
    const qrBill = new SwissQRBill(qrBillData);

    // Attach to PDFKit document
    // SwissQRBill has built-in PDFKit integration
    qrBill.attachTo(doc);

    console.log(`QR-Bill added to invoice ${invoice.number}`);
  } catch (error) {
    // Don't fail the invoice generation if QR-Bill fails
    console.error('Error adding QR-Bill:', error);
  }
};
