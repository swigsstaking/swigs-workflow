import mongoose from 'mongoose';

const bankTransactionSchema = new mongoose.Schema({
  importId: {
    type: String,
    required: true,
    index: true
  },
  importFilename: String,
  txId: String,
  bookingDate: {
    type: Date,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'CHF'
  },
  creditDebit: {
    type: String,
    enum: ['CRDT', 'DBIT'],
    required: true
  },
  counterpartyName: String,
  counterpartyIban: String,
  reference: String,
  unstructuredReference: String,
  matchStatus: {
    type: String,
    enum: ['matched', 'suggested', 'unmatched', 'ignored'],
    default: 'unmatched'
  },
  matchMethod: {
    type: String,
    enum: ['qr_reference', 'amount_client', 'manual', null],
    default: null
  },
  matchedInvoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  matchConfidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  // --- Compta Plus fields (optional, non-breaking) ---
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount'
  },
  expenseCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExpenseCategory'
  },
  autoClassified: {
    type: Boolean,
    default: false
  },
  notes: String,
  vatAmount: Number,
  vatRate: Number,
  attachments: [{
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: String, required: true }, // base64
    uploadedAt: { type: Date, default: Date.now }
  }],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true
  },
  // --- Lexa AI classification (session 20, webhook retour Lexa→Pro) ---
  lexaClassification: {
    streamId: String,
    debitAccount: String,
    creditAccount: String,
    tvaRate: Number,
    tvaCode: String,
    confidence: Number,
    amountHt: Number,
    amountTtc: Number,
    citations: [{
      source: String,
      article: String,
      law: String,
    }],
    classifiedAt: Date,
  }
}, {
  timestamps: true
});

bankTransactionSchema.index({ userId: 1, txId: 1 });
bankTransactionSchema.index({ txId: 1 }, { sparse: true }); // webhook lookup Lexa→Pro
bankTransactionSchema.index({ userId: 1, matchStatus: 1 });
bankTransactionSchema.index({ importId: 1, bookingDate: -1 });
bankTransactionSchema.index({ userId: 1, bookingDate: 1, amount: 1, creditDebit: 1, counterpartyName: 1 });
bankTransactionSchema.index({ userId: 1, creditDebit: 1, bookingDate: -1 }); // For expense analytics
bankTransactionSchema.index({ userId: 1, expenseCategory: 1, bookingDate: -1 }); // For budget alerts

export default mongoose.model('BankTransaction', bankTransactionSchema);
