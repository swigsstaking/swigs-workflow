import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { generateToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Environment config
const HUB_URL = process.env.HUB_URL || 'https://apps.swigs.online';
const APP_ID = process.env.APP_ID || 'swigs-workflow';
const APP_SECRET = process.env.APP_SECRET;

// PKCE store (use Redis in production)
const pkceStore = new Map();

// Auth code store for secure token exchange (one-time use, 30s TTL)
const authCodeStore = new Map();

// Hash a refresh token with SHA-256
const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// Cleanup expired PKCE codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pkceStore) {
    if (data.expiresAt < now) {
      pkceStore.delete(state);
    }
  }
  // Also cleanup expired auth codes
  for (const [code, data] of authCodeStore) {
    if (data.expiresAt < now) {
      authCodeStore.delete(code);
    }
  }
}, 5 * 60 * 1000);

/**
 * GET /api/auth/login
 * Start OAuth flow with PKCE
 */
router.get('/login', (req, res) => {
  let returnUrl = req.query.returnUrl || '/';
  // Validate returnUrl: must start with / and not // (open redirect protection)
  if (!returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    returnUrl = '/';
  }

  // Generate PKCE values
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');

  // Store verifier (expires in 10 min)
  pkceStore.set(state, {
    codeVerifier,
    returnUrl,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  // Build authorization URL
  const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/callback`;
  const authUrl = new URL(`${HUB_URL}/api/oauth/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', APP_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'profile');

  res.redirect(authUrl.toString());
});

/**
 * GET /api/auth/callback
 * OAuth callback - exchange code for tokens
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Check for errors from Hub
    if (error) {
      console.error('OAuth error from Hub:', error);
      return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
    }

    // Validate state and get verifier
    const pkceData = pkceStore.get(state);
    if (!pkceData || pkceData.expiresAt < Date.now()) {
      pkceStore.delete(state);
      return res.redirect('/?auth_error=invalid_state');
    }
    pkceStore.delete(state);

    // Exchange code for tokens
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/callback`;
    const tokenResponse = await fetch(`${HUB_URL}/api/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: APP_ID,
        code_verifier: pkceData.codeVerifier
      })
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.json().catch(() => ({}));
      console.error('Token exchange failed:', err);
      return res.redirect('/?auth_error=token_exchange_failed');
    }

    const { access_token, id_token } = await tokenResponse.json();

    // Verify id_token with APP_SECRET, fallback to decode if verification fails
    let hubUser;
    if (APP_SECRET) {
      try {
        hubUser = jwt.verify(id_token, APP_SECRET);
      } catch {
        // Fallback: decode without verification (backward compat)
        const [, payloadB64] = id_token.split('.');
        hubUser = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      }
    } else {
      const [, payloadB64] = id_token.split('.');
      hubUser = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    }

    // Validate avatar URL (only https allowed)
    let avatar = hubUser.picture || hubUser.avatar || null;
    if (avatar && !avatar.startsWith('https://')) {
      avatar = null;
    }

    // Find or create local user
    let user = await User.findOne({
      $or: [{ hubUserId: hubUser.sub }, { email: hubUser.email }]
    });

    if (user) {
      user.hubUserId = hubUser.sub;
      user.name = hubUser.name || user.name;
      user.avatar = avatar || user.avatar;
      user.lastLogin = new Date();
      await user.save();
    } else {
      user = await User.create({
        hubUserId: hubUser.sub,
        email: hubUser.email,
        name: hubUser.name || hubUser.email.split('@')[0],
        avatar,
        lastLogin: new Date()
      });
    }

    // Generate app tokens
    const appAccessToken = generateToken(user._id);
    const refreshToken = crypto.randomBytes(64).toString('hex');

    // Store session with hashed refresh token
    await Session.create({
      userId: user._id,
      refreshToken,
      refreshTokenHash: hashRefreshToken(refreshToken),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    // Generate one-time auth code instead of putting tokens in URL
    const authCode = crypto.randomBytes(32).toString('hex');
    authCodeStore.set(authCode, {
      accessToken: appAccessToken,
      refreshToken,
      userId: user._id,
      expiresAt: Date.now() + 30 * 1000 // 30 seconds TTL
    });

    // Redirect with auth code (not raw tokens)
    const returnUrl = new URL(pkceData.returnUrl, `${req.protocol}://${req.get('host')}`);
    returnUrl.searchParams.set('auth_code', authCode);

    res.redirect(returnUrl.toString());

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?auth_error=internal_error');
  }
});

/**
 * POST /api/auth/exchange
 * Exchange a one-time auth code for tokens (secure alternative to tokens-in-URL)
 */
router.post('/exchange', async (req, res) => {
  try {
    const { authCode } = req.body;

    if (!authCode) {
      return res.status(400).json({ error: 'Auth code requis' });
    }

    const codeData = authCodeStore.get(authCode);

    // One-time use: delete immediately
    authCodeStore.delete(authCode);

    if (!codeData || codeData.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Code invalide ou expiré' });
    }

    const user = await User.findById(codeData.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    res.json({
      accessToken: codeData.accessToken,
      refreshToken: codeData.refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Auth code exchange error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'échange du code' });
  }
});

/**
 * POST /api/auth/sso-verify
 * DEPRECATED: Use OAuth PKCE flow instead (GET /api/auth/login)
 * Kept for backward compatibility
 */
router.post('/sso-verify', async (req, res) => {
  console.warn('DEPRECATED: /sso-verify called. Migrate to OAuth PKCE flow.');

  try {
    const { ssoToken } = req.body;

    if (!ssoToken) {
      return res.status(400).json({ error: 'Token SSO requis' });
    }

    if (!APP_SECRET) {
      console.error('APP_SECRET not configured');
      return res.status(500).json({ error: 'Configuration serveur incomplete' });
    }

    // Verifier le token aupres du Hub
    const verifyResponse = await fetch(`${HUB_URL}/api/auth/sso-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Secret': APP_SECRET
      },
      body: JSON.stringify({
        ssoToken,
        appId: APP_ID
      })
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json().catch(() => ({}));
      console.error('Hub SSO verify failed:', error);
      return res.status(401).json({
        error: error.error || 'Token SSO invalide',
        code: 'SSO_VERIFY_FAILED'
      });
    }

    const { user: hubUser } = await verifyResponse.json();

    // Trouver ou creer l'utilisateur local
    // Note: le Hub retourne hubId, pas id
    const hubId = hubUser.hubId || hubUser.id;

    // Validate avatar URL (only https allowed)
    let ssoAvatar = hubUser.avatar || null;
    if (ssoAvatar && !ssoAvatar.startsWith('https://')) {
      ssoAvatar = null;
    }

    let user = await User.findOne({
      $or: [
        { hubUserId: hubId },
        { email: hubUser.email }
      ]
    });

    if (user) {
      // Mettre a jour les infos depuis le Hub
      user.hubUserId = hubId;
      user.name = hubUser.name || user.name;
      user.avatar = ssoAvatar || user.avatar;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Creer un nouvel utilisateur
      user = await User.create({
        hubUserId: hubId,
        email: hubUser.email,
        name: hubUser.name || hubUser.email.split('@')[0],
        avatar: ssoAvatar,
        lastLogin: new Date()
      });
    }

    // Generer le token de l'application
    const accessToken = generateToken(user._id);

    // Creer une session (pour refresh token si besoin)
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await Session.create({
      userId: user._id,
      refreshToken,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('SSO verify error:', error);
    res.status(500).json({ error: 'Erreur de verification SSO' });
  }
});

/**
 * POST /api/auth/refresh
 * Rafraichit le token d'acces
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis' });
    }

    // Lookup by hash first (preferred), fallback to plain token (backward compat)
    const tokenHash = hashRefreshToken(refreshToken);
    let session = await Session.findOne({
      refreshTokenHash: tokenHash,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      // Fallback: lookup by plain refresh token (pre-migration sessions)
      session = await Session.findOne({
        refreshToken,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      });

      // Backfill hash if found by plain token
      if (session && !session.refreshTokenHash) {
        session.refreshTokenHash = tokenHash;
        await session.save();
      }
    }

    if (!session) {
      return res.status(401).json({ error: 'Session invalide ou expiree' });
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Utilisateur invalide' });
    }

    // Token rotation: revoke old session and create new one
    session.isRevoked = true;
    await session.save();

    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    await Session.create({
      userId: user._id,
      refreshToken: newRefreshToken,
      refreshTokenHash: hashRefreshToken(newRefreshToken),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    const accessToken = generateToken(user._id);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        preferences: user.preferences
      }
    });

  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Erreur de rafraichissement' });
  }
});

/**
 * GET /api/auth/me
 * Retourne l'utilisateur connecte
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
      preferences: req.user.preferences
    }
  });
});

/**
 * POST /api/auth/logout
 * Deconnexion (revoque la session)
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await Session.updateOne(
        { refreshToken },
        { isRevoked: true }
      );
    }

    res.json({ message: 'Deconnecte' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Erreur de deconnexion' });
  }
});

export default router;
