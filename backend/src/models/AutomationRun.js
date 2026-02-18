import mongoose from 'mongoose';

// Execution log entry for each node
const executionLogSchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  nodeType: String,
  actionType: String,
  label: String,

  startedAt: { type: Date, default: Date.now },
  completedAt: Date,

  status: {
    type: String,
    enum: ['pending', 'running', 'success', 'failed', 'skipped'],
    default: 'pending'
  },

  // Input data for this node
  input: mongoose.Schema.Types.Mixed,

  // Output data from this node
  output: mongoose.Schema.Types.Mixed,

  // Error message if failed
  error: String,

  // Duration in ms
  durationMs: Number
}, { _id: false });

const automationRunSchema = new mongoose.Schema({
  automation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Automation',
    required: true
  },

  // Snapshot of automation name (in case it changes)
  automationName: String,

  // Trigger data that started this run
  triggerData: mongoose.Schema.Types.Mixed,

  // Trigger type
  triggerType: String,

  // Overall run status
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'waiting', 'cancelled'],
    default: 'pending'
  },

  // Current node being executed (for waiting runs)
  currentNodeId: String,

  // Execution history
  executionLog: [executionLogSchema],

  // Context data passed between nodes
  context: mongoose.Schema.Types.Mixed,

  // For wait nodes - when to resume
  scheduledAt: Date,

  // Error message if run failed
  error: String,

  // Timing
  startedAt: Date,
  completedAt: Date,

  // Duration in ms
  durationMs: Number
}, {
  timestamps: true
});

// Indexes
automationRunSchema.index({ automation: 1, createdAt: -1 });
automationRunSchema.index({ status: 1 });
automationRunSchema.index({ scheduledAt: 1, status: 1 });  // For finding runs to resume

// Calculate duration on completion
automationRunSchema.pre('save', function(next) {
  if (this.completedAt && this.startedAt) {
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();
  }
  next();
});

// Static method to find runs ready to resume
automationRunSchema.statics.findReadyToResume = function() {
  return this.find({
    status: 'waiting',
    scheduledAt: { $lte: new Date() }
  }).populate('automation');
};

export default mongoose.model('AutomationRun', automationRunSchema);
