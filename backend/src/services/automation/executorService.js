import Automation from '../../models/Automation.js';
import AutomationRun from '../../models/AutomationRun.js';
import { sendTemplateEmail } from './emailService.js';

/**
 * Execute an automation run
 * @param {string} runId - AutomationRun ID
 */
export const executeRun = async (runId) => {
  const run = await AutomationRun.findById(runId).populate('automation');

  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  if (!run.automation) {
    await updateRunStatus(run, 'failed', 'Automation not found');
    return;
  }

  // Start execution
  run.status = 'running';
  run.startedAt = new Date();
  await run.save();

  try {
    // Find the trigger node (entry point)
    const triggerNode = run.automation.nodes.find(n => n.type === 'trigger');

    if (!triggerNode) {
      await updateRunStatus(run, 'failed', 'No trigger node found');
      return;
    }

    // Execute starting from trigger
    await executeNode(run, triggerNode);

    // Check if run is still running (not waiting)
    const updatedRun = await AutomationRun.findById(runId);
    if (updatedRun.status === 'running') {
      await updateRunStatus(updatedRun, 'completed');
    }

    // Update automation stats
    await Automation.findByIdAndUpdate(run.automation._id, {
      $inc: {
        'stats.totalRuns': 1,
        'stats.successfulRuns': updatedRun.status === 'completed' ? 1 : 0
      },
      'stats.lastRunAt': new Date()
    });

  } catch (error) {
    console.error(`Run ${runId} execution error:`, error);
    await updateRunStatus(run, 'failed', error.message);

    // Update automation stats
    await Automation.findByIdAndUpdate(run.automation._id, {
      $inc: { 'stats.totalRuns': 1, 'stats.failedRuns': 1 },
      'stats.lastRunAt': new Date(),
      'stats.lastError': error.message
    });
  }
};

/**
 * Execute a single node
 */
const executeNode = async (run, node) => {
  if (!node) return;

  const startTime = Date.now();
  const logEntry = {
    nodeId: node.id,
    nodeType: node.type,
    actionType: node.actionType,
    label: node.label,
    startedAt: new Date(),
    status: 'running',
    input: run.context
  };

  try {
    let output = {};
    let shouldContinue = true;

    switch (node.type) {
      case 'trigger':
        // Trigger node just passes through
        output = { triggered: true };
        break;

      case 'action':
        output = await executeAction(run, node);
        break;

      case 'condition':
        const result = evaluateCondition(run.context, node.conditionConfig);
        output = { conditionResult: result };
        shouldContinue = true;  // We handle branching differently
        break;

      case 'wait':
        const waitResult = await handleWait(run, node);
        if (waitResult.waiting) {
          logEntry.status = 'success';
          logEntry.output = { waiting: true, resumeAt: waitResult.resumeAt };
          logEntry.completedAt = new Date();
          logEntry.durationMs = Date.now() - startTime;
          run.executionLog.push(logEntry);
          await run.save();
          return;  // Stop execution, will resume later
        }
        output = { waited: true };
        break;
    }

    // Log success
    logEntry.status = 'success';
    logEntry.output = output;
    logEntry.completedAt = new Date();
    logEntry.durationMs = Date.now() - startTime;
    run.executionLog.push(logEntry);

    // Update context with output
    run.context = { ...run.context, [`node_${node.id}`]: output };
    await run.save();

    // Execute next nodes
    if (shouldContinue && node.connections?.length > 0) {
      for (const connection of node.connections) {
        // For conditions, check which branch to take
        if (node.type === 'condition') {
          const conditionResult = output.conditionResult;
          if (
            (connection.condition === 'true' && conditionResult) ||
            (connection.condition === 'false' && !conditionResult) ||
            connection.condition === 'default'
          ) {
            const nextNode = run.automation.nodes.find(n => n.id === connection.targetId);
            await executeNode(run, nextNode);
          }
        } else {
          const nextNode = run.automation.nodes.find(n => n.id === connection.targetId);
          await executeNode(run, nextNode);
        }
      }
    }

  } catch (error) {
    logEntry.status = 'failed';
    logEntry.error = error.message;
    logEntry.completedAt = new Date();
    logEntry.durationMs = Date.now() - startTime;
    run.executionLog.push(logEntry);
    await run.save();
    throw error;
  }
};

/**
 * Execute an action node
 */
const executeAction = async (run, node) => {
  const config = node.actionConfig || {};

  switch (node.actionType) {
    case 'send_email':
      return await executeSendEmail(run, config);

    case 'webhook':
      return await executeWebhook(run, config);

    case 'update_record':
      return await executeUpdateRecord(run, config);

    default:
      return { skipped: true, reason: `Unknown action type: ${node.actionType}` };
  }
};

/**
 * Execute send_email action
 */
