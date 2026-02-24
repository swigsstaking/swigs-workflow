import mongoose from 'mongoose';

const serviceCategorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Le nom de la catégorie est requis'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  color: {
    type: String,
    default: '#6B7280',
    trim: true
  },
  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

serviceCategorySchema.index({ userId: 1, name: 1 }, { unique: true });
serviceCategorySchema.index({ userId: 1, order: 1 });

export default mongoose.model('ServiceCategory', serviceCategorySchema);
