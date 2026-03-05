import mongoose from 'mongoose';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Event from '../models/Event.js';
import Project from '../models/Project.js';
import Status from '../models/Status.js';
import BankTransaction from '../models/BankTransaction.js';
import ExpenseCategory from '../models/ExpenseCategory.js';
import { projectCharges } from '../services/chargeProjection.service.js';

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

/**
 * Helper: compute date range from `period` query param.
 * - 'year' (default) → Jan 1 to Dec 31 of current year
 * - 'rolling'        → 12 months rolling window
 */
function getAnalyticsPeriod(period) {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (period === 'rolling') {
    return {
      start: new Date(currentYear, now.getMonth() - 11, 1),
      end: new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999),
      label: '12 derniers mois'
    };
  }
  // Default: current year
  return {
    start: new Date(currentYear, 0, 1),
    end: new Date(currentYear, 11, 31, 23, 59, 59, 999),
    label: `${currentYear}`
  };
}

/**
 * Helper: get the revenue date field and match filter based on revenueMode.
 * - 'invoiced' (default) → issueDate, status != cancelled
 * - 'paid'               → paidAt, status = paid
 */
function getRevenueMode(mode) {
  if (mode === 'paid') {
    return {
      dateField: 'paidAt',
      matchStatus: { status: { $in: ['paid', 'partial'] } },
      amountField: '_revAmount',
      isPaid: true
    };
  }
  return {
    dateField: 'issueDate',
    matchStatus: { status: { $ne: 'cancelled' } },
    amountField: 'total',
    isPaid: false
  };
}

/**
 * For paid mode: compute effective revenue date and amount.
 * - _revDate: paidAt → latest payment date → issueDate (fallback for partial invoices)
 * - _revAmount: paidAmount if > 0, else total (fallback for old invoices without paidAmount)
 */
const PAID_MODE_ADD_FIELDS = {
  $addFields: {
    _revDate: { $ifNull: ['$paidAt', { $ifNull: [{ $max: '$payments.date' }, '$issueDate'] }] },
    _revAmount: {
      $cond: [
        { $gt: [{ $ifNull: ['$paidAmount', 0] }, 0] },
        '$paidAmount',
        '$total'
      ]
    }
  }
};

