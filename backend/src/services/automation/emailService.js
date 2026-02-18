import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import EmailTemplate from '../../models/EmailTemplate.js';
import Settings from '../../models/Settings.js';

// Create transporter based on settings
const createTransporter = async (userId) => {
  const settings = await Settings.getSettings(userId);

  // Use SMTP settings from .env or settings
  const smtpConfig = {
    host: process.env.SMTP_HOST || 'mail.infomaniak.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || 'mail@swigs.online',
      pass: process.env.SMTP_PASS
    }
  };

  return nodemailer.createTransport(smtpConfig);
};

// Isolated Handlebars instance (avoids global helper pollution)
const hbs = Handlebars.create();

hbs.registerHelper('formatCurrency', function(amount) {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount || 0);
});

hbs.registerHelper('formatDate', function(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-CH');
});

/**
 * Send email using a template
 * @param {string} templateId - EmailTemplate ID
 * @param {string} to - Recipient email
 * @param {object} data - Data for template variables
 * @param {string} userId - User ID for settings
 */
export const sendTemplateEmail = async (templateId, to, data = {}, userId = null) => {
  try {
    const template = await EmailTemplate.findById(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Get company settings
    const settings = await Settings.getSettings(userId || template.userId);

    // Build context with company data
    const context = {
      company: {
        name: settings.company?.name || 'SWIGS',
        email: settings.company?.email || 'contact@swigs.online',
        phone: settings.company?.phone || '',
        address: settings.company?.address || ''
      },
      today: new Date().toLocaleDateString('fr-CH'),
      ...data
    };

    // Compile templates (using isolated instance)
    const subjectCompiled = hbs.compile(template.subject);
    const bodyCompiled = hbs.compile(template.body);

    const subject = subjectCompiled(context);
    const html = bodyCompiled(context);

    // Create transporter
    const transporter = await createTransporter(userId || template.userId);

    // Send email
    const info = await transporter.sendMail({
      from: `"${settings.company?.name || 'SWIGS'}" <${process.env.SMTP_USER || 'mail@swigs.online'}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, '')  // Strip HTML for text version
    });

    console.log(`📧 Email sent: ${info.messageId}`);

    // Update template stats
    await EmailTemplate.findByIdAndUpdate(templateId, {
      $inc: { 'stats.timesSent': 1 },
      'stats.lastUsedAt': new Date()
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

/**
 * Send raw email (without template)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML body
 * @param {string} userId - User ID for settings
 */
export const sendRawEmail = async (to, subject, html, userId = null) => {
  try {
    const settings = await Settings.getSettings(userId);
    const transporter = await createTransporter(userId);

    const info = await transporter.sendMail({
      from: `"${settings.company?.name || 'SWIGS'}" <${process.env.SMTP_USER || 'mail@swigs.online'}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, '')
    });

    console.log(`📧 Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

/**
 * Verify SMTP connection
 */
export const verifyConnection = async (userId = null) => {
  try {
    const transporter = await createTransporter(userId);
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  sendTemplateEmail,
  sendRawEmail,
  verifyConnection
};
