import { renderPDF, renderHTML } from './pdfTemplates/renderer.js';
import { generateQRBillSVG } from './qrbill.service.js';

/**
 * PDF Service — Puppeteer + Handlebars HTML→PDF generation
 * Replaces the legacy PDFKit implementation (see pdf.service.legacy.js)
 */

/**
 * Default design settings (used when settings.invoiceDesign is not configured)
 */
const DEFAULT_DESIGN = {
  template: 'modern',
  primaryColor: '#1a56a0',
  accentColor: '#0e3d7a',
  fontFamily: 'Helvetica',
  showLogo: true,
  logoPosition: 'left',
  logoSize: 18,
  logoOffsetX: 0,
  logoOffsetY: 0,
  showCompanyName: true,
  showCompanyAddress: true,
  showCompanyContact: true,
  showVatNumber: true,
  showSiret: true,
  showIban: false,
  showQrBill: true,
  showProjectName: true,
  showPaymentTerms: true,
  showDateBlock: true,
  tableHeaderStyle: 'colored',
  footerText: null,
  headerText: null,
  notesTemplate: null,
  labelInvoice: 'Facture',
  labelQuote: 'Devis',
  labelServices: 'Prestations'
};

/**
 * Merge design settings with defaults
 */
const getDesign = (settings) => {
  const invoiceDesign = settings.invoiceDesign?.toObject
    ? settings.invoiceDesign.toObject()
    : (settings.invoiceDesign || {});
  // Remove Mongoose internal fields
  delete invoiceDesign._id;
  return { ...DEFAULT_DESIGN, ...invoiceDesign };
};

/**
 * Build common company block from settings
 */
const buildCompany = (settings) => {
  const company = settings.company || {};
  return {
    name: company.name || 'SWIGS',
    address: company.address || '',
    email: company.email || '',
    phone: company.phone || '',
    siret: company.siret || '',
    vatNumber: company.vatNumber || '',
    iban: company.iban || '',
    logo: company.logo || null  // base64 data URI
  };
};

/**
 * Build client block from project
 */
const buildClient = (project) => {
  const client = project.client || {};
  return {
    name: client.name || '-',
    email: client.email || '',
    phone: client.phone || '',
    address: client.address || ''
  };
};

/**
 * Build lines array from invoice (events snapshots, quote snapshots, custom lines)
 */
const buildInvoiceLines = (invoice) => {
  const lines = [];

  // Events (hours / actions / expenses)
  if (invoice.events && invoice.events.length > 0) {
    for (const event of invoice.events) {
      let description = event.description;
      let detail = null;
      if (event.type === 'hours') {
        detail = `${event.hours}h × ${new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2 }).format(event.hourlyRate)} CHF/h`;
      }
      lines.push({
        description,
        detail,
        quantity: event.type === 'hours' ? event.hours : 1,
        unitPrice: event.type === 'hours' ? event.hourlyRate : (event.amount || 0),
        total: event.amount || 0
      });
    }
  }

  // Quote snapshots
  if (invoice.quotes && invoice.quotes.length > 0) {
    for (const quoteSnapshot of invoice.quotes) {
      const prefix = quoteSnapshot.isPartial
        ? `[Partiel] Devis ${quoteSnapshot.number} — `
        : `Devis ${quoteSnapshot.number} — `;

      for (const line of quoteSnapshot.lines) {
        lines.push({
          description: prefix + line.description,
          detail: null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.total
        });
      }

      if (quoteSnapshot.isPartial && quoteSnapshot.invoicedAmount) {
        const fmt = (n) => new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2 }).format(n);
        lines.push({
          description: `Paiement partiel (${fmt(quoteSnapshot.invoicedAmount)} CHF sur ${fmt(quoteSnapshot.subtotal)} CHF)`,
          detail: null,
          quantity: 1,
          unitPrice: 0,
          total: 0
        });
      }
    }
  }

  // Custom lines
  if (invoice.customLines && invoice.customLines.length > 0) {
    for (const line of invoice.customLines) {
      lines.push({
        description: line.description,
        detail: null,
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice || 0,
        total: line.total || 0
      });
    }
  }

  return lines;
};

/**
 * Build lines array from quote
 */
const buildQuoteLines = (quote) => {
  if (!quote.lines || quote.lines.length === 0) return [];
  return quote.lines.map(line => ({
    description: line.description,
    detail: null,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: line.total
  }));
};

