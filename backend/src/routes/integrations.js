/**
 * Routes d'intégration Lexa↔Pro (session 20)
 *
 * POST /api/integrations/lexa/webhook
 *   Reçoit la classification d'une transaction bancaire depuis Lexa.
 *   Authentifié par HMAC (verifyLexaHmac).
 *   Met à jour BankTransaction.lexaClassification.
 *   Idempotent : si streamId déjà présent et identique, retourne 200 skipped.
 */

import { Router } from 'express';
import { verifyLexaHmac } from '../middleware/verifyLexaHmac.js';
import BankTransaction from '../models/BankTransaction.js';

const router = Router();

router.post('/lexa/webhook', verifyLexaHmac, async (req, res) => {
  try {
    const { txId, streamId, classification, classifiedAt } = req.body;

    // Validation minimale
    if (!txId || !streamId || !classification) {
      return res.status(400).json({ error: 'missing txId, streamId or classification' });
    }

    const tx = await BankTransaction.findOne({ txId });
    if (!tx) {
      console.warn('[lexa-webhook] tx not found: %s', txId);
      return res.status(404).json({ error: 'transaction not found', txId });
    }

    // Idempotence : même streamId → skip sans re-update
    if (tx.lexaClassification?.streamId === streamId) {
      console.log('[lexa-webhook] idempotent skip tx=%s streamId=%s', txId, streamId);
      return res.status(200).json({ ok: true, skipped: 'already classified' });
    }

    // Update lexaClassification (overwrite si re-classification Lexa)
    tx.lexaClassification = {
      streamId,
      debitAccount: classification.debitAccount,
      creditAccount: classification.creditAccount,
      tvaRate: classification.tvaRate,
      tvaCode: classification.tvaCode ?? null,
      confidence: classification.confidence,
      amountHt: classification.amountHt ?? null,
      amountTtc: classification.amountTtc ?? null,
      citations: Array.isArray(classification.citations)
        ? classification.citations.map((c) => ({
            source: c.source ?? null,
            article: c.article ?? null,
            law: c.law ?? null,
          }))
        : [],
      classifiedAt: classifiedAt ? new Date(classifiedAt) : new Date(),
    };

    await tx.save();

    console.log(
      '[lexa-webhook] updated tx=%s debit=%s credit=%s conf=%s',
      txId,
      classification.debitAccount,
      classification.creditAccount,
      classification.confidence,
    );

    return res.status(200).json({ ok: true, updated: true });
  } catch (err) {
    console.error('[lexa-webhook] error:', err.message);
    return res.status(500).json({ error: 'internal', message: err.message });
  }
});

export default router;
