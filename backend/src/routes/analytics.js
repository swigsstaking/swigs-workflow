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
  getVatDetail
} from '../controllers/analyticsController.js';
import { checkComptaPlus } from '../middleware/requireComptaPlus.js';

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

// Compta Plus analytics
router.get('/expenses', checkComptaPlus, getExpenseStats);
router.get('/profitloss', checkComptaPlus, getProfitLoss);
router.get('/vat-detail', checkComptaPlus, getVatDetail);

export default router;
