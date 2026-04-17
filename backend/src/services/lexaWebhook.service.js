/**
 * lexaWebhook.service.js — Producteur HMAC vers Lexa bridge
 *
 * Publie les événements Swigs Pro vers Lexa via POST /api/bridge/pro-events
 * avec signature HMAC-SHA256 (X-Lexa-Signature: sha256=<hex>).
 *
 * Design : fire-and-forget — ne bloque jamais le flow Pro.
 * Timeout 10s max, pas de retry agressif, log warn en cas d'échec.
 *
 * Secret partagé : LEXA_WEBHOOK_SECRET (identique dans les .env Pro et Lexa).
 * Tenant mapping V1 : hubUserId du user Pro → tenantId Lexa (même UUID via SSO Hub).
 *   Si absent : Lexa utilise son DEFAULT_TENANT_ID (00000000-0000-0000-0000-000000000001).
 *
 * V2 : accepte un `userId` optionnel pour lire les Settings et respecter
 *   le toggle lexaIntegration (enabled, publishInvoices, publishExpenses).
 *   Fallback : si pas de userId, publier quand même (comportement V1 préservé).
 */

import crypto from 'crypto';
import axios from 'axios';
import Settings from '../models/Settings.js';

const LEXA_URL = process.env.LEXA_URL || 'https://lexa.swigs.online';
const SECRET = process.env.LEXA_WEBHOOK_SECRET;

/**
 * Détermine si l'event doit être publié selon les Settings de l'user.
 *
 * @param {string} event - ex: 'invoice.created', 'expense.submitted'
 * @param {string|null} userId - ObjectId du user Pro
 * @returns {Promise<boolean>} true = publier, false = skip
 */
async function shouldPublish(event, userId) {
  if (!userId) {
    // Pas de userId : comportement V1, toujours publier
    return true;
  }

  try {
    const settings = await Settings.findOne({ userId }).select('lexaIntegration').lean();
    const lexa = settings?.lexaIntegration;

    if (!lexa) {
      // Pas de settings : défaut = publier
      return true;
    }

    if (lexa.enabled === false) {
      console.info(`[lexa-webhook] integration disabled for user=${userId}`);
      return false;
    }

    const isInvoiceEvent = event.startsWith('invoice.');
    const isExpenseEvent = event.startsWith('expense.');

    if (isInvoiceEvent && lexa.publishInvoices === false) {
      console.info(`[lexa-webhook] publishInvoices disabled for user=${userId}, skip ${event}`);
      return false;
    }

    if (isExpenseEvent && lexa.publishExpenses === false) {
      console.info(`[lexa-webhook] publishExpenses disabled for user=${userId}, skip ${event}`);
      return false;
    }

    return true;
  } catch (err) {
    // En cas d'erreur de lecture des settings, on publie quand même (fail-open)
    console.warn(`[lexa-webhook] could not read settings for user=${userId}: ${err.message} — publishing anyway`);
    return true;
  }
}

/**
 * Publie un event vers Lexa /api/bridge/pro-events avec HMAC.
 *
 * @param {string} event - ex: 'invoice.created', 'invoice.paid'
 * @param {string|null} tenantId - hubUserId du user Pro (UUID) ou null
 * @param {object} data - payload spécifique à l'event
 * @param {string|null} userId - ObjectId Mongoose du user Pro (pour lire les Settings)
 * @returns {Promise<void>} — résolu dans tous les cas (fire-and-forget)
 */
export async function publishToLexa(event, tenantId, data, userId = null) {
  if (!SECRET) {
    console.warn('[lexa-webhook] LEXA_WEBHOOK_SECRET non configuré, publication ignorée');
    return;
  }

  // Vérifier le toggle Settings avant de publier
  const publish = await shouldPublish(event, userId);
  if (!publish) return;

  const payloadObj = {
    event,
    timestamp: new Date().toISOString(),
    ...(tenantId ? { tenantId } : {}),
    data,
  };

  const payloadStr = JSON.stringify(payloadObj);
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadStr)
    .digest('hex');

  try {
    const response = await axios.post(`${LEXA_URL}/api/bridge/pro-events`, payloadObj, {
      headers: {
        'Content-Type': 'application/json',
        'X-Lexa-Signature': `sha256=${signature}`,
      },
      timeout: 10000,
    });
    console.info(`[lexa-webhook] published ${event} tenant=${tenantId ?? 'default'} user=${userId ?? 'n/a'}`);

    // Mettre à jour lastPublishedAt si on a un userId
    if (userId) {
      Settings.findOneAndUpdate(
        { userId },
        { $set: { 'lexaIntegration.lastPublishedAt': new Date(), 'lexaIntegration.failureCount': 0 } },
      ).catch(() => {}); // fire-and-forget
    }
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    console.warn(`[lexa-webhook] failed to publish ${event} (${status ?? 'network'}): ${detail}`);

    // Incrémenter failureCount si on a un userId
    if (userId) {
      Settings.findOneAndUpdate(
        { userId },
        { $inc: { 'lexaIntegration.failureCount': 1 } },
      ).catch(() => {}); // fire-and-forget
    }
    // Fire-and-forget : on ne relance pas pour ne pas bloquer le flow Pro
  }
}
