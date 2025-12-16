/**
 * Database Retry Utility
 * Implements retry logic with exponential backoff for SQLite operations
 */

const { logger } = require('./logger');

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 100; // ms
const DEFAULT_MAX_DELAY = 5000; // ms

/**
 * Calculates delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, baseDelay = DEFAULT_BASE_DELAY, maxDelay = DEFAULT_MAX_DELAY) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Add jitter (±25%)
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Checks if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} Whether the error is retryable
 */
function isRetryableError(error) {
  if (!error) return false;
  
  const retryableCodes = [
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'SQLITE_PROTOCOL',
    'SQLITE_IOERR',
    'ECONNRESET',
    'ETIMEDOUT'
  ];
  
  const retryableMessages = [
    'database is locked',
    'database table is locked',
    'cannot start a transaction within a transaction',
    'busy',
    'timeout'
  ];
  
  // Check error code
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }
  
  // Check error message
  if (error.message) {
    const lowerMessage = error.message.toLowerCase();
    return retryableMessages.some(msg => lowerMessage.includes(msg));
  }
  
  return false;
}

/**
 * Executes a function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.baseDelay - Base delay for backoff
 * @param {number} options.maxDelay - Maximum delay
 * @param {string} options.operationName - Name for logging
 * @param {Object} options.context - Additional context for logging
 * @returns {Promise<any>} Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelay = DEFAULT_BASE_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    operationName = 'database operation',
    context = {}
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = calculateBackoff(attempt, baseDelay, maxDelay);
        
        logger.warn(`Retrying ${operationName}`, {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: error.message,
          code: error.code,
          ...context
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Not retryable or max retries reached
        logger.error(`${operationName} failed`, {
          attempts: attempt + 1,
          error: error.message,
          code: error.code,
          retryable: isRetryableError(error),
          ...context
        });
        
        throw error;
      }
    }
  }
  
  // Should not reach here, but just in case
  throw lastError;
}

/**
 * Creates a retry wrapper for database queries
 * @param {Object} db - Database instance
 * @returns {Function} Wrapped query function
 */
function createRetryableQuery(db) {
  return async function retryableQuery(sql, params = [], options = {}) {
    return withRetry(
      () => db.query(sql, params),
      {
        operationName: 'SQL query',
        context: { sql: sql.substring(0, 100) },
        ...options
      }
    );
  };
}

/**
 * Wraps a database method with retry logic
 * @param {Function} method - Method to wrap
 * @param {string} methodName - Name for logging
 * @returns {Function} Wrapped method
 */
function wrapWithRetry(method, methodName) {
  return async function(...args) {
    return withRetry(
      () => method.apply(this, args),
      {
        operationName: methodName,
        context: { args: args.length }
      }
    );
  };
}

module.exports = {
  withRetry,
  isRetryableError,
  calculateBackoff,
  createRetryableQuery,
  wrapWithRetry,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY,
  DEFAULT_MAX_DELAY
};
