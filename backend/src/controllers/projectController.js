import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Client from '../models/Client.js';
import Status from '../models/Status.js';
import Event from '../models/Event.js';
import Quote from '../models/Quote.js';
import Invoice from '../models/Invoice.js';
import { historyService } from '../services/historyService.js';

import { eventBus } from '../services/eventBus.service.js';

const CLIENT_SYNC_FIELDS = ['name', 'email', 'phone', 'address', 'street', 'zip', 'city', 'country', 'che', 'company', 'siret'];

/**
 * Find or create a Client document matching the embedded client data.
 * Returns the Client _id to use as clientRef.
 */
async function resolveClientRef(clientData, userId) {
  if (!clientData?.name) return null;

  // Try to find existing client by name + company (same user)
  const matchQuery = { userId, name: clientData.name };
  if (clientData.company) matchQuery.company = clientData.company;

  let client = await Client.findOne(matchQuery);

  if (client) {
    // Update existing client with any new fields from project
    const updates = {};
    for (const field of CLIENT_SYNC_FIELDS) {
      if (clientData[field] && !client[field]) {
        updates[field] = clientData[field];
      }
    }
    if (Object.keys(updates).length > 0) {
      await Client.updateOne({ _id: client._id }, { $set: updates });
    }
    return client._id;
  }

  // Create new client
  const newClientData = { userId };
  for (const field of CLIENT_SYNC_FIELDS) {
    if (clientData[field]) newClientData[field] = clientData[field];
  }
  client = await Client.create(newClientData);
  return client._id;
}

