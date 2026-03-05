import mongoose from 'mongoose';

const recurringChargeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  counterpartyName: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly'],
    default: 'monthly'
  },
  expectedAmount: {
    type: Number,
    required: true
  },
  amountVariance: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  expenseCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory'
  },
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31
  },
  isConfirmed: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSeenDate: Date,
  detectionConfidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  sampleTransactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankTransaction'
  }]
}, {
  timestamps: true
});

recurringChargeSchema.index({ userId: 1, counterpartyName: 1 }, { unique: true });
recurringChargeSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model('RecurringCharge', recurringChargeSchema);
