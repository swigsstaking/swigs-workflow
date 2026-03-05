import ExpenseCategory, { DEFAULT_CATEGORIES } from '../models/ExpenseCategory.js';

/**
 * GET /api/expense-categories
 */
export const getAll = async (req, res, next) => {
  try {
    const categories = await ExpenseCategory.find({ userId: req.user._id })
      .sort({ order: 1 })
      .lean();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/expense-categories
 */
export const create = async (req, res, next) => {
  try {
    const { name, icon, color, accountNumber, budgetMonthly, vatRate } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Nom requis' });
    }

    // Get max order
    const maxOrder = await ExpenseCategory.findOne({ userId: req.user._id })
      .sort({ order: -1 })
      .select('order')
      .lean();

    const category = await ExpenseCategory.create({
      name,
      icon: icon || 'Folder',
      color: color || '#6366f1',
      accountNumber,
      budgetMonthly,
      vatRate: vatRate !== undefined ? vatRate : 8.1,
      order: (maxOrder?.order ?? -1) + 1,
      userId: req.user._id
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expense-categories/:id
 */
export const update = async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findOne({ _id: req.params.id, userId: req.user._id });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });
    }

    const { name, icon, color, accountNumber, budgetMonthly, vatRate } = req.body;
    if (name) category.name = name;
    if (icon) category.icon = icon;
    if (color) category.color = color;
    if (accountNumber !== undefined) category.accountNumber = accountNumber;
    if (budgetMonthly !== undefined) category.budgetMonthly = budgetMonthly;
    if (vatRate !== undefined) category.vatRate = vatRate;

    await category.save();
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/expense-categories/:id
 */
export const remove = async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findOne({ _id: req.params.id, userId: req.user._id });
    if (!category) {
      return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });
    }
    if (category.isDefault) {
      return res.status(400).json({ success: false, error: 'Les catégories par défaut ne peuvent pas être supprimées' });
    }

    await category.deleteOne();
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/expense-categories/seed
 * Create default Swiss categories if none exist
 */
export const seed = async (req, res, next) => {
  try {
    const existing = await ExpenseCategory.countDocuments({ userId: req.user._id });
    if (existing > 0) {
      return res.json({ success: true, data: { seeded: 0, message: 'Des catégories existent déjà' } });
    }

    const categories = await ExpenseCategory.insertMany(
      DEFAULT_CATEGORIES.map(c => ({ ...c, isDefault: true, userId: req.user._id }))
    );

    res.status(201).json({ success: true, data: { seeded: categories.length, categories } });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/expense-categories/reorder
 */
export const reorder = async (req, res, next) => {
  try {
    const { categoryIds } = req.body;
    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ success: false, error: 'categoryIds requis (array)' });
    }

    const ops = categoryIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, userId: req.user._id },
        update: { order: index }
      }
    }));

    await ExpenseCategory.bulkWrite(ops);

    const categories = await ExpenseCategory.find({ userId: req.user._id })
      .sort({ order: 1 })
      .lean();

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};
