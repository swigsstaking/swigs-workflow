import mongoose from 'mongoose';

const bankImportSchema = new mongoose.Schema({
  importId: {
    type: String,
    required: true,
    unique: true
  },
  filename: {
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    enum: ['camt.053', 'camt.054', 'email_notification', 'manual', 'csv'],
    required: true
  },
  totalTransactions: {
    type: Number,
    default: 0
  },
  matchedCount: {
    type: Number,
    default: 0
  },
  suggestedCount: {
    type: Number,
    default: 0
  },
  unmatchedCount: {
    type: Number,
    default: 0
  },
  statementIban: String,
  statementOpeningBalance: Number,
  statementClosingBalance: Number,
  statementDate: Date,
  // --- Compta Plus fields (optional, non-breaking) ---
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true
  }
}, {
  timestamps: true
});

bankImportSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('BankImport', bankImportSchema);
