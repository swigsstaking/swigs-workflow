import express from 'express';
import { getDashboard } from '../controllers/dashboardController.js';
import { checkComptaPlus } from '../middleware/requireComptaPlus.js';

const router = express.Router();

router.get('/', checkComptaPlus, getDashboard);

export default router;
