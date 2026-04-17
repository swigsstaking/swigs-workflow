import Expense from '../models/Expense.js';
import { publishToLexa } from '../services/lexaWebhook.service.js';

/**
 * Labels lisibles pour les catégories (utilisés dans les notifications/logs)
 */
const CATEGORY_LABELS = {
  vehicle_fuel: 'Carburant',
  vehicle_maintenance: 'Entretien véhicule',
  meal: 'Repas',
  travel: 'Voyage & déplacement',
  office_supplies: 'Fournitures bureau',
  phone_internet: 'Téléphone & internet',
  other: 'Autre',
};

/**
 * GET /api/expenses
 * Liste les notes de frais de l'utilisateur connecté.
 */
export const getAll = async (req, res, next) => {
  try {
    const { status, limit = 100, skip = 0 } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Math.min(Number(limit), 200))
        .lean(),
      Expense.countDocuments(filter),
    ]);

    res.json({ success: true, data: expenses, total });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/expenses/:id
 */
export const getOne = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!expense) return res.status(404).json({ success: false, error: 'Note de frais introuvable' });
    res.json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/expenses
 * Créer une note de frais en brouillon (draft).
 */
export const create = async (req, res, next) => {
  try {
    const {
      employeeName,
      category,
      description,
      amountTtc,
      amountHt,
      amountTva,
      tvaRate,
      date,
      attachmentUrl,
    } = req.body;

    if (!amountTtc || amountTtc <= 0) {
      return res.status(400).json({ success: false, error: 'Montant TTC requis et > 0' });
    }

    const expense = await Expense.create({
      userId: req.user._id,
      hubUserId: req.user.hubUserId || null,
      employeeName: employeeName?.trim() || req.user.name || req.user.email,
      category: category || 'other',
      description: description?.trim(),
      amountTtc: Number(amountTtc),
      amountHt: amountHt != null ? Number(amountHt) : undefined,
      amountTva: amountTva != null ? Number(amountTva) : undefined,
      tvaRate: tvaRate != null ? Number(tvaRate) : 0,
      date: date ? new Date(date) : new Date(),
      attachmentUrl: attachmentUrl?.trim(),
      status: 'draft',
    });

    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/expenses/:id
 * Mettre à jour une note de frais (uniquement si draft).
 */
export const update = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
    if (!expense) return res.status(404).json({ success: false, error: 'Note de frais introuvable' });
    if (expense.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Seules les notes en brouillon peuvent être modifiées' });
    }

    const allowed = ['employeeName', 'category', 'description', 'amountTtc', 'amountHt', 'amountTva', 'tvaRate', 'date', 'attachmentUrl'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        expense[field] = req.body[field];
      }
    }

    await expense.save();
    res.json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/expenses/:id/submit
 * Soumettre la note de frais pour approbation + publier expense.submitted vers Lexa.
 */
export const submit = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
    if (!expense) return res.status(404).json({ success: false, error: 'Note de frais introuvable' });
    if (expense.status !== 'draft') {
      return res.status(400).json({ success: false, error: `Statut actuel "${expense.status}" — seul "draft" peut être soumis` });
    }

    expense.status = 'submitted';
    expense.submittedAt = new Date();
    await expense.save();

    // Fire-and-forget vers Lexa (ne bloque pas la réponse Pro)
    const tenantId = expense.hubUserId || null;
    publishToLexa('expense.submitted', tenantId, {
      expenseId: expense._id.toString(),
      description: expense.description || CATEGORY_LABELS[expense.category] || expense.category,
      category: expense.category,
      categoryLabel: CATEGORY_LABELS[expense.category] || expense.category,
      amountTtc: expense.amountTtc,
      amountHt: expense.amountHt ?? null,
      amountTva: expense.amountTva ?? null,
      tvaRate: expense.tvaRate ?? 0,
      date: expense.date.toISOString().slice(0, 10),
      employeeName: expense.employeeName,
      attachmentUrl: expense.attachmentUrl ?? null,
    }).then(() => {
      // Marquer comme ingested côté Pro pour tracking (non bloquant)
      Expense.updateOne({ _id: expense._id }, { lexaIngested: true }).catch(() => {});
    }).catch((err) => {
      console.warn('[expenses] publish to Lexa failed:', err.message);
    });

    res.json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/expenses/:id/approve
 * Approuver une note de frais (manager).
 */
export const approve = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
    if (!expense) return res.status(404).json({ success: false, error: 'Note de frais introuvable' });
    if (expense.status !== 'submitted') {
      return res.status(400).json({ success: false, error: 'Seules les notes soumises peuvent être approuvées' });
    }

    expense.status = 'approved';
    expense.approvedAt = new Date();
    if (req.body.managerNote) expense.managerNote = req.body.managerNote;
    await expense.save();

    res.json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/expenses/:id/reject
 * Refuser une note de frais (manager).
 */
export const reject = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
    if (!expense) return res.status(404).json({ success: false, error: 'Note de frais introuvable' });
    if (!['submitted', 'approved'].includes(expense.status)) {
      return res.status(400).json({ success: false, error: 'Statut incompatible avec un refus' });
    }

    expense.status = 'rejected';
    expense.rejectedAt = new Date();
    if (req.body.managerNote) expense.managerNote = req.body.managerNote;
    await expense.save();

    res.json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/expenses/:id/reimburse
 * Marquer comme remboursée.
 */
export const reimburse = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
    if (!expense) return res.status(404).json({ success: false, error: 'Note de frais introuvable' });
    if (expense.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Seules les notes approuvées peuvent être marquées remboursées' });
    }

    expense.status = 'reimbursed';
    expense.reimbursedAt = new Date();
    await expense.save();

    res.json({ success: true, data: expense });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/expenses/:id
 * Supprimer une note de frais (uniquement si draft).
 */
export const remove = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, userId: req.user._id });
    if (!expense) return res.status(404).json({ success: false, error: 'Note de frais introuvable' });
    if (expense.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Seules les notes en brouillon peuvent être supprimées' });
    }

    await expense.deleteOne();
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
};
