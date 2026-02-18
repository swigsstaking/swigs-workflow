import Event from '../models/Event.js';
import Project from '../models/Project.js';
import Settings from '../models/Settings.js';
import { historyService } from '../services/historyService.js';

// Helper: Verify project ownership
const verifyProjectOwnership = async (projectId, userId) => {
  const query = { _id: projectId };
  if (userId) {
    query.userId = userId;
  }
  return Project.findOne(query);
};

// @desc    Get events for a project
// @route   GET /api/projects/:projectId/events
export const getEvents = async (req, res, next) => {
  try {
    // Verify project ownership
    const project = await verifyProjectOwnership(req.params.projectId, req.user?._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    const { billed, type } = req.query;

    let query = { project: req.params.projectId };

    if (billed !== undefined) {
      query.billed = billed === 'true';
    }

    if (type) {
      query.type = type;
    }

    const events = await Event.find(query)
      .populate('invoice', 'number')
      .sort('-date')
      .lean();

    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};

// @desc    Create event
// @route   POST /api/projects/:projectId/events
export const createEvent = async (req, res, next) => {
  try {
    const { type, description, date, hours, hourlyRate, amount } = req.body;

    // Verify project ownership
    const project = await verifyProjectOwnership(req.params.projectId, req.user?._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Get default hourly rate if not provided
    let finalHourlyRate = hourlyRate;
    if (type === 'hours' && !hourlyRate) {
      const settings = await Settings.getSettings(req.user?._id);
      finalHourlyRate = settings.invoicing.defaultHourlyRate;
    }

    const event = await Event.create({
      project: req.params.projectId,
      type,
      description,
      date: date || new Date(),
      hours,
      hourlyRate: finalHourlyRate,
      amount
    });

    // Log history
    await historyService.eventAdded(project._id, type, description);

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

// @desc    Update event
// @route   PUT /api/events/:id
export const updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('project');

    if (!event) {
      return res.status(404).json({ success: false, error: 'Événement non trouvé' });
    }

    // Verify project ownership
    if (req.user && event.project.userId && event.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Cannot update billed events
    if (event.billed) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de modifier un événement facturé'
      });
    }

    const { type, description, date, hours, hourlyRate, amount } = req.body;

    event.type = type || event.type;
    event.description = description || event.description;
    event.date = date || event.date;
    event.hours = hours !== undefined ? hours : event.hours;
    event.hourlyRate = hourlyRate !== undefined ? hourlyRate : event.hourlyRate;
    event.amount = amount !== undefined ? amount : event.amount;

    await event.save();

    // Log history
    await historyService.eventUpdated(event.project._id, event._id);

    res.json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete event
// @route   DELETE /api/events/:id
export const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id).populate('project');

    if (!event) {
      return res.status(404).json({ success: false, error: 'Événement non trouvé' });
    }

    // Verify project ownership
    if (req.user && event.project.userId && event.project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Accès refusé' });
    }

    // Cannot delete billed events
    if (event.billed) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer un événement facturé'
      });
    }

    const projectId = event.project._id;
    const description = event.description;

    await event.deleteOne();

    // Log history
    await historyService.eventDeleted(projectId, description);

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Get unbilled events for a project (for invoice creation)
// @route   GET /api/projects/:projectId/events/unbilled
export const getUnbilledEvents = async (req, res, next) => {
  try {
    // Verify project ownership
    const project = await verifyProjectOwnership(req.params.projectId, req.user?._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    const events = await Event.find({
      project: req.params.projectId,
      billed: false
    }).sort('-date').lean();

    // Calculate totals
    const totals = {
      hours: 0,
      hoursAmount: 0,
      expenses: 0,
      total: 0
    };

    events.forEach(event => {
      if (event.type === 'hours') {
        totals.hours += event.hours;
        totals.hoursAmount += event.hours * event.hourlyRate;
      } else if (event.type === 'expense') {
        totals.expenses += event.amount;
      }
    });

    totals.total = totals.hoursAmount + totals.expenses;

    res.json({
      success: true,
      data: events,
      totals
    });
  } catch (error) {
    next(error);
  }
};
