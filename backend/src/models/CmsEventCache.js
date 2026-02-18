import mongoose from 'mongoose';

const cmsEventCacheSchema = new mongoose.Schema({
  // Type of cached data
  type: {
    type: String,
    enum: ['poll_checkpoint', 'order_event', 'customer_event'],
    required: true
  },

  // User ID for multi-tenant support
  userId: {
    type: String,
    index: true
  },

  // Event type (for order_event, customer_event)
  eventType: String,

  // Cached data
  data: mongoose.Schema.Types.Mixed,

  // For poll_checkpoint: when was the last check
  checkedAt: Date,

  // For events: when was it processed
  processedAt: Date,

  // Count of items processed (for poll_checkpoint)
  count: Number,

  // Reference to external ID (e.g., CMS order ID)
  externalId: String,

  // Status hash to detect changes
  statusHash: String
}, {
  timestamps: true
});

// Indexes
cmsEventCacheSchema.index({ type: 1, userId: 1, checkedAt: -1 });
cmsEventCacheSchema.index({ externalId: 1, eventType: 1, userId: 1 });
cmsEventCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL: 30 days

// Static method to get last poll checkpoint
cmsEventCacheSchema.statics.getLastCheckpoint = async function(pollType = 'orders', userId = null) {
  const query = {
    type: 'poll_checkpoint',
    'data.pollType': pollType
  };

  if (userId) {
    query.userId = userId;
  }

  const checkpoint = await this.findOne(query).sort({ checkedAt: -1 });

  return checkpoint?.checkedAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: 24h ago
};

// Static method to create poll checkpoint
cmsEventCacheSchema.statics.createCheckpoint = function(pollType, count, userId = null) {
  return this.create({
    type: 'poll_checkpoint',
    userId,
    data: { pollType },
    checkedAt: new Date(),
    count
  });
};

// Static method to check if event was already processed
cmsEventCacheSchema.statics.wasProcessed = async function(externalId, eventType, userId = null) {
  const query = {
    externalId,
    eventType
  };

  if (userId) {
    query.userId = userId;
  }

  const existing = await this.findOne(query);
  return !!existing;
};

// Static method to mark event as processed
cmsEventCacheSchema.statics.markProcessed = function(externalId, eventType, data = {}, userId = null) {
  return this.create({
    type: eventType.includes('order') ? 'order_event' : 'customer_event',
    userId,
    eventType,
    externalId,
    data,
    processedAt: new Date()
  });
};

export default mongoose.model('CmsEventCache', cmsEventCacheSchema);
