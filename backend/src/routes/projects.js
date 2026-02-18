import express from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  changeStatus,
  archiveProject,
  restoreProject,
  updatePositions,
  resetPositions
} from '../controllers/projectController.js';
import { getEvents, createEvent, getUnbilledEvents } from '../controllers/eventController.js';
import { getInvoices, createInvoice } from '../controllers/invoiceController.js';
import { getQuotes, createQuote, getInvoiceableQuotes } from '../controllers/quoteController.js';
import { getProjectHistory } from '../controllers/settingsController.js';
import { validate, sanitizeBody } from '../middleware/validate.js';

const router = express.Router();

// Project routes
router.route('/')
  .get(getProjects)
  .post(
    sanitizeBody('name', 'description', 'client', 'status', 'tags', 'notes'),
    validate({ body: { name: 'required|string' } }),
    createProject
  );

// Position management (before /:id to avoid conflicts)
router.route('/positions')
  .patch(updatePositions)
  .delete(resetPositions);

router.route('/:id')
  .get(getProject)
  .put(
    sanitizeBody('name', 'description', 'client', 'status', 'tags', 'notes'),
    updateProject
  )
  .delete(archiveProject);

router.route('/:id/status')
  .patch(changeStatus);

router.route('/:id/restore')
  .patch(restoreProject);

// Events routes (nested under projects)
router.route('/:projectId/events')
  .get(getEvents)
  .post(
    sanitizeBody('type', 'description', 'date', 'hours', 'hourlyRate', 'amount'),
    validate({ body: { type: 'required|string|in:hours,action,expense' } }),
    createEvent
  );

router.route('/:projectId/events/unbilled')
  .get(getUnbilledEvents);

// Invoices routes (nested under projects)
router.route('/:projectId/invoices')
  .get(getInvoices)
  .post(createInvoice);

// Quotes routes (nested under projects)
router.route('/:projectId/quotes')
  .get(getQuotes)
  .post(createQuote);

router.route('/:projectId/quotes/invoiceable')
  .get(getInvoiceableQuotes);

// History route
router.route('/:projectId/history')
  .get(getProjectHistory);

export default router;
