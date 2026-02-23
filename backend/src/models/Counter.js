import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: String, // e.g. "invoice_2026_userId" or "quote_2026_userId"
  seq: { type: Number, default: 0 }
});

counterSchema.statics.getNextSequence = async function(name) {
  const counter = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

export default mongoose.model('Counter', counterSchema);
