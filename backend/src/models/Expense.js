import mongoose from 'mongoose';

/**
 * Expense — Note de frais employé
 *
 * Cycle de vie :
 *   draft → submitted (publie expense.submitted vers Lexa) → approved → reimbursed
 *                                                         ↘ rejected
 *
 * hubUserId : UUID SSO Hub, sert de tenantId pour Lexa webhook.
 */
const expenseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  hubUserId: {
    type: String,
    index: true,
  },

  // Qui a payé la dépense
  employeeName: {
    type: String,
    required: true,
    trim: true,
  },

  // Catégorie comptable suisse (enum aligné sur plan comptable)
  category: {
    type: String,
    enum: [
      'vehicle_fuel',
      'vehicle_maintenance',
      'meal',
      'travel',
      'office_supplies',
      'phone_internet',
      'other',
    ],
    default: 'other',
  },

  description: {
    type: String,
    trim: true,
  },

  // Montants
  amountTtc: {
    type: Number,
    required: true,
    min: 0,
  },
  amountHt: {
    type: Number,
    min: 0,
  },
  amountTva: {
    type: Number,
    min: 0,
  },
  tvaRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  date: {
    type: Date,
    default: Date.now,
  },

  // URL du justificatif (ticket, facture, photo) — V1: URL string
  attachmentUrl: {
    type: String,
    trim: true,
  },

  // Workflow status
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'reimbursed', 'rejected'],
    default: 'draft',
  },

  submittedAt: Date,
  approvedAt: Date,
  reimbursedAt: Date,
  rejectedAt: Date,

  // Suivi de l'ingestion Lexa (évite double-push)
  lexaIngested: {
    type: Boolean,
    default: false,
  },

  // Notes manager (pour approbation/refus)
  managerNote: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

expenseSchema.index({ userId: 1, createdAt: -1 });
expenseSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Expense', expenseSchema);
