import Settings from '../models/Settings.js';
import History from '../models/History.js';
import { encrypt, decrypt } from '../utils/crypto.js';

// @desc    Get settings
// @route   GET /api/settings
export const getSettings = async (req, res, next) => {
  try {
    const userId = req.user?._id || null;
    const settings = await Settings.getSettings(userId);
    const settingsObj = settings.toObject ? settings.toObject() : { ...settings };

    // Decrypt secrets before sending to frontend
    if (settingsObj.smtp?.pass) {
      settingsObj.smtp.pass = decrypt(settingsObj.smtp.pass);
    }
    if (settingsObj.abaninja?.apiKey) {
      settingsObj.abaninja.apiKey = decrypt(settingsObj.abaninja.apiKey);
    }

    res.json({ success: true, data: settingsObj });
  } catch (error) {
    next(error);
  }
};

// @desc    Update settings
// @route   PUT /api/settings
export const updateSettings = async (req, res, next) => {
  try {
    const { company, invoicing, personalization, emailTemplates, smtp, abaninja, reminders, cms } = req.body;

    const userId = req.user?._id || null;
    const query = userId ? { userId } : { userId: { $exists: false } };

    let settings = await Settings.findOne(query);

    if (!settings) {
      settings = new Settings({ userId });
    }

    if (company) {
      settings.company = { ...settings.company.toObject(), ...company };
    }

    if (invoicing) {
      settings.invoicing = { ...settings.invoicing.toObject(), ...invoicing };
    }

    if (personalization) {
      settings.personalization = { ...settings.personalization.toObject(), ...personalization };
    }

    if (emailTemplates) {
      settings.emailTemplates = { ...settings.emailTemplates.toObject(), ...emailTemplates };
    }

    if (smtp) {
      const smtpData = { ...(settings.smtp?.toObject ? settings.smtp.toObject() : {}), ...smtp };
      // Encrypt SMTP password before saving
      if (smtpData.pass) {
        smtpData.pass = encrypt(smtpData.pass);
      }
      settings.smtp = smtpData;
    }

    if (abaninja) {
      const abData = { ...(settings.abaninja?.toObject ? settings.abaninja.toObject() : {}), ...abaninja };
      // Encrypt API key before saving
      if (abData.apiKey) {
        abData.apiKey = encrypt(abData.apiKey);
      }
      settings.abaninja = abData;
    }

    if (reminders) {
      settings.reminders = { ...(settings.reminders?.toObject ? settings.reminders.toObject() : {}), ...reminders };
    }

    if (cms) {
      settings.cms = { ...(settings.cms?.toObject ? settings.cms.toObject() : {}), ...cms };
    }

    await settings.save();

    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// @desc    Get project history
// @route   GET /api/projects/:projectId/history
export const getProjectHistory = async (req, res, next) => {
  try {
    const query = { project: req.params.projectId };
    // Note: History is linked to project, which is already filtered by user

    const history = await History.find(query).sort('-createdAt');

    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats
// @route   GET /api/stats
export const getStats = async (req, res, next) => {
  try {
    const Project = (await import('../models/Project.js')).default;
    const Invoice = (await import('../models/Invoice.js')).default;
    const Event = (await import('../models/Event.js')).default;

    // Build user query
    const userQuery = {};
    if (req.user) {
      userQuery.userId = req.user._id;
    }

    // Active projects count
    const activeProjects = await Project.countDocuments({ ...userQuery, archivedAt: null });

    // Pending invoices - need to get user's projects first
    let pendingInvoices = [];
    if (req.user) {
      const userProjects = await Project.find(userQuery).select('_id');
      const projectIds = userProjects.map(p => p._id);
      pendingInvoices = await Invoice.find({
        project: { $in: projectIds },
        status: { $in: ['draft', 'sent'] }
      });
    } else {
      pendingInvoices = await Invoice.find({ status: { $in: ['draft', 'sent'] } });
    }
    const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Paid this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let paidInvoices = [];
    if (req.user) {
      const userProjects = await Project.find(userQuery).select('_id');
      const projectIds = userProjects.map(p => p._id);
      paidInvoices = await Invoice.find({
        project: { $in: projectIds },
        status: 'paid',
        paidAt: { $gte: startOfMonth }
      });
    } else {
      paidInvoices = await Invoice.find({
        status: 'paid',
        paidAt: { $gte: startOfMonth }
      });
    }
    const paidThisMonth = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Unbilled events total - need to get user's projects first
    let unbilledEvents = [];
    if (req.user) {
      const userProjects = await Project.find(userQuery).select('_id');
      const projectIds = userProjects.map(p => p._id);
      unbilledEvents = await Event.find({
        project: { $in: projectIds },
        billed: false
      });
    } else {
      unbilledEvents = await Event.find({ billed: false });
    }
    const unbilledTotal = unbilledEvents.reduce((sum, event) => {
      if (event.type === 'hours') return sum + (event.hours * event.hourlyRate);
      if (event.type === 'expense') return sum + event.amount;
      return sum;
    }, 0);

    res.json({
      success: true,
      data: {
        activeProjects,
        pendingAmount,
        paidThisMonth,
        unbilledTotal
      }
    });
  } catch (error) {
    next(error);
  }
};
