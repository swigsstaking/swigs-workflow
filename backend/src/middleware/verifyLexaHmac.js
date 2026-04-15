import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Middleware HMAC pour les webhooks entrants depuis Lexa (sens Lexa→Pro).
 * Session 20 — miroir de requireHmac.ts côté Lexa.
 *
 * Attend les headers :
 *   X-Lexa-Signature: sha256=<hex>
 *   X-Lexa-Timestamp: <unix-ms>
 *
 * Signature canonique : sha256(LEXA_WEBHOOK_SECRET, "${timestamp}.${rawBody}")
 * Protection replay : |now - timestamp| < 5 min
 *
 * Nécessite que express.json({ verify: (req,_,buf)=>{req.rawBody=buf} }) soit
 * configuré avant ce middleware (voir server.js).
 */
export function verifyLexaHmac(req, res, next) {
  const signatureHeader = req.get('X-Lexa-Signature') ?? '';
  const timestampHeader = req.get('X-Lexa-Timestamp') ?? '';

  // Vérification présence headers
  if (!signatureHeader || !timestampHeader) {
    return res.status(401).json({ error: 'missing X-Lexa-Signature or X-Lexa-Timestamp' });
  }

  // Vérification format signature
  const match = signatureHeader.match(/^sha256=([a-f0-9]{64})$/i);
  if (!match) {
    return res.status(401).json({ error: 'malformed X-Lexa-Signature' });
  }
  const provided = match[1].toLowerCase();

  // Vérification timestamp (protection replay, tolérance 5 min)
  const ts = parseInt(timestampHeader, 10);
  if (isNaN(ts)) {
    return res.status(401).json({ error: 'invalid X-Lexa-Timestamp' });
  }
  const drift = Math.abs(Date.now() - ts);
  if (drift > 5 * 60 * 1000) {
    return res.status(401).json({ error: 'timestamp out of range (replay protection)' });
  }

  // Vérification rawBody disponible
  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(500).json({ error: 'raw body not captured (verify hook missing in express.json)' });
  }

  // Recalcul signature canonique : sha256(secret, "${ts}.${rawBody}")
  const secret = process.env.LEXA_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[lexa-webhook] LEXA_WEBHOOK_SECRET missing');
    return res.status(500).json({ error: 'webhook secret not configured' });
  }

  const canonical = `${timestampHeader}.${rawBody.toString()}`;
  const expected = createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');

  // Comparaison timing-safe (protection timing attacks)
  const a = Buffer.from(expected, 'utf-8');
  const b = Buffer.from(provided, 'utf-8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'invalid X-Lexa-Signature' });
  }

  next();
}
