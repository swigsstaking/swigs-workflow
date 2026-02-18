import schedulerService from './schedulerService.js';
import cmsPollerService from './cmsPollerService.js';
import { fireTrigger, fireInternalTrigger, TRIGGER_TYPES } from './triggerService.js';
import { executeRun, resumeRun } from './executorService.js';
import { sendTemplateEmail, sendRawEmail, verifyConnection } from './emailService.js';

/**
 * Initialize all automation services
 * Call this after MongoDB connection is established
 */
export const initializeAutomationServices = () => {
  console.log('\n🤖 Initializing Automation Services...\n');

  // Initialize scheduler (handles cron jobs and wait resumes)
  schedulerService.initialize();

  // Initialize CMS poller (polls external CMS for events)
  cmsPollerService.initialize();

  console.log('\n✅ All Automation Services initialized\n');
};

/**
 * Shutdown all automation services
 * Call this on app shutdown
 */
export const shutdownAutomationServices = () => {
  console.log('\n🛑 Shutting down Automation Services...\n');

  schedulerService.shutdown();
  cmsPollerService.stop();

  console.log('✅ All Automation Services stopped\n');
};

// Export individual services for direct access
export {
  schedulerService,
  cmsPollerService,
  fireTrigger,
  fireInternalTrigger,
  TRIGGER_TYPES,
  executeRun,
  resumeRun,
  sendTemplateEmail,
  sendRawEmail,
  verifyConnection
};

export default {
  initializeAutomationServices,
  shutdownAutomationServices,
  schedulerService,
  cmsPollerService,
  fireTrigger,
  fireInternalTrigger,
  TRIGGER_TYPES,
  executeRun,
  resumeRun,
  sendTemplateEmail,
  sendRawEmail,
  verifyConnection
};
