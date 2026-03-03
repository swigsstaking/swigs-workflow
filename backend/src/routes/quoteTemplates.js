import express from 'express';
import {
  getQuoteTemplates,
  getQuoteTemplate,
  createQuoteTemplate,
  updateQuoteTemplate,
  deleteQuoteTemplate,
  reorderQuoteTemplates
} from '../controllers/quoteTemplateController.js';

const router = express.Router();

router.route('/')
  .get(getQuoteTemplates)
  .post(createQuoteTemplate);

router.route('/reorder')
  .put(reorderQuoteTemplates);

router.route('/:id')
  .get(getQuoteTemplate)
  .put(updateQuoteTemplate)
  .delete(deleteQuoteTemplate);

export default router;
