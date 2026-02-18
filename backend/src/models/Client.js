import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
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
  },
  notes: {
    type: String,
    trim: true
  },

  // AbaNinja sync
  abaNinjaId: {
    type: Number,
    default: null
  },
  abaNinjaSyncedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for search
clientSchema.index({ name: 'text', company: 'text', email: 'text' });

export default mongoose.model('Client', clientSchema);
