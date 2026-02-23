import mongoose from 'mongoose';

const timerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  description: { type: String, default: '' },
  startedAt: { type: Date, required: true, default: Date.now },
  pausedAt: { type: Date, default: null },
  totalPausedMs: { type: Number, default: 0 },
  status: { type: String, enum: ['running', 'paused', 'stopped'], default: 'running' },
  hourlyRate: { type: Number, default: 0 }
}, { timestamps: true });

// Only one active timer per user
timerSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Timer', timerSchema);
