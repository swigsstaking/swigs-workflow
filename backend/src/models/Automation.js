import mongoose from 'mongoose';

// Node configuration schemas for different node types
const triggerConfigSchema = new mongoose.Schema({
  siteId: mongoose.Schema.Types.ObjectId,
  statusFilter: String,
  scheduleExpression: String  // For time.schedule (cron format)
}, { _id: false });

const actionConfigSchema = new mongoose.Schema({
  // For send_email action
  templateId: mongoose.Schema.Types.ObjectId,
  to: String,  // 'customer', 'admin', or email address

  // For webhook action
  webhookUrl: String,
  webhookMethod: { type: String, enum: ['GET', 'POST'], default: 'POST' },

  // For update_record action
  recordType: String,
  recordField: String,
  recordValue: String
}, { _id: false });

const conditionConfigSchema = new mongoose.Schema({
  field: String,        // e.g., 'order.total', 'customer.email'
  operator: {
    type: String,
    enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
  },
  value: mongoose.Schema.Types.Mixed
}, { _id: false });

const waitConfigSchema = new mongoose.Schema({
  duration: Number,     // Duration value
  unit: {
    type: String,
    enum: ['minutes', 'hours', 'days'],
    default: 'hours'
  }
}, { _id: false });

// Connection schema (edges between nodes)
const connectionSchema = new mongoose.Schema({
  targetId: { type: String, required: true },
  condition: { type: String, default: 'default' }  // 'default', 'true', 'false'
}, { _id: false });

// Node schema
const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['trigger', 'action', 'condition', 'wait'],
    required: true
  },

  // Action subtype for action nodes
  actionType: {
    type: String,
    enum: ['send_email', 'send_sms', 'webhook', 'update_record', 'create_task']
  },

  // Position on canvas
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },

  // Label for display
  label: String,

  // Configuration based on type
  triggerConfig: triggerConfigSchema,
  actionConfig: actionConfigSchema,
  conditionConfig: conditionConfigSchema,
  waitConfig: waitConfigSchema,

  // Outgoing connections
  connections: [connectionSchema]
}, { _id: false });

// Main Automation schema
const automationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true
  },

  description: {
    type: String,
    trim: true
  },

  // Active state
  isActive: {
    type: Boolean,
    default: false
  },

  // Main trigger type
  triggerType: {
    type: String,
    enum: [
      'order.created',
      'order.paid',
      'order.shipped',
      'order.delivered',
      'customer.created',
      'customer.updated',
      'time.schedule',
      'project.status_changed',
      'invoice.created',
      'invoice.paid',
      'quote.signed',
      'manual'
    ],
    required: true
  },

  // Trigger configuration (for filtering)
  triggerConfig: triggerConfigSchema,

  // All nodes in the workflow
  nodes: [nodeSchema],

  // Statistics
  stats: {
    totalRuns: { type: Number, default: 0 },
    successfulRuns: { type: Number, default: 0 },
    failedRuns: { type: Number, default: 0 },
    lastRunAt: Date,
    lastError: String
  }
}, {
  timestamps: true
});

// Indexes
automationSchema.index({ userId: 1, isActive: 1 });
automationSchema.index({ triggerType: 1, isActive: 1 });

// Virtual for run count
automationSchema.virtual('runCount').get(function() {
  return this.stats.totalRuns;
});

export default mongoose.model('Automation', automationSchema);
