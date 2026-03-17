import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { chatLimiter, aiGeneralLimiter, ocrLimiter } from '../middleware/aiRateLimit.js';
import * as aiController from '../controllers/aiController.js';

const router = express.Router();

// Multer — memory storage, 10MB max, images + PDF only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// Health check (no auth required — useful for monitoring)
router.get('/health', aiController.health);

// All other routes require authentication
router.use(requireAuth);

// Chat SSE streaming (stricter rate limit)
router.post('/chat', chatLimiter, aiController.chat);
router.post('/chat/stop', aiGeneralLimiter, aiController.stopChat);

// OCR document extraction (10/min, single file upload)
router.post('/ocr', ocrLimiter, upload.single('document'), aiController.ocr);

// Suggestions & tools (general rate limit)
router.get('/suggestions', aiGeneralLimiter, aiController.getSuggestions);
router.post('/tools/vat', aiGeneralLimiter, aiController.calculateVat);

export default router;
