import Automation from '../../models/Automation.js';
import AutomationRun from '../../models/AutomationRun.js';
import PlannedBlock from '../../models/PlannedBlock.js';
import Invoice from '../../models/Invoice.js';
import Quote from '../../models/Quote.js';
import { executeRun } from './executorService.js';

const CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Convert offset + unit to milliseconds
 */
const offsetToMs = (offset, unit) => {
  switch (unit) {
    case 'minutes': return offset * 60 * 1000;
    case 'hours':   return offset * 60 * 60 * 1000;
    case 'days':    return offset * 24 * 60 * 60 * 1000;
    default:        return 0;
  }
};

/**
 * Check all date.relative automations and fire matching records
 */
export const checkDateTriggers = async () => {
  try {
    const automations = await Automation.find({
      isActive: true,
      triggerType: 'date.relative'
    });

    if (automations.length === 0) return;

    console.log(`📅 Checking ${automations.length} date.relative automations...`);

    for (const automation of automations) {
      try {
        await processAutomation(automation);
      } catch (err) {
        console.error(`   ❌ date.relative error for "${automation.name}":`, err.message);
      }
    }
  } catch (error) {
    console.error('Error in checkDateTriggers:', error);
  }
};

/**
 * Process a single date.relative automation
 */
const processAutomation = async (automation) => {
  const { dateSource, dateOffset, dateOffsetUnit, dateOffsetDirection, scheduledDate } = automation.triggerConfig || {};

  if (!dateSource) return;

  // Custom one-shot: check if scheduledDate falls within [now - 5min, now)
  if (dateSource === 'custom') {
    if (!scheduledDate) return;

    const now = new Date();
    const scheduled = new Date(scheduledDate);
    const windowStart = new Date(now.getTime() - CRON_INTERVAL_MS);

    if (scheduled < windowStart || scheduled >= now) return;

    const automationId = automation._id.toString();

    // Dedup: one-shot, use automation._id as triggerRecordId
    const exists = await AutomationRun.exists({
      automation: automation._id,
      triggerRecordId: automationId
    });
    if (exists) return;

    const run = await AutomationRun.create({
      automation: automation._id,
      automationName: automation.name,
      triggerType: 'date.relative',
      triggerRecordId: automationId,
      triggerData: {
        dateSource: 'custom',
        scheduledDate: scheduled.toISOString()
      },
      status: 'pending',
      context: {
        scheduledDate: scheduled.toISOString(),
        automationName: automation.name,
        _trigger: {
          type: 'date.relative',
          dateSource: 'custom',
          timestamp: now.toISOString()
        }
      }
    });

    console.log(`   📅 Triggered "${automation.name}" (custom one-shot)`);

    executeRun(run._id).catch(err => {
      console.error(`   ❌ Execution error for run ${run._id}:`, err.message);
    });
    return;
  }

  // Standard date.relative: needs offset config
  if (!dateOffset || !dateOffsetUnit || !dateOffsetDirection) return;

  const now = new Date();
  const offsetMs = offsetToMs(dateOffset, dateOffsetUnit);

  // Calculate the target date window we're looking for
  // "before" = trigger fires when now + offset is in the window of the source date
  // "after"  = trigger fires when now - offset is in the window of the source date
  let windowStart, windowEnd;

  if (dateOffsetDirection === 'before') {
    // We want records whose date is between now+offset and now+offset+5min
    windowStart = new Date(now.getTime() + offsetMs);
    windowEnd = new Date(now.getTime() + offsetMs + CRON_INTERVAL_MS);
  } else {
    // "after" — records whose date is between now-offset-5min and now-offset
    windowStart = new Date(now.getTime() - offsetMs - CRON_INTERVAL_MS);
    windowEnd = new Date(now.getTime() - offsetMs);
  }

  const records = await queryRecords(dateSource, windowStart, windowEnd, automation.userId);

  for (const { record, project } of records) {
    const recordId = record._id.toString();

    // Dedup: skip if we already ran for this record
    const exists = await AutomationRun.exists({
      automation: automation._id,
      triggerRecordId: recordId
    });
    if (exists) continue;

    const context = buildContext(dateSource, record, project);

    const run = await AutomationRun.create({
      automation: automation._id,
      automationName: automation.name,
      triggerType: 'date.relative',
      triggerRecordId: recordId,
      triggerData: {
        dateSource,
        recordId,
        targetDate: context.targetDate
      },
      status: 'pending',
      context: {
        ...context,
        _trigger: {
          type: 'date.relative',
          dateSource,
          direction: dateOffsetDirection,
          offset: `${dateOffset} ${dateOffsetUnit}`,
          timestamp: now.toISOString()
        }
      }
    });

    console.log(`   📅 Triggered "${automation.name}" for ${dateSource} ${recordId}`);

    executeRun(run._id).catch(err => {
      console.error(`   ❌ Execution error for run ${run._id}:`, err.message);
    });
  }
};

