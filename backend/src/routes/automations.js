import express from 'express';
import {
  getAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  toggleAutomation,
  runAutomation,
  getAutomationRuns,
  getAutomationRun,
  retryRun
} from '../controllers/automationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

// Automation CRUD
router.route('/')
  .get(getAutomations)
  .post(createAutomation);

router.route('/:id')
  .get(getAutomation)
  .put(updateAutomation)
  .delete(deleteAutomation);

// Toggle active state
router.patch('/:id/toggle', toggleAutomation);

// Manual run
router.post('/:id/run', runAutomation);

// Get runs for automation
router.get('/:id/runs', getAutomationRuns);

export default router;
