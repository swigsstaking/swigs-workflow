import mongoose from 'mongoose';

const cronLockSchema = new mongoose.Schema({
  _id: { type: String }, // lock name e.g. 'bank-imap-cron'
  lockedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { timestamps: false });

cronLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup

const CronLock = mongoose.model('CronLock', cronLockSchema);

/**
 * Try to acquire a distributed lock. Returns true if acquired, false if another instance holds it.
 * Uses atomic findOneAndUpdate: either updates an expired lock or inserts a new one.
 */
export async function acquireCronLock(lockId, ttlMs = 10 * 60 * 1000) {
  try {
    const now = new Date();
    const result = await CronLock.findOneAndUpdate(
      { _id: lockId, expiresAt: { $lt: now } }, // only match expired locks
      { $set: { lockedAt: now, expiresAt: new Date(now.getTime() + ttlMs) } },
      { upsert: true, returnDocument: 'after' }
    );
    return !!result;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key = another instance inserted first (lock is active & not expired)
      return false;
    }
    console.error(`[CronLock] Error acquiring ${lockId}:`, err.message);
    return false;
  }
}

/**
 * Release a lock after work is done.
 */
export async function releaseCronLock(lockId) {
  await CronLock.deleteOne({ _id: lockId }).catch(() => {});
}

export default CronLock;
