import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Le projet est requis']
  },
  type: {
    type: String,
    enum: ['hours', 'action', 'expense'],
    required: [true, 'Le type est requis']
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'La date est requise'],
    default: Date.now
  },

  // For type 'hours'
  hours: {
    type: Number,
    min: [0, 'Les heures ne peuvent pas être négatives']
  },
  hourlyRate: {
    type: Number,
    min: [0, 'Le taux horaire ne peut pas être négatif']
  },

  // For type 'expense'
  amount: {
    type: Number,
    min: [0, 'Le montant ne peut pas être négatif']
  },

  // Billing
  billed: {
    type: Boolean,
    default: false
  },
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    default: null
  }
}, {
  timestamps: true
});

// Virtual for calculated amount
eventSchema.virtual('total').get(function() {
  if (this.type === 'hours' && this.hours && this.hourlyRate) {
    return this.hours * this.hourlyRate;
  }
  if (this.type === 'expense' && this.amount) {
    return this.amount;
  }
  return 0;
});

// Ensure hours fields are set for hours type
eventSchema.pre('save', function(next) {
  if (this.type === 'hours' && (!this.hours || !this.hourlyRate)) {
    return next(new Error('Les heures et le taux horaire sont requis pour le type "hours"'));
  }
  if (this.type === 'expense' && !this.amount) {
    return next(new Error('Le montant est requis pour le type "expense"'));
  }
  next();
});

// Indexes for common query patterns
eventSchema.index({ project: 1, date: -1 });
eventSchema.index({ project: 1, billed: 1 });
eventSchema.index({ project: 1, billed: 1, date: -1 }); // Compound for unbilled events sorted
eventSchema.index({ date: -1, type: 1 }); // For analytics hours queries
eventSchema.index({ project: 1, type: 1, date: -1 }); // For analytics queries by project and type

export default mongoose.model('Event', eventSchema);
