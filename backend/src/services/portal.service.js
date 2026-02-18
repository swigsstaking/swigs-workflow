import crypto from 'crypto';
import PortalToken from '../models/PortalToken.js';
import Invoice from '../models/Invoice.js';
import Quote from '../models/Quote.js';
import Settings from '../models/Settings.js';

/**
 * Portal Service - Generate and manage client portal tokens
 */

/**
 * Generate a secure random token
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex'); // 64 chars hex
};

/**
 * Create a portal link for a document
 */
export const createPortalLink = async (type, documentId, userId, expiresInDays = 30) => {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const portalToken = await PortalToken.create({
    token,
    type,
    documentId,
    userId,
    expiresAt,
    isActive: true
  });

  return {
    token: portalToken.token,
    expiresAt: portalToken.expiresAt
  };
};

/**
 * Verify token and get document
 */
export const verifyAndGetDocument = async (token) => {
  // Find token
  const portalToken = await PortalToken.findOne({ token, isActive: true });

  if (!portalToken) {
    throw new Error('Token invalide ou révoqué');
  }

  // Check expiration
  if (portalToken.expiresAt < new Date()) {
    throw new Error('Token expiré');
  }

  // Update access tracking
  portalToken.accessCount += 1;
  portalToken.lastAccessedAt = new Date();
  await portalToken.save();

  // Load document based on type
  let document;
  if (portalToken.type === 'invoice') {
    document = await Invoice.findById(portalToken.documentId).populate('project');
  } else if (portalToken.type === 'quote') {
    document = await Quote.findById(portalToken.documentId).populate('project');
  } else {
    throw new Error('Type de document non supporté');
  }

  if (!document) {
    throw new Error('Document non trouvé');
  }

  // Load settings for company info
  const settings = await Settings.getSettings(portalToken.userId);

  return {
    type: portalToken.type,
    document,
    project: document.project,
    settings
  };
};

/**
 * Revoke a portal token
 */
export const revokeToken = async (tokenId, userId) => {
  const portalToken = await PortalToken.findById(tokenId);

  if (!portalToken) {
    throw new Error('Token non trouvé');
  }

  // Verify ownership
  if (portalToken.userId.toString() !== userId.toString()) {
    throw new Error('Accès refusé');
  }

  portalToken.isActive = false;
  await portalToken.save();

  return portalToken;
};

/**
 * Get active links for a document
 */
export const getActiveLinks = async (type, documentId, userId) => {
  const tokens = await PortalToken.find({
    type,
    documentId,
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort('-createdAt');

  return tokens;
};
