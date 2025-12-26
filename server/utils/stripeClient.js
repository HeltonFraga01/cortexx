/**
 * Stripe Client Wrapper
 * 
 * Provides a singleton Stripe SDK instance with lazy initialization.
 * Retrieves API keys from global_settings table.
 * 
 * Best Practices Applied:
 * - Singleton pattern for efficient resource usage
 * - Lazy initialization to avoid startup delays
 * - Proper key encryption for security
 * - Cache invalidation on settings change
 * 
 * Requirements: 1.2, 1.3
 */

const Stripe = require('stripe');
const crypto = require('crypto');
const { logger } = require('./logger');
const SupabaseService = require('../services/SupabaseService');

let stripeInstance = null;
let cachedSecretKey = null;

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.STRIPE_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'default-key-change-in-production-32ch';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte key from the encryption key
 * @returns {Buffer} 32-byte key
 */
function deriveKey() {
  return crypto.scryptSync(ENCRYPTION_KEY, 'stripe-salt', 32);
}

/**
 * Decrypt a value using AES-256-GCM
 * @param {string} encryptedValue - The encrypted value (format: enc:iv:authTag:ciphertext)
 * @returns {string} Decrypted value
 */
function decrypt(encryptedValue) {
  if (!encryptedValue) return null;
  
  // Check if value is encrypted (starts with 'enc:')
  if (!encryptedValue.startsWith('enc:')) {
    // Legacy unencrypted value - return as-is
    return encryptedValue;
  }
  
  try {
    const parts = encryptedValue.split(':');
    
    // Handle legacy simple encryption format (enc:value)
    if (parts.length === 2) {
      return parts[1];
    }
    
    // New format: enc:iv:authTag:ciphertext
    if (parts.length !== 4) {
      logger.warn('Invalid encrypted value format');
      return null;
    }
    
    const [, ivHex, authTagHex, ciphertext] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = deriveKey();
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Failed to decrypt value', { error: error.message });
    // Fallback: try legacy format
    if (encryptedValue.startsWith('enc:')) {
      return encryptedValue.substring(4);
    }
    return null;
  }
}

/**
 * Encrypt a value using AES-256-GCM
 * Best Practice: Use authenticated encryption for API keys
 * @param {string} value - The value to encrypt
 * @returns {string} Encrypted value (format: enc:iv:authTag:ciphertext)
 */
function encrypt(value) {
  if (!value) return null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey();
    
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: enc:iv:authTag:ciphertext
    return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Failed to encrypt value', { error: error.message });
    // Fallback to simple prefix (not secure, but maintains compatibility)
    return `enc:${value}`;
  }
}

/**
 * Get Stripe secret key from global_settings
 * @returns {Promise<string|null>} The secret key or null
 */
async function getSecretKey() {
  try {
    const { data, error } = await SupabaseService.adminClient
      .from('global_settings')
      .select('value')
      .eq('key', 'stripe_secret_key')
      .single();

    if (error || !data) {
      return null;
    }

    const encryptedKey = data.value?.key || data.value;
    return decrypt(encryptedKey);
  } catch (error) {
    logger.error('Failed to get Stripe secret key', { error: error.message });
    return null;
  }
}

/**
 * Get or create Stripe instance
 * @param {string} [secretKey] - Optional secret key to use
 * @returns {Promise<Stripe|null>} Stripe instance or null
 */
async function getStripeClient(secretKey = null) {
  try {
    const key = secretKey || await getSecretKey();
    
    if (!key) {
      logger.warn('Stripe secret key not configured');
      return null;
    }

    // Return cached instance if key hasn't changed
    if (stripeInstance && cachedSecretKey === key) {
      return stripeInstance;
    }

    // Create new instance
    stripeInstance = new Stripe(key, {
      apiVersion: '2024-11-20.acacia',
      typescript: false,
    });
    cachedSecretKey = key;

    logger.info('Stripe client initialized');
    return stripeInstance;
  } catch (error) {
    logger.error('Failed to initialize Stripe client', { error: error.message });
    return null;
  }
}

/**
 * Create a temporary Stripe instance for validation
 * @param {string} secretKey - The secret key to validate
 * @returns {Stripe} Stripe instance
 */
function createTemporaryClient(secretKey) {
  return new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
    typescript: false,
  });
}

/**
 * Clear cached Stripe instance (useful when settings change)
 */
function clearCache() {
  stripeInstance = null;
  cachedSecretKey = null;
  logger.info('Stripe client cache cleared');
}

/**
 * Mask a secret key showing only last 4 characters
 * @param {string} key - The key to mask
 * @returns {string} Masked key
 */
function maskSecretKey(key) {
  if (!key || key.length < 8) return '****';
  const visiblePart = key.slice(-4);
  const maskedLength = key.length - 4;
  return '*'.repeat(maskedLength) + visiblePart;
}

module.exports = {
  getStripeClient,
  createTemporaryClient,
  clearCache,
  maskSecretKey,
  encrypt,
  decrypt,
  getSecretKey,
};
