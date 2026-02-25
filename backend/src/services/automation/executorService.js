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

    case 'create_task':
      return await executeCreateTask(run, config);

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

  // Test mode: override recipient with test email
  const originalTo = recipient;
  if (run.context?._test?.enabled && run.context._test.email) {
    recipient = run.context._test.email;
  }

  const result = await sendTemplateEmail(templateId, recipient, run.context);

  const output = { emailSent: true, to: recipient, messageId: result.messageId };
  if (run.context?._test?.enabled) {
    output.originalTo = originalTo;
    output.testMode = true;
  }
  return output;
};

/**
 * Check if an IPv4 address string targets a private/internal/cloud-metadata range.
 * Used both for literal IPs in the URL and for DNS-resolved IPs.
 */
const isIpBlocked = (ip) => {
  // Exact matches for cloud metadata services
  const blockedExact = [
    '169.254.169.254', // AWS / GCP / Azure IMDS
    '168.63.129.16',   // Azure Wire Server / IMDS alternate
    '100.100.100.200', // Alibaba Cloud metadata
  ];
  if (blockedExact.includes(ip)) return true;

  const parts = ip.split('.');
  if (parts.length !== 4 || !parts.every(p => /^\d+$/.test(p))) return false;

  const [a, b] = parts.map(Number);

  if (a === 0) return true;           // 0.0.0.0/8  (localhost equiv on Linux)
  if (a === 10) return true;          // 10.0.0.0/8
  if (a === 127) return true;         // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && b === 51) return true;  // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0) return true;   // 203.0.113.0/24 TEST-NET-3
  if (a === 240) return true;         // 240.0.0.0/4 reserved

  return false;
};

/**
 * Check if a URL targets a private/internal network (SSRF protection).
 * Performs a DNS pre-resolution to defeat DNS-rebinding attacks.
 * Exported for reuse in other services (e.g. settings validation).
 */
export const isUrlAllowed = async (urlString) => {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block non-http(s) schemes
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;

  // Block localhost variants
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;

  // Block .internal / .local / .localhost domains
  if (
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  ) return false;

  // If the hostname is a literal IPv4, check it directly
  const ipv4Parts = hostname.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every(p => /^\d+$/.test(p))) {
    if (isIpBlocked(hostname)) return false;
    return true;
  }

  // For hostnames: resolve DNS to catch SSRF via DNS rebinding
  try {
    const { promises: dns } = await import('dns');
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isIpBlocked(addr)) return false;
    }
  } catch {
    // DNS resolution failed — deny to be safe
    return false;
  }

  return true;
};

/**
 * Execute webhook action
 */
const executeWebhook = async (run, config) => {
  const { webhookUrl, webhookMethod = 'POST' } = config;

  if (!webhookUrl) {
    throw new Error('Webhook URL is required');
  }

  if (!await isUrlAllowed(webhookUrl)) {
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
 * Execute create_task action via Event Bus
 */
const executeCreateTask = async (run, config) => {
  const { taskTitle, taskDescription, assignTo } = config;

  if (!taskTitle) {
    throw new Error('Task title is required');
  }

  // Import the event bus singleton
  const { default: eventBus } = await import('../eventBus.service.js');

  const taskPayload = {
    title: taskTitle,
    description: taskDescription || '',
    assignTo: assignTo || null,
    source: 'automation',
    automationId: run.automation?._id?.toString(),
    context: run.context
  };

  const published = eventBus.publish('task.create', taskPayload);

  return {
    taskCreated: true,
    published,
    title: taskTitle,
    assignTo: assignTo || 'non assignée'
  };
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
