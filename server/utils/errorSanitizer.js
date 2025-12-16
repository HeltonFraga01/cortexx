/**
 * Error Sanitizer Utility
 * Removes sensitive information from error messages before logging or returning to clients
 */

const { logger } = require('./logger');

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS = [
  // Tokens and API keys
  /token[=:]\s*['"]?[\w\-_.]+['"]?/gi,
  /api[_-]?key[=:]\s*['"]?[\w\-_.]+['"]?/gi,
  /bearer\s+[\w\-_.]+/gi,
  /authorization[=:]\s*['"]?[\w\-_.]+['"]?/gi,
  
  // Passwords and secrets
  /password[=:]\s*['"]?[^'"\s]+['"]?/gi,
  /secret[=:]\s*['"]?[\w\-_.]+['"]?/gi,
  /credential[s]?[=:]\s*['"]?[^'"\s]+['"]?/gi,
  
  // Database connection strings
  /postgres:\/\/[^@]+@/gi,
  /mysql:\/\/[^@]+@/gi,
  /mongodb:\/\/[^@]+@/gi,
  
  // AWS credentials
  /aws[_-]?access[_-]?key[_-]?id[=:]\s*['"]?[\w]+['"]?/gi,
  /aws[_-]?secret[_-]?access[_-]?key[=:]\s*['"]?[\w\/+=]+['"]?/gi,
  
  // Generic sensitive patterns
  /private[_-]?key[=:]\s*['"]?[^'"\s]+['"]?/gi,
  /xc-token[=:]\s*['"]?[\w\-_.]+['"]?/gi
];

// Replacement text for sensitive data
const REDACTED = '[REDACTED]';

/**
 * Sanitizes a string by removing sensitive patterns
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeString(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  let sanitized = text;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, REDACTED);
  }
  
  return sanitized;
}

/**
 * Sanitizes an error object
 * @param {Error} error - Error to sanitize
 * @returns {Object} Sanitized error object
 */
function sanitizeError(error) {
  if (!error) {
    return { message: 'Unknown error', code: 'UNKNOWN_ERROR' };
  }
  
  const sanitized = {
    message: sanitizeString(error.message || 'Unknown error'),
    code: error.code || 'INTERNAL_ERROR'
  };
  
  // Only include stack in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    sanitized.stack = sanitizeString(error.stack);
  }
  
  return sanitized;
}

/**
 * Sanitizes an object recursively
 * @param {Object} obj - Object to sanitize
 * @param {number} depth - Current recursion depth
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 5) return '[MAX_DEPTH]';
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key indicates sensitive data
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('key') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('authorization')
    ) {
      sanitized[key] = REDACTED;
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Handles an error with proper logging and sanitization
 * @param {Error} error - Error to handle
 * @param {Object} context - Additional context for logging
 * @returns {Object} Sanitized error response
 */
function handleError(error, context = {}) {
  const sanitizedError = sanitizeError(error);
  const sanitizedContext = sanitizeObject(context);
  
  // Log the error with context
  logger.error(sanitizedError.message, {
    ...sanitizedContext,
    code: sanitizedError.code,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
  
  return sanitizedError;
}

/**
 * Creates an error response suitable for API responses
 * @param {Error} error - Error to convert
 * @param {number} statusCode - HTTP status code
 * @returns {Object} API error response
 */
function createErrorResponse(error, statusCode = 500) {
  const sanitized = sanitizeError(error);
  
  return {
    success: false,
    error: sanitized.message,
    code: sanitized.code,
    statusCode
  };
}

/**
 * Express error handling middleware
 */
function errorMiddleware(err, req, res, next) {
  const sanitized = handleError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.session?.userId
  });
  
  const statusCode = err.statusCode || err.status || 500;
  
  res.status(statusCode).json({
    success: false,
    error: sanitized.message,
    code: sanitized.code
  });
}

module.exports = {
  sanitizeString,
  sanitizeError,
  sanitizeObject,
  handleError,
  createErrorResponse,
  errorMiddleware,
  REDACTED
};
