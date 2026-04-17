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
 */

import crypto from 'crypto';
import axios from 'axios';

const LEXA_URL = process.env.LEXA_URL || 'https://lexa.swigs.online';
const SECRET = process.env.LEXA_WEBHOOK_SECRET;

/**
 * Publie un event vers Lexa /api/bridge/pro-events avec HMAC.
 *
 * @param {string} event - ex: 'invoice.created', 'invoice.paid'
 * @param {string|null} tenantId - hubUserId du user Pro (UUID) ou null
 * @param {object} data - payload spécifique à l'event
 * @returns {Promise<void>} — résolu dans tous les cas (fire-and-forget)
 */
export async function publishToLexa(event, tenantId, data) {
  if (!SECRET) {
    console.warn('[lexa-webhook] LEXA_WEBHOOK_SECRET non configuré, publication ignorée');
    return;
  }

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
    await axios.post(`${LEXA_URL}/api/bridge/pro-events`, payloadObj, {
      headers: {
        'Content-Type': 'application/json',
        'X-Lexa-Signature': `sha256=${signature}`,
      },
      timeout: 10000,
    });
    console.info(`[lexa-webhook] published ${event} tenant=${tenantId ?? 'default'}`);
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error || err.message;
    console.warn(`[lexa-webhook] failed to publish ${event} (${status ?? 'network'}): ${detail}`);
    // Fire-and-forget : on ne relance pas pour ne pas bloquer le flow Pro
  }
}
