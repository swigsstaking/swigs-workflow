import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  icon: {
    type: String,
    default: 'Folder'
  },
  color: {
    type: String,
    default: '#6366f1'
  },
  accountNumber: {
    type: String,
    trim: true
  },
  budgetMonthly: {
    type: Number,
    min: 0
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
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

expenseCategorySchema.index({ userId: 1, order: 1 });

/**
 * Default Swiss expense categories (seed)
 */
export const DEFAULT_CATEGORIES = [
  { name: 'Infrastructure', icon: 'Building2', color: '#6366f1', accountNumber: '6200', order: 0 },
  { name: 'Matériel de bureau', icon: 'Package', color: '#8b5cf6', accountNumber: '6500', order: 1 },
  { name: 'Marketing & Publicité', icon: 'Megaphone', color: '#ec4899', accountNumber: '6600', order: 2 },
  { name: 'Formation', icon: 'GraduationCap', color: '#f59e0b', accountNumber: '6700', order: 3 },
  { name: 'Représentation & Déplacement', icon: 'Car', color: '#10b981', accountNumber: '6800', order: 4 },
  { name: 'Assurances', icon: 'Shield', color: '#3b82f6', accountNumber: '6300', order: 5 },
  { name: 'Télécommunication', icon: 'Phone', color: '#06b6d4', accountNumber: '6510', order: 6 },
  { name: 'Honoraires externes', icon: 'Users', color: '#f97316', accountNumber: '6570', order: 7 },
  { name: 'Divers', icon: 'MoreHorizontal', color: '#64748b', accountNumber: '6900', order: 8 },
];

export default mongoose.model('ExpenseCategory', expenseCategorySchema);
