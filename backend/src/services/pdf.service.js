import PDFDocument from 'pdfkit';
import { addQRBillToDocument } from './qrbill.service.js';

/**
 * PDF Service for generating invoices and quotes
 */

/**
 * Format currency (CHF)
 */
const formatCurrency = (amount) => {
  return `${amount.toFixed(2)} CHF`;
};

/**
 * Format date
 */
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-CH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Add company header to PDF
 */
const addHeader = (doc, settings, documentType, documentNumber) => {
  const company = settings.company || {};

  // Logo (if exists)
  if (company.logo) {
    try {
      doc.image(company.logo, 50, 50, { width: 80 });
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  // Company info (top right)
  doc.fontSize(10)
    .text(company.name || 'SWIGS', 400, 50, { align: 'right' })
    .text(company.address || '', 400, 65, { align: 'right' })
    .text(company.email || '', 400, 80, { align: 'right' })
    .text(company.phone || '', 400, 95, { align: 'right' });

  if (company.siret) {
    doc.text(`SIRET: ${company.siret}`, 400, 110, { align: 'right' });
  }
  if (company.vatNumber) {
    doc.text(`TVA: ${company.vatNumber}`, 400, 125, { align: 'right' });
  }

  // Document title
  doc.fontSize(24)
    .font('Helvetica-Bold')
    .text(documentType, 50, 160);

  // Document number
  doc.fontSize(14)
    .font('Helvetica')
    .text(documentNumber, 50, 190);

  doc.moveDown(2);
};

/**
 * Add client info to PDF
 */
const addClientInfo = (doc, project) => {
  const client = project.client || {};

  doc.fontSize(12)
    .font('Helvetica-Bold')
    .text('Client:', 50, 230);

  doc.fontSize(10)
    .font('Helvetica')
    .text(client.name || '-', 50, 245)
    .text(client.email || '', 50, 260)
    .text(client.phone || '', 50, 275);

  if (project.name) {
    doc.fontSize(10)
      .font('Helvetica-Bold')
      .text('Projet:', 50, 295)
      .font('Helvetica')
      .text(project.name, 50, 310);
  }

  doc.moveDown(2);
};

/**
 * Add invoice/quote lines table
 */
const addLinesTable = (doc, lines, yPosition = 350) => {
  const tableTop = yPosition;
  const descriptionX = 50;
  const quantityX = 320;
  const unitPriceX = 390;
  const totalX = 480;

  // Table header
  doc.fontSize(10)
    .font('Helvetica-Bold')
    .text('Description', descriptionX, tableTop)
    .text('Qté', quantityX, tableTop)
    .text('Prix unit.', unitPriceX, tableTop)
    .text('Total', totalX, tableTop);

  // Header line
  doc.moveTo(descriptionX, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke();

  let yPos = tableTop + 25;
  doc.font('Helvetica');

  // Table rows
  for (const line of lines) {
    // Check if we need a new page
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }

    doc.fontSize(9)
      .text(line.description, descriptionX, yPos, { width: 250 })
      .text((line.quantity || 1).toString(), quantityX, yPos)
      .text(formatCurrency(line.unitPrice), unitPriceX, yPos)
      .text(formatCurrency(line.total), totalX, yPos);

    yPos += 20;
  }

  return yPos + 10;
};

/**
 * Add totals section
 */
const addTotals = (doc, subtotal, vatRate, vatAmount, total, yPosition) => {
  const labelX = 380;
  const valueX = 480;
  let yPos = yPosition + 20;

  doc.fontSize(10)
    .font('Helvetica')
    .text('Sous-total HT:', labelX, yPos)
    .text(formatCurrency(subtotal), valueX, yPos);

  yPos += 20;
  doc.text(`TVA (${vatRate}%):`, labelX, yPos)
    .text(formatCurrency(vatAmount), valueX, yPos);

  yPos += 20;
  doc.fontSize(12)
    .font('Helvetica-Bold')
    .text('Total TTC:', labelX, yPos)
    .text(formatCurrency(total), valueX, yPos);

  return yPos + 40;
};

/**
 * Add notes section
 */
const addNotes = (doc, notes, yPosition) => {
  if (!notes) return yPosition;

  // Check if we need a new page
  if (yPosition > 650) {
    doc.addPage();
    yPosition = 50;
  }

  doc.fontSize(10)
    .font('Helvetica-Bold')
    .text('Notes:', 50, yPosition);

  doc.fontSize(9)
    .font('Helvetica')
    .text(notes, 50, yPosition + 15, { width: 500 });

  return yPosition + 80;
};

/**
 * Add footer
 */
const addFooter = (doc, settings) => {
  const company = settings.company || {};

  doc.fontSize(8)
    .font('Helvetica')
    .text(
      `${company.name || 'SWIGS'} - ${company.address || ''} - ${company.email || ''}`,
      50,
      750,
      { align: 'center', width: 500 }
    );
};

/**
 * Generate invoice PDF
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @returns {Buffer} PDF buffer
 */
export const generateInvoicePDF = async (invoice, project, settings) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      addHeader(doc, settings, 'FACTURE', invoice.number);

      // Dates
      doc.fontSize(10)
        .font('Helvetica')
        .text(`Date d'émission: ${formatDate(invoice.issueDate)}`, 400, 230, { align: 'right' })
        .text(`Date d'échéance: ${formatDate(invoice.dueDate)}`, 400, 245, { align: 'right' });

      if (invoice.status === 'paid' && invoice.paidAt) {
        doc.text(`Payée le: ${formatDate(invoice.paidAt)}`, 400, 260, { align: 'right', color: 'green' });
      }

      // Client info
      addClientInfo(doc, project);

      // Lines table
      let yPos = 350;
      const lines = [];

      // Add events (for standard invoices)
      if (invoice.events && invoice.events.length > 0) {
        for (const event of invoice.events) {
          let description = event.description;
          if (event.type === 'hours') {
            description = `${description} (${event.hours}h × ${formatCurrency(event.hourlyRate)})`;
          }
          lines.push({
            description,
            quantity: event.type === 'hours' ? event.hours : 1,
            unitPrice: event.type === 'hours' ? event.hourlyRate : event.amount,
            total: event.amount
          });
        }
      }

      // Add quote lines (for standard invoices)
      if (invoice.quotes && invoice.quotes.length > 0) {
        for (const quoteSnapshot of invoice.quotes) {
          const prefix = quoteSnapshot.isPartial
            ? `[Partiel] Devis ${quoteSnapshot.number} - `
            : `Devis ${quoteSnapshot.number} - `;

          for (const line of quoteSnapshot.lines) {
            lines.push({
              description: prefix + line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              total: line.total
            });
          }

          // Add partial payment note if applicable
          if (quoteSnapshot.isPartial && quoteSnapshot.invoicedAmount) {
            lines.push({
              description: `  → Paiement partiel (${formatCurrency(quoteSnapshot.invoicedAmount)} sur ${formatCurrency(quoteSnapshot.subtotal)})`,
              quantity: 1,
              unitPrice: 0,
              total: 0
            });
          }
        }
      }

      // Add custom lines (for custom invoices)
      if (invoice.customLines && invoice.customLines.length > 0) {
        lines.push(...invoice.customLines);
      }

      yPos = addLinesTable(doc, lines, yPos);

      // Totals
      yPos = addTotals(doc, invoice.subtotal, invoice.vatRate, invoice.vatAmount, invoice.total, yPos);

      // Notes
      yPos = addNotes(doc, invoice.notes, yPos);

      // Payment terms
      const paymentTerms = settings.invoicing?.defaultPaymentTerms || 30;
      if (invoice.status !== 'paid') {
        doc.fontSize(9)
          .font('Helvetica-Bold')
          .text(`Paiement à ${paymentTerms} jours`, 50, yPos, { align: 'center' });
      }

      // Footer
      addFooter(doc, settings);

      // Add QR-Bill if IBAN is configured
      if (settings.company?.iban) {
        addQRBillToDocument(doc, invoice, project, settings)
          .then(() => doc.end())
          .catch((err) => {
            console.error('QR-Bill error, generating PDF without it:', err.message);
            doc.end();
          });
      } else {
        doc.end();
      }
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate quote PDF
 * @param {Object} quote - Quote document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @returns {Buffer} PDF buffer
 */
export const generateQuotePDF = async (quote, project, settings) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      addHeader(doc, settings, 'DEVIS', quote.number);

      // Dates
      doc.fontSize(10)
        .font('Helvetica')
        .text(`Date d'émission: ${formatDate(quote.issueDate)}`, 400, 230, { align: 'right' })
        .text(`Valide jusqu'au: ${formatDate(quote.validUntil)}`, 400, 245, { align: 'right' });

      if (quote.status === 'signed' && quote.signedAt) {
        doc.text(`Signé le: ${formatDate(quote.signedAt)}`, 400, 260, { align: 'right', color: 'green' });
      }

      // Client info
      addClientInfo(doc, project);

      // Lines table
      let yPos = 350;
      yPos = addLinesTable(doc, quote.lines, yPos);

      // Totals
      yPos = addTotals(doc, quote.subtotal, quote.vatRate, quote.vatAmount, quote.total, yPos);

      // Notes
      yPos = addNotes(doc, quote.notes, yPos);

      // Validity note
      doc.fontSize(9)
        .font('Helvetica-Bold')
        .text(`Ce devis est valide jusqu'au ${formatDate(quote.validUntil)}`, 50, yPos, { align: 'center' });

      // Footer
      addFooter(doc, settings);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
