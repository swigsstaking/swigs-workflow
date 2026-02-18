import mongoose from 'mongoose';

const plannedBlockSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Un projet est requis']
  },
  start: {
    type: Date,
    required: [true, 'Une date de début est requise']
  },
  end: {
    type: Date,
    required: [true, 'Une date de fin est requise']
  },
  notes: {
    type: String,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
plannedBlockSchema.index({ start: 1, end: 1 });
plannedBlockSchema.index({ project: 1 });

// Virtual for duration in hours
plannedBlockSchema.virtual('durationHours').get(function() {
  return (this.end - this.start) / (1000 * 60 * 60);
});

// Ensure end is after start
plannedBlockSchema.pre('save', function(next) {
  if (this.end <= this.start) {
    const error = new Error('La date de fin doit être après la date de début');
    error.statusCode = 400;
    return next(error);
  }
  next();
});

export default mongoose.model('PlannedBlock', plannedBlockSchema);
