/**
 * Stripe Client Wrapper
 * 
 * Provides a singleton Stripe SDK instance with lazy initialization.
 * Retrieves API keys from global_settings table.
 * 
 * Requirements: 1.2, 1.3
 */

const Stripe = require('stripe');
const { logger } = require('./logger');
const SupabaseService = require('../services/SupabaseService');

let stripeInstance = null;
let cachedSecretKey = null;

/**
 * Decrypt a value (placeholder - implement proper encryption)
 * @param {string} encryptedValue - The encrypted value
 * @returns {string} Decrypted value
 */
function decrypt(encryptedValue) {
  // For now, values are stored as-is
  // TODO: Implement proper AES-256 encryption
  if (!encryptedValue) return null;
  
  // Check if value is encrypted (starts with 'enc:')
  if (encryptedValue.startsWith('enc:')) {
    // Placeholder for decryption logic
    return encryptedValue.substring(4);
  }
  
  return encryptedValue;
}

/**
 * Encrypt a value (placeholder - implement proper encryption)
 * @param {string} value - The value to encrypt
 * @returns {string} Encrypted value
 */
function encrypt(value) {
  // For now, prefix with 'enc:' to indicate it should be encrypted
  // TODO: Implement proper AES-256 encryption
  if (!value) return null;
  return `enc:${value}`;
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
