import { Router } from 'express';
import {
  getAll,
  create,
  update,
  remove,
  getSuggestions,
  bulkCreate
} from '../controllers/counterpartyRuleController.js';

const router = Router();

router.get('/', getAll);
router.get('/suggestions', getSuggestions);
router.post('/', create);
router.post('/bulk', bulkCreate);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
