import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true
  },
  refreshTokenHash: {
    type: String,
    unique: true,
    sparse: true
  },
  userAgent: String,
  ipAddress: String,
  expiresAt: {
    type: Date,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Index for hash-based lookup
sessionSchema.index({ refreshTokenHash: 1, isRevoked: 1, expiresAt: 1 });

export default mongoose.model('Session', sessionSchema);
