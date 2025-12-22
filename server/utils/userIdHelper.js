/**
 * User ID Helper
 * 
 * Centralizes logic for converting between different user ID formats:
 * - UUID format: 12345678-1234-1234-1234-123456789012 (36 chars with dashes)
 * - Hash format: 12345678123412341234123456789012 (32 chars without dashes)
 * 
 * The hash format is used by WUZAPI tokens and legacy session storage.
 * The UUID format is used by Supabase Auth and accounts.owner_user_id.
 * 
 * Requirements: Task 3 - Unified Auth System Audit
 */

const { logger } = require('./logger');

/**
 * Regular expression for validating UUID format
 * Matches: 12345678-1234-1234-1234-123456789012
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Regular expression for validating WUZAPI hash format
 * Matches: 12345678123412341234123456789012 (32 hex chars)
 */
const HASH_REGEX = /^[0-9a-f]{32}$/i;

/**
 * Check if a string is a valid UUID format
 * @param {string} str - String to validate
 * @returns {boolean} True if valid UUID format
 */
function isUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str);
}

/**
 * Check if a string is a valid WUZAPI hash format (32 hex chars)
 * @param {string} str - String to validate
 * @returns {boolean} True if valid hash format
 */
function isWuzapiHash(str) {
  if (!str || typeof str !== 'string') return false;
  return HASH_REGEX.test(str);
}

/**
 * Convert a WUZAPI hash (32 chars) to UUID format (36 chars with dashes)
 * @param {string} hash - 32-character hex string
 * @returns {string} UUID formatted string
 * @throws {Error} If hash is not valid format
 */
function hashToUUID(hash) {
  if (!isWuzapiHash(hash)) {
    throw new Error(`Invalid hash format: expected 32 hex characters, got ${hash?.length || 0}`);
  }
  
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`;
}

/**
 * Convert a UUID (36 chars with dashes) to WUZAPI hash format (32 chars)
 * @param {string} uuid - UUID formatted string
 * @returns {string} 32-character hex string
 * @throws {Error} If uuid is not valid format
 */
function uuidToHash(uuid) {
  if (!isUUID(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }
  
  return uuid.replace(/-/g, '');
}

/**
 * Normalize a user ID to UUID format
 * Accepts both UUID and hash formats, always returns UUID format
 * 
 * @param {string} userId - User ID in either format
 * @returns {string|null} UUID formatted string, or null if invalid
 */
function normalizeToUUID(userId) {
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  
  // Already UUID format
  if (isUUID(userId)) {
    return userId.toLowerCase();
  }
  
  // Hash format - convert to UUID
  if (isWuzapiHash(userId)) {
    return hashToUUID(userId).toLowerCase();
  }
  
  // Unknown format
  logger.warn('Unknown user ID format', { 
    userId: userId.substring(0, 8) + '...', 
    length: userId.length 
  });
  return null;
}

/**
 * Normalize a user ID to hash format
 * Accepts both UUID and hash formats, always returns hash format
 * 
 * @param {string} userId - User ID in either format
 * @returns {string|null} 32-character hex string, or null if invalid
 */
function normalizeToHash(userId) {
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  
  // Already hash format
  if (isWuzapiHash(userId)) {
    return userId.toLowerCase();
  }
  
  // UUID format - convert to hash
  if (isUUID(userId)) {
    return uuidToHash(userId).toLowerCase();
  }
  
  // Unknown format
  logger.warn('Unknown user ID format', { 
    userId: userId.substring(0, 8) + '...', 
    length: userId.length 
  });
  return null;
}

/**
 * Compare two user IDs for equality, regardless of format
 * Normalizes both to the same format before comparing
 * 
 * @param {string} id1 - First user ID
 * @param {string} id2 - Second user ID
 * @returns {boolean} True if IDs represent the same user
 */
function areEqual(id1, id2) {
  const normalized1 = normalizeToHash(id1);
  const normalized2 = normalizeToHash(id2);
  
  if (!normalized1 || !normalized2) {
    return false;
  }
  
  return normalized1 === normalized2;
}

/**
 * Get the format type of a user ID
 * @param {string} userId - User ID to check
 * @returns {'uuid'|'hash'|'unknown'} Format type
 */
function getFormat(userId) {
  if (isUUID(userId)) return 'uuid';
  if (isWuzapiHash(userId)) return 'hash';
  return 'unknown';
}

/**
 * Validate and describe a user ID
 * Useful for debugging and logging
 * 
 * @param {string} userId - User ID to validate
 * @returns {Object} Validation result with format, normalized values, and validity
 */
function validate(userId) {
  const format = getFormat(userId);
  const isValid = format !== 'unknown';
  
  return {
    original: userId,
    format,
    isValid,
    asUUID: isValid ? normalizeToUUID(userId) : null,
    asHash: isValid ? normalizeToHash(userId) : null,
    length: userId?.length || 0
  };
}

module.exports = {
  // Validation functions
  isUUID,
  isWuzapiHash,
  getFormat,
  validate,
  
  // Conversion functions
  hashToUUID,
  uuidToHash,
  normalizeToUUID,
  normalizeToHash,
  
  // Comparison
  areEqual,
  
  // Constants (for testing)
  UUID_REGEX,
  HASH_REGEX
};
