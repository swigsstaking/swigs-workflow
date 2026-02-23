import express from 'express';
import rateLimit from 'express-rate-limit';
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

const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Trop de générations PDF. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

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
  .get(pdfLimiter, getQuotePDF);

router.route('/:id/send')
  .post(sendQuote);

export default router;
