import PlannedBlock from '../models/PlannedBlock.js';
import User from '../models/User.js';

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
