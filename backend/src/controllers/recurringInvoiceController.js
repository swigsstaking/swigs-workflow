import RecurringInvoice from '../models/RecurringInvoice.js';
import { calculateNextDate, generateInvoiceFromRecurring } from '../services/recurringInvoice.service.js';
import { verifyProjectOwnership } from '../utils/project.js';

// Helper: calculate initial nextGenerationDate from startDate
const getInitialNextDate = (startDate, frequency, dayOfMonth) => {
  const start = new Date(startDate);
  // If startDate is today or in the past, first generation is "now" (startDate itself)
  // The cron picks it up on next run
  const now = new Date();
  if (start <= now) {
    return start;
  }
  return start;
};

// @desc    Get all recurring invoices for authenticated user
// @route   GET /api/recurring-invoices
export const getAll = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = { userId: req.user._id };
    if (status) query.status = status;

    const recurrings = await RecurringInvoice.find(query)
      .populate('project', 'name client')
      .populate('generatedInvoices', 'number status total issueDate dueDate')
      .sort('-createdAt');

    res.json({ success: true, data: recurrings });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single recurring invoice
// @route   GET /api/recurring-invoices/:id
export const getById = async (req, res, next) => {
  try {
    const recurring = await RecurringInvoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    })
      .populate('project', 'name client')
      .populate('generatedInvoices', 'number status total issueDate dueDate');

    if (!recurring) {
      return res.status(404).json({ success: false, error: 'Facturation récurrente non trouvée' });
    }

    res.json({ success: true, data: recurring });
  } catch (err) {
    next(err);
  }
};

// @desc    Create recurring invoice
// @route   POST /api/recurring-invoices
export const create = async (req, res, next) => {
  try {
    const {
      project: projectId,
      customLines,
      frequency,
      dayOfMonth = 1,
      startDate,
      endDate,
      vatRate,
      paymentTermsDays,
      notes,
      autoSend
    } = req.body;

    // Validate project ownership
    const project = await verifyProjectOwnership(projectId, req.user._id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Validate at least one custom line
    if (!customLines || customLines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Ajoutez au moins une ligne à la facturation récurrente'
      });
    }

    // Calculate initial nextGenerationDate
    const nextGenerationDate = getInitialNextDate(startDate, frequency, dayOfMonth);

    const recurring = await RecurringInvoice.create({
      userId: req.user._id,
      project: projectId,
      customLines,
      frequency,
      dayOfMonth,
      startDate,
      endDate: endDate || null,
      vatRate: vatRate !== undefined ? vatRate : 8.1,
      paymentTermsDays: paymentTermsDays !== undefined ? paymentTermsDays : 30,
      notes: notes || '',
      autoSend: autoSend || false,
      nextGenerationDate
    });

    await recurring.populate('project', 'name client');

    res.status(201).json({ success: true, data: recurring });
  } catch (err) {
    next(err);
  }
};

// @desc    Update recurring invoice
// @route   PUT /api/recurring-invoices/:id
export const update = async (req, res, next) => {
  try {
    const recurring = await RecurringInvoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!recurring) {
      return res.status(404).json({ success: false, error: 'Facturation récurrente non trouvée' });
    }

    if (recurring.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Impossible de modifier une facturation récurrente annulée'
      });
    }

    const allowedFields = [
      'customLines', 'frequency', 'dayOfMonth', 'endDate',
      'vatRate', 'paymentTermsDays', 'notes', 'autoSend'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        recurring[field] = req.body[field];
      }
    }

    // If frequency or dayOfMonth changed, recalculate next date
    if (req.body.frequency !== undefined || req.body.dayOfMonth !== undefined) {
      recurring.nextGenerationDate = calculateNextDate(
        recurring.lastGeneratedAt || new Date(),
        recurring.frequency,
        recurring.dayOfMonth
      );
    }

    await recurring.save();
    await recurring.populate('project', 'name client');

    res.json({ success: true, data: recurring });
  } catch (err) {
    next(err);
  }
};

// @desc    Change status (active/paused/cancelled)
// @route   PATCH /api/recurring-invoices/:id/status
export const changeStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const recurring = await RecurringInvoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!recurring) {
      return res.status(404).json({ success: false, error: 'Facturation récurrente non trouvée' });
    }

    const currentStatus = recurring.status;

    // Validation des transitions
    if (currentStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Impossible de réactiver une facturation récurrente annulée'
      });
    }

    if (currentStatus === status) {
      return res.status(400).json({
        success: false,
        error: `Le statut est déjà "${status}"`
      });
    }

    recurring.status = status;

    // If resuming from paused, recalculate nextGenerationDate if it's in the past
    if (status === 'active' && currentStatus === 'paused') {
      const now = new Date();
      if (recurring.nextGenerationDate < now) {
        recurring.nextGenerationDate = calculateNextDate(
          now,
          recurring.frequency,
          recurring.dayOfMonth
        );
      }
    }

    await recurring.save();

    res.json({ success: true, data: recurring });
  } catch (err) {
    next(err);
  }
};

// @desc    Soft-delete (cancel) recurring invoice
// @route   DELETE /api/recurring-invoices/:id
export const remove = async (req, res, next) => {
  try {
    const recurring = await RecurringInvoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!recurring) {
      return res.status(404).json({ success: false, error: 'Facturation récurrente non trouvée' });
    }

    recurring.status = 'cancelled';
    await recurring.save();

    res.json({ success: true, message: 'Facturation récurrente annulée' });
  } catch (err) {
    next(err);
  }
};

// @desc    Force immediate invoice generation
// @route   POST /api/recurring-invoices/:id/generate
export const generateNow = async (req, res, next) => {
  try {
    const recurring = await RecurringInvoice.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('project', 'name client userId');

    if (!recurring) {
      return res.status(404).json({ success: false, error: 'Facturation récurrente non trouvée' });
    }

    if (recurring.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Impossible de générer une facture pour une récurrence annulée'
      });
    }

    const invoice = await generateInvoiceFromRecurring(recurring);

    res.status(201).json({
      success: true,
      message: `Facture ${invoice.number} générée avec succès`,
      data: invoice
    });
  } catch (err) {
    next(err);
  }
};
