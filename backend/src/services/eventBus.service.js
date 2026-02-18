/**
 * SWIGS Event Bus Client for swigs-workflow
 * Connects to Hub's WebSocket Event Bus for inter-app communication
 */

import WebSocket from 'ws';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';

const {
  HUB_WS_URL = 'wss://apps.swigs.online',
  APP_ID = 'swigs-workflow',
  APP_SECRET
} = process.env;

/**
 * Generate a service JWT for Event Bus authentication
 * The Hub verifies this JWT with the shared secret
 */
const generateServiceToken = () => {
  if (!APP_SECRET) return null;

  return jwt.sign(
    {
      app: APP_ID,
      type: 'service',
      iat: Math.floor(Date.now() / 1000)
    },
    APP_SECRET,
    { expiresIn: '1h' }
  );
};

class EventBusService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.subscriptions = new Set();
    this.pendingEvents = [];
  }

  /**
   * Connect to Event Bus
   */
  async connect() {
    if (!APP_SECRET) {
      console.warn('[EventBus] APP_SECRET not configured, skipping connection');
      return false;
    }

    return new Promise((resolve, reject) => {
      // Generate a JWT signed with the shared secret
      const serviceToken = generateServiceToken();
      if (!serviceToken) {
        console.warn('[EventBus] Failed to generate service token');
        return reject(new Error('Token generation failed'));
      }

      const url = `${HUB_WS_URL}/ws/events?token=${encodeURIComponent(serviceToken)}&app_id=${encodeURIComponent(APP_ID)}`;

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('[EventBus] Connected to Hub');

        // Resubscribe to events
        if (this.subscriptions.size > 0) {
          this.send({ action: 'subscribe', events: [...this.subscriptions] });
        }

        // Send pending events
        while (this.pendingEvents.length > 0) {
          const event = this.pendingEvents.shift();
          this.ws.send(JSON.stringify(event));
        }

        this.emit('connected');
        resolve(true);
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'event') {
            // Emit to specific listeners
            this.emit(message.event, message);
            // Emit to wildcard listeners
            this.emit('*', message);
          } else if (message.type === 'connected') {
            console.log('[EventBus] Connection acknowledged');
          } else if (message.type === 'error') {
            console.error('[EventBus] Server error:', message.error);
          }
        } catch (e) {
          console.error('[EventBus] Failed to parse message:', e);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        console.log(`[EventBus] Disconnected: ${code} ${reason}`);
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[EventBus] Error:', err.message);
        if (!this.connected) {
          reject(err);
        }
      });
    });
  }

  /**
   * Subscribe to event types
   * @param {string|string[]} events - Event types (e.g., 'order.created', 'order.*')
   */
  subscribe(events) {
    const eventList = Array.isArray(events) ? events : [events];

    eventList.forEach(event => this.subscriptions.add(event));

    if (this.connected) {
      this.send({ action: 'subscribe', events: eventList });
    }
  }

  /**
   * Unsubscribe from event types
   */
  unsubscribe(events) {
    const eventList = Array.isArray(events) ? events : [events];

    eventList.forEach(event => this.subscriptions.delete(event));

    if (this.connected) {
      this.send({ action: 'unsubscribe', events: eventList });
    }
  }

  /**
   * Publish an event
   * @param {string} event - Event type (e.g., 'invoice.created')
   * @param {Object} payload - Event data
   */
  publish(event, payload) {
    const timestamp = new Date().toISOString();
    const signature = this.signMessage(payload, timestamp);

    const message = {
      action: 'publish',
      event,
      payload,
      timestamp,
      signature
    };

    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue for later (max 1000)
      if (this.pendingEvents.length >= 1000) {
        console.warn('[EventBus] Pending events queue full, dropping event');
        return false;
      }
      this.pendingEvents.push(message);
    }

    return true;
  }

  /**
   * Sign message with HMAC-SHA256
   */
  signMessage(payload, timestamp) {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signatureBase = `${timestamp}.${data}`;
    return crypto
      .createHmac('sha256', APP_SECRET)
      .update(signatureBase)
      .digest('hex');
  }

  /**
   * Send message to WebSocket
   */
  send(message) {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[EventBus] Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[EventBus] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }

  /**
   * Disconnect from Event Bus
   */
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connected = false;
  }

  /**
   * Check if connected
   */
  get isConnected() {
    return this.connected;
  }
}

// Singleton instance
export const eventBus = new EventBusService();

/**
 * Initialize Event Bus and set up automation triggers
 */
export const initEventBus = async () => {
  // Lazy import to avoid circular dependency
  const { fireTrigger } = await import('./automation/triggerService.js');

  try {
    await eventBus.connect();

    // CMS events to subscribe and trigger automations
    const cmsEvents = [
      'order.created',
      'order.paid',
      'order.shipped',
      'order.delivered',
      'customer.created',
      'customer.updated'
    ];

    // Subscribe to CMS events
    eventBus.subscribe(cmsEvents);

    // Log all incoming events
    eventBus.on('*', (event) => {
      console.log(`[EventBus] Received: ${event.event} from ${event.source}`);
    });

    // Connect CMS events to automation triggers
    cmsEvents.forEach(eventType => {
      eventBus.on(eventType, async (event) => {
        try {
          console.log(`[EventBus] Triggering automations for: ${eventType}`);
          await fireTrigger(eventType, event.payload, {
            siteId: event.payload?.siteId
          });
        } catch (err) {
          console.error(`[EventBus] Failed to trigger automation for ${eventType}:`, err);
        }
      });
    });

    console.log('[EventBus] Initialized and listening for events');
    return true;
  } catch (err) {
    console.warn('[EventBus] Failed to initialize:', err.message);
    return false;
  }
};

export default eventBus;
