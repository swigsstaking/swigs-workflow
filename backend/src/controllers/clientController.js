import Client from '../models/Client.js';
import Project from '../models/Project.js';

import { eventBus } from '../services/eventBus.service.js';

// Fields to sync between Client and Project.client embedded
const CLIENT_SYNC_FIELDS = ['name', 'email', 'phone', 'address', 'street', 'zip', 'city', 'country', 'che', 'company', 'siret'];

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
    const { name, email, phone, address, street, zip, city, country, che, company, siret, notes } = req.body;

    const client = await Client.create({
      userId: req.user?._id,
      name,
      email,
      phone,
      address,
      street,
      zip,
      city,
      country,
      che,
      company,
      siret,
      notes
    });

    // Publish to Hub Event Bus for cross-app automations
    eventBus.publish('client.created', {
      clientId: client._id.toString(),
      clientName: client.name,
      email: client.email,
      company: client.company || client.name,
      hubUserId: req.user?.hubUserId || null
    }).catch(() => {});

    res.status(201).json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
export const updateClient = async (req, res, next) => {
  try {
    const { name, email, phone, address, street, zip, city, country, che, company, siret, notes } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const client = await Client.findOneAndUpdate(
      query,
      { name, email, phone, address, street, zip, city, country, che, company, siret, notes },
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    // Sync to all projects linked to this client
    const syncData = {};
    for (const field of CLIENT_SYNC_FIELDS) {
      if (client[field] !== undefined) {
        syncData[`client.${field}`] = client[field] || '';
      }
    }
    if (Object.keys(syncData).length > 0) {
      await Project.updateMany(
        { clientRef: client._id },
        { $set: syncData }
      );
    }

    // Publish to Hub Event Bus for cross-app automations
    eventBus.publish('client.updated', {
      clientId: client._id.toString(),
      clientName: client.name,
      email: client.email,
      changedFields: Object.keys(req.body),
      hubUserId: req.user?.hubUserId || null
    }).catch(() => {});

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

    // Check if client has linked projects
    const projectQuery = { clientRef: client._id };
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
