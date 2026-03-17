/**
 * Generic subscription status middleware.
 * Fetches subscription details (status, trialEnd, daysRemaining) from Hub
 * and attaches them to req.subscription.
 *
 * Uses in-memory cache with 5-min TTL (same pattern as requireComptaPlus).
 */

const HUB_URL = process.env.HUB_URL || 'https://apps.swigs.online';
const APP_SECRET = process.env.APP_SECRET;
const PRODUCT_SLUG = 'swigs-workflow';

const cache = new Map(); // hubUserId → { data, expiresAt }
const TTL = 5 * 60 * 1000; // 5 minutes

async function getSubscriptionStatus(hubUserId) {
  if (!hubUserId) return null;

  const cached = cache.get(hubUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const params = new URLSearchParams({ userId: hubUserId, productSlug: PRODUCT_SLUG });
    const res = await fetch(`${HUB_URL}/api/subscriptions/check?${params}`, {
      headers: { 'X-App-Secret': APP_SECRET }
    });

    if (!res.ok) {
      console.warn('[Subscription] Hub check failed:', res.status);
      return null;
    }

    const json = await res.json();

    let data = null;
    if (json.hasSubscription && json.subscription) {
      const sub = json.subscription;
      const trialEnd = sub.trialEnd ? new Date(sub.trialEnd) : null;
      const now = new Date();
      let daysRemaining = null;

      if (trialEnd && sub.status === 'trialing') {
        daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
      }

      data = {
        active: true,
        status: sub.status,
        trialEnd: sub.trialEnd || null,
        daysRemaining,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false,
        currentPeriodEnd: sub.currentPeriodEnd || null,
        plan: sub.plan ? { name: sub.plan.name } : null
      };
    }

    cache.set(hubUserId, { data, expiresAt: Date.now() + TTL });
    return data;
  } catch (err) {
    console.error('[Subscription] Hub check error:', err.message);
    return null;
  }
}

/**
 * Middleware: attaches req.subscription with full status details
 */
export const checkSubscription = async (req, res, next) => {
  try {
    req.subscription = await getSubscriptionStatus(req.user?.hubUserId);
    next();
  } catch (err) {
    req.subscription = null;
    next();
  }
};

/**
 * Clear cache for a specific user
 */
export const clearSubscriptionCache = (hubUserId) => {
  if (hubUserId) cache.delete(hubUserId);
};
