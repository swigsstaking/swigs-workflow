import Client from '../models/Client.js';

// @desc    Get all clients
// @route   GET /api/clients
export const getClients = async (req, res, next) => {
  try {
    const { search } = req.query;

    let query = {};

    // Filter by user
    if (req.user) {
      query.userId = req.user._id;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const clients = await Client.find(query).sort('name');
    res.json({ success: true, data: clients });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single client
// @route   GET /api/clients/:id
export const getClient = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const client = await Client.findOne(query);

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    res.json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
};

// @desc    Create client
// @route   POST /api/clients
export const createClient = async (req, res, next) => {
  try {
    const { name, email, phone, address, company, siret, notes } = req.body;

    const client = await Client.create({
      userId: req.user?._id,
      name,
      email,
      phone,
      address,
      company,
      siret,
      notes
    });

    res.status(201).json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
export const updateClient = async (req, res, next) => {
  try {
    const { name, email, phone, address, company, siret, notes } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const client = await Client.findOneAndUpdate(
      query,
      { name, email, phone, address, company, siret, notes },
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    res.json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
export const deleteClient = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const client = await Client.findOne(query);

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    // Check if client has projects
    const Project = (await import('../models/Project.js')).default;
    const projectQuery = { 'client._id': client._id };
    if (req.user) {
      projectQuery.userId = req.user._id;
    }
    const projectCount = await Project.countDocuments(projectQuery);

    if (projectCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Ce client est lié à ${projectCount} projet(s). Impossible de le supprimer.`
      });
    }

    await client.deleteOne();
    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};
