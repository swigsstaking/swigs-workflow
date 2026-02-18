import express from 'express';
import {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  reorderServices,
  toggleService
} from '../controllers/serviceController.js';

const router = express.Router();

router.route('/')
  .get(getServices)
  .post(createService);

router.route('/reorder')
  .put(reorderServices);

router.route('/:id')
  .get(getService)
  .put(updateService)
  .delete(deleteService);

router.route('/:id/toggle')
  .patch(toggleService);

export default router;
