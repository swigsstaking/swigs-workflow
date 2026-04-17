import { Router } from 'express';
import {
  getAll,
  getOne,
  create,
  update,
  submit,
  approve,
  reject,
  reimburse,
  remove,
} from '../controllers/expenseController.js';

const router = Router();

// Liste + création
router.route('/')
  .get(getAll)
  .post(create);

// Actions de workflow (avant /:id pour éviter conflit)
router.post('/:id/submit', submit);
router.patch('/:id/approve', approve);
router.patch('/:id/reject', reject);
router.patch('/:id/reimburse', reimburse);

// CRUD single
router.route('/:id')
  .get(getOne)
  .put(update)
  .delete(remove);

export default router;
