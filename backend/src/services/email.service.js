import nodemailer from 'nodemailer';
import imapSimple from 'imap-simple';
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
 * Append a sent email to the IMAP Sent folder so it appears in the user's mailbox.
 * Uses the same SMTP credentials for IMAP (same host, standard IMAP port 993).
 * Fails silently — sending the email is the priority, saving to Sent is best-effort.
 */
export const appendToSentFolder = async (smtpConfig, rawMessage) => {
  try {
    const password = decrypt(smtpConfig.pass);
    const imapConfig = {
      imap: {
        user: smtpConfig.user,
        password,
        host: smtpConfig.host,
        port: 993,
        tls: true,
        authTimeout: 15000,
        tlsOptions: { rejectUnauthorized: process.env.NODE_ENV !== 'production' ? false : true }
      }
    };

    console.log(`[IMAP Sent] Connecting to ${smtpConfig.host}:993 as ${smtpConfig.user}...`);
    const connection = await imapSimple.connect(imapConfig);
    console.log('[IMAP Sent] Connected. Listing mailboxes...');

    const boxes = await connection.getBoxes();
    const boxNames = [];
    const collectNames = (obj, prefix = '') => {
      for (const [name, box] of Object.entries(obj)) {
        const fullName = prefix ? `${prefix}.${name}` : name;
        boxNames.push({ name: fullName, attribs: box.attribs || [] });
        if (box.children) collectNames(box.children, fullName);
      }
    };
    collectNames(boxes);
    console.log('[IMAP Sent] Available mailboxes:', boxNames.map(b => `${b.name} [${b.attribs.join(',')}]`).join(', '));

    // Find Sent folder: first by \Sent attribute, then by common names
    let sentFolder = null;

    // 1. Check for \Sent special-use attribute
    for (const box of boxNames) {
      if (box.attribs.some(a => a.toLowerCase() === '\\sent')) {
        sentFolder = box.name;
        break;
      }
    }

    // 2. Fallback: common names
    if (!sentFolder) {
      const commonNames = ['Sent', 'INBOX.Sent', 'Sent Messages', 'Sent Items', 'Envoy&AOk-s', 'INBOX.Sent Messages'];
      for (const name of commonNames) {
        if (boxNames.some(b => b.name === name)) {
          sentFolder = name;
          break;
        }
      }
    }

    // 3. Last resort: any folder containing 'sent' (case-insensitive)
    if (!sentFolder) {
      const match = boxNames.find(b => b.name.toLowerCase().includes('sent'));
      if (match) sentFolder = match.name;
    }

    if (!sentFolder) {
      console.warn('[IMAP Sent] No Sent folder found among:', boxNames.map(b => b.name).join(', '));
      connection.end();
      return;
    }

    console.log(`[IMAP Sent] Appending to folder: "${sentFolder}"`);

    // Convert Buffer to string if needed
    const messageStr = Buffer.isBuffer(rawMessage) ? rawMessage.toString('utf-8') : rawMessage;
    await connection.append(messageStr, { mailbox: sentFolder, flags: ['\\Seen'] });

    console.log('[IMAP Sent] Successfully appended to Sent folder');
    connection.end();
  } catch (err) {
    console.error('[IMAP Sent] Error:', err.message);
  }
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
    companyName: company.name || 'Mon entreprise',
    paymentTerms: settings.invoicing?.defaultPaymentTerms || 30
  };

  // Process templates
  const subject = replaceVariables(
    emailTemplates.quoteSubject || 'Devis {number} - {projectName}',
    variables
  );

  const body = replaceVariables(
    emailTemplates.quoteBody ||
    'Bonjour {clientName},\n\nVeuillez trouver ci-joint notre offre relative à votre demande.\n\nJe reste à votre disposition pour toute question ou ajustement.\n\nAvec mes meilleures salutations,\n\n{companyName}',
    variables
  );

  // Create transporter
  const transporter = createTransporter(settings.smtp);

  // Send email
  const mailOptions = {
    from: `"${company.name || 'Mon entreprise'}" <${settings.smtp.user}>`,
    to: client.email,
    subject,
    text: body,
    html: textToHtml(body),
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

  // Save to IMAP Sent folder (best-effort, non-blocking)
  const bufferTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  bufferTransport.sendMail(mailOptions).then(composed => {
    appendToSentFolder(settings.smtp, composed.message);
  }).catch(() => {});

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
    companyName: company.name || 'Mon entreprise',
    paymentTerms: settings.invoicing?.defaultPaymentTerms || 30
  };

  // Process templates
  const subject = replaceVariables(
    emailTemplates.invoiceSubject || 'Facture {number} - {projectName}',
    variables
  );

  const body = replaceVariables(
    emailTemplates.invoiceBody ||
    'Bonjour,\n\nVeuillez trouver ci-joint la facture relative à notre prestation. Je vous remercie pour la confiance accordée.\n\nJe reste à votre disposition pour tout renseignement complémentaire.\n\nAvec mes remerciements et mes salutations distinguées,\n\n{companyName}',
    variables
  );

  // Create transporter
  const transporter = createTransporter(settings.smtp);

  // Send email
  const mailOptions = {
    from: `"${company.name || 'Mon entreprise'}" <${settings.smtp.user}>`,
    to: client.email,
    subject,
    text: body,
    html: textToHtml(body),
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

  // Save to IMAP Sent folder (best-effort, non-blocking)
  const bufferTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  bufferTransport.sendMail(mailOptions).then(composed => {
    appendToSentFolder(settings.smtp, composed.message);
  }).catch(() => {});

  return result;
};

/**
 * Send payment confirmation email
 * @param {Object} invoice - Invoice document (populated with project)
 * @param {Object} settings - User settings
 * @returns {Promise<Object>} Nodemailer result
 */
export const sendPaymentConfirmationEmail = async (invoice, settings) => {
  const project = invoice.project || {};
  const client = project.client || {};
  const company = settings.company || {};
  const emailTemplates = settings.emailTemplates || {};

  if (!client.email) return null;
  if (!settings.smtp || !settings.smtp.host) return null;

  const variables = {
    clientName: client.name || 'Client',
    number: invoice.number,
    projectName: project.name || 'Projet',
    total: formatCurrency(invoice.total),
    companyName: company.name || 'Mon entreprise'
  };

  const subject = replaceVariables(
    emailTemplates.paymentConfirmationSubject || 'Confirmation de paiement — Facture {number}',
    variables
  );

  const body = replaceVariables(
    emailTemplates.paymentConfirmationBody ||
    'Bonjour {clientName},\n\nNous accusons bonne réception de votre paiement pour la facture {number} d\'un montant de {total}.\n\nNous vous remercions pour votre confiance.\n\nAvec nos meilleures salutations,\n\n{companyName}',
    variables
  );

  const transporter = createTransporter(settings.smtp);

  const mailOptions = {
    from: `"${company.name || 'Mon entreprise'}" <${settings.smtp.user}>`,
    to: client.email,
    subject,
    text: body,
    html: textToHtml(body)
  };

  const result = await transporter.sendMail(mailOptions);

  // Save to IMAP Sent folder (best-effort, non-blocking)
  const bufferTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  bufferTransport.sendMail(mailOptions).then(composed => {
    appendToSentFolder(settings.smtp, composed.message);
  }).catch(() => {});

  return result;
};