const executeSendEmail = async (run, config) => {
  const { templateId, to } = config;

  if (!templateId) {
    throw new Error('Template ID is required');
  }

  // Determine recipient
  let recipient = to;
  if (to === 'customer' && run.context.customer?.email) {
    recipient = run.context.customer.email;
  } else if (to === 'admin') {
    // Get from settings or default
    recipient = process.env.ADMIN_EMAIL || 'admin@swigs.online';
  }

  if (!recipient) {
    throw new Error('No recipient email found');
  }

  const result = await sendTemplateEmail(templateId, recipient, run.context);
  return { emailSent: true, to: recipient, messageId: result.messageId };
};

/**
 * Check if a URL targets a private/internal network (SSRF protection)
 */
const isUrlAllowed = (urlString) => {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();

    // Block non-http(s) schemes
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;

    // Block .internal / .local domains
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;

    // Block private IPs (10.x, 172.16-31.x, 192.168.x, 169.254.x link-local)
    const parts = hostname.split('.');
    if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
      const [a, b] = parts.map(Number);
      if (a === 10) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
      if (a === 0) return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Execute webhook action
 */
const executeWebhook = async (run, config) => {
  const { webhookUrl, webhookMethod = 'POST' } = config;

  if (!webhookUrl) {
    throw new Error('Webhook URL is required');
  }

  if (!isUrlAllowed(webhookUrl)) {
    throw new Error('Webhook URL targets a disallowed address');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(webhookUrl, {
      method: webhookMethod,
      headers: { 'Content-Type': 'application/json' },
      body: webhookMethod === 'POST' ? JSON.stringify(run.context) : undefined,
      signal: controller.signal,
      redirect: 'error'
    });

    return {
      webhookCalled: true,
      url: webhookUrl,
      status: response.status,
      ok: response.ok
    };
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Execute update_record action (placeholder for future)
 */
const executeUpdateRecord = async (run, config) => {
  // TODO: Implement record updates
  return { updated: false, reason: 'Not implemented yet' };
};

/**
 * Evaluate a condition
 */
const evaluateCondition = (context, config) => {
  if (!config) return true;

  const { field, operator, value } = config;

  // Get field value from context using dot notation
  const fieldValue = field?.split('.').reduce((obj, key) => obj?.[key], context);

  switch (operator) {
    case 'equals':
      return fieldValue == value;
    case 'not_equals':
      return fieldValue != value;
    case 'contains':
      return String(fieldValue || '').includes(String(value));
    case 'greater_than':
      return Number(fieldValue) > Number(value);
    case 'less_than':
      return Number(fieldValue) < Number(value);
    case 'is_empty':
      return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return fieldValue && fieldValue !== '' && !(Array.isArray(fieldValue) && fieldValue.length === 0);
    default:
      return true;
  }
};

/**
 * Handle wait node - schedule resume
 */
const handleWait = async (run, node) => {
  const config = node.waitConfig || {};
  const { duration = 1, unit = 'hours' } = config;

  // Calculate resume time
  const multipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };

  const waitMs = duration * (multipliers[unit] || multipliers.hours);
  const resumeAt = new Date(Date.now() + waitMs);

  // Update run to waiting state
  run.status = 'waiting';
  run.currentNodeId = node.id;
  run.scheduledAt = resumeAt;
  await run.save();

  return { waiting: true, resumeAt };
};

/**
 * Resume a waiting run
 */
export const resumeRun = async (runId) => {
  const run = await AutomationRun.findById(runId).populate('automation');

  if (!run || run.status !== 'waiting') {
    return;
  }

  // Find the wait node we stopped at
  const waitNode = run.automation.nodes.find(n => n.id === run.currentNodeId);

  if (!waitNode) {
    await updateRunStatus(run, 'failed', 'Wait node not found');
    return;
  }

  // Resume execution
  run.status = 'running';
  run.currentNodeId = null;
  run.scheduledAt = null;
  await run.save();

  try {
    // Execute next nodes after wait
    if (waitNode.connections?.length > 0) {
      for (const connection of waitNode.connections) {
        const nextNode = run.automation.nodes.find(n => n.id === connection.targetId);
        await executeNode(run, nextNode);
      }
    }

    // Check final status
    const updatedRun = await AutomationRun.findById(runId);
    if (updatedRun.status === 'running') {
      await updateRunStatus(updatedRun, 'completed');
    }

  } catch (error) {
    await updateRunStatus(run, 'failed', error.message);
  }
};

/**
 * Update run status helper
 */
const updateRunStatus = async (run, status, error = null) => {
  run.status = status;
  if (status === 'completed' || status === 'failed') {
    run.completedAt = new Date();
  }
  if (error) {
    run.error = error;
  }
  await run.save();
};

export default {
  executeRun,
  resumeRun
};
