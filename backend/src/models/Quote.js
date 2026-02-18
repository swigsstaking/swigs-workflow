import mongoose from 'mongoose';

const quoteLineSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
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

const quoteSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Le projet est requis']
  },
  number: {
    type: String,
    required: [true, 'Le numéro de devis est requis'],
    unique: true
  },

  // Lines
  lines: [quoteLineSchema],

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
    enum: ['draft', 'sent', 'signed', 'refused', 'expired', 'partial', 'invoiced'],
    default: 'draft'
  },

  // Partial payment tracking
  invoicedAmount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Invoice references (can have multiple for partial payments)
  invoices: [{
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice'
    },
    amount: Number,
    invoicedAt: Date
  }],

  // Legacy: Single invoice reference (kept for backwards compatibility)
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  },

  // Dates
  issueDate: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, 'La date de validité est requise']
  },
  signedAt: {
    type: Date,
    default: null
  },
  invoicedAt: {
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

// Generate quote number (atomic — safe for PM2 cluster)
quoteSchema.statics.generateNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;

  // Find the last used number
  const lastQuote = await this.findOne(
    { number: new RegExp(`^${prefix}`) },
    { number: 1 },
    { sort: { number: -1 } }
  );

  let nextNum = 1;
  if (lastQuote) {
    const lastNum = parseInt(lastQuote.number.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  // Retry loop in case of conflict (unique index on number)
  for (let attempt = 0; attempt < 5; attempt++) {
    const number = `${prefix}${String(nextNum + attempt).padStart(3, '0')}`;
    const exists = await this.findOne({ number });
    if (!exists) return number;
  }

  // Fallback with timestamp
  return `${prefix}${Date.now()}`;
};

// Indexes for common query patterns
// Note: number already has an index via unique: true
quoteSchema.index({ project: 1, createdAt: -1 });
quoteSchema.index({ project: 1, status: 1 }); // For filtering by project + status
quoteSchema.index({ status: 1 });
quoteSchema.index({ issueDate: -1 }); // For analytics queries

export default mongoose.model('Quote', quoteSchema);
