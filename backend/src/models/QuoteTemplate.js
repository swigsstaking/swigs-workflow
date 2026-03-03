import mongoose from 'mongoose';

const quoteTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Le nom du modèle est requis'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  lines: [{
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 }
  }],
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', ''],
    default: ''
  },
  discountValue: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

quoteTemplateSchema.index({ userId: 1, order: 1 });
quoteTemplateSchema.index({ isActive: 1 });

export default mongoose.model('QuoteTemplate', quoteTemplateSchema);
