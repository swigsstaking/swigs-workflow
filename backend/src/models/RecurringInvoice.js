import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const customLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, required: true },
  unit: { type: String, default: '' }
}, { _id: false });

const recurringInvoiceSchema = new mongoose.Schema({
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  project: { type: ObjectId, ref: 'Project', required: true },

  // Template de facturation
  customLines: [customLineSchema],

  // Fréquence
  frequency: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
    required: true
  },
  dayOfMonth: { type: Number, min: 1, max: 28, default: 1 },

  // Plage
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },

  // Configuration
  vatRate: { type: Number, default: 8.1, min: 0 },
  paymentTermsDays: { type: Number, default: 30 },
  notes: { type: String, default: '' },
  autoSend: { type: Boolean, default: false },

  // Tracking
  status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
  lastGeneratedAt: { type: Date, default: null },
  nextGenerationDate: { type: Date, required: true },
  generatedInvoices: [{ type: ObjectId, ref: 'Invoice' }],
  totalGenerated: { type: Number, default: 0 }
}, { timestamps: true });

recurringInvoiceSchema.index({ status: 1, nextGenerationDate: 1 });
recurringInvoiceSchema.index({ userId: 1, status: 1 });

export default mongoose.model('RecurringInvoice', recurringInvoiceSchema);
