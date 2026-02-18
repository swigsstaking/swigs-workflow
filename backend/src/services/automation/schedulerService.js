import cron from 'node-cron';
import Automation from '../../models/Automation.js';
import AutomationRun from '../../models/AutomationRun.js';
import { resumeRun, executeRun } from './executorService.js';
import { fireTrigger } from './triggerService.js';

let scheduledJobs = new Map();
let resumeCheckJob = null;

/**
 * Initialize the scheduler service
 */
export const initialize = () => {
  console.log('⏰ Initializing Scheduler Service...');

  // Schedule job to check for waiting runs to resume (every minute)
  resumeCheckJob = cron.schedule('* * * * *', async () => {
    await checkWaitingRuns();
  });

  // Schedule job to refresh cron-based automations (every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    await refreshScheduledAutomations();
  });

  // Initial load of scheduled automations
  refreshScheduledAutomations();

  console.log('   ✅ Scheduler Service initialized');
};

/**
 * Check for waiting runs that need to be resumed
 */
const checkWaitingRuns = async () => {
  try {
    const runsToResume = await AutomationRun.findReadyToResume();

    for (const run of runsToResume) {
      console.log(`⏰ Resuming waiting run: ${run._id}`);
      resumeRun(run._id).catch(err => {
        console.error(`Failed to resume run ${run._id}:`, err);
      });
    }
  } catch (error) {
    console.error('Error checking waiting runs:', error);
  }
};

/**
 * Refresh scheduled automations (cron-based)
 */
const refreshScheduledAutomations = async () => {
  try {
    // Get all active cron-based automations
    const automations = await Automation.find({
      isActive: true,
      triggerType: 'time.schedule'
    });

    // Track which automations we found
    const foundIds = new Set();

    for (const automation of automations) {
      foundIds.add(automation._id.toString());

      const cronExpression = automation.triggerConfig?.scheduleExpression;
      if (!cronExpression) continue;

      // Skip if already scheduled with same cron
      const existingJob = scheduledJobs.get(automation._id.toString());
      if (existingJob?.cronExpression === cronExpression) {
        continue;
      }

      // Stop existing job if cron changed
      if (existingJob) {
        existingJob.job.stop();
      }

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        console.warn(`Invalid cron expression for automation ${automation.name}: ${cronExpression}`);
        continue;
      }

      // Schedule new job
      const job = cron.schedule(cronExpression, async () => {
        console.log(`⏰ Scheduled trigger for: ${automation.name}`);
        await fireTrigger('time.schedule', {
          automationId: automation._id,
          scheduledAt: new Date().toISOString()
        }, { userId: automation.userId });
      });

      scheduledJobs.set(automation._id.toString(), {
        job,
        cronExpression
      });

      console.log(`   📅 Scheduled automation: ${automation.name} (${cronExpression})`);
    }

    // Stop jobs for automations that no longer exist or are inactive
    for (const [id, { job }] of scheduledJobs) {
      if (!foundIds.has(id)) {
        job.stop();
        scheduledJobs.delete(id);
        console.log(`   🛑 Unscheduled automation: ${id}`);
      }
    }

  } catch (error) {
    console.error('Error refreshing scheduled automations:', error);
  }
};

/**
 * Manually schedule an automation
 */
export const scheduleAutomation = async (automationId, cronExpression) => {
  const automation = await Automation.findById(automationId);
  if (!automation) {
    throw new Error('Automation not found');
  }

  // Stop existing job
  const existingJob = scheduledJobs.get(automationId.toString());
  if (existingJob) {
    existingJob.job.stop();
  }

  // Validate cron
  if (!cron.validate(cronExpression)) {
    throw new Error('Invalid cron expression');
  }

  // Schedule new job
  const job = cron.schedule(cronExpression, async () => {
    console.log(`⏰ Scheduled trigger for: ${automation.name}`);
    await fireTrigger('time.schedule', {
      automationId: automation._id,
      scheduledAt: new Date().toISOString()
    }, { userId: automation.userId });
  });

  scheduledJobs.set(automationId.toString(), {
    job,
    cronExpression
  });

  return { scheduled: true, cronExpression };
};

/**
 * Unschedule an automation
 */
export const unscheduleAutomation = (automationId) => {
  const existingJob = scheduledJobs.get(automationId.toString());
  if (existingJob) {
    existingJob.job.stop();
    scheduledJobs.delete(automationId.toString());
    return { unscheduled: true };
  }
  return { unscheduled: false };
};

/**
 * Get scheduled jobs status
 */
export const getScheduledJobs = () => {
  const jobs = [];
  for (const [id, { cronExpression }] of scheduledJobs) {
    jobs.push({ automationId: id, cronExpression });
  }
  return jobs;
};

/**
 * Stop all scheduled jobs
 */
export const shutdown = () => {
  console.log('⏰ Shutting down Scheduler Service...');

  if (resumeCheckJob) {
    resumeCheckJob.stop();
  }

  for (const [id, { job }] of scheduledJobs) {
    job.stop();
  }

  scheduledJobs.clear();
  console.log('   ✅ Scheduler Service stopped');
};

export default {
  initialize,
  scheduleAutomation,
  unscheduleAutomation,
  getScheduledJobs,
  shutdown
};
