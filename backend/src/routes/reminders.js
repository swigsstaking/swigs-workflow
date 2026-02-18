import express from 'express';
import { sendReminder } from '../controllers/reminderController.js';

const router = express.Router();

// All routes are protected by requireAuth middleware in server.js

router.post('/:invoiceId/send', sendReminder);

export default router;
