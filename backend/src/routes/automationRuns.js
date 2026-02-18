import express from 'express';
import { getAutomationRun, retryRun } from '../controllers/automationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// Single run
router.get('/:id', getAutomationRun);

// Retry failed run
router.post('/:id/retry', retryRun);

export default router;
