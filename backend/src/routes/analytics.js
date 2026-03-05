import express from 'express';
import {
  getRevenueStats,
  getMonthlyEvolution,
  getQuoteStats,
  getProjectStats,
  getTopClients,
  getHoursStats,
  getExpenseStats,
  getProfitLoss,
  getVatDetail,
  getProfitLossDetail,
  getExpenseCategoryDetail,
  getVatQuarterDetail
} from '../controllers/analyticsController.js';
import { requireComptaPlus } from '../middleware/requireComptaPlus.js';

const router = express.Router();

// GET /api/analytics/revenue - Revenue statistics
router.get('/revenue', getRevenueStats);

// GET /api/analytics/monthly - Monthly evolution (12 months)
router.get('/monthly', getMonthlyEvolution);

// GET /api/analytics/quotes - Quote statistics
router.get('/quotes', getQuoteStats);

// GET /api/analytics/projects - Project statistics
router.get('/projects', getProjectStats);

// GET /api/analytics/clients - Top clients by revenue
router.get('/clients', getTopClients);

// GET /api/analytics/hours - Hours worked statistics
router.get('/hours', getHoursStats);

// Compta Plus analytics — hard gate (403 if no subscription)
router.get('/expenses', requireComptaPlus, getExpenseStats);
router.get('/profitloss', requireComptaPlus, getProfitLoss);
router.get('/vat-detail', requireComptaPlus, getVatDetail);

// Drill-down detail endpoints
router.get('/profitloss/:year/:month/detail', requireComptaPlus, getProfitLossDetail);
router.get('/expenses/:categoryId/detail', requireComptaPlus, getExpenseCategoryDetail);
router.get('/vat-detail/:quarter/detail', requireComptaPlus, getVatQuarterDetail);

export default router;
