import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Require ENCRYPTION_KEY or JWT_SECRET — refuse to start with a default key
const encryptionKeySource = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
if (!encryptionKeySource) {
  throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set in environment variables. Refusing to start with a default key.');
}

const SALT = process.env.ENCRYPTION_SALT || 'swigs-workflow-2026-v1';

// Primary key derived with a unique salt
const PRIMARY_KEY = crypto.scryptSync(encryptionKeySource, SALT, 32);

// Legacy key for key rotation: if ENCRYPTION_KEY_LEGACY is set, try it as fallback during decrypt
// Uses the same salt for backward compatibility with the legacy key material
const LEGACY_KEY = process.env.ENCRYPTION_KEY_LEGACY
  ? crypto.scryptSync(process.env.ENCRYPTION_KEY_LEGACY, SALT, 32)
  : null;

/**
 * Encrypt a plain text string (always uses primary key)
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted string in format iv:authTag:encrypted
 */
export function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, PRIMARY_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Try to decrypt with a specific key
 */
function tryDecrypt(encryptedText, key) {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return null;
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Decrypt an encrypted string
 * Backward compatible: returns plain text as-is if not encrypted (no ':' separator)
 * Tries primary key first, then legacy key if set
 * @param {string} encryptedText - Encrypted string or plain text
 * @returns {string} Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

  // Try primary key
  try {
    const result = tryDecrypt(encryptedText, PRIMARY_KEY);
    if (result !== null) return result;
  } catch {
    // Primary key failed, try legacy
  }

  // Try legacy key if configured
  if (LEGACY_KEY) {
    try {
      const result = tryDecrypt(encryptedText, LEGACY_KEY);
      if (result !== null) return result;
    } catch {
      // Legacy key also failed
    }
  }

  // Not encrypted or unknown format — return as-is (plain text backward compat)
  return encryptedText;
}
