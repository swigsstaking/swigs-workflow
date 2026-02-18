import mongoose from 'mongoose';
const { Schema } = mongoose;

const portalTokenSchema = new Schema({
  token: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['invoice', 'quote', 'client'], required: true },
  documentId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  accessCount: { type: Number, default: 0 },
  lastAccessedAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// TTL index pour auto-suppression
portalTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PortalToken', portalTokenSchema);
