import Status from '../models/Status.js';

// @desc    Get all statuses
// @route   GET /api/statuses
export const getStatuses = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user) filter.userId = req.user._id;
    const statuses = await Status.find(filter).sort('order');
    res.json({ success: true, data: statuses });
  } catch (error) {
    next(error);
  }
};

// @desc    Create status
// @route   POST /api/statuses
export const createStatus = async (req, res, next) => {
  try {
    const { name, color, isDefault } = req.body;

    // Get max order for this user
    const query = req.user ? { userId: req.user._id } : {};
    const maxOrder = await Status.findOne(query).sort('-order');
    const order = maxOrder ? maxOrder.order + 1 : 0;

    const status = await Status.create({
      userId: req.user?._id,
      name,
      color,
      order,
      isDefault
    });
    res.status(201).json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

// @desc    Update status
// @route   PUT /api/statuses/:id
export const updateStatus = async (req, res, next) => {
  try {
    const { name, color, isDefault } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const status = await Status.findOneAndUpdate(
      query,
      { name, color, isDefault },
      { new: true, runValidators: true }
    );

    if (!status) {
      return res.status(404).json({ success: false, error: 'Statut non trouvé' });
    }

    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder statuses
// @route   PUT /api/statuses/reorder
export const reorderStatuses = async (req, res, next) => {
  try {
    const { statusIds } = req.body;

    // Update order for each status (only user's statuses)
    const updates = statusIds.map((id, index) => {
      const query = { _id: id };
      if (req.user) {
        query.userId = req.user._id;
      }
      return Status.findOneAndUpdate(query, { order: index });
    });

    await Promise.all(updates);

    const query = req.user ? { userId: req.user._id } : {};
    const statuses = await Status.find(query).sort('order');
    res.json({ success: true, data: statuses });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete status
// @route   DELETE /api/statuses/:id
export const deleteStatus = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const status = await Status.findOne(query);

    if (!status) {
      return res.status(404).json({ success: false, error: 'Statut non trouvé' });
    }

    // Check if status is default
    if (status.isDefault) {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer le statut par défaut'
      });
    }

    await status.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Seed default statuses
// @route   POST /api/statuses/seed
export const seedStatuses = async (req, res, next) => {
  try {
    const query = req.user ? { userId: req.user._id } : {};
    const count = await Status.countDocuments(query);
    if (count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Des statuts existent déjà'
      });
    }

    const defaultStatuses = [
      { userId: req.user?._id, name: 'Nouveau', color: '#6B7280', order: 0, isDefault: true },
      { userId: req.user?._id, name: 'Devis', color: '#F59E0B', order: 1 },
      { userId: req.user?._id, name: 'En cours', color: '#3B82F6', order: 2 },
      { userId: req.user?._id, name: 'Facturé', color: '#8B5CF6', order: 3 },
      { userId: req.user?._id, name: 'Payé', color: '#10B981', order: 4 },
      { userId: req.user?._id, name: 'Maintenance', color: '#EC4899', order: 5 }
    ];

    const statuses = await Status.insertMany(defaultStatuses);
    res.status(201).json({ success: true, data: statuses });
  } catch (error) {
    next(error);
  }
};
