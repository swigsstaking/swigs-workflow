import Automation from '../../models/Automation.js';
import AutomationRun from '../../models/AutomationRun.js';
import { executeRun } from './executorService.js';

/**
 * Fire a trigger and execute matching automations
 * @param {string} triggerType - Type of trigger (e.g., 'order.paid')
 * @param {object} data - Trigger data
 * @param {object} options - Additional options (siteId, userId)
 */
export const fireTrigger = async (triggerType, data, options = {}) => {
  console.log(`🎯 Trigger fired: ${triggerType}`);

  try {
    // Find all active automations with this trigger type
    const query = {
      isActive: true,
      triggerType
    };

    // Filter by user if specified
    if (options.userId) {
      query.userId = options.userId;
    }

    const automations = await Automation.find(query);

    console.log(`   Found ${automations.length} matching automations`);

    // Execute each matching automation
    const results = await Promise.allSettled(
      automations.map(automation => executeAutomation(automation, triggerType, data, options))
    );

    // Log results
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`   ❌ Automation ${automations[index].name} failed:`, result.reason);
      } else {
        console.log(`   ✅ Automation ${automations[index].name} started: ${result.value}`);
      }
    });

    return results;
  } catch (error) {
    console.error('Trigger error:', error);
    throw error;
  }
};

/**
 * Execute a single automation
 */
const executeAutomation = async (automation, triggerType, data, options) => {
  // Check trigger config filters
  if (automation.triggerConfig) {
    // Filter by siteId if specified
    if (automation.triggerConfig.siteId && options.siteId) {
      if (automation.triggerConfig.siteId.toString() !== options.siteId.toString()) {
        return null;  // Skip - different site
      }
    }

    // Filter by status if specified
    if (automation.triggerConfig.statusFilter && data.status) {
      if (automation.triggerConfig.statusFilter !== data.status) {
        return null;  // Skip - different status
      }
    }
  }

  // Create automation run
  const run = await AutomationRun.create({
    automation: automation._id,
    automationName: automation.name,
    triggerType,
    triggerData: data,
    status: 'pending',
    context: {
      ...data,
      _trigger: {
        type: triggerType,
        timestamp: new Date().toISOString()
      }
    }
  });

  // Execute asynchronously
  executeRun(run._id).catch(err => {
    console.error(`Automation ${automation.name} execution error:`, err);
  });

  return run._id;
};

/**
 * Fire internal workflow triggers
 */
export const fireInternalTrigger = async (triggerType, data, userId = null) => {
  return fireTrigger(triggerType, data, { userId });
};

/**
 * Trigger types and their expected data structures
 */
export const TRIGGER_TYPES = {
  // CMS triggers (from polling)
  'order.created': {
    description: 'Nouvelle commande créée',
    expectedData: ['orderId', 'orderNumber', 'customer', 'items', 'total', 'siteId']
  },
  'order.paid': {
    description: 'Commande payée',
    expectedData: ['orderId', 'orderNumber', 'customer', 'total', 'payment', 'siteId']
  },
  'order.shipped': {
    description: 'Commande expédiée',
    expectedData: ['orderId', 'orderNumber', 'customer', 'shipping', 'siteId']
  },
  'order.delivered': {
    description: 'Commande livrée',
    expectedData: ['orderId', 'orderNumber', 'customer', 'siteId']
  },
  'customer.created': {
    description: 'Nouveau client',
    expectedData: ['customerId', 'email', 'firstName', 'lastName', 'siteId']
  },
  'customer.updated': {
    description: 'Client mis à jour',
    expectedData: ['customerId', 'email', 'changedFields', 'siteId']
  },

  // Internal workflow triggers
  'project.status_changed': {
    description: 'Statut projet changé',
    expectedData: ['projectId', 'projectName', 'oldStatus', 'newStatus', 'client']
  },
  'invoice.created': {
    description: 'Facture créée',
    expectedData: ['invoiceId', 'invoiceNumber', 'projectId', 'total', 'client']
  },
  'invoice.paid': {
    description: 'Facture payée',
    expectedData: ['invoiceId', 'invoiceNumber', 'projectId', 'total', 'paidAt']
  },
  'quote.signed': {
    description: 'Devis signé',
    expectedData: ['quoteId', 'quoteNumber', 'projectId', 'total', 'client']
  },

  // Time-based triggers
  'time.schedule': {
    description: 'Planifié (cron)',
    expectedData: []
  },

  // Manual trigger
  'manual': {
    description: 'Déclenché manuellement',
    expectedData: []
  }
};

export default {
  fireTrigger,
  fireInternalTrigger,
  TRIGGER_TYPES
};
