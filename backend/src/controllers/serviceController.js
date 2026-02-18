import Service from '../models/Service.js';

// @desc    Get all services
// @route   GET /api/services
export const getServices = async (req, res, next) => {
  try {
    const { category, active } = req.query;

    let query = {};

    // Filter by user
    if (req.user) {
      query.userId = req.user._id;
    }

    if (category) {
      query.category = category;
    }

    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const services = await Service.find(query).sort({ category: 1, order: 1, name: 1 });

    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single service
// @route   GET /api/services/:id
export const getService = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const service = await Service.findOne(query);

    if (!service) {
      return res.status(404).json({ success: false, error: 'Service non trouvé' });
    }

    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

// @desc    Create service
// @route   POST /api/services
export const createService = async (req, res, next) => {
  try {
    const { name, description, category, priceType, unitPrice, estimatedHours, defaultQuantity } = req.body;

    // Get max order for new service (within user's services)
    const orderQuery = { category: category || 'other' };
    if (req.user) {
      orderQuery.userId = req.user._id;
    }

    const maxOrder = await Service.findOne(orderQuery)
      .sort('-order')
      .select('order');

    const service = await Service.create({
      userId: req.user?._id,
      name,
      description,
      category,
      priceType,
      unitPrice,
      estimatedHours,
      defaultQuantity,
      order: maxOrder ? maxOrder.order + 1 : 0
    });

    res.status(201).json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
export const updateService = async (req, res, next) => {
  try {
    const { name, description, category, priceType, unitPrice, estimatedHours, defaultQuantity, isActive } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const service = await Service.findOne(query);

    if (!service) {
      return res.status(404).json({ success: false, error: 'Service non trouvé' });
    }

    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;
    if (category !== undefined) service.category = category;
    if (priceType !== undefined) service.priceType = priceType;
    if (unitPrice !== undefined) service.unitPrice = unitPrice;
    if (estimatedHours !== undefined) service.estimatedHours = estimatedHours;
    if (defaultQuantity !== undefined) service.defaultQuantity = defaultQuantity;
    if (isActive !== undefined) service.isActive = isActive;

    await service.save();

    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
export const deleteService = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const service = await Service.findOne(query);

    if (!service) {
      return res.status(404).json({ success: false, error: 'Service non trouvé' });
    }

    await service.deleteOne();

    res.json({ success: true, message: 'Service supprimé' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder services
// @route   PUT /api/services/reorder
export const reorderServices = async (req, res, next) => {
  try {
    const { serviceIds } = req.body;

    // Update order for each service (only user's services)
    const updates = serviceIds.map(async (id, index) => {
      const query = { _id: id };
      if (req.user) {
        query.userId = req.user._id;
      }
      return Service.findOneAndUpdate(query, { order: index });
    });

    await Promise.all(updates);

    const query = {};
    if (req.user) {
      query.userId = req.user._id;
    }

    const services = await Service.find(query).sort({ category: 1, order: 1 });

    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle service active status
// @route   PATCH /api/services/:id/toggle
export const toggleService = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const service = await Service.findOne(query);

    if (!service) {
      return res.status(404).json({ success: false, error: 'Service non trouvé' });
    }

    service.isActive = !service.isActive;
    await service.save();

    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};
