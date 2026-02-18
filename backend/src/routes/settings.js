import express from 'express';
import { getSettings, updateSettings, getStats } from '../controllers/settingsController.js';

const router = express.Router();

router.route('/')
  .get(getSettings)
  .put(updateSettings);

router.route('/stats')
  .get(getStats);

export default router;
