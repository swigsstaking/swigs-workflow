import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  testConnection,
  syncInvoice,
  syncQuote,
  syncClient,
  syncAll,
  getStatus
} from '../controllers/abaninjaController.js';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Test connection
router.post('/test-connection', testConnection);

// Sync individual documents
router.post('/sync/invoice/:id', syncInvoice);
router.post('/sync/quote/:id', syncQuote);
router.post('/sync/client/:id', syncClient);

// Bulk sync
router.post('/sync/all', syncAll);

// Status
router.get('/status', getStatus);

export default router;
