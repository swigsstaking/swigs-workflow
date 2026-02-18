import cron from 'node-cron';
import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';
import { createTransporter } from './email.service.js';
import { historyService } from './historyService.js';

/**
 * Reminder Service for automatic invoice reminders
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
 * Replace template variables
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
 * Send a reminder email for an overdue invoice
 * @param {Object} invoice - Invoice document
 * @param {Object} project - Project document (populated)
 * @param {Object} settings - User settings
 * @param {Object} scheduleItem - Schedule item from settings
 */
export const sendReminder = async (invoice, project, settings, scheduleItem) => {
  try {
    const client = project.client || {};
    const company = settings.company || {};

    // Validate client email
    if (!client.email) {
      console.log(`Reminder skipped for invoice ${invoice.number}: No client email`);
      return { success: false, error: 'No client email' };
    }

    // Validate SMTP config
    if (!settings.smtp || !settings.smtp.host) {
      console.log(`Reminder skipped for invoice ${invoice.number}: No SMTP config`);
      return { success: false, error: 'No SMTP config' };
    }

    // Calculate days overdue
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

    // Template variables
    const variables = {
      clientName: client.name || 'Client',
      number: invoice.number,
      total: formatCurrency(invoice.total),
      dueDate: formatDate(invoice.dueDate),
      daysOverdue: daysOverdue.toString(),
      companyName: company.name || 'SWIGS'
    };

    // Process templates
    const subject = replaceVariables(scheduleItem.subject, variables);
    const body = replaceVariables(scheduleItem.body, variables);

    // Create transporter
    const transporter = createTransporter(settings.smtp);

    // Send email
    const mailOptions = {
      from: `"${company.name || 'SWIGS'}" <${settings.smtp.user}>`,
      to: client.email,
      subject,
      text: body
    };

    await transporter.sendMail(mailOptions);

    // Update invoice
    invoice.reminders.push({
      sentAt: new Date(),
      type: scheduleItem.type,
      emailSent: true
    });
    invoice.reminderCount = (invoice.reminderCount || 0) + 1;

    // Calculate next reminder date
    const nextScheduleItem = getNextScheduleItem(
      settings.reminders.schedule,
      daysOverdue
    );
    if (nextScheduleItem) {
      const nextReminderDate = new Date(dueDate);
      nextReminderDate.setDate(nextReminderDate.getDate() + nextScheduleItem.days);
      invoice.nextReminderDate = nextReminderDate;
    } else {
      invoice.nextReminderDate = null;
    }

    await invoice.save();

    // Log to history
    await historyService.log(
      project._id,
      'reminder_sent',
      `Relance envoyée pour facture ${invoice.number} (${scheduleItem.type})`,
      { invoiceNumber: invoice.number, reminderType: scheduleItem.type }
    );

    console.log(`Reminder sent for invoice ${invoice.number} (${scheduleItem.type})`);

    return { success: true };
  } catch (error) {
    console.error(`Error sending reminder for invoice ${invoice.number}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Get next schedule item based on days overdue
 */
const getNextScheduleItem = (schedule, currentDaysOverdue) => {
  const sortedSchedule = [...schedule].sort((a, b) => a.days - b.days);

  for (const item of sortedSchedule) {
    if (item.days > currentDaysOverdue) {
      return item;
    }
  }

  return null;
};

/**
 * Get current schedule item based on days overdue
 */
const getCurrentScheduleItem = (schedule, daysOverdue) => {
  const sortedSchedule = [...schedule].sort((a, b) => b.days - a.days);

  for (const item of sortedSchedule) {
    if (daysOverdue >= item.days) {
      return item;
    }
  }

  return null;
};

/**
 * Check for overdue invoices and send reminders
 */
export const checkOverdueInvoices = async () => {
  try {
    console.log('Checking for overdue invoices...');

    const now = new Date();

    // Get all users with reminders enabled
    const allSettings = await Settings.find({ 'reminders.enabled': true });

    for (const settings of allSettings) {
      try {
        if (!settings.reminders?.enabled) continue;

        // Find overdue invoices for this user
        const overdueInvoices = await Invoice.find({
          status: 'sent',
          dueDate: { $lt: now }
        }).populate({
          path: 'project',
          match: { userId: settings.userId },
          select: 'name client userId'
        });

        // Filter out invoices where project doesn't belong to user
        const userInvoices = overdueInvoices.filter(inv => inv.project !== null);

        for (const invoice of userInvoices) {
          try {
            // Calculate days overdue
            const daysOverdue = Math.floor(
              (now - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)
            );

            // Find appropriate schedule item
            const scheduleItem = getCurrentScheduleItem(
              settings.reminders.schedule,
              daysOverdue
            );

            if (!scheduleItem) continue;

            // Check if this reminder type was already sent
            const alreadySent = invoice.reminders?.some(
              r => r.type === scheduleItem.type
            );

            if (alreadySent) continue;

            // Check if enough days have passed for this reminder
            if (daysOverdue < scheduleItem.days) continue;

            // Send reminder
            await sendReminder(invoice, invoice.project, settings, scheduleItem);
          } catch (error) {
            console.error(`Error processing invoice ${invoice.number}:`, error);
            // Continue with next invoice
          }
        }
      } catch (error) {
        console.error(`Error processing reminders for user ${settings.userId}:`, error);
        // Continue with next user
      }
    }

    console.log('Overdue invoice check completed');
  } catch (error) {
    console.error('Error in checkOverdueInvoices:', error);
  }
};

/**
 * Send manual reminder for an invoice
 * @param {String} invoiceId - Invoice ID
 * @param {String} userId - User ID
 */
export const sendManualReminder = async (invoiceId, userId) => {
  try {
    // Load invoice with project
    const invoice = await Invoice.findById(invoiceId).populate('project');

    if (!invoice) {
      throw new Error('Facture non trouvée');
    }

    if (!invoice.project) {
      throw new Error('Projet non trouvé');
    }

    // Verify ownership
    if (invoice.project.userId.toString() !== userId.toString()) {
      throw new Error('Non autorisé');
    }

    // Check if invoice is overdue
    if (invoice.status !== 'sent') {
      throw new Error('La facture doit être envoyée pour envoyer une relance');
    }

    const now = new Date();
    const dueDate = new Date(invoice.dueDate);

    if (dueDate >= now) {
      throw new Error('La facture n\'est pas encore échue');
    }

    // Get settings
    const settings = await Settings.getSettings(userId);

    if (!settings.reminders?.enabled) {
      throw new Error('Les relances automatiques ne sont pas activées');
    }

    // Calculate days overdue
    const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

    // Get appropriate schedule item
    const scheduleItem = getCurrentScheduleItem(
      settings.reminders.schedule,
      daysOverdue
    );

    if (!scheduleItem) {
      throw new Error('Aucune relance configurée pour ce délai');
    }

    // Send reminder
    const result = await sendReminder(invoice, invoice.project, settings, scheduleItem);

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'envoi de la relance');
    }

    return {
      success: true,
      message: 'Relance envoyée avec succès',
      reminderType: scheduleItem.type
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Initialize reminder service with cron job
 */
export const initialize = () => {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    console.log('Running daily reminder check at 8:00 AM');
    checkOverdueInvoices();
  });

  console.log('Reminder service initialized (daily check at 8:00 AM)');
};
