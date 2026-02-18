import express from 'express';
import {
  getRevenueStats,
  getMonthlyEvolution,
  getQuoteStats,
  getProjectStats,
  getTopClients,
  getHoursStats,
  seedTestData,
  deleteTestData
} from '../controllers/analyticsController.js';

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

// TEMPORARY - Test data seeding
router.post('/seed-test-data', seedTestData);
router.delete('/seed-test-data', deleteTestData);

export default router;
