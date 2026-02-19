import mongoose from 'mongoose';

const historySchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Le projet est requis']
  },
  action: {
    type: String,
    required: [true, 'L\'action est requise'],
    enum: [
      'project_created',
      'project_updated',
      'project_archived',
      'project_restored',
      'status_change',
      'event_added',
      'event_updated',
      'event_deleted',
      'quote_created',
      'quote_sent',
      'quote_signed',
      'quote_refused',
      'invoice_created',
      'invoice_sent',
      'invoice_paid',
      'invoice_cancelled',
      'invoice_deleted',
      'bank_import',
      'bank_reconciled'
    ]
  },
  description: {
    type: String,
    required: [true, 'La description est requise']
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  user: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Make history immutable (no updates allowed)
historySchema.pre('findOneAndUpdate', function() {
  throw new Error('L\'historique ne peut pas être modifié');
});

// Index for querying
historySchema.index({ project: 1, createdAt: -1 });

export default mongoose.model('History', historySchema);
