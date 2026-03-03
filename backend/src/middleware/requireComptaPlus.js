/**
 * Compta Plus subscription gating middleware.
 * Checks subscription status via Hub API with in-memory cache (5 min TTL).
 *
 * - requireComptaPlus: hard gate — 403 if not subscribed
 * - checkComptaPlus: soft gate — sets req.hasComptaPlus boolean
 */

const HUB_URL = process.env.HUB_URL || 'https://apps.swigs.online';
const APP_SECRET = process.env.APP_SECRET;

const cache = new Map(); // hubUserId → { result: boolean, expiresAt: number }
const TTL = 5 * 60 * 1000; // 5 minutes

async function getComptaPlusStatus(hubUserId) {
  if (!hubUserId) return false;

  const cached = cache.get(hubUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  try {
    const params = new URLSearchParams({ userId: hubUserId, productSlug: 'compta-plus' });
    const res = await fetch(`${HUB_URL}/api/subscriptions/check?${params}`, {
      headers: {
        'X-App-Secret': APP_SECRET
      }
    });

    if (!res.ok) {
      // Hub unavailable — fail open (don't block user)
      console.warn('[ComptaPlus] Hub check failed:', res.status);
      return false;
    }

    const data = await res.json();
    const hasSubscription = !!data.hasSubscription;

    cache.set(hubUserId, { result: hasSubscription, expiresAt: Date.now() + TTL });
    return hasSubscription;
  } catch (err) {
    console.error('[ComptaPlus] Hub check error:', err.message);
    // Fail open on network errors
    return false;
  }
}

/**
 * Hard gate — blocks with 403 if user doesn't have Compta Plus
 */
export const requireComptaPlus = async (req, res, next) => {
  try {
    const has = await getComptaPlusStatus(req.user?.hubUserId);
    if (!has) {
      return res.status(403).json({
        success: false,
        error: 'Compta Plus required',
        code: 'COMPTA_PLUS_REQUIRED'
      });
    }
    req.hasComptaPlus = true;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Soft gate — attaches req.hasComptaPlus boolean without blocking
 */
export const checkComptaPlus = async (req, res, next) => {
  try {
    req.hasComptaPlus = await getComptaPlusStatus(req.user?.hubUserId);
    next();
  } catch (err) {
    req.hasComptaPlus = false;
    next();
  }
};

/**
 * Clear cache for a specific user (e.g., after subscription change)
 */
export const clearComptaPlusCache = (hubUserId) => {
  if (hubUserId) cache.delete(hubUserId);
};
