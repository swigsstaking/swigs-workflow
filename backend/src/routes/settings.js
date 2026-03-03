import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { getSettings, updateSettings, getStats, uploadLogo, deleteLogo, getInvoicePreview, getInvoicePreviewHTML, sendTestEmail, sendTestReminder } from '../controllers/settingsController.js';

const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Trop de générations PDF. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

const router = express.Router();

// Multer for logo upload - store in memory, max 500KB
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG ou PNG.'));
    }
  }
});

router.route('/')
  .get(getSettings)
  .put(updateSettings);

router.route('/stats')
  .get(getStats);

router.post('/logo', logoUpload.single('logo'), uploadLogo);
router.delete('/logo', deleteLogo);
router.get('/invoice-preview', pdfLimiter, getInvoicePreview);
router.get('/invoice-preview-html', getInvoicePreviewHTML);
router.post('/test-email', pdfLimiter, sendTestEmail);
router.post('/test-reminder', pdfLimiter, sendTestReminder);

export default router;
