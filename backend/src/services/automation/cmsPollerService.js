import CmsEventCache from '../../models/CmsEventCache.js';
import Settings from '../../models/Settings.js';
import { fireTrigger } from './triggerService.js';
import { decrypt } from '../../utils/crypto.js';

let pollingInterval = null;
let isPolling = false;

const DEFAULT_POLL_INTERVAL = 60000; // 1 minute

/**
 * Initialize the CMS Poller Service (multi-tenant)
 */
export const initialize = () => {
  console.log('📡 Initializing CMS Poller Service (multi-tenant)...');

  // Start polling loop
  startPolling();

  console.log('   ✅ CMS Poller Service initialized');
};

/**
 * Start polling loop
 */
const startPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Initial poll
  pollAllUsers().catch(err => console.error('Initial poll error:', err));

  // Set up interval (check every minute for users to poll)
  pollingInterval = setInterval(async () => {
    if (!isPolling) {
      await pollAllUsers();
    }
  }, DEFAULT_POLL_INTERVAL);
};

/**
 * Poll all users with CMS integration enabled
 */
const pollAllUsers = async () => {
  if (isPolling) return;
  isPolling = true;

  try {
    // Find all settings with CMS enabled
    const settingsWithCms = await Settings.find({
      'cmsIntegration.enabled': true,
      'cmsIntegration.apiUrl': { $ne: '' },
      'cmsIntegration.serviceToken': { $ne: '' }
    });

    if (settingsWithCms.length === 0) {
      isPolling = false;
      return;
    }

    console.log(`📡 Polling CMS for ${settingsWithCms.length} user(s)...`);

    for (const settings of settingsWithCms) {
      // Check if it's time to poll for this user
      const lastPolled = settings.cmsIntegration.lastPolledAt;
      const pollInterval = settings.cmsIntegration.pollInterval || DEFAULT_POLL_INTERVAL;
      const now = new Date();

      if (lastPolled && (now - lastPolled) < pollInterval) {
        continue; // Not time to poll yet
      }

      await pollForUser(settings);
    }

  } catch (error) {
    console.error('📡 CMS Polling error:', error.message);
  } finally {
    isPolling = false;
  }
};

/**
 * Poll CMS for a specific user
 */
const pollForUser = async (settings) => {
  const userId = settings.userId;
  const { apiUrl, serviceToken: rawToken } = settings.cmsIntegration;
  const serviceToken = decrypt(rawToken);

  try {
    // Get last checkpoint for this user
    const lastCheck = await CmsEventCache.getLastCheckpoint('orders', userId?.toString());

    console.log(`   📡 Polling for user ${userId || 'global'} since ${lastCheck.toISOString()}`);

    // Fetch orders from CMS
    const response = await fetch(`${apiUrl}/orders?updatedSince=${lastCheck.toISOString()}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`   ⚠️ CMS API error for user ${userId}: ${response.status}`);
      return;
    }

    const data = await response.json();
    const orders = data.data || data;

    let processedCount = 0;

    for (const order of orders) {
      const processed = await processOrder(order, userId);
      if (processed) processedCount++;
    }

    // Update last polled timestamp
    await Settings.updateOne(
      { _id: settings._id },
      { 'cmsIntegration.lastPolledAt': new Date() }
    );

    // Create checkpoint
    await CmsEventCache.createCheckpoint('orders', processedCount, userId?.toString());

    if (processedCount > 0) {
      console.log(`   ✅ Processed ${processedCount} order events for user ${userId || 'global'}`);
    }

  } catch (error) {
    console.error(`   ❌ Error polling for user ${userId}:`, error.message);
  }
};

/**
 * Process a single order and fire appropriate triggers
 */
const processOrder = async (order, userId) => {
  try {
    // Check if already processed
    const wasProcessed = await CmsEventCache.wasProcessed(
      order._id,
      `order.${order.status}`,
      userId?.toString()
    );

    if (wasProcessed) {
      return false;
    }

    // Determine event type based on status
    const eventType = getOrderEventType(order.status);

    if (!eventType) {
      return false;
    }

    // Build trigger data
    const triggerData = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      customer: {
        email: order.customer?.email,
        firstName: order.customer?.firstName,
        lastName: order.customer?.lastName,
        phone: order.customer?.phone
      },
      items: order.items?.map(item => ({
        productId: item.product,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      subtotal: order.subtotal,
      total: order.total,
      currency: order.currency,
      payment: order.payment,
      shipping: order.shipping,
      siteId: order.site,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    // Fire trigger for specific user
    await fireTrigger(eventType, triggerData, { userId, siteId: order.site });

    // Mark as processed
    await CmsEventCache.markProcessed(
      order._id,
      eventType,
      { orderNumber: order.orderNumber, status: order.status },
      userId?.toString()
    );

    console.log(`   📨 Fired trigger ${eventType} for order ${order.orderNumber}`);

    return true;

  } catch (error) {
    console.error(`Error processing order ${order._id}:`, error);
    return false;
  }
};

/**
 * Map order status to event type
 */
const getOrderEventType = (status) => {
  const statusMap = {
    'pending': 'order.created',
    'paid': 'order.paid',
    'processing': null,
    'shipped': 'order.shipped',
    'delivered': 'order.delivered',
    'cancelled': null,
    'refunded': null
  };

  return statusMap[status];
};

/**
 * Manual poll trigger for a specific user
 */
export const triggerPollForUser = async (userId) => {
  const settings = await Settings.findOne({ userId });

  if (!settings || !settings.cmsIntegration?.enabled) {
    return { success: false, message: 'CMS integration not enabled for this user' };
  }

  await pollForUser(settings);
  return { success: true, message: 'Poll triggered' };
};

/**
 * Stop polling
 */
export const stop = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isPolling = false;
  console.log('📡 CMS Poller Service stopped');
};

/**
 * Get poller status for a user
 */
export const getStatus = async (userId = null) => {
  const query = userId ? { userId } : {};
  const settings = await Settings.findOne(query);

  const lastCheckpoint = await CmsEventCache.findOne({
    type: 'poll_checkpoint',
    ...(userId ? { userId: userId.toString() } : {})
  }).sort({ checkedAt: -1 });

  return {
    enabled: settings?.cmsIntegration?.enabled || false,
    apiUrl: settings?.cmsIntegration?.apiUrl || '',
    isPolling,
    pollInterval: settings?.cmsIntegration?.pollInterval || DEFAULT_POLL_INTERVAL,
    lastPolledAt: settings?.cmsIntegration?.lastPolledAt,
    lastCheck: lastCheckpoint?.checkedAt,
    lastCount: lastCheckpoint?.count
  };
};

export default {
  initialize,
  triggerPollForUser,
  stop,
  getStatus
};
