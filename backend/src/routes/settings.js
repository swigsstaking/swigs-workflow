import express from 'express';
import multer from 'multer';
import { getSettings, updateSettings, getStats, uploadLogo, deleteLogo, getInvoicePreview, getInvoicePreviewHTML, sendTestEmail, sendTestReminder } from '../controllers/settingsController.js';

const router = express.Router();

// Multer for logo upload - store in memory, max 500KB
const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou SVG.'));
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
router.get('/invoice-preview', getInvoicePreview);
router.get('/invoice-preview-html', getInvoicePreviewHTML);
router.post('/test-email', sendTestEmail);
router.post('/test-reminder', sendTestReminder);

export default router;
