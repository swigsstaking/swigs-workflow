import ServiceCategory from '../models/ServiceCategory.js';
import Service from '../models/Service.js';

const DEFAULT_CATEGORIES = [
  { name: 'development', color: '#3B82F6', order: 0 },
  { name: 'design', color: '#8B5CF6', order: 1 },
  { name: 'maintenance', color: '#22C55E', order: 2 },
  { name: 'hosting', color: '#F97316', order: 3 },
  { name: 'consulting', color: '#EAB308', order: 4 },
  { name: 'other', color: '#6B7280', order: 5 }
];

// @desc    Get all service categories
// @route   GET /api/service-categories
export const getServiceCategories = async (req, res, next) => {
  try {
    const query = {};
    if (req.user) {
      query.userId = req.user._id;
    }

    const categories = await ServiceCategory.find(query).sort({ order: 1, name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

// @desc    Create service category
// @route   POST /api/service-categories
export const createServiceCategory = async (req, res, next) => {
  try {
    const { name, color } = req.body;

    // Get max order
    const maxOrder = await ServiceCategory.findOne({ userId: req.user._id })
      .sort('-order')
      .select('order');

    const category = await ServiceCategory.create({
      userId: req.user._id,
      name,
      color,
      order: maxOrder ? maxOrder.order + 1 : 0
    });

    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Cette catégorie existe déjà' });
    }
    next(error);
  }
};

// @desc    Update service category
// @route   PUT /api/service-categories/:id
export const updateServiceCategory = async (req, res, next) => {
  try {
    const { name, color, order } = req.body;

    const category = await ServiceCategory.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!category) {
      return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });
    }

    const oldName = category.name;

    if (name !== undefined) category.name = name;
    if (color !== undefined) category.color = color;
    if (order !== undefined) category.order = order;

    await category.save();

    // If name changed, update services that reference the old name
    if (name !== undefined && name !== oldName) {
      await Service.updateMany(
        { userId: req.user._id, category: oldName },
        { category: name }
      );
    }

    res.json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Cette catégorie existe déjà' });
    }
    next(error);
  }
};

// @desc    Delete service category
// @route   DELETE /api/service-categories/:id
export const deleteServiceCategory = async (req, res, next) => {
  try {
    const category = await ServiceCategory.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!category) {
      return res.status(404).json({ success: false, error: 'Catégorie non trouvée' });
    }

    // Check if any services use this category
    const serviceCount = await Service.countDocuments({
      userId: req.user._id,
      category: category.name
    });

    if (serviceCount > 0) {
      return res.status(400).json({
        success: false,
        error: `${serviceCount} service(s) utilisent cette catégorie. Réassignez-les d'abord.`
      });
    }

    await category.deleteOne();
    res.json({ success: true, message: 'Catégorie supprimée' });
  } catch (error) {
    next(error);
  }
};

// @desc    Seed default categories
// @route   POST /api/service-categories/seed
export const seedServiceCategories = async (req, res, next) => {
  try {
    const existing = await ServiceCategory.countDocuments({ userId: req.user._id });

    if (existing > 0) {
      return res.json({ success: true, data: [], message: 'Catégories déjà existantes' });
    }

    const categories = await ServiceCategory.insertMany(
      DEFAULT_CATEGORIES.map(cat => ({ ...cat, userId: req.user._id }))
    );

    res.status(201).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};
