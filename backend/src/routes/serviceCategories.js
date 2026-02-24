import express from 'express';
import {
  getServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  seedServiceCategories
} from '../controllers/serviceCategoryController.js';

const router = express.Router();

router.get('/', getServiceCategories);
router.post('/', createServiceCategory);
router.post('/seed', seedServiceCategories);
router.put('/:id', updateServiceCategory);
router.delete('/:id', deleteServiceCategory);

export default router;
