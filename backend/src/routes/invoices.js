import express from 'express';
import {
  getAllInvoices,
  getInvoice,
  updateInvoice,
  changeInvoiceStatus,
  deleteInvoice,
  getInvoicePDF,
  sendInvoice
} from '../controllers/invoiceController.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.route('/')
  .get(getAllInvoices);

router.route('/:id')
  .get(getInvoice)
  .put(updateInvoice)
  .delete(deleteInvoice);

router.route('/:id/status')
  .patch(
    validate({ body: { status: 'required|string|in:draft,sent,paid,cancelled' } }),
    changeInvoiceStatus
  );

router.route('/:id/pdf')
  .get(getInvoicePDF);

router.route('/:id/send')
  .post(sendInvoice);

export default router;
