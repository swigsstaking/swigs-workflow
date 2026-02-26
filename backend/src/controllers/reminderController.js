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
    // Return user-facing error message instead of generic 500
    const knownErrors = [
      'Facture non trouvée',
      'Projet non trouvé',
      'Non autorisé',
      'pas d\'adresse email',
      'Configuration SMTP',
      'pas encore échue',
      'Aucune relance configurée',
      'authentication failed'
    ];
    const isKnown = knownErrors.some(msg => error.message?.includes(msg));
    if (isKnown) {
      return res.status(400).json({ success: false, error: error.message });
    }
    next(error);
  }
};
