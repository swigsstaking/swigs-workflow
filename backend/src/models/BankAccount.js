import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  iban: {
    type: String,
    required: true,
    trim: true
  },
  qrIban: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  currency: {
    type: String,
    enum: ['CHF', 'EUR', 'USD'],
    default: 'CHF'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Unique IBAN per user
bankAccountSchema.index({ userId: 1, iban: 1 }, { unique: true });

// Ensure only one default per user
bankAccountSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    );
  }
  next();
});

export default mongoose.model('BankAccount', bankAccountSchema);
