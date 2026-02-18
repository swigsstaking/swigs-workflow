import express from 'express';
import {
  getAllQuotes,
  getQuote,
  updateQuote,
  changeQuoteStatus,
  deleteQuote,
  getQuotePDF,
  sendQuote
} from '../controllers/quoteController.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.route('/')
  .get(getAllQuotes);

router.route('/:id')
  .get(getQuote)
  .put(updateQuote)
  .delete(deleteQuote);

router.route('/:id/status')
  .patch(
    validate({ body: { status: 'required|string|in:draft,sent,signed,refused,expired' } }),
    changeQuoteStatus
  );

router.route('/:id/pdf')
  .get(getQuotePDF);

router.route('/:id/send')
  .post(sendQuote);

export default router;
