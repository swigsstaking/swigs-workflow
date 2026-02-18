import express from 'express';
import {
  getPlannedBlocks,
  createPlannedBlock,
  updatePlannedBlock,
  deletePlannedBlock
} from '../controllers/planningController.js';

const router = express.Router();

router.route('/')
  .get(getPlannedBlocks)
  .post(createPlannedBlock);

router.route('/:id')
  .put(updatePlannedBlock)
  .delete(deletePlannedBlock);

export default router;
