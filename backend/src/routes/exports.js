import express from 'express';
import {
  exportJournal,
  exportClients,
  exportRevenueReport
} from '../controllers/exportController.js';

const router = express.Router();

// All routes are protected by requireAuth middleware in server.js

router.get('/journal', exportJournal);
router.get('/clients', exportClients);
router.get('/revenue-report', exportRevenueReport);

export default router;
