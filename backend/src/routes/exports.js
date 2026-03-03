import express from 'express';
import {
  exportJournal,
  exportClients,
  exportRevenueReport,
  exportFiduciary
} from '../controllers/exportController.js';
import { requireComptaPlus } from '../middleware/requireComptaPlus.js';

const router = express.Router();

// All routes are protected by requireAuth middleware in server.js

router.get('/journal', exportJournal);
router.get('/clients', exportClients);
router.get('/revenue-report', exportRevenueReport);
router.get('/fiduciary', requireComptaPlus, exportFiduciary);

export default router;
