import mongoose from 'mongoose';
import Counter from './Counter.js';

const invoiceEventSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  description: String,
  type: String,
  hours: Number,
  hourlyRate: Number,
  amount: Number,
  date: Date
}, { _id: false });

// Custom line schema (for custom invoices without events/quotes)
const customLineSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: 0
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const invoiceQuoteLineSchema = new mongoose.Schema({
  description: String,
  quantity: Number,
  unitPrice: Number,
  total: Number
}, { _id: false });

const invoiceQuoteSchema = new mongoose.Schema({
  quoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  },
  number: String,
  lines: [invoiceQuoteLineSchema],
  subtotal: Number,
  signedAt: Date
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Le projet est requis']
  },
  number: {
    type: String,
    required: [true, 'Le numéro de facture est requis'],
    unique: true
  },

  // Invoice type: standard (from events/quotes) or custom (free lines)
  invoiceType: {
    type: String,
    enum: ['standard', 'custom'],
    default: 'standard'
  },

  // Snapshot of events (for standard invoices)
  events: [invoiceEventSchema],

  // Snapshot of quotes (for standard invoices)
  quotes: [invoiceQuoteSchema],

  // Custom lines (for custom invoices)
  customLines: [customLineSchema],

  // Totals
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  vatRate: {
    type: Number,
    default: 20,
    min: 0,
    max: 100
  },
  vatAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft'
  },

  // Dates
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: [true, 'La date d\'échéance est requise']
  },
  paidAt: {
    type: Date,
    default: null
  },

  // PDF
  pdfPath: {
    type: String,
    default: null
  },

  // Notes
  notes: {
    type: String,
    trim: true
  },

  // Reminders
  skipReminders: {
    type: Boolean,
    default: false
  },
  reminders: [{
    sentAt: {
      type: Date,
      required: true
    },
    type: {
      type: String,
      required: true
    },
    emailSent: {
      type: Boolean,
      default: false
    }
  }],
  nextReminderDate: {
    type: Date,
    default: null
  },
  reminderCount: {
    type: Number,
    default: 0
  },

  // AbaNinja sync
  abaNinjaId: {
    type: Number,
    default: null
  },
  abaNinjaSyncedAt: {
    type: Date,
    default: null
  },
  abaNinjaSyncStatus: {
    type: String,
    enum: ['pending', 'synced', 'error', null],
    default: null
  }
}, {
  timestamps: true
});

// Generate invoice number (atomic — safe for PM2 cluster)
invoiceSchema.statics.generateNumber = async function(userId) {
  const year = new Date().getFullYear();
  const seq = await Counter.getNextSequence(`invoice_${year}_${userId || 'global'}`);
  return `FAC-${year}-${String(seq).padStart(3, '0')}`;
};

// Indexes for common query patterns
// Note: number already has an index via unique: true
invoiceSchema.index({ project: 1, createdAt: -1 });
invoiceSchema.index({ project: 1, status: 1 }); // For filtering by project + status
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ issueDate: -1 }); // For analytics queries
invoiceSchema.index({ issueDate: 1, status: 1 }); // For revenue analytics
invoiceSchema.index({ project: 1, issueDate: 1, status: 1 }); // For project analytics queries

export default mongoose.model('Invoice', invoiceSchema);
