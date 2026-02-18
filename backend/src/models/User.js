import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // ID utilisateur du Hub (pour lier les comptes)
  hubUserId: {
    type: String,
    unique: true,
    sparse: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  }
}, {
  timestamps: true
});

// Note: email and hubUserId already have indexes via unique: true

export default mongoose.model('User', userSchema);
