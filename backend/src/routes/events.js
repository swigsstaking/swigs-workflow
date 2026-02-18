import express from 'express';
import { updateEvent, deleteEvent } from '../controllers/eventController.js';
import { sanitizeBody } from '../middleware/validate.js';

const router = express.Router();

router.route('/:id')
  .put(
    sanitizeBody('type', 'description', 'date', 'hours', 'hourlyRate', 'amount'),
    updateEvent
  )
  .delete(deleteEvent);

export default router;
