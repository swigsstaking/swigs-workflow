import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { chatLimiter, aiGeneralLimiter } from '../middleware/aiRateLimit.js';
import * as aiController from '../controllers/aiController.js';

const router = express.Router();

// Health check (no auth required — useful for monitoring)
router.get('/health', aiController.health);

// All other routes require authentication
router.use(requireAuth);

// Chat SSE streaming (stricter rate limit)
router.post('/chat', chatLimiter, aiController.chat);
router.post('/chat/stop', aiGeneralLimiter, aiController.stopChat);

// Suggestions & tools (general rate limit)
router.get('/suggestions', aiGeneralLimiter, aiController.getSuggestions);
router.post('/tools/vat', aiGeneralLimiter, aiController.calculateVat);

export default router;
