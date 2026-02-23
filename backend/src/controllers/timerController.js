import Timer from '../models/Timer.js';
import Event from '../models/Event.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';
import { historyService } from '../services/historyService.js';

// @desc    Get active timer for current user
// @route   GET /api/timer/active
export const getActive = async (req, res, next) => {
  try {
    const timer = await Timer.findOne({
      userId: req.user._id,
      status: { $in: ['running', 'paused'] }
    }).populate('projectId', 'name client');

    res.json({ success: true, data: timer });
  } catch (error) {
    next(error);
  }
};

// @desc    Start a new timer
// @route   POST /api/timer/start
export const start = async (req, res, next) => {
  try {
    const { projectId, description, hourlyRate } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: 'projectId est requis' });
    }

    // Check no active timer exists
    const existing = await Timer.findOne({
      userId: req.user._id,
      status: { $in: ['running', 'paused'] }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Un timer est déjà actif. Arrêtez-le avant d\'en démarrer un nouveau.'
      });
    }

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Get hourly rate from settings if not provided
    let finalHourlyRate = hourlyRate;
    if (!finalHourlyRate) {
      const settings = await Settings.getSettings(req.user._id);
      finalHourlyRate = settings.invoicing.defaultHourlyRate;
    }

    const timer = await Timer.create({
      userId: req.user._id,
      projectId,
      description: description || '',
      startedAt: new Date(),
      hourlyRate: finalHourlyRate,
      status: 'running'
    });

    const populated = await timer.populate('projectId', 'name client');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Pause the active timer
// @route   PATCH /api/timer/pause
export const pause = async (req, res, next) => {
  try {
    const timer = await Timer.findOne({
      userId: req.user._id,
      status: 'running'
    });

    if (!timer) {
      return res.status(404).json({ success: false, error: 'Aucun timer en cours' });
    }

    timer.pausedAt = new Date();
    timer.status = 'paused';
    await timer.save();

    const populated = await timer.populate('projectId', 'name client');
    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Resume the paused timer
// @route   PATCH /api/timer/resume
export const resume = async (req, res, next) => {
  try {
    const timer = await Timer.findOne({
      userId: req.user._id,
      status: 'paused'
    });

    if (!timer) {
      return res.status(404).json({ success: false, error: 'Aucun timer en pause' });
    }

    const now = new Date();
    const pausedDuration = now.getTime() - new Date(timer.pausedAt).getTime();
    timer.totalPausedMs = (timer.totalPausedMs || 0) + pausedDuration;
    timer.pausedAt = null;
    timer.status = 'running';
    await timer.save();

    const populated = await timer.populate('projectId', 'name client');
    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Stop the timer and create an Event
// @route   POST /api/timer/stop
export const stop = async (req, res, next) => {
  try {
    const timer = await Timer.findOne({
      userId: req.user._id,
      status: { $in: ['running', 'paused'] }
    });

    if (!timer) {
      return res.status(404).json({ success: false, error: 'Aucun timer actif' });
    }

    const now = new Date();

    // Account for currently paused time
    let totalPausedMs = timer.totalPausedMs || 0;
    if (timer.status === 'paused' && timer.pausedAt) {
      totalPausedMs += now.getTime() - new Date(timer.pausedAt).getTime();
    }

    // Calculate elapsed in ms
    const elapsedMs = now.getTime() - new Date(timer.startedAt).getTime() - totalPausedMs;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Round to nearest quarter hour (minimum 0.25h)
    const roundedHours = Math.max(0.25, Math.round(elapsedHours * 4) / 4);

    // Use description from request body if provided, otherwise from timer
    const description = req.body?.description || timer.description || 'Session de travail';

    // Create Event
    const event = await Event.create({
      project: timer.projectId,
      type: 'hours',
      description,
      date: timer.startedAt,
      hours: roundedHours,
      hourlyRate: timer.hourlyRate
    });

    // Log history
    await historyService.eventAdded(timer.projectId, 'hours', description);

    // Delete the timer
    await timer.deleteOne();

    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

// @desc    Discard the active timer without creating an event
// @route   DELETE /api/timer/discard
export const discard = async (req, res, next) => {
  try {
    const timer = await Timer.findOne({
      userId: req.user._id,
      status: { $in: ['running', 'paused'] }
    });

    if (!timer) {
      return res.status(404).json({ success: false, error: 'Aucun timer actif' });
    }

    await timer.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