/**
 * Query source records within the time window
 */
const queryRecords = async (source, windowStart, windowEnd, userId) => {
  switch (source) {
    case 'planned_block': {
      const blocks = await PlannedBlock.find({
        userId,
        start: { $gte: windowStart, $lt: windowEnd }
      }).populate('project');
      return blocks.map(b => ({
        record: b,
        project: b.project
      }));
    }

    case 'invoice_due': {
      const invoices = await Invoice.find({
        status: { $in: ['draft', 'sent', 'partial'] },
        dueDate: { $gte: windowStart, $lt: windowEnd }
      }).populate('project');
      // Filter by userId via project
      return invoices
        .filter(inv => inv.project && String(inv.project.userId) === String(userId))
        .map(inv => ({
          record: inv,
          project: inv.project
        }));
    }

    case 'quote_expiry': {
      const quotes = await Quote.find({
        status: { $in: ['draft', 'sent'] },
        validUntil: { $gte: windowStart, $lt: windowEnd }
      }).populate('project');
      // Filter by userId via project
      return quotes
        .filter(q => q.project && String(q.project.userId) === String(userId))
        .map(q => ({
          record: q,
          project: q.project
        }));
    }

    default:
      return [];
  }
};

/**
 * Build enriched context from source record
 */
const buildContext = (source, record, project) => {
  const clientName = project?.client?.name || project?.client?.company || '';
  const clientEmail = project?.client?.email || '';
  const projectName = project?.name || '';

  switch (source) {
    case 'planned_block': {
      const durationMs = record.end.getTime() - record.start.getTime();
      const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;
      return {
        recordId: record._id.toString(),
        recordType: 'planned_block',
        targetDate: record.start.toISOString(),
        start: record.start.toISOString(),
        end: record.end.toISOString(),
        projectName,
        projectId: project?._id?.toString(),
        client: { name: clientName, email: clientEmail },
        durationHours,
        notes: record.notes || ''
      };
    }

    case 'invoice_due': {
      const now = new Date();
      const daysUntilDue = Math.ceil((record.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        recordId: record._id.toString(),
        recordType: 'invoice',
        targetDate: record.dueDate.toISOString(),
        invoiceNumber: record.number,
        invoiceId: record._id.toString(),
        dueDate: record.dueDate.toISOString(),
        total: record.total,
        status: record.status,
        projectName,
        projectId: project?._id?.toString(),
        client: { name: clientName, email: clientEmail },
        daysUntilDue
      };
    }

    case 'quote_expiry': {
      const now = new Date();
      const daysUntilExpiry = Math.ceil((record.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        recordId: record._id.toString(),
        recordType: 'quote',
        targetDate: record.validUntil.toISOString(),
        quoteNumber: record.number,
        quoteId: record._id.toString(),
        validUntil: record.validUntil.toISOString(),
        total: record.total,
        status: record.status,
        projectName,
        projectId: project?._id?.toString(),
        client: { name: clientName, email: clientEmail },
        daysUntilExpiry
      };
    }

    default:
      return { recordId: record._id.toString(), recordType: source };
  }
};

export default { checkDateTriggers };
