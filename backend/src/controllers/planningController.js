import crypto from 'crypto';
import PlannedBlock from '../models/PlannedBlock.js';
import User from '../models/User.js';
import eventBus from '../services/eventBus.service.js';

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

    // Load current block to detect new tasks
    const currentBlock = await PlannedBlock.findOne(query).populate({
      path: 'project',
      select: 'name client status',
      populate: [
        { path: 'client', select: 'name' },
        { path: 'status', select: 'name color' }
      ]
    });

    if (!currentBlock) {
      return res.status(404).json({
        success: false,
        error: 'Bloc planifié non trouvé'
      });
    }

    const updateData = {};
    if (start) updateData.start = new Date(start);
    if (end) updateData.end = new Date(end);
    if (notes !== undefined) updateData.notes = notes;
    if (req.body.tasks !== undefined) updateData.tasks = req.body.tasks;

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

    // Publish new tasks to Event Bus → swigs-task
    if (req.body.tasks && eventBus.isConnected) {
      const oldTaskIds = new Set((currentBlock.tasks || []).map(t => t.id));
      const newTasks = req.body.tasks.filter(t => !oldTaskIds.has(t.id));

      for (const task of newTasks) {
        eventBus.publish('task.create', {
          title: task.text,
          description: `Planning: ${block.project?.name || 'Projet'} — ${block.project?.client?.name || ''}`,
          assignTo: req.user?.email || null,
          source: 'planning',
          context: {
            projectName: block.project?.name,
            clientName: block.project?.client?.name,
            blockDate: block.start?.toISOString(),
            planningBlockId: block._id.toString()
          }
        });
      }
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

// @desc    Generate or regenerate calendar sync token
// @route   POST /api/planning/calendar-token
export const generateCalendarToken = async (req, res, next) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { calendarToken: token },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/api/planning/ical/${token}`;

    res.json({ success: true, data: { token, url } });
  } catch (error) {
    next(error);
  }
};

// Helper: pad number to 2 digits
function pad(n) { return n.toString().padStart(2, '0'); }

// Helper: format date to iCal DTSTART/DTEND format (local time)
function toIcalDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// Helper: format date to iCal UTC timestamp for DTSTAMP
function toIcalUtc(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// Helper: escape iCal text values
function escapeIcal(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// @desc    Get iCal feed (public, authenticated by token)
// @route   GET /api/planning/ical/:token
export const getIcalFeed = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ calendarToken: token });
    if (!user) {
      return res.status(404).send('Not Found');
    }

    // Fetch blocks: 3 months ago → 6 months ahead
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - 3);
    const end = new Date(now);
    end.setMonth(end.getMonth() + 6);

    const blocks = await PlannedBlock.find({
      userId: user._id,
      $or: [
        { start: { $gte: start, $lte: end } },
        { end: { $gte: start, $lte: end } },
        { start: { $lte: start }, end: { $gte: end } }
      ]
    }).populate({
      path: 'project',
      select: 'name client status',
      populate: [
        { path: 'client', select: 'name' },
        { path: 'status', select: 'name color' }
      ]
    }).sort('start');

    // Build iCal
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SWIGS//Workflow//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:SWIGS Planning',
      'X-WR-TIMEZONE:Europe/Zurich'
    ];

    for (const block of blocks) {
      const summary = block.project?.name || 'Bloc planifié';
      const descParts = [];
      if (block.project?.client?.name) descParts.push(`Client: ${block.project.client.name}`);
      if (block.project?.status?.name) descParts.push(`Statut: ${block.project.status.name}`);
      if (block.notes) descParts.push(`Notes: ${block.notes}`);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${block._id}@swigs`);
      lines.push(`DTSTAMP:${toIcalUtc(block.updatedAt || block.createdAt || now)}`);
      lines.push(`DTSTART:${toIcalDate(block.start)}`);
      lines.push(`DTEND:${toIcalDate(block.end)}`);
      lines.push(`SUMMARY:${escapeIcal(summary)}`);
      if (descParts.length > 0) {
        lines.push(`DESCRIPTION:${escapeIcal(descParts.join('\n'))}`);
      }
      lines.push('STATUS:CONFIRMED');
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');

    const ical = lines.join('\r\n');

    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="swigs-planning.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.send(ical);
  } catch (error) {
    next(error);
  }
};
