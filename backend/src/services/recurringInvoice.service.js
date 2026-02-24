import cron from 'node-cron';
import RecurringInvoice from '../models/RecurringInvoice.js';
import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';
import { generateInvoicePDF } from './pdf.service.js';
import { sendInvoiceEmail } from './email.service.js';

/**
 * Calculate the next generation date based on frequency and dayOfMonth
 */
export const calculateNextDate = (fromDate, frequency, dayOfMonth = 1) => {
  const next = new Date(fromDate);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;

    case 'monthly': {
      // Move to same day next month, capped at dayOfMonth
      next.setMonth(next.getMonth() + 1);
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dayOfMonth, maxDay));
      break;
    }

    case 'quarterly': {
      next.setMonth(next.getMonth() + 3);
      const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dayOfMonth, maxDay));
      break;
    }

    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;

    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
};

/**
 * Core generation logic — creates an Invoice from a RecurringInvoice template.
 * Used by both the cron job and the manual generateNow endpoint.
 *
 * @param {Object} recurring - RecurringInvoice document (populated with project)
 * @returns {Object} The created Invoice document
 */
export const generateInvoiceFromRecurring = async (recurring) => {
  // Ensure project is populated
  const project = recurring.project._id
    ? recurring.project
    : await Project.findById(recurring.project);

  if (!project) {
    throw new Error(`Projet ${recurring.project} introuvable`);
  }

  // Calculate totals from custom lines
  const processedLines = recurring.customLines.map(line => ({
    description: line.description,
    quantity: line.quantity || 1,
    unitPrice: line.unitPrice,
    unit: line.unit || '',
    total: (line.quantity || 1) * line.unitPrice
  }));

  const subtotal = processedLines.reduce((sum, line) => sum + line.total, 0);
  const vatAmount = subtotal * (recurring.vatRate / 100);
  const total = subtotal + vatAmount;

  const issueDate = new Date();
  const dueDate = new Date(
    issueDate.getTime() + recurring.paymentTermsDays * 24 * 60 * 60 * 1000
  );

  // Generate invoice number atomically
  const number = await Invoice.generateNumber(recurring.userId);

  const invoice = await Invoice.create({
    project: project._id,
    number,
    invoiceType: 'custom',
    events: [],
    quotes: [],
    customLines: processedLines,
    subtotal,
    vatRate: recurring.vatRate,
    vatAmount,
    total,
    issueDate,
    dueDate,
    notes: recurring.notes || ''
  });

  // Update recurring invoice tracking
  const nextDate = calculateNextDate(
    new Date(),
    recurring.frequency,
    recurring.dayOfMonth
  );

  recurring.lastGeneratedAt = new Date();
  recurring.nextGenerationDate = nextDate;
  recurring.totalGenerated = (recurring.totalGenerated || 0) + 1;
  recurring.generatedInvoices.push(invoice._id);

  // Cancel if endDate exceeded
  if (recurring.endDate && nextDate > new Date(recurring.endDate)) {
    recurring.status = 'cancelled';
  }

  await recurring.save();

  // Auto-send if configured
  if (recurring.autoSend) {
    try {
      const settings = await Settings.getSettings(recurring.userId);
      if (settings?.smtp?.host && project.client?.email) {
        const pdfBuffer = await generateInvoicePDF(invoice, project, settings);
        await sendInvoiceEmail(invoice, project, settings, pdfBuffer);
        invoice.status = 'sent';
        await invoice.save();
      }
    } catch (emailErr) {
      console.error(`Auto-send failed for recurring invoice ${recurring._id}:`, emailErr.message);
      // Non-blocking — invoice is still created
    }
  }

  return invoice;
};

/**
 * Daily cron job: process all due recurring invoices at 06:00
 */
export const processRecurringInvoices = async () => {
  try {
    console.log('Processing recurring invoices...');

    const now = new Date();

    // Find all due recurring invoices (IDs only to avoid stale data)
    const dueRecurrings = await RecurringInvoice.find({
      status: 'active',
      nextGenerationDate: { $lte: now }
    }).select('_id');

    console.log(`Found ${dueRecurrings.length} recurring invoice(s) to process`);

    for (const { _id: recurringId } of dueRecurrings) {
      try {
        // Atomically claim this recurring invoice to prevent double generation
        const recurring = await RecurringInvoice.findOneAndUpdate(
          { _id: recurringId, status: 'active', nextGenerationDate: { $lte: now } },
          { $set: { nextGenerationDate: new Date(now.getTime() + 24 * 60 * 60 * 1000) } }, // Temporary bump to prevent re-claim
          { new: false }
        ).populate('project', 'name client userId');

        if (!recurring) {
          console.log(`Recurring invoice ${recurringId} already claimed by another process, skipping`);
          continue;
        }

        const invoice = await generateInvoiceFromRecurring(recurring);
        console.log(`Generated invoice ${invoice.number} from recurring ${recurringId}`);
      } catch (err) {
        console.error(`Error processing recurring invoice ${recurringId}:`, err.message);
        // Continue with next recurring invoice
      }
    }

    console.log('Recurring invoice processing completed');
  } catch (err) {
    console.error('Error in processRecurringInvoices:', err);
  }
};

let isRunning = false;

/**
 * Initialize recurring invoice cron job
 */
export const initRecurringInvoices = () => {
  // Run every day at 6:00 AM
  cron.schedule('0 6 * * *', async () => {
    if (isRunning) {
      console.log('[RecurringInvoice] Skipping — previous run still active');
      return;
    }
    isRunning = true;
    try {
      console.log('Running daily recurring invoice generation at 6:00 AM');
      await processRecurringInvoices();
    } finally {
      isRunning = false;
    }
  });

  console.log('Recurring invoice service initialized (daily generation at 6:00 AM)');
};
