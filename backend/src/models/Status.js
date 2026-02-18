import mongoose from 'mongoose';

const statusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  name: {
    type: String,
    required: [true, 'Le nom du statut est requis'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  color: {
    type: String,
    required: [true, 'La couleur est requise'],
    default: '#6B7280',
    match: [/^#[0-9A-Fa-f]{6}$/, 'Format couleur invalide (ex: #3B82F6)']
  },
  order: {
    type: Number,
    default: 0
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'status'  // Use singular collection name (legacy)
});

// Ensure only one default status per user
statusSchema.pre('save', async function(next) {
  if (this.isDefault) {
    const query = { _id: { $ne: this._id } };
    if (this.userId) {
      query.userId = this.userId;
    }
    await this.constructor.updateMany(query, { isDefault: false });
  }
  next();
});

// Compound index for unique name per user
statusSchema.index({ userId: 1, name: 1 }, { unique: true, sparse: true });

export default mongoose.model('Status', statusSchema);
