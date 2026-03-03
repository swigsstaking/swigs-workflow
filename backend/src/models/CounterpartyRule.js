import mongoose from 'mongoose';

const counterpartyRuleSchema = new mongoose.Schema({
  counterpartyName: {
    type: String,
    required: true,
    trim: true
  },
  counterpartyIban: {
    type: String,
    trim: true
  },
  expenseCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory',
    required: true
  },
  alias: {
    type: String,
    trim: true
  },
  matchCount: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

counterpartyRuleSchema.index({ userId: 1, counterpartyName: 1 }, { unique: true });

export default mongoose.model('CounterpartyRule', counterpartyRuleSchema);
