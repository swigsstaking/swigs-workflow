import mongoose from 'mongoose';

// PKCE state — shared across cluster instances
const pkceStateSchema = new mongoose.Schema({
  state: { type: String, required: true, unique: true },
  codeVerifier: { type: String, required: true },
  returnUrl: { type: String, default: '/' },
  expiresAt: { type: Date, required: true }
});
pkceStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PkceState = mongoose.model('PkceState', pkceStateSchema);

// Auth code — one-time use token exchange
const authCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  expiresAt: { type: Date, required: true }
});
authCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthCode = mongoose.model('AuthCode', authCodeSchema);
