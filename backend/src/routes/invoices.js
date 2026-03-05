import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getAllInvoices,
  getInvoice,
  updateInvoice,
  changeInvoiceStatus,
  deleteInvoice,
  getInvoicePDF,
  sendInvoice,
  recordPayment,
  getInvoiceEditData,
  getInvoiceHash,
  createCreditNote
} from '../controllers/invoiceController.js';
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
  .get(getAllInvoices);

router.route('/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(deleteInvoice);

router.route('/:id/edit-data')
  .get(getInvoiceEditData);

router.route('/:id/status')
  .patch(
    validate({ body: { status: 'required|string|in:draft,sent,paid,partial,cancelled' } }),
    changeInvoiceStatus
  );

router.route('/:id/payments')
  .post(recordPayment);

router.route('/:id/pdf')
  .get(pdfLimiter, getInvoicePDF);

router.route('/:id/send')
  .post(sendInvoice);

router.route('/:id/hash')
  .get(getInvoiceHash);

router.route('/:id/credit-note')
  .post(createCreditNote);

export default router;
