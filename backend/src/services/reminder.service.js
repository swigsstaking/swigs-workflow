import cron from 'node-cron';
import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';
import { createTransporter, textToHtml } from './email.service.js';
import { acquireCronLock, releaseCronLock } from '../models/CronLock.js';
import { generateReminderPDF } from './pdf.service.js';
import { historyService } from './historyService.js';

import { eventBus } from './eventBus.service.js';

/**
 * Reminder Service for automatic invoice reminders
 */

/**
 * Format currency for display (no trailing unit — already in templates)
 */
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0) + ' CHF';
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
  // Fix double currency suffix (user templates may have "{total} CHF" while {total} already includes "CHF")
  result = result.replace(/CHF\s+CHF/g, 'CHF');
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

    // Template variables — {total} already includes "CHF"
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

    // Tier labels
    const tierLabels = {
      reminder_1: '1er Rappel',
      reminder_2: '2ème Rappel',
      reminder_3: '3ème Rappel',
      final_notice: 'Mise en demeure'
    };
    const reminderLabel = tierLabels[scheduleItem.type] || 'Rappel';

    // Generate REMINDER PDF (not the original invoice)
    let pdfBuffer = null;
    try {
      pdfBuffer = await generateReminderPDF(invoice, project, settings, {
        tier: scheduleItem.type,
        daysOverdue
      });
    } catch (pdfError) {
      console.error(`Error generating reminder PDF for ${invoice.number}:`, pdfError.message);
    }

    // Create transporter
    const transporter = createTransporter(settings.smtp);

    // Send HTML email with PDF attachment (minimal HTML to prevent Gmail signature splitting)
    const mailOptions = {
      from: `"${company.name || 'SWIGS'}" <${settings.smtp.user}>`,
      to: client.email,
      subject,
      text: body,
      html: textToHtml(body),
      attachments: pdfBuffer ? [
        {
          filename: `Rappel-${invoice.number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
          contentDisposition: 'attachment'
        }
      ] : []
    };

    await transporter.sendMail(mailOptions);

    // Save to IMAP Sent folder (best-effort, non-blocking)
    try {
      const { default: nodemailer } = await import('nodemailer');
      const bufferTransport = nodemailer.createTransport({ streamTransport: true, buffer: true });
      bufferTransport.sendMail(mailOptions).then(async (composed) => {
        const { appendToSentFolder } = await import('./email.service.js');
        appendToSentFolder(settings.smtp, composed.message);
      }).catch(() => {});
    } catch (_) { /* ignore */ }

    // Update reminder record — works for both auto (pending marker exists) and manual sends
    const nextScheduleItem = getNextScheduleItem(
      settings.reminders.schedule,
      daysOverdue
    );
    const nextReminderDate = nextScheduleItem
      ? new Date(dueDate.getTime() + nextScheduleItem.days * 86400000)
      : null;

    const updated = await Invoice.updateOne(
      { _id: invoice._id, 'reminders.type': scheduleItem.type },
      {
        $set: {
          'reminders.$.emailSent': true,
          'reminders.$.pending': false,
          'reminders.$.sentAt': new Date(),
          nextReminderDate
        },
        $inc: { reminderCount: 1 }
      }
    );

    // Manual send — no pending marker exists, push a new confirmed entry
    if (updated.matchedCount === 0) {
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $push: {
            reminders: {
              sentAt: new Date(),
              type: scheduleItem.type,
              emailSent: true,
              pending: false
            }
          },
          $set: { nextReminderDate },
          $inc: { reminderCount: 1 }
        }
      );
    }

    // Log to history
    try {
      await historyService.log(
        project._id,
        'reminder_sent',
        `Relance envoyée pour facture ${invoice.number} (${reminderLabel})`,
        { invoiceNumber: invoice.number, reminderType: scheduleItem.type }
      );
    } catch (e) { /* non-blocking */ }

    console.log(`Reminder sent for invoice ${invoice.number} (${scheduleItem.type})`);

    // Publish to Hub Event Bus for cross-app automations
    eventBus.publish('reminder.sent', {
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.number,
      projectId: project._id.toString(),
      projectName: project.name,
      reminderType: scheduleItem.type,
      daysOverdue,
      total: invoice.total,
      client: project.client,
      hubUserId: null
    }).catch(() => {});

    return { success: true };
  } catch (error) {
    console.error(`Error sending reminder for invoice ${invoice.number}:`, error);

    // Log failed reminder on invoice so user can see it
    try {
      const errorMsg = error.responseCode === 550
        ? `Adresse rejetée: ${(error.rejected || []).join(', ')}`
        : error.message;

      // Try to update existing pending marker (auto send path)
      const updated = await Invoice.updateOne(
        { _id: invoice._id, 'reminders.type': scheduleItem.type },
        {
          $set: {
            'reminders.$.emailSent': false,
            'reminders.$.pending': false,
            'reminders.$.error': errorMsg
          }
        }
      );

      // Manual send — no pending marker, push a new failed entry
      if (updated.matchedCount === 0) {
        await Invoice.updateOne(
          { _id: invoice._id },
          {
            $push: {
              reminders: {
                sentAt: new Date(),
                type: scheduleItem.type,
                emailSent: false,
                error: errorMsg
              }
            }
          }
        );
      }

      await historyService.log(
        project._id,
        'reminder_failed',
        `Échec relance facture ${invoice.number} (${scheduleItem.type}): ${errorMsg}`,
        { invoiceNumber: invoice.number, reminderType: scheduleItem.type, error: errorMsg }
      );
    } catch (e) { /* non-blocking */ }

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

        // Get user's project IDs first, then query only their invoices
        const userProjects = await Project.find({ userId: settings.userId }).select('_id');
        const projectIds = userProjects.map(p => p._id);
        if (projectIds.length === 0) continue;

        const userInvoices = await Invoice.find({
          project: { $in: projectIds },
          status: { $in: ['sent', 'partial'] },
          dueDate: { $lt: now },
          skipReminders: { $ne: true }
        }).populate({
          path: 'project',
          select: 'name client userId'
        });

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

            // Check if enough days have passed for this reminder
            if (daysOverdue < scheduleItem.days) continue;

            // Atomic lock: only one PM2 instance can claim this reminder.
            // Uses findOneAndUpdate to atomically check "no reminder of this type"
            // and insert a pending marker, preventing the other instance from proceeding.
            const locked = await Invoice.findOneAndUpdate(
              {
                _id: invoice._id,
                'reminders.type': { $ne: scheduleItem.type }
              },
              {
                $push: {
                  reminders: {
                    sentAt: new Date(),
                    type: scheduleItem.type,
                    emailSent: false,
                    pending: true
                  }
                }
              },
              { new: true }
            ).populate({
              path: 'project',
              select: 'name client userId'
            });

            if (!locked) {
              // Another instance already claimed this reminder — skip
              continue;
            }

            // Send reminder using the locked (fresh) invoice
            await sendReminder(locked, locked.project, settings, scheduleItem);
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
    if (!['sent', 'partial'].includes(invoice.status)) {
      throw new Error('La facture doit être envoyée pour envoyer une relance');
    }

    const now = new Date();
    const dueDate = new Date(invoice.dueDate);

    if (dueDate >= now) {
      throw new Error('La facture n\'est pas encore échue');
    }

    // Get settings (manual reminders bypass the auto-reminders enabled check)
    const settings = await Settings.getSettings(userId);

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
 * Initialize reminder service with cron job.
 * Uses MongoDB atomic lock so only one PM2 instance runs the check.
 */
export const initialize = () => {
  cron.schedule('0 8 * * *', async () => {
    const lockId = 'reminder-cron';

    const acquired = await acquireCronLock(lockId);
    if (!acquired) {
      console.log('[Reminder] Skipping — another instance holds the lock');
      return;
    }

    try {
      console.log('Running daily reminder check at 8:00 AM');
      await checkOverdueInvoices();
    } catch (err) {
      console.error('[Reminder] Cron error:', err.message);
    } finally {
      await releaseCronLock(lockId);
    }
  });

  console.log('Reminder service initialized (daily check at 8:00 AM)');
};
