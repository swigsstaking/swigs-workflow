import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Le nom du service est requis'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['development', 'design', 'maintenance', 'hosting', 'consulting', 'other'],
    default: 'other'
  },
  // Pricing options
  priceType: {
    type: String,
    enum: ['fixed', 'hourly', 'monthly', 'yearly'],
    default: 'fixed'
  },
  unitPrice: {
    type: Number,
    required: [true, 'Le prix unitaire est requis'],
    min: 0
  },
  // For hourly pricing
  estimatedHours: {
    type: Number,
    min: 0,
    default: null
  },
  // Default quantity when added to quote
  defaultQuantity: {
    type: Number,
    min: 1,
    default: 1
  },
  // Active status
  isActive: {
    type: Boolean,
    default: true
  },
  // Order for display
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for sorting
serviceSchema.index({ category: 1, order: 1 });
serviceSchema.index({ isActive: 1 });

export default mongoose.model('Service', serviceSchema);
