import express from 'express';
import {
  getPlannedBlocks,
  createPlannedBlock,
  updatePlannedBlock,
  deletePlannedBlock,
  generateCalendarToken
} from '../controllers/planningController.js';

const router = express.Router();

// Calendar token generation (protected by requireAuth at server.js level)
router.post('/calendar-token', generateCalendarToken);

router.route('/')
  .get(getPlannedBlocks)
  .post(createPlannedBlock);

router.route('/:id')
  .put(updatePlannedBlock)
  .delete(deletePlannedBlock);

export default router;
