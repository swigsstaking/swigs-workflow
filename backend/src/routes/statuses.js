import express from 'express';
import {
  getStatuses,
  createStatus,
  updateStatus,
  reorderStatuses,
  deleteStatus,
  seedStatuses
} from '../controllers/statusController.js';

const router = express.Router();

router.route('/')
  .get(getStatuses)
  .post(createStatus);

router.route('/seed')
  .post(seedStatuses);

router.route('/reorder')
  .put(reorderStatuses);

router.route('/:id')
  .put(updateStatus)
  .delete(deleteStatus);

export default router;
