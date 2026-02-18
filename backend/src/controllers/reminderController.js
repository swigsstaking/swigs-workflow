import { sendManualReminder } from '../services/reminder.service.js';

/**
 * Send manual reminder for an invoice
 * POST /api/reminders/:invoiceId/send
 */
export const sendReminder = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const userId = req.user._id;

    const result = await sendManualReminder(invoiceId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};
