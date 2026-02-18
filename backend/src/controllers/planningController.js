import PlannedBlock from '../models/PlannedBlock.js';

// @desc    Get planned blocks for a date range
// @route   GET /api/planning
export const getPlannedBlocks = async (req, res, next) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Les paramètres start et end sont requis'
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Build query with user filter
    const query = {
      $or: [
        // Block starts within range
        { start: { $gte: startDate, $lte: endDate } },
        // Block ends within range
        { end: { $gte: startDate, $lte: endDate } },
        // Block spans the entire range
        { start: { $lte: startDate }, end: { $gte: endDate } }
      ]
    };

    // Filter by user
    if (req.user) {
      query.userId = req.user._id;
    }

    const blocks = await PlannedBlock.find(query)
      .populate({
        path: 'project',
        select: 'name client status',
        populate: [
          { path: 'client', select: 'name' },
          { path: 'status', select: 'name color' }
        ]
      })
      .sort('start');

    res.json({ success: true, data: blocks });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a planned block
// @route   POST /api/planning
export const createPlannedBlock = async (req, res, next) => {
  try {
    const { projectId, start, end, notes } = req.body;

    if (!projectId || !start || !end) {
      return res.status(400).json({
        success: false,
        error: 'projectId, start et end sont requis'
      });
    }

    const block = await PlannedBlock.create({
      userId: req.user?._id,
      project: projectId,
      start: new Date(start),
      end: new Date(end),
      notes
    });

    await block.populate({
      path: 'project',
      select: 'name client status',
      populate: [
        { path: 'client', select: 'name' },
        { path: 'status', select: 'name color' }
      ]
    });

    res.status(201).json({ success: true, data: block });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a planned block
// @route   PUT /api/planning/:id
export const updatePlannedBlock = async (req, res, next) => {
  try {
    const { start, end, notes } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const updateData = {};
    if (start) updateData.start = new Date(start);
    if (end) updateData.end = new Date(end);
    if (notes !== undefined) updateData.notes = notes;

    const block = await PlannedBlock.findOneAndUpdate(
      query,
      updateData,
      { new: true, runValidators: true }
    ).populate({
      path: 'project',
      select: 'name client status',
      populate: [
        { path: 'client', select: 'name' },
        { path: 'status', select: 'name color' }
      ]
    });

    if (!block) {
      return res.status(404).json({
        success: false,
        error: 'Bloc planifié non trouvé'
      });
    }

    res.json({ success: true, data: block });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a planned block
// @route   DELETE /api/planning/:id
export const deletePlannedBlock = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const block = await PlannedBlock.findOneAndDelete(query);

    if (!block) {
      return res.status(404).json({
        success: false,
        error: 'Bloc planifié non trouvé'
      });
    }

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
