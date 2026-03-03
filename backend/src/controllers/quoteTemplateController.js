import QuoteTemplate from '../models/QuoteTemplate.js';

// @desc    Get all quote templates
// @route   GET /api/quote-templates
export const getQuoteTemplates = async (req, res, next) => {
  try {
    const { active } = req.query;

    let query = {};

    if (req.user) {
      query.userId = req.user._id;
    }

    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const templates = await QuoteTemplate.find(query).sort({ order: 1, name: 1 });

    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single quote template
// @route   GET /api/quote-templates/:id
export const getQuoteTemplate = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const template = await QuoteTemplate.findOne(query);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Modèle non trouvé' });
    }

    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

// @desc    Create quote template
// @route   POST /api/quote-templates
export const createQuoteTemplate = async (req, res, next) => {
  try {
    const { name, description, lines, discountType, discountValue, notes } = req.body;

    const orderQuery = {};
    if (req.user) {
      orderQuery.userId = req.user._id;
    }

    const maxOrder = await QuoteTemplate.findOne(orderQuery)
      .sort('-order')
      .select('order');

    const template = await QuoteTemplate.create({
      userId: req.user?._id,
      name,
      description,
      lines,
      discountType,
      discountValue,
      notes,
      order: maxOrder ? maxOrder.order + 1 : 0
    });

    res.status(201).json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

// @desc    Update quote template
// @route   PUT /api/quote-templates/:id
export const updateQuoteTemplate = async (req, res, next) => {
  try {
    const { name, description, lines, discountType, discountValue, notes, isActive } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const template = await QuoteTemplate.findOne(query);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Modèle non trouvé' });
    }

    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (lines !== undefined) template.lines = lines;
    if (discountType !== undefined) template.discountType = discountType;
    if (discountValue !== undefined) template.discountValue = discountValue;
    if (notes !== undefined) template.notes = notes;
    if (isActive !== undefined) template.isActive = isActive;

    await template.save();

    res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete quote template
// @route   DELETE /api/quote-templates/:id
export const deleteQuoteTemplate = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const template = await QuoteTemplate.findOne(query);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Modèle non trouvé' });
    }

    await template.deleteOne();

    res.json({ success: true, message: 'Modèle supprimé' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder quote templates
// @route   PUT /api/quote-templates/reorder
export const reorderQuoteTemplates = async (req, res, next) => {
  try {
    const { templateIds } = req.body;

    const updates = templateIds.map(async (id, index) => {
      const query = { _id: id };
      if (req.user) {
        query.userId = req.user._id;
      }
      return QuoteTemplate.findOneAndUpdate(query, { order: index });
    });

    await Promise.all(updates);

    const query = {};
    if (req.user) {
      query.userId = req.user._id;
    }

    const templates = await QuoteTemplate.find(query).sort({ order: 1 });

    res.json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
};
