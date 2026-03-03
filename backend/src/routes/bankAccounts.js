import { Router } from 'express';
import {
  getAll,
  create,
  update,
  remove,
  setDefault
} from '../controllers/bankAccountController.js';

const router = Router();

router.get('/', getAll);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.patch('/:id/default', setDefault);

export default router;
