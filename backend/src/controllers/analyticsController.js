import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Event from '../models/Event.js';
import Project from '../models/Project.js';
import Status from '../models/Status.js';

// Helper: Get date range for a month
const getMonthRange = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
};

// Helper: Get date range for a year
const getYearRange = (year) => {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end };
};

// Helper: French month names
const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// Helper: Get user's project IDs
const getUserProjectIds = async (userId) => {
  if (!userId) return null;
  const projects = await Project.find({ userId }).select('_id');
  return projects.map(p => p._id);
};

/**
 * GET /api/analytics/revenue
 * Returns revenue statistics
 */
export const getRevenueStats = async (req, res, next) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Get user's projects for filtering invoices
    const projectIds = await getUserProjectIds(req.user?._id);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Date ranges
    const ytdRange = getYearRange(currentYear);
    const mtdRange = getMonthRange(currentYear, currentMonth);
    const lastMonthRange = getMonthRange(lastMonthYear, lastMonth);
    const lastYearYtdEnd = new Date(currentYear - 1, currentMonth - 1, now.getDate(), 23, 59, 59, 999);
    const lastYearYtdStart = new Date(currentYear - 1, 0, 1);

    // Use $facet to run all aggregations in parallel
    const [result] = await Invoice.aggregate([
      { $match: projectFilter },
      {
        $facet: {
          ytd: [
            {
              $match: {
                issueDate: { $gte: ytdRange.start, $lte: ytdRange.end },
                status: { $ne: 'cancelled' }
              }
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
          ],
          mtd: [
            {
              $match: {
                issueDate: { $gte: mtdRange.start, $lte: mtdRange.end },
                status: { $ne: 'cancelled' }
              }
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
          ],
          lastMonth: [
            {
              $match: {
                issueDate: { $gte: lastMonthRange.start, $lte: lastMonthRange.end },
                status: { $ne: 'cancelled' }
              }
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
          ],
          lastYearYtd: [
            {
              $match: {
                issueDate: { $gte: lastYearYtdStart, $lte: lastYearYtdEnd },
                status: { $ne: 'cancelled' }
              }
            },
            { $group: { _id: null, total: { $sum: '$total' } } }
          ],
          pending: [
            { $match: { status: 'sent' } },
            {
              $group: {
                _id: null,
                total: { $sum: '$total' },
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    // Extract values
    const ytd = result.ytd[0]?.total || 0;
    const mtd = result.mtd[0]?.total || 0;
    const lastMonthTotal = result.lastMonth[0]?.total || 0;
    const lastYearYtd = result.lastYearYtd[0]?.total || 0;
    const pending = result.pending[0]?.total || 0;
    const pendingCount = result.pending[0]?.count || 0;

    // Growth calculations
    const monthlyGrowth = lastMonthTotal > 0
      ? ((mtd - lastMonthTotal) / lastMonthTotal) * 100
      : 0;
    const yearlyGrowth = lastYearYtd > 0
      ? ((ytd - lastYearYtd) / lastYearYtd) * 100
      : 0;

    res.json({
      success: true,
      data: {
        ytd,
        mtd,
        pending,
        pendingCount,
        lastMonth: lastMonthTotal,
        lastYearYtd,
        growth: {
          monthly: Math.round(monthlyGrowth * 10) / 10,
          yearly: Math.round(yearlyGrowth * 10) / 10
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/monthly
 * Returns monthly evolution data for the last 12 months
 */
export const getMonthlyEvolution = async (req, res, next) => {
  try {
    const { includeLastYear } = req.query;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get user's projects for filtering invoices
    const projectIds = await getUserProjectIds(req.user?._id);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Calculate date range for last 12 months
    const startDate = new Date(currentYear, currentMonth - 12, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // Build aggregation pipeline
    const matchStage = {
      ...projectFilter,
      issueDate: { $gte: startDate, $lte: endDate },
      status: { $ne: 'cancelled' }
    };

    // For includeLastYear, extend the date range
    if (includeLastYear === 'true') {
      matchStage.issueDate = {
        $gte: new Date(currentYear - 1, currentMonth - 12, 1),
        $lte: endDate
      };
    }

    const invoices = await Invoice.aggregate([
      { $match: matchStage },
      {
        $project: {
          total: 1,
          year: { $year: '$issueDate' },
          month: { $month: '$issueDate' }
        }
      },
      {
        $group: {
          _id: { year: '$year', month: '$month' },
          revenue: { $sum: '$total' }
        }
      }
    ]);

    // Create map for quick lookup
    const revenueMap = new Map();
    invoices.forEach(inv => {
      const key = `${inv._id.year}-${inv._id.month}`;
      revenueMap.set(key, inv.revenue);
    });

    // Build response array
    const data = [];
    for (let i = 11; i >= 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;

      if (month <= 0) {
        month += 12;
        year -= 1;
      }

      const revenue = revenueMap.get(`${year}-${month}`) || 0;
      const costs = 0;
      const profit = revenue - costs;

      const monthData = {
        month: monthNames[month - 1],
        monthNum: month,
        year,
        revenue,
        costs,
        profit,
        isCurrentMonth: month === currentMonth && year === currentYear
      };

      // Include last year data if requested
      if (includeLastYear === 'true') {
        const lastYearRevenue = revenueMap.get(`${year - 1}-${month}`) || 0;
        const lastYearCosts = 0;
        const lastYearProfit = lastYearRevenue - lastYearCosts;

        monthData.lastYearRevenue = lastYearRevenue;
        monthData.lastYearCosts = lastYearCosts;
        monthData.lastYearProfit = lastYearProfit;
      }

      data.push(monthData);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/quotes
 * Returns quote statistics
 */
export const getQuoteStats = async (req, res, next) => {
  try {
    // Get user's projects for filtering quotes
    const projectIds = await getUserProjectIds(req.user?._id);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    const quotes = await Quote.find(projectFilter).lean();

    const byStatus = {
      draft: 0,
      sent: 0,
      signed: 0,
      refused: 0,
      expired: 0,
      invoiced: 0
    };

    let totalValue = 0;

    quotes.forEach(quote => {
      byStatus[quote.status] = (byStatus[quote.status] || 0) + 1;
      totalValue += quote.total;
    });

    // Conversion rate: signed / (sent + signed + refused)
    const conversionBase = byStatus.sent + byStatus.signed + byStatus.refused;
    const conversionRate = conversionBase > 0
      ? (byStatus.signed / conversionBase) * 100
      : 0;

    const averageValue = quotes.length > 0 ? totalValue / quotes.length : 0;

    res.json({
      success: true,
      data: {
        total: quotes.length,
        byStatus,
        conversionRate: Math.round(conversionRate * 10) / 10,
        averageValue: Math.round(averageValue * 100) / 100,
        totalValue
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/projects
 * Returns project statistics
 */
export const getProjectStats = async (req, res, next) => {
  try {
    // Filter by user
    const userQuery = {};
    if (req.user) {
      userQuery.userId = req.user._id;
    }

    const projects = await Project.find(userQuery).populate('status');
    const statuses = await Status.find(userQuery).sort('order');

    const active = projects.filter(p => !p.archivedAt).length;
    const archived = projects.filter(p => p.archivedAt).length;

    // Count by status
    const byStatus = {};
    statuses.forEach(status => {
      byStatus[status._id.toString()] = {
        name: status.name,
        color: status.color,
        count: 0
      };
    });

    projects.forEach(project => {
      if (project.status && !project.archivedAt) {
        const statusId = project.status._id.toString();
        if (byStatus[statusId]) {
          byStatus[statusId].count += 1;
        }
      }
    });

    res.json({
      success: true,
      data: {
        total: projects.length,
        active,
        archived,
        byStatus: Object.values(byStatus)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/clients
 * Returns top clients by revenue
 */
export const getTopClients = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Get user's projects for filtering invoices
    const projectIds = await getUserProjectIds(req.user?._id);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Aggregation with $lookup to get project data
    const clients = await Invoice.aggregate([
      {
        $match: {
          ...projectFilter,
          status: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'projects',
          localField: 'project',
          foreignField: '_id',
          as: 'projectData'
        }
      },
      { $unwind: '$projectData' },
      {
        $group: {
          _id: {
            company: {
              $ifNull: ['$projectData.client.company', '$projectData.client.name']
            }
          },
          clientName: { $first: '$projectData.client.name' },
          company: { $first: '$projectData.client.company' },
          totalRevenue: { $sum: '$total' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          clientName: { $ifNull: ['$clientName', 'Unknown'] },
          company: { $ifNull: ['$company', ''] },
          totalRevenue: 1,
          invoiceCount: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: clients
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/hours
 * Returns hours worked statistics by month
 */
export const getHoursStats = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get user's projects for filtering events
    const projectIds = await getUserProjectIds(req.user?._id);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Calculate date range
    const startDate = new Date(currentYear, currentMonth - months, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // Aggregation to get hours and revenue by month
    const events = await Event.aggregate([
      {
        $match: {
          ...projectFilter,
          type: 'hours',
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $project: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          hours: 1,
          revenue: { $multiply: ['$hours', '$hourlyRate'] }
        }
      },
      {
        $group: {
          _id: { year: '$year', month: '$month' },
          hours: { $sum: '$hours' },
          revenue: { $sum: '$revenue' }
        }
      }
    ]);

    // Create map for quick lookup
    const statsMap = new Map();
    events.forEach(e => {
      const key = `${e._id.year}-${e._id.month}`;
      statsMap.set(key, { hours: e.hours, revenue: e.revenue });
    });

    // Build response array
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      let month = currentMonth - i;
      let year = currentYear;

      if (month <= 0) {
        month += 12;
        year -= 1;
      }

      const stats = statsMap.get(`${year}-${month}`) || { hours: 0, revenue: 0 };

      data.push({
        month: monthNames[month - 1],
        monthNum: month,
        year,
        hours: stats.hours,
        revenue: stats.revenue,
        isCurrentMonth: month === currentMonth && year === currentYear
      });
    }

    // Calculate totals
    const totalHours = data.reduce((sum, d) => sum + d.hours, 0);
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

    // This month vs last month
    const currentMonthData = data.find(d => d.isCurrentMonth);
    const lastMonthIndex = data.findIndex(d => d.isCurrentMonth) - 1;
    const lastMonthData = lastMonthIndex >= 0 ? data[lastMonthIndex] : null;

    const monthlyChange = lastMonthData && lastMonthData.hours > 0
      ? ((currentMonthData.hours - lastMonthData.hours) / lastMonthData.hours) * 100
      : 0;

    res.json({
      success: true,
      data: {
        monthly: data,
        totals: {
          hours: totalHours,
          revenue: totalRevenue
        },
        currentMonth: currentMonthData?.hours || 0,
        monthlyChange: Math.round(monthlyChange * 10) / 10
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/analytics/seed-test-data
 * Seeds test invoice data for testing analytics charts
 * TEMPORARY - Remove after testing
 */
export const seedTestData = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Non disponible en production' });
    }

    // Filter by user
    const userQuery = {};
    if (req.user) {
      userQuery.userId = req.user._id;
    }

    // Get project IDs from database (user's projects only)
    const projects = await Project.find(userQuery).limit(7);

    if (projects.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Not enough projects in database to seed test data'
      });
    }

    // Delete existing test invoices for user's projects
    const projectIds = projects.map(p => p._id);
    const deleted = await Invoice.deleteMany({
      number: /^TEST-/,
      project: { $in: projectIds }
    });

    const vatRate = 8.1;
    const testInvoices = [
      // August 2025
      { projectIdx: 0, number: 'TEST-2025-001', subtotal: 4500, status: 'paid', issueDate: new Date('2025-08-15'), paidAt: new Date('2025-08-28'), desc: 'Développement Phase 1' },
      { projectIdx: 1, number: 'TEST-2025-002', subtotal: 3200, status: 'paid', issueDate: new Date('2025-08-22'), paidAt: new Date('2025-09-05'), desc: 'Création site web' },

      // September 2025
      { projectIdx: 2, number: 'TEST-2025-003', subtotal: 5800, status: 'paid', issueDate: new Date('2025-09-10'), paidAt: new Date('2025-09-25'), desc: 'Développement site' },
      { projectIdx: Math.min(3, projects.length - 1), number: 'TEST-2025-004', subtotal: 2100, status: 'paid', issueDate: new Date('2025-09-18'), paidAt: new Date('2025-10-02'), desc: 'Maintenance mensuelle' },
      { projectIdx: 0, number: 'TEST-2025-005', subtotal: 1500, status: 'paid', issueDate: new Date('2025-09-28'), paidAt: new Date('2025-10-10'), desc: 'Support technique' },

      // October 2025
      { projectIdx: Math.min(4, projects.length - 1), number: 'TEST-2025-006', subtotal: 6200, status: 'paid', issueDate: new Date('2025-10-05'), paidAt: new Date('2025-10-20'), desc: 'Développement e-commerce' },
      { projectIdx: Math.min(5, projects.length - 1), number: 'TEST-2025-007', subtotal: 4800, status: 'paid', issueDate: new Date('2025-10-12'), paidAt: new Date('2025-10-28'), desc: 'Site corporate' },
      { projectIdx: 2, number: 'TEST-2025-008', subtotal: 3500, status: 'paid', issueDate: new Date('2025-10-20'), paidAt: new Date('2025-11-05'), desc: 'Phase 2' },
      { projectIdx: Math.min(3, projects.length - 1), number: 'TEST-2025-009', subtotal: 2100, status: 'paid', issueDate: new Date('2025-10-28'), paidAt: new Date('2025-11-10'), desc: 'Maintenance' },

      // November 2025
      { projectIdx: Math.min(6, projects.length - 1), number: 'TEST-2025-010', subtotal: 7500, status: 'paid', issueDate: new Date('2025-11-08'), paidAt: new Date('2025-11-22'), desc: 'Refonte complète' },
      { projectIdx: 0, number: 'TEST-2025-011', subtotal: 2800, status: 'paid', issueDate: new Date('2025-11-15'), paidAt: new Date('2025-11-30'), desc: 'Évolutions' },
      { projectIdx: 1, number: 'TEST-2025-012', subtotal: 1800, status: 'paid', issueDate: new Date('2025-11-25'), paidAt: new Date('2025-12-10'), desc: 'SEO' },

      // December 2025
      { projectIdx: 2, number: 'TEST-2025-013', subtotal: 4200, status: 'paid', issueDate: new Date('2025-12-05'), paidAt: new Date('2025-12-20'), desc: 'Phase finale' },
      { projectIdx: Math.min(4, projects.length - 1), number: 'TEST-2025-014', subtotal: 3100, status: 'paid', issueDate: new Date('2025-12-10'), paidAt: new Date('2025-12-28'), desc: 'E-commerce v2' },
      { projectIdx: Math.min(3, projects.length - 1), number: 'TEST-2025-015', subtotal: 2100, status: 'paid', issueDate: new Date('2025-12-18'), paidAt: new Date('2026-01-05'), desc: 'Maintenance' },
      { projectIdx: Math.min(5, projects.length - 1), number: 'TEST-2025-016', subtotal: 2500, status: 'paid', issueDate: new Date('2025-12-22'), paidAt: new Date('2026-01-08'), desc: 'Corrections' },

      // January 2026 (current month)
      { projectIdx: 0, number: 'TEST-2026-001', subtotal: 5500, status: 'paid', issueDate: new Date('2026-01-10'), paidAt: new Date('2026-01-25'), desc: 'Nouveau module' },
      { projectIdx: Math.min(6, projects.length - 1), number: 'TEST-2026-002', subtotal: 3800, status: 'sent', issueDate: new Date('2026-01-18'), paidAt: null, desc: 'Maintenance' },
      { projectIdx: 1, number: 'TEST-2026-003', subtotal: 2200, status: 'sent', issueDate: new Date('2026-01-25'), paidAt: null, desc: 'Nouvelle saison' },
    ];

    const created = [];

    for (const inv of testInvoices) {
      const vatAmount = Math.round(inv.subtotal * vatRate) / 100;
      const total = inv.subtotal + vatAmount;
      const dueDate = new Date(inv.issueDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const invoice = new Invoice({
        project: projects[inv.projectIdx]._id,
        number: inv.number,
        events: [{
          description: inv.desc,
          type: 'hours',
          hours: Math.round(inv.subtotal / 120),
          hourlyRate: 120,
          amount: inv.subtotal,
          date: inv.issueDate
        }],
        quotes: [],
        subtotal: inv.subtotal,
        vatRate: vatRate,
        vatAmount: vatAmount,
        total: total,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: dueDate,
        paidAt: inv.paidAt,
        notes: `Test invoice for ${projects[inv.projectIdx].client?.company || projects[inv.projectIdx].client?.name || 'Unknown'}`
      });

      await invoice.save();
      created.push({ number: inv.number, total, status: inv.status });
    }

    res.json({
      success: true,
      message: `Created ${created.length} test invoices`,
      data: {
        deleted: deleted.deletedCount,
        created: created.length,
        invoices: created
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/analytics/seed-test-data
 * Removes all test invoice data
 */
export const deleteTestData = async (req, res, next) => {
  try {
    // Get user's projects for filtering
    const projectIds = await getUserProjectIds(req.user?._id);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    const deleted = await Invoice.deleteMany({
      ...projectFilter,
      number: /^TEST-/
    });

    res.json({
      success: true,
      message: `Deleted ${deleted.deletedCount} test invoices`,
      data: { deleted: deleted.deletedCount }
    });
  } catch (error) {
    next(error);
  }
};