// Helper: Get user's project IDs (with optional status exclusion)
const getUserProjectIds = async (userId, excludeStatuses = []) => {
  if (!userId) return null;
  const query = { userId };
  if (excludeStatuses.length > 0) {
    const statusIds = excludeStatuses
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    if (statusIds.length > 0) query.status = { $nin: statusIds };
  }
  const projects = await Project.find(query).select('_id');
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

    // Parse params
    const excludeStatuses = req.query.excludeStatuses ? req.query.excludeStatuses.split(',').filter(Boolean) : [];
    const { dateField, matchStatus, amountField, isPaid } = getRevenueMode(req.query.revenueMode);

    // Get user's projects for filtering invoices
    const projectIds = await getUserProjectIds(req.user?._id, excludeStatuses);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Date ranges
    const ytdRange = getYearRange(currentYear);
    const mtdRange = getMonthRange(currentYear, currentMonth);
    const lastMonthRange = getMonthRange(lastMonthYear, lastMonth);
    const lastYearYtdEnd = new Date(currentYear - 1, currentMonth - 1, now.getDate(), 23, 59, 59, 999);
    const lastYearYtdStart = new Date(currentYear - 1, 0, 1);

    // Build pipeline — in paid mode, compute fallback date for partial invoices
    const pipeline = [{ $match: projectFilter }];
    if (isPaid) pipeline.push(PAID_MODE_ADD_FIELDS);
    const dField = isPaid ? '_revDate' : dateField;
    // Credit notes subtract from revenue (multiplier: -1 for credit_note, +1 otherwise)
    const cnMultiplier = { $cond: [{ $eq: ['$documentType', 'credit_note'] }, -1, 1] };
    const sumExpr = { $multiply: [cnMultiplier, isPaid ? '$_revAmount' : '$total'] };

    // Use $facet to run all aggregations in parallel
    pipeline.push({
      $facet: {
        ytd: [
          { $match: { [dField]: { $gte: ytdRange.start, $lte: ytdRange.end }, ...matchStatus } },
          { $group: { _id: null, total: { $sum: sumExpr } } }
        ],
        mtd: [
          { $match: { [dField]: { $gte: mtdRange.start, $lte: mtdRange.end }, ...matchStatus } },
          { $group: { _id: null, total: { $sum: sumExpr } } }
        ],
        lastMonth: [
          { $match: { [dField]: { $gte: lastMonthRange.start, $lte: lastMonthRange.end }, ...matchStatus } },
          { $group: { _id: null, total: { $sum: sumExpr } } }
        ],
        lastYearYtd: [
          { $match: { [dField]: { $gte: lastYearYtdStart, $lte: lastYearYtdEnd }, ...matchStatus } },
          { $group: { _id: null, total: { $sum: sumExpr } } }
        ],
        pending: [
          { $match: { status: { $in: ['sent', 'partial'] }, documentType: { $ne: 'credit_note' } } },
          {
            $group: {
              _id: null,
              total: { $sum: { $subtract: ['$total', { $ifNull: ['$paidAmount', 0] }] } },
              count: { $sum: 1 }
            }
          }
        ]
      }
    });
    const [result] = await Invoice.aggregate(pipeline);

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
        revenueMode: req.query.revenueMode || 'invoiced',
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

    // Parse excluded statuses
    const excludeStatuses = req.query.excludeStatuses ? req.query.excludeStatuses.split(',').filter(Boolean) : [];
    const { dateField, matchStatus, amountField, isPaid } = getRevenueMode(req.query.revenueMode);

    // Get user's projects for filtering invoices
    const projectIds = await getUserProjectIds(req.user?._id, excludeStatuses);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Calculate date range for last 12 months
    const startDate = new Date(currentYear, currentMonth - 12, 1);
    const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // Build aggregation pipeline
    const pipeline = [
      { $match: { ...projectFilter, ...matchStatus } }
    ];

    // For paid mode: compute fallback date for partial invoices
    if (isPaid) pipeline.push(PAID_MODE_ADD_FIELDS);
    const dField = isPaid ? '_revDate' : dateField;

    // Date range filter
    const dateFilter = includeLastYear === 'true'
      ? { $gte: new Date(currentYear - 1, currentMonth - 12, 1), $lte: endDate }
      : { $gte: startDate, $lte: endDate };

    // Credit notes subtract from revenue
    const cnMul = { $cond: [{ $eq: ['$documentType', 'credit_note'] }, -1, 1] };
    const revExpr = { $multiply: [cnMul, `$${amountField}`] };

    pipeline.push(
      { $match: { [dField]: dateFilter } },
      {
        $project: {
          _revValue: revExpr,
          year: { $year: `$${dField}` },
          month: { $month: `$${dField}` }
        }
      },
      {
        $group: {
          _id: { year: '$year', month: '$month' },
          revenue: { $sum: '$_revValue' }
        }
      }
    );

    const invoices = await Invoice.aggregate(pipeline);

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
    // Parse excluded statuses
    const excludeStatuses = req.query.excludeStatuses ? req.query.excludeStatuses.split(',').filter(Boolean) : [];

    // Get user's projects for filtering quotes
    const projectIds = await getUserProjectIds(req.user?._id, excludeStatuses);
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
    // Parse excluded statuses
    const excludeStatuses = req.query.excludeStatuses ? req.query.excludeStatuses.split(',').filter(Boolean) : [];

    // Filter by user
    const userQuery = {};
    if (req.user) {
      userQuery.userId = req.user._id;
    }
    if (excludeStatuses.length > 0) {
      userQuery.status = { $nin: excludeStatuses.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const projects = await Project.find(userQuery).populate('status');
    const statuses = await Status.find(req.user ? { userId: req.user._id } : {}).sort('order');

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

    // Parse excluded statuses
    const excludeStatuses = req.query.excludeStatuses ? req.query.excludeStatuses.split(',').filter(Boolean) : [];

    // Get user's projects for filtering invoices
    const projectIds = await getUserProjectIds(req.user?._id, excludeStatuses);
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
          totalRevenue: { $sum: { $cond: [{ $eq: ['$documentType', 'credit_note'] }, { $multiply: ['$total', -1] }, '$total'] } },
          invoiceCount: { $sum: { $cond: [{ $eq: ['$documentType', 'credit_note'] }, 0, 1] } }
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

    // Parse excluded statuses
    const excludeStatuses = req.query.excludeStatuses ? req.query.excludeStatuses.split(',').filter(Boolean) : [];

    // Get user's projects for filtering events
    const projectIds = await getUserProjectIds(req.user?._id, excludeStatuses);
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

// =============================================================================
// COMPTA PLUS ANALYTICS (require hasComptaPlus)
// =============================================================================

/**
 * GET /api/analytics/expenses
 * Expense breakdown by category + monthly evolution
 */
export const getExpenseStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const currentYear = now.getFullYear();
    const { start: startDate, end: endDate } = getAnalyticsPeriod(req.query.period);

    // By category
    const byCategory = await BankTransaction.aggregate([
      {
        $match: {
          userId,
          creditDebit: 'DBIT',
          bookingDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$expenseCategory',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          vatTotal: { $sum: { $ifNull: ['$vatAmount', 0] } }
        }
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryId: '$_id',
          categoryName: { $ifNull: ['$category.name', 'Non catégorisé'] },
          categoryColor: { $ifNull: ['$category.color', '#94a3b8'] },
          categoryIcon: '$category.icon',
          accountNumber: '$category.accountNumber',
          total: 1,
          count: 1,
          vatTotal: 1
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Monthly evolution (12 months)
    const monthlyStart = new Date(currentYear, now.getMonth() - 11, 1);
    const monthly = await BankTransaction.aggregate([
      {
        $match: {
          userId,
          creditDebit: 'DBIT',
          bookingDate: { $gte: monthlyStart, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$bookingDate' },
            month: { $month: '$bookingDate' },
            category: '$expenseCategory'
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: '_id.category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ]);

    // Build monthly array
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      let m = now.getMonth() + 1 - i;
      let y = currentYear;
      if (m <= 0) { m += 12; y -= 1; }

      const monthEntries = monthly.filter(e => e._id.year === y && e._id.month === m);
      const totalExpenses = monthEntries.reduce((sum, e) => sum + e.total, 0);

      monthlyData.push({
        month: monthNames[m - 1],
        monthNum: m,
        year: y,
        total: totalExpenses,
        byCategory: monthEntries.map(e => ({
          categoryName: e.category?.name || 'Non catégorisé',
          categoryColor: e.category?.color || '#94a3b8',
          total: e.total
        }))
      });
    }

    // Totals
    const ytd = byCategory.reduce((sum, c) => sum + c.total, 0);
    const uncategorized = byCategory.find(c => !c.categoryId)?.count || 0;
    const currentMonthTotal = monthlyData[monthlyData.length - 1]?.total || 0;

    res.json({
      success: true,
      data: {
        ytd,
        mtd: currentMonthTotal,
        uncategorized,
        byCategory,
        monthly: monthlyData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/profitloss
 * Revenue vs expenses by month = profit
 */
export const getProfitLoss = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const currentYear = now.getFullYear();
    const { dateField, matchStatus, amountField, isPaid } = getRevenueMode(req.query.revenueMode);
    const { start: startDate, end: endDate } = getAnalyticsPeriod(req.query.period);

    // Get project IDs for revenue
    const projectIds = await getUserProjectIds(userId);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // Revenue by month (credit notes subtract from revenue via multiplier)
    const revPipeline = [
      { $match: { ...projectFilter, ...matchStatus } }
    ];
    if (isPaid) revPipeline.push(PAID_MODE_ADD_FIELDS);
    const dField = isPaid ? '_revDate' : dateField;
    // Credit note multiplier: -1 for credit_note, +1 otherwise
    const cnMul = { $cond: [{ $eq: ['$documentType', 'credit_note'] }, -1, 1] };
    // For paid mode, prorate vatAmount based on _revAmount/total ratio
    const vatExpr = isPaid
      ? { $multiply: [cnMul, '$vatAmount', { $cond: [{ $gt: ['$total', 0] }, { $divide: ['$_revAmount', '$total'] }, 0] }] }
      : { $multiply: [cnMul, '$vatAmount'] };
    const revExpr = isPaid
      ? { $multiply: [cnMul, '$_revAmount'] }
      : { $multiply: [cnMul, '$total'] };
    revPipeline.push(
      { $match: { [dField]: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: { year: { $year: `$${dField}` }, month: { $month: `$${dField}` } },
          revenue: { $sum: revExpr },
          vatCollected: { $sum: vatExpr }
        }
      }
    );
    const revenueData = await Invoice.aggregate(revPipeline);

    // Expenses by month
    const expenseData = await BankTransaction.aggregate([
      {
        $match: {
          userId,
          creditDebit: 'DBIT',
          bookingDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { year: { $year: '$bookingDate' }, month: { $month: '$bookingDate' } },
          expenses: { $sum: '$amount' },
          vatDeductible: { $sum: { $ifNull: ['$vatAmount', 0] } }
        }
      }
    ]);

    const revenueMap = new Map();
    revenueData.forEach(r => revenueMap.set(`${r._id.year}-${r._id.month}`, r));
    const expenseMap = new Map();
    expenseData.forEach(e => expenseMap.set(`${e._id.year}-${e._id.month}`, e));

    // Build month array based on period
    const data = [];
    const period = req.query.period || 'rolling';
    if (period === 'year') {
      // Jan → Dec of current year
      for (let m = 1; m <= 12; m++) {
        const key = `${currentYear}-${m}`;
        const rev = revenueMap.get(key) || { revenue: 0, vatCollected: 0 };
        const exp = expenseMap.get(key) || { expenses: 0, vatDeductible: 0 };
        data.push({
          month: monthNames[m - 1], monthNum: m, year: currentYear,
          revenue: rev.revenue, expenses: exp.expenses, profit: rev.revenue - exp.expenses,
          vatCollected: rev.vatCollected, vatDeductible: exp.vatDeductible, vatNet: rev.vatCollected - exp.vatDeductible
        });
      }
    } else {
      // Last 12 rolling months
      for (let i = 11; i >= 0; i--) {
        let m = now.getMonth() + 1 - i;
        let y = currentYear;
        if (m <= 0) { m += 12; y -= 1; }
        const key = `${y}-${m}`;
        const rev = revenueMap.get(key) || { revenue: 0, vatCollected: 0 };
        const exp = expenseMap.get(key) || { expenses: 0, vatDeductible: 0 };
        data.push({
          month: monthNames[m - 1], monthNum: m, year: y,
          revenue: rev.revenue, expenses: exp.expenses, profit: rev.revenue - exp.expenses,
          vatCollected: rev.vatCollected, vatDeductible: exp.vatDeductible, vatNet: rev.vatCollected - exp.vatDeductible
        });
      }
    }

    // Merge projection data if requested
    if (req.query.projection === 'true') {
      const projectionMap = await projectCharges(userId, startDate, endDate);
      for (const m of data) {
        const key = `${m.year}-${m.monthNum}`;
        const proj = projectionMap.get(key);
        m.projectedExpenses = proj ? Math.round(proj.projectedExpenses * 100) / 100 : 0;
        m.projectedCharges = proj ? proj.charges : [];
      }
    }

    // LTVA art. 10: Annual revenue threshold check (CHF 100'000)
    const annualRevenue = data.reduce((sum, m) => sum + (m.revenue || 0), 0);
    let vatThresholdWarning = null;
    if (annualRevenue >= 100000) {
      vatThresholdWarning = 'critical';
    } else if (annualRevenue >= 90000) {
      vatThresholdWarning = 'warning';
    } else if (annualRevenue >= 80000) {
      vatThresholdWarning = 'info';
    }

    res.json({ success: true, data, period, revenueMode: req.query.revenueMode || 'invoiced', annualRevenue, vatThresholdWarning });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/vat-detail
 * VAT collected - deductible = net, by quarter
 */
export const getVatDetail = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    const { dateField, matchStatus, amountField, isPaid } = getRevenueMode(req.query.revenueMode);

    const projectIds = await getUserProjectIds(userId);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // VAT collected (credit notes subtract via multiplier)
    const vatPipeline = [
      { $match: { ...projectFilter, ...matchStatus } }
    ];
    if (isPaid) vatPipeline.push(PAID_MODE_ADD_FIELDS);
    const dField = isPaid ? '_revDate' : dateField;
    // Credit note multiplier: -1 for credit_note, +1 otherwise
    const cnMul = { $cond: [{ $eq: ['$documentType', 'credit_note'] }, -1, 1] };
    // For paid mode, prorate amounts based on _revAmount/total ratio
    const payRatio = { $cond: [{ $gt: ['$total', 0] }, { $divide: ['$_revAmount', '$total'] }, 0] };
    const vatExpr = isPaid ? { $multiply: [cnMul, '$vatAmount', payRatio] } : { $multiply: [cnMul, '$vatAmount'] };
    const subtotalExpr = isPaid ? { $multiply: [cnMul, '$subtotal', payRatio] } : { $multiply: [cnMul, '$subtotal'] };
    const totalExpr = isPaid ? { $multiply: [cnMul, '$_revAmount'] } : { $multiply: [cnMul, '$total'] };

    vatPipeline.push(
      { $match: { [dField]: { $gte: startDate, $lte: endDate } } },
      {
        $project: {
          quarter: { $ceil: { $divide: [{ $month: `$${dField}` }, 3] } },
          _vatAmt: vatExpr,
          _total: totalExpr,
          _subtotal: subtotalExpr
        }
      },
      {
        $group: {
          _id: '$quarter',
          vatCollected: { $sum: '$_vatAmt' },
          revenueHT: { $sum: '$_subtotal' },
          revenueTTC: { $sum: '$_total' }
        }
      }
    );
    const collected = await Invoice.aggregate(vatPipeline);

    // VAT deductible (from DBIT transactions with vatAmount)
    const deductible = await BankTransaction.aggregate([
      {
        $match: {
          userId,
          creditDebit: 'DBIT',
          bookingDate: { $gte: startDate, $lte: endDate },
          vatAmount: { $gt: 0 }
        }
      },
      {
        $project: {
          quarter: { $ceil: { $divide: [{ $month: '$bookingDate' }, 3] } },
          vatAmount: 1,
          amount: 1
        }
      },
      {
        $group: {
          _id: '$quarter',
          vatDeductible: { $sum: '$vatAmount' },
          expensesTotal: { $sum: '$amount' }
        }
      }
    ]);

    const collectedMap = new Map(collected.map(c => [c._id, c]));
    const deductibleMap = new Map(deductible.map(d => [d._id, d]));

    const quarters = [1, 2, 3, 4].map(q => {
      const col = collectedMap.get(q) || { vatCollected: 0, revenueHT: 0, revenueTTC: 0 };
      const ded = deductibleMap.get(q) || { vatDeductible: 0, expensesTotal: 0 };
      return {
        quarter: q,
        label: `T${q}`,
        vatCollected: col.vatCollected,
        vatDeductible: ded.vatDeductible,
        vatNet: col.vatCollected - ded.vatDeductible,
        revenueHT: col.revenueHT,
        expensesTotal: ded.expensesTotal
      };
    });

    const totals = quarters.reduce((acc, q) => ({
      vatCollected: acc.vatCollected + q.vatCollected,
      vatDeductible: acc.vatDeductible + q.vatDeductible,
      vatNet: acc.vatNet + q.vatNet,
      revenueHT: acc.revenueHT + q.revenueHT,
      expensesTotal: acc.expensesTotal + q.expensesTotal
    }), { vatCollected: 0, vatDeductible: 0, vatNet: 0, revenueHT: 0, expensesTotal: 0 });

    res.json({
      success: true,
      data: { year, quarters, totals }
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// DRILL-DOWN DETAIL ENDPOINTS
// =============================================================================

/**
 * GET /api/analytics/profitloss/:year/:month/detail
 * Returns individual invoices (revenue) and transactions (expenses) for a given month.
 */
export const getProfitLossDetail = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const { dateField, matchStatus, isPaid } = getRevenueMode(req.query.revenueMode);
    const { start, end } = getMonthRange(year, month);

    const projectIds = await getUserProjectIds(userId);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // In paid mode, also find partial invoices where a payment falls in the date range
    const invoiceFilter = { ...projectFilter, ...matchStatus };
    if (isPaid) {
      invoiceFilter.$or = [
        { paidAt: { $gte: start, $lte: end } },
        { status: 'partial', 'payments.date': { $gte: start, $lte: end } }
      ];
    } else {
      invoiceFilter[dateField] = { $gte: start, $lte: end };
    }

    const [invoices, transactions] = await Promise.all([
      Invoice.find(invoiceFilter)
        .populate({ path: 'project', select: 'client name' })
        .select('number total vatAmount subtotal status issueDate paidAt paidAmount payments')
        .sort({ [dateField]: -1 })
        .lean(),
      BankTransaction.find({
        userId,
        creditDebit: 'DBIT',
        bookingDate: { $gte: start, $lte: end }
      })
        .populate({ path: 'expenseCategory', select: 'name color' })
        .select('bookingDate amount counterpartyName expenseCategory vatAmount')
        .sort({ bookingDate: -1 })
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        invoices: invoices.map(inv => {
          // In paid mode, show paidAmount and effective date
          const effectiveDate = isPaid
            ? (inv.paidAt || (inv.payments?.length ? new Date(Math.max(...inv.payments.map(p => new Date(p.date)))) : inv.issueDate))
            : inv[dateField];
          const displayAmount = isPaid ? ((inv.paidAmount || 0) > 0 ? inv.paidAmount : inv.total) : inv.total;
          return {
            _id: inv._id,
            number: inv.number,
            clientName: inv.project?.client?.name || 'Inconnu',
            company: inv.project?.client?.company || '',
            projectName: inv.project?.name || '',
            total: displayAmount,
            subtotal: inv.subtotal,
            vatAmount: inv.vatAmount,
            status: inv.status,
            date: effectiveDate,
            paidAmount: inv.paidAmount || 0,
            invoiceTotal: inv.total
          };
        }),
        transactions: transactions.map(tx => ({
          _id: tx._id,
          date: tx.bookingDate,
          counterpartyName: tx.counterpartyName,
          amount: tx.amount,
          vatAmount: tx.vatAmount,
          categoryName: tx.expenseCategory?.name || null,
          categoryColor: tx.expenseCategory?.color || null
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/expenses/:categoryId/detail
 * Returns individual transactions for a given expense category.
 */
export const getExpenseCategoryDetail = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { categoryId } = req.params;
    const { start: startDate, end: endDate } = getAnalyticsPeriod(req.query.period);

    const filter = {
      userId,
      creditDebit: 'DBIT',
      bookingDate: { $gte: startDate, $lte: endDate }
    };

    if (categoryId === 'uncategorized') {
      filter.expenseCategory = null;
    } else if (mongoose.Types.ObjectId.isValid(categoryId)) {
      filter.expenseCategory = new mongoose.Types.ObjectId(categoryId);
    } else {
      return res.status(400).json({ success: false, error: 'categoryId invalide' });
    }

    const transactions = await BankTransaction.find(filter)
      .select('bookingDate amount counterpartyName vatAmount vatRate reference notes attachments')
      .sort({ bookingDate: -1 })
      .limit(200)
      .lean();

    res.json({
      success: true,
      data: transactions.map(tx => ({
        _id: tx._id,
        date: tx.bookingDate,
        counterpartyName: tx.counterpartyName,
        amount: tx.amount,
        vatAmount: tx.vatAmount,
        vatRate: tx.vatRate,
        reference: tx.reference,
        notes: tx.notes || '',
        attachmentCount: tx.attachments?.length || 0
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/vat-detail/:quarter/detail
 * Returns individual invoices and transactions for a given quarter.
 */
export const getVatQuarterDetail = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const quarter = parseInt(req.params.quarter);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { dateField, matchStatus, isPaid } = getRevenueMode(req.query.revenueMode);

    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);

    const projectIds = await getUserProjectIds(userId);
    const projectFilter = projectIds ? { project: { $in: projectIds } } : {};

    // In paid mode, also find partial invoices where a payment falls in the date range
    const invoiceFilter = { ...projectFilter, ...matchStatus };
    if (isPaid) {
      invoiceFilter.$or = [
        { paidAt: { $gte: start, $lte: end } },
        { status: 'partial', 'payments.date': { $gte: start, $lte: end } }
      ];
    } else {
      invoiceFilter[dateField] = { $gte: start, $lte: end };
    }

    const [invoices, transactions] = await Promise.all([
      Invoice.find(invoiceFilter)
        .populate({ path: 'project', select: 'client name' })
        .select('number total vatAmount subtotal status issueDate paidAt paidAmount payments')
        .sort({ [dateField]: -1 })
        .lean(),
      BankTransaction.find({
        userId,
        creditDebit: 'DBIT',
        bookingDate: { $gte: start, $lte: end },
        vatAmount: { $gt: 0 }
      })
        .populate({ path: 'expenseCategory', select: 'name color' })
        .select('bookingDate amount counterpartyName expenseCategory vatAmount vatRate')
        .sort({ bookingDate: -1 })
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        invoices: invoices.map(inv => {
          const effectiveDate = isPaid
            ? (inv.paidAt || (inv.payments?.length ? new Date(Math.max(...inv.payments.map(p => new Date(p.date)))) : inv.issueDate))
            : inv[dateField];
          const displayAmount = isPaid ? ((inv.paidAmount || 0) > 0 ? inv.paidAmount : inv.total) : inv.total;
          const ratio = isPaid && inv.total > 0 ? (displayAmount / inv.total) : 1;
          return {
            _id: inv._id,
            number: inv.number,
            clientName: inv.project?.client?.name || 'Inconnu',
            company: inv.project?.client?.company || '',
            total: displayAmount,
            subtotal: Math.round((inv.subtotal * ratio) * 100) / 100,
            vatAmount: Math.round((inv.vatAmount * ratio) * 100) / 100,
            status: inv.status,
            date: effectiveDate,
            paidAmount: inv.paidAmount || 0,
            invoiceTotal: inv.total
          };
        }),
        transactions: transactions.map(tx => ({
          _id: tx._id,
          date: tx.bookingDate,
          counterpartyName: tx.counterpartyName,
          amount: tx.amount,
          vatAmount: tx.vatAmount,
          vatRate: tx.vatRate,
          categoryName: tx.expenseCategory?.name || null,
          categoryColor: tx.expenseCategory?.color || null
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

