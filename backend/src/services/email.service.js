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
 * Convert plain text body to minimal HTML that looks like a plain email.
 * Prevents Gmail from splitting body/signature and placing attachments in between.
 */
export const textToHtml = (text) => {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#222;line-height:1.6">${escaped}</div>`;
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
 * Build a simple but readable HTML email body for invoices and quotes.
 */
const buildEmailHTML = ({ title, clientName, body, amount, companyName }) => {
  const escapedBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:30px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="background:#1a1a2e;padding:24px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600">${title}</h1>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6">${escapedBody}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0;border:1px solid #e8e8e8;border-radius:6px;overflow:hidden">
            <tr style="background:#f8f8f8">
              <td style="padding:12px 16px;color:#555;font-size:14px;font-weight:600">Montant total</td>
              <td style="padding:12px 16px;color:#1a1a2e;font-size:16px;font-weight:700;text-align:right">${amount}</td>
            </tr>
          </table>
          <p style="margin:24px 0 0;color:#888;font-size:12px;border-top:1px solid #eee;padding-top:16px">${companyName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
    'Bonjour {clientName},\n\nVeuillez trouver ci-joint le devis {number} d\'un montant de {total}.\n\nN\'hésitez pas à me contacter pour toute question.\n\nCordialement,\n{companyName}',
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
    html: buildEmailHTML({
      title: `Devis ${variables.number}`,
      clientName: variables.clientName,
      body,
      amount: variables.total,
      companyName: variables.companyName
    }),
    attachments: [
      {
        filename: `Devis-${quote.number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
        contentDisposition: 'attachment'
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
    'Bonjour {clientName},\n\nVeuillez trouver ci-joint la facture {number} d\'un montant de {total}.\n\nMerci de procéder au règlement dans un délai de {paymentTerms} jours.\n\nCordialement,\n{companyName}',
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
    html: buildEmailHTML({
      title: `Facture ${variables.number}`,
      clientName: variables.clientName,
      body,
      amount: variables.total,
      companyName: variables.companyName
    }),
    attachments: [
      {
        filename: `Facture-${invoice.number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
        contentDisposition: 'attachment'
      }
    ]
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
};
