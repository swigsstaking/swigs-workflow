import Invoice from '../models/Invoice.js';
import Project from '../models/Project.js';
import {
  generateJournalCSV,
  generateClientListCSV,
  generateRevenueReportPDF
} from '../services/export.service.js';
import Settings from '../models/Settings.js';

/**
 * Export journal comptable (CSV)
 * GET /api/exports/journal?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const exportJournal = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const userId = req.user._id;

    // Validate date range
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Les paramètres from et to sont requis'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({
        success: false,
        error: 'Format de date invalide'
      });
    }

    // Find all paid invoices in date range for this user
    const invoices = await Invoice.find({
      status: 'paid',
      paidAt: {
        $gte: fromDate,
        $lte: toDate
      }
    })
      .populate({
        path: 'project',
        match: { userId },
        select: 'name client userId'
      })
      .sort({ paidAt: 1 });

    // Filter out invoices where project doesn't belong to user (populate returns null)
    const userInvoices = invoices.filter(inv => inv.project !== null);

    // Generate CSV
    const csv = generateJournalCSV(userInvoices, { from: fromDate, to: toDate });

    // Send as downloadable file
    const filename = `journal_${from}_${to}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Export client list (CSV)
 * GET /api/exports/clients
 */
export const exportClients = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all projects for this user
    const projects = await Project.find({ userId }).select('client');

    // Extract unique clients (based on email)
    const clientsMap = new Map();
    for (const project of projects) {
      if (project.client && project.client.email) {
        const key = project.client.email;
        if (!clientsMap.has(key)) {
          clientsMap.set(key, project.client);
        }
      } else if (project.client && project.client.name) {
        // For clients without email, use name as key
        const key = `name_${project.client.name}`;
        if (!clientsMap.has(key)) {
          clientsMap.set(key, project.client);
        }
      }
    }

    const clients = Array.from(clientsMap.values());

    // Generate CSV
    const csv = generateClientListCSV(clients);

    // Send as downloadable file
    const filename = `clients_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Export revenue report (PDF)
 * GET /api/exports/revenue-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export const exportRevenueReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const userId = req.user._id;

    // Validate date range
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Les paramètres from et to sont requis'
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({
        success: false,
        error: 'Format de date invalide'
      });
    }

    // Find all invoices in date range for this user (any status)
    const invoices = await Invoice.find({
      issueDate: {
        $gte: fromDate,
        $lte: toDate
      }
    })
      .populate({
        path: 'project',
        match: { userId },
        select: 'name client userId'
      })
      .sort({ issueDate: 1 });

    // Filter out invoices where project doesn't belong to user
    const userInvoices = invoices.filter(inv => inv.project !== null);

    // Get user settings
    const settings = await Settings.getSettings(userId);

    // Generate PDF
    const pdfBuffer = await generateRevenueReportPDF(
      userInvoices,
      { from: fromDate, to: toDate },
      settings
    );

    // Send as downloadable file
    const filename = `rapport_revenus_${from}_${to}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
