import nodemailer from 'nodemailer';
import { decrypt } from '../utils/crypto.js';

/**
 * Email Service for sending invoices and quotes
 */

/**
 * Create email transporter from SMTP config
 * @param {Object} smtpConfig - SMTP configuration
 * @returns {Object} Nodemailer transporter
 */
export const createTransporter = (smtpConfig) => {
  if (!smtpConfig || !smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    throw new Error('Configuration SMTP incomplète');
  }

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port || 587,
    secure: smtpConfig.secure || false, // true for 465, false for other ports
    auth: {
      user: smtpConfig.user,
      pass: decrypt(smtpConfig.pass)
    }
  });
};

/**
 * Replace template variables
 * @param {string} template - Template string with {variables}
 * @param {Object} variables - Variables to replace
 * @returns {string} Processed template
 */
const replaceVariables = (template, variables) => {
  if (!template) return '';

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
};

/**
 * Format currency (CHF)
 */
const formatCurrency = (amount) => {
  return `${amount.toFixed(2)} CHF`;
};

/**
 * Send quote email
 * @param {Object} quote - Quote document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @param {Buffer} pdfBuffer - PDF attachment
 * @returns {Promise<Object>} Nodemailer result
 */
export const sendQuoteEmail = async (quote, project, settings, pdfBuffer) => {
  const client = project.client || {};
  const company = settings.company || {};
  const emailTemplates = settings.emailTemplates || {};

  // Validate client email
  if (!client.email) {
    throw new Error('Le client n\'a pas d\'adresse email');
  }

  // Validate SMTP config
  if (!settings.smtp || !settings.smtp.host) {
    throw new Error('Configuration SMTP manquante dans les paramètres');
  }

  // Template variables
  const variables = {
    clientName: client.name || 'Client',
    number: quote.number,
    projectName: project.name || 'Projet',
    total: formatCurrency(quote.total),
    companyName: company.name || 'SWIGS',
    paymentTerms: settings.invoicing?.defaultPaymentTerms || 30
  };

  // Process templates
  const subject = replaceVariables(
    emailTemplates.quoteSubject || 'Devis {number} - {projectName}',
    variables
  );

  const body = replaceVariables(
    emailTemplates.quoteBody ||
    'Bonjour {clientName},\n\nVeuillez trouver ci-joint le devis {number} d\'un montant de {total} CHF.\n\nN\'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{companyName}',
    variables
  );

  // Create transporter
  const transporter = createTransporter(settings.smtp);

  // Send email
  const mailOptions = {
    from: `"${company.name || 'SWIGS'}" <${settings.smtp.user}>`,
    to: client.email,
    subject,
    text: body,
    attachments: [
      {
        filename: `Devis-${quote.number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
};

/**
 * Send invoice email
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @param {Buffer} pdfBuffer - PDF attachment
 * @returns {Promise<Object>} Nodemailer result
 */
export const sendInvoiceEmail = async (invoice, project, settings, pdfBuffer) => {
  const client = project.client || {};
  const company = settings.company || {};
  const emailTemplates = settings.emailTemplates || {};

  // Validate client email
  if (!client.email) {
    throw new Error('Le client n\'a pas d\'adresse email');
  }

  // Validate SMTP config
  if (!settings.smtp || !settings.smtp.host) {
    throw new Error('Configuration SMTP manquante dans les paramètres');
  }

  // Template variables
  const variables = {
    clientName: client.name || 'Client',
    number: invoice.number,
    projectName: project.name || 'Projet',
    total: formatCurrency(invoice.total),
    companyName: company.name || 'SWIGS',
    paymentTerms: settings.invoicing?.defaultPaymentTerms || 30
  };

  // Process templates
  const subject = replaceVariables(
    emailTemplates.invoiceSubject || 'Facture {number} - {projectName}',
    variables
  );

  const body = replaceVariables(
    emailTemplates.invoiceBody ||
    'Bonjour {clientName},\n\nVeuillez trouver ci-joint la facture {number} d\'un montant de {total} CHF.\n\nMerci de procéder au règlement dans un délai de {paymentTerms} jours.\n\nCordialement,\n{companyName}',
    variables
  );

  // Create transporter
  const transporter = createTransporter(settings.smtp);

  // Send email
  const mailOptions = {
    from: `"${company.name || 'SWIGS'}" <${settings.smtp.user}>`,
    to: client.email,
    subject,
    text: body,
    attachments: [
      {
        filename: `Facture-${invoice.number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
};