// @desc    Get all projects (OPTIMIZED - single aggregation query)
// @route   GET /api/projects
export const getProjects = async (req, res, next) => {
  try {
    const { archived, status, search, limit = 50, page = 1 } = req.query;

    // Build match stage
    const matchStage = {};

    // Filter by user if authenticated
    if (req.user) {
      matchStage.userId = new mongoose.Types.ObjectId(req.user._id);
    }

    // Filter archived
    if (archived === 'true') {
      matchStage.archivedAt = { $ne: null };
    } else {
      matchStage.archivedAt = null;
    }

    // Filter by status
    if (status) {
      matchStage.status = new mongoose.Types.ObjectId(status);
    }

    // Search with text index
    if (search) {
      matchStage.$text = { $search: search };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100); // Max 100 per page

    // Single aggregation query with all lookups
    const projectsWithTotals = await Project.aggregate([
      { $match: matchStage },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },

      // Lookup status
      {
        $lookup: {
          from: 'status',
          localField: 'status',
          foreignField: '_id',
          as: 'statusData'
        }
      },
      { $unwind: { path: '$statusData', preserveNullAndEmptyArrays: true } },

      // Lookup unbilled events
      {
        $lookup: {
          from: 'events',
          let: { projectId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$project', '$$projectId'] },
                    { $eq: ['$billed', false] }
                  ]
                }
              }
            },
            { $sort: { date: -1 } },
            { $limit: 50 } // Limit for performance
          ],
          as: 'unbilledEvents'
        }
      },

      // Lookup unbilled quotes (draft, sent, signed, partial)
      {
        $lookup: {
          from: 'quotes',
          let: { projectId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$project', '$$projectId'] },
                    { $in: ['$status', ['draft', 'sent', 'signed', 'partial']] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } }
          ],
          as: 'unbilledQuotes'
        }
      },

      // Lookup pending invoices (draft, sent, partial — not paid/cancelled)
      {
        $lookup: {
          from: 'invoices',
          let: { projectId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$project', '$$projectId'] },
                    { $in: ['$status', ['draft', 'sent', 'partial']] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } }
          ],
          as: 'pendingInvoices'
        }
      },

      // Calculate totals in aggregation
      {
        $addFields: {
          status: '$statusData',
          unbilledTotal: {
            $reduce: {
              input: '$unbilledEvents',
              initialValue: 0,
              in: {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ['$$this.type', 'hours'] },
                      then: { $add: ['$$value', { $multiply: ['$$this.hours', '$$this.hourlyRate'] }] }
                    },
                    {
                      case: { $eq: ['$$this.type', 'expense'] },
                      then: { $add: ['$$value', '$$this.amount'] }
                    }
                  ],
                  default: '$$value'
                }
              }
            }
          },
          unbilledHours: {
            $reduce: {
              input: {
                $filter: {
                  input: '$unbilledEvents',
                  cond: { $eq: ['$$this.type', 'hours'] }
                }
              },
              initialValue: 0,
              in: { $add: ['$$value', '$$this.hours'] }
            }
          },
          // Calculate unbilled quotes total (with partial support)
          unbilledQuotesTotal: {
            $reduce: {
              input: '$unbilledQuotes',
              initialValue: 0,
              in: {
                $cond: {
                  if: {
                    $and: [
                      { $eq: ['$$this.status', 'partial'] },
                      { $gt: ['$$this.subtotal', 0] }
                    ]
                  },
                  then: {
                    $add: [
                      '$$value',
                      {
                        $multiply: [
                          { $ifNull: ['$$this.total', 0] },
                          {
                            $divide: [
                              { $subtract: ['$$this.subtotal', { $ifNull: ['$$this.invoicedAmount', 0] }] },
                              '$$this.subtotal'
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  else: { $add: ['$$value', { $ifNull: ['$$this.total', 0] }] }
                }
              }
            }
          },
          unbilledQuotesCount: { $size: '$unbilledQuotes' },
          // Pending invoices total (remaining amount for partial, full for others)
          pendingInvoicesTotal: {
            $reduce: {
              input: '$pendingInvoices',
              initialValue: 0,
              in: {
                $cond: {
                  if: { $eq: ['$$this.status', 'partial'] },
                  then: {
                    $add: [
                      '$$value',
                      { $subtract: [{ $ifNull: ['$$this.total', 0] }, { $ifNull: ['$$this.paidAmount', 0] }] }
                    ]
                  },
                  else: { $add: ['$$value', { $ifNull: ['$$this.total', 0] }] }
                }
              }
            }
          },
          pendingInvoicesCount: { $size: '$pendingInvoices' },
          recentEvents: { $slice: ['$unbilledEvents', 3] },
          recentQuotes: { $slice: ['$unbilledQuotes', 3] },
          recentInvoices: { $slice: ['$pendingInvoices', 3] }
        }
      },

      // Clean up - remove large arrays
      {
        $project: {
          statusData: 0,
          unbilledEvents: 0,
          unbilledQuotes: 0,
          pendingInvoices: 0
        }
      }
    ]);

    // Get total count for pagination
    const totalCount = await Project.countDocuments(matchStage);

    res.json({
      success: true,
      data: projectsWithTotals,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error) {
    console.error('GET PROJECTS ERROR:', error);
    next(error);
  }
};

// @desc    Get single project (OPTIMIZED - parallel queries)
// @route   GET /api/projects/:id
export const getProject = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const project = await Project.findOne(query).populate('status');

    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Run all stats queries in parallel
    const [eventStats, quoteStats, invoiceStats] = await Promise.all([
      // Event stats aggregation
      Event.aggregate([
        { $match: { project: project._id } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalHours: {
              $sum: {
                $cond: [{ $eq: ['$type', 'hours'] }, '$hours', 0]
              }
            },
            unbilledEventsTotal: {
              $sum: {
                $cond: [
                  { $eq: ['$billed', false] },
                  {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: ['$type', 'hours'] },
                          then: { $multiply: ['$hours', '$hourlyRate'] }
                        },
                        {
                          case: { $eq: ['$type', 'expense'] },
                          then: '$amount'
                        }
                      ],
                      default: 0
                    }
                  },
                  0
                ]
              }
            },
            billedEventsTotal: {
              $sum: {
                $cond: [
                  { $eq: ['$billed', true] },
                  {
                    $switch: {
                      branches: [
                        {
                          case: { $eq: ['$type', 'hours'] },
                          then: { $multiply: ['$hours', '$hourlyRate'] }
                        },
                        {
                          case: { $eq: ['$type', 'expense'] },
                          then: '$amount'
                        }
                      ],
                      default: 0
                    }
                  },
                  0
                ]
              }
            }
          }
        }
      ]),

      // Quote stats - use simple find for complex calculation
      Quote.find({ project: project._id }).lean(),

      // Invoice stats aggregation
      Invoice.aggregate([
        { $match: { project: project._id } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            paidTotal: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$total', 0] }
            },
            sentTotal: {
              $sum: { $cond: [{ $eq: ['$status', 'sent'] }, '$total', 0] }
            },
            draftTotal: {
              $sum: { $cond: [{ $eq: ['$status', 'draft'] }, '$total', 0] }
            },
            totalInvoiced: {
              $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$total', 0] }
            }
          }
        }
      ])
    ]);

    // Extract event stats
    const eventData = eventStats[0] || {
      totalCount: 0, totalHours: 0, unbilledEventsTotal: 0, billedEventsTotal: 0
    };

    // Calculate quote stats (need complex calculation for partial)
    const quotes = quoteStats;
    const unbilledQuotesTotal = quotes
      .filter(q => ['draft', 'sent', 'signed', 'partial'].includes(q.status))
      .reduce((sum, q) => {
        if (q.status === 'partial' && q.subtotal > 0) {
          const remainingFraction = (q.subtotal - (q.invoicedAmount || 0)) / q.subtotal;
          return sum + (q.total * remainingFraction);
        }
        return sum + q.total;
      }, 0);

    const invoicedQuotesTotal = quotes
      .filter(q => q.status === 'invoiced')
      .reduce((sum, q) => sum + q.total, 0);

    // Extract invoice stats
    const invoiceData = invoiceStats[0] || {
      totalCount: 0, paidTotal: 0, sentTotal: 0, draftTotal: 0, totalInvoiced: 0
    };

    res.json({
      success: true,
      data: {
        ...project.toObject(),
        stats: {
          unbilledTotal: eventData.unbilledEventsTotal + unbilledQuotesTotal,
          billedTotal: invoiceData.totalInvoiced,
          pendingTotal: invoiceData.sentTotal + invoiceData.draftTotal,
          unbilledEventsTotal: eventData.unbilledEventsTotal,
          billedEventsTotal: eventData.billedEventsTotal,
          unbilledQuotesTotal,
          invoicedQuotesTotal,
          paidInvoicesTotal: invoiceData.paidTotal,
          sentInvoicesTotal: invoiceData.sentTotal,
          totalHours: eventData.totalHours,
          eventCount: eventData.totalCount,
          quoteCount: quotes.length,
          invoiceCount: invoiceData.totalCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create project
// @route   POST /api/projects
export const createProject = async (req, res, next) => {
  try {
    const { name, description, client, status, tags, notes } = req.body;

    // Get default status if not provided (scoped to current user)
    let statusId = status;
    if (!statusId) {
      const statusFilter = { isDefault: true };
      if (req.user) statusFilter.userId = req.user._id;
      const defaultStatus = await Status.findOne(statusFilter);
      if (!defaultStatus) {
        return res.status(400).json({
          success: false,
          error: 'Aucun statut par défaut. Créez des statuts d\'abord.'
        });
      }
      statusId = defaultStatus._id;
    }

    // Auto-link to Client collection
    const clientRef = req.user?._id ? await resolveClientRef(client, req.user._id) : null;

    const project = await Project.create({
      userId: req.user?._id,
      name,
      description,
      client,
      clientRef,
      status: statusId,
      tags,
      notes
    });

    await project.populate('status');

    // Log history
    await historyService.projectCreated(project._id, name);

    // Publish to Hub Event Bus for cross-app automations
    eventBus.publish('project.created', {
      projectId: project._id.toString(),
      projectName: project.name,
      client: project.client,
      hubUserId: req.user?.hubUserId || null
    }).catch(() => {});

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project
// @route   PUT /api/projects/:id
export const updateProject = async (req, res, next) => {
  try {
    const { name, description, client, tags, notes } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    // If client data changed, resolve the clientRef
    let clientRef;
    if (client && req.user) {
      const existing = await Project.findOne(query).select('clientRef');
      if (existing?.clientRef) {
        clientRef = existing.clientRef;
      } else {
        clientRef = await resolveClientRef(client, req.user._id);
      }
    }

    const updateData = { name, description, client, tags, notes };
    if (clientRef) updateData.clientRef = clientRef;

    const project = await Project.findOneAndUpdate(
      query,
      updateData,
      { new: true, runValidators: true }
    ).populate('status');

    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Sync client data back to Client collection
    if (client && project.clientRef) {
      const syncData = {};
      for (const field of CLIENT_SYNC_FIELDS) {
        if (client[field] !== undefined) {
          syncData[field] = client[field] || '';
        }
      }
      if (Object.keys(syncData).length > 0) {
        await Client.updateOne({ _id: project.clientRef }, { $set: syncData });
      }
    }

    // Log history
    await historyService.projectUpdated(project._id, req.body);

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

// @desc    Change project status
// @route   PATCH /api/projects/:id/status
export const changeStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const project = await Project.findOne(query).populate('status');
    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    const oldStatusName = project.status?.name || 'Inconnu';

    // Find status (shared across all users in legacy system)
    const newStatus = await Status.findById(status);
    if (!newStatus) {
      return res.status(404).json({ success: false, error: 'Statut non trouvé' });
    }

    project.status = status;
    await project.save();

    await project.populate('status');

    // Log history
    await historyService.statusChanged(project._id, oldStatusName, newStatus.name);

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive project
// @route   DELETE /api/projects/:id
export const archiveProject = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const project = await Project.findOneAndUpdate(
      query,
      { archivedAt: new Date() },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Log history
    await historyService.projectArchived(project._id);

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore archived project
// @route   PATCH /api/projects/:id/restore
export const restoreProject = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) {
      query.userId = req.user._id;
    }

    const project = await Project.findOneAndUpdate(
      query,
      { archivedAt: null },
      { new: true }
    ).populate('status');

    if (!project) {
      return res.status(404).json({ success: false, error: 'Projet non trouvé' });
    }

    // Log history
    await historyService.projectRestored(project._id);

    res.json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

// @desc    Update project positions (batch)
// @route   PATCH /api/projects/positions
export const updatePositions = async (req, res, next) => {
  try {
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({
        success: false,
        error: 'Positions array is required'
      });
    }

    const bulkOps = positions.map(({ id, x, y, order }) => ({
      updateOne: {
        filter: { _id: id, ...(req.user ? { userId: req.user._id } : {}) },
        update: { $set: { position: { x, y, order } } }
      }
    }));

    await Project.bulkWrite(bulkOps);

    res.json({ success: true, message: 'Positions updated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset all project positions
// @route   DELETE /api/projects/positions
export const resetPositions = async (req, res, next) => {
  try {
    const query = req.user ? { userId: req.user._id } : {};

    await Project.updateMany(
      query,
      { $set: { position: { x: null, y: null, order: 0 } } }
    );

    res.json({ success: true, message: 'Positions reset' });
  } catch (error) {
    next(error);
  }
};
