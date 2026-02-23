import express from 'express';
import {
  getAll,
  getById,
  create,
  update,
  changeStatus,
  remove,
  generateNow
} from '../controllers/recurringInvoiceController.js';

const router = express.Router();

router.route('/')
  .get(getAll)
  .post(create);

router.route('/:id')
  .get(getById)
  .put(update)
  .delete(remove);

router.route('/:id/status')
  .patch(changeStatus);

router.route('/:id/generate')
  .post(generateNow);

export default router;
