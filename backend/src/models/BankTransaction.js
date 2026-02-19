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
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
    required: true
  }
}, {
  timestamps: true
});

bankTransactionSchema.index({ userId: 1, matchStatus: 1 });
bankTransactionSchema.index({ importId: 1, bookingDate: -1 });

export default mongoose.model('BankTransaction', bankTransactionSchema);