/**
 * Generate invoice PDF
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateInvoicePDF = async (invoice, project, settings) => {
  const design = getDesign(settings);
  const vatRate = invoice.vatRate ?? settings.invoicing?.defaultVatRate ?? 8.1;

  // Generate QR-Bill SVG if IBAN configured and showQrBill enabled
  let qrBillSvg = '';
  if (design.showQrBill && settings.company?.iban) {
    qrBillSvg = await generateQRBillSVG(invoice, project, settings);
  }

  const data = {
    company: buildCompany(settings),
    client: buildClient(project),
    project: {
      name: project.name || ''
    },
    document: {
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paidAt: invoice.status === 'paid' ? invoice.paidAt : null,
      status: invoice.status,
      notes: invoice.notes || null,
      paymentTerms: settings.invoicing?.defaultPaymentTerms || null
    },
    lines: buildInvoiceLines(invoice),
    totals: {
      subtotal: invoice.subtotal || 0,
      vatRate,
      vatAmount: invoice.vatAmount || 0,
      total: invoice.total || 0
    },
    design,
    qrBillSvg
  };

  return renderPDF('invoice', data);
};

/**
 * Generate reminder PDF
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @param {Object} reminderInfo - Reminder info { tier: 'reminder_1'|'reminder_2'|'reminder_3'|'final_notice', daysOverdue: Number }
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateReminderPDF = async (invoice, project, settings, reminderInfo = {}) => {
  const design = getDesign(settings);
  const vatRate = invoice.vatRate ?? settings.invoicing?.defaultVatRate ?? 8.1;

  const tierLabels = {
    reminder_1: '1er Rappel',
    reminder_2: '2ème Rappel',
    reminder_3: '3ème Rappel',
    final_notice: 'Mise en demeure'
  };
  const reminderLabel = tierLabels[reminderInfo.tier] || 'Rappel';

  const now = new Date();
  const newDueDate = new Date(now);
  newDueDate.setDate(newDueDate.getDate() + 15);

  // Generate QR-Bill SVG if IBAN configured and showQrBill enabled
  let qrBillSvg = '';
  if (design.showQrBill && settings.company?.iban) {
    qrBillSvg = await generateQRBillSVG(invoice, project, settings);
  }

  const data = {
    company: buildCompany(settings),
    client: buildClient(project),
    project: {
      name: project.name || ''
    },
    document: {
      originalNumber: invoice.number,
      reminderLabel,
      reminderTier: reminderInfo.tier || 'reminder_1',
      issueDate: invoice.issueDate,
      originalDueDate: invoice.dueDate,
      newDueDate,
      daysOverdue: reminderInfo.daysOverdue || 0,
      status: 'overdue',
      notes: invoice.notes || null
    },
    lines: buildInvoiceLines(invoice),
    totals: {
      subtotal: invoice.subtotal || 0,
      vatRate,
      vatAmount: invoice.vatAmount || 0,
      total: invoice.total || 0
    },
    design,
    qrBillSvg
  };

  return renderPDF('reminder', data);
};

/**
 * Generate quote PDF
 * @param {Object} quote - Quote document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @returns {Promise<Buffer>} PDF buffer
 */
export const generateQuotePDF = async (quote, project, settings) => {
  const design = getDesign(settings);
  const vatRate = quote.vatRate ?? settings.invoicing?.defaultVatRate ?? 8.1;

  const data = {
    company: buildCompany(settings),
    client: buildClient(project),
    project: {
      name: project.name || ''
    },
    document: {
      number: quote.number,
      issueDate: quote.issueDate,
      validUntil: quote.validUntil,
      signedAt: quote.status === 'signed' ? quote.signedAt : null,
      status: quote.status,
      notes: quote.notes || null
    },
    lines: buildQuoteLines(quote),
    totals: {
      subtotal: quote.subtotal || 0,
      vatRate,
      vatAmount: quote.vatAmount || 0,
      total: quote.total || 0
    },
    design,
    qrBillSvg: ''
  };

  return renderPDF('quote', data);
};

/**
 * Generate invoice preview as HTML string (for live preview in frontend)
 * @param {Object} settings - User settings
 * @returns {string} HTML string
 */
export const generatePreviewHTML = (settings) => {
  const design = getDesign(settings);
  const vatRate = settings.invoicing?.defaultVatRate ?? 8.1;
  const subtotal = 3750;
  const vatAmount = Math.round(subtotal * vatRate) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  const data = {
    company: buildCompany(settings),
    client: {
      name: 'Entreprise Exemple SA',
      email: 'contact@exemple.ch',
      phone: '+41 22 123 45 67',
      address: 'Rue de la Poste 1, 1200 Genève'
    },
    project: { name: 'Projet exemple' },
    document: {
      number: 'FAC-2026-001',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paidAt: null,
      status: 'sent',
      notes: design.notesTemplate || 'Merci pour votre confiance.',
      paymentTerms: settings.invoicing?.defaultPaymentTerms || 30
    },
    lines: [
      { description: 'Développement frontend React', detail: '20h × 150.00 CHF/h', quantity: 20, unitPrice: 150, total: 3000 },
      { description: 'Licence logiciel annuelle', detail: null, quantity: 1, unitPrice: 250, total: 250 },
      { description: 'Hébergement serveur', detail: null, quantity: 1, unitPrice: 500, total: 500 }
    ],
    totals: { subtotal, vatRate, vatAmount, total },
    design,
    qrBillSvg: ''
  };

  let html = renderHTML('invoice', data);

  // Inject padding to simulate Puppeteer PDF margins (15mm top/bottom, 12mm left/right)
  html = html.replace('</style>', '.page { padding: 15mm 12mm; }\n</style>');

  return html;
};
