import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du client est requis'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  siret: {
    type: String,
    trim: true
  }
}, { _id: false });

const positionSchema = new mongoose.Schema({
  x: {
    type: Number,
    default: null
  },
  y: {
    type: Number,
    default: null
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

const projectSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
    // Not required for backward compatibility, will be migrated
  },
  name: {
    type: String,
    required: [true, 'Le nom du projet est requis'],
    trim: true,
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  client: {
    type: clientSchema,
    required: [true, 'Les informations client sont requises']
  },
  status: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Status',
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  archivedAt: {
    type: Date,
    default: null
  },
  position: {
    type: positionSchema,
    default: () => ({})
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for events
projectSchema.virtual('events', {
  ref: 'Event',
  localField: '_id',
  foreignField: 'project'
});

// Virtual for invoices
projectSchema.virtual('invoices', {
  ref: 'Invoice',
  localField: '_id',
  foreignField: 'project'
});

// Virtual for quotes
projectSchema.virtual('quotes', {
  ref: 'Quote',
  localField: '_id',
  foreignField: 'project'
});

// Indexes for common query patterns
projectSchema.index({ name: 'text', 'client.name': 'text', tags: 'text' });
projectSchema.index({ userId: 1, archivedAt: 1 }); // Main filter query
projectSchema.index({ userId: 1, status: 1 }); // Filter by status
projectSchema.index({ updatedAt: -1 }); // For sorting
projectSchema.index({ archivedAt: 1 }); // For archived filter

export default mongoose.model('Project', projectSchema);
