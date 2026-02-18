import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import {
  getDocument,
  downloadPDF,
  signQuote,
  generateLink,
  revokeLink,
  getLinks
} from '../controllers/portalController.js';

const router = Router();

// Rate limiting strict pour routes publiques
const portalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Trop de requêtes, réessayez plus tard' }
});

// Routes PRIVÉES (DOIVENT être AVANT les routes :token)
router.post('/generate', requireAuth, generateLink);
router.delete('/links/:id', requireAuth, revokeLink);
router.get('/links/:type/:documentId', requireAuth, getLinks);

// Routes PUBLIQUES
router.get('/:token', portalLimiter, getDocument);
router.get('/:token/pdf', portalLimiter, downloadPDF);
router.post('/:token/sign', portalLimiter, signQuote);

export default router;
