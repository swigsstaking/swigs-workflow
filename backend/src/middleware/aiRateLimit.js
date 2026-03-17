import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Rate limiters for AI endpoints.
 * - chatLimiter: 20 req/min per user (SSE streaming is expensive)
 * - aiGeneralLimiter: 60 req/min per user (suggestions, tools, health)
 */

const keyGenerator = (req) => req.user?._id?.toString() || ipKeyGenerator(req);

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT || '20', 10),
  keyGenerator,
  message: {
    success: false,
    error: 'Trop de requêtes AI. Réessayez dans une minute.',
    code: 'AI_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const ocrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator,
  message: {
    success: false,
    error: 'Trop de requêtes OCR. Réessayez dans une minute.',
    code: 'AI_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const aiGeneralLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator,
  message: {
    success: false,
    error: 'Trop de requêtes. Réessayez dans une minute.',
    code: 'AI_RATE_LIMIT'
  },
  standardHeaders: true,
  legacyHeaders: false
});
