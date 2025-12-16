/**
 * Common Validation Utilities
 * Provides reusable validation functions for API inputs
 */

const { logger } = require('../utils/logger');

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 */

/**
 * Validates that a value is a non-empty string
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
function validateString(value, fieldName) {
  const errors = [];
  
  if (value === undefined || value === null) {
    errors.push(`${fieldName} is required`);
  } else if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
  } else if (value.trim().length === 0) {
    errors.push(`${fieldName} cannot be empty`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates that a value is a positive integer
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
function validatePositiveInteger(value, fieldName) {
  const errors = [];
  
  if (value === undefined || value === null) {
    errors.push(`${fieldName} is required`);
  } else {
    const num = Number(value);
    if (!Number.isInteger(num)) {
      errors.push(`${fieldName} must be an integer`);
    } else if (num <= 0) {
      errors.push(`${fieldName} must be positive`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an email address
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
function validateEmail(value, fieldName = 'email') {
  const errors = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (value === undefined || value === null) {
    errors.push(`${fieldName} is required`);
  } else if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
  } else if (!emailRegex.test(value)) {
    errors.push(`${fieldName} is not a valid email address`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a phone number (Brazilian format)
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
function validatePhone(value, fieldName = 'phone') {
  const errors = [];
  
  if (value === undefined || value === null) {
    errors.push(`${fieldName} is required`);
  } else if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
  } else {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    
    // Brazilian phone: 10-11 digits (with area code) or 12-13 (with country code)
    if (digits.length < 10 || digits.length > 13) {
      errors.push(`${fieldName} must have 10-13 digits`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a URL
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
function validateUrl(value, fieldName = 'url') {
  const errors = [];
  
  if (value === undefined || value === null) {
    errors.push(`${fieldName} is required`);
  } else if (typeof value !== 'string') {
    errors.push(`${fieldName} must be a string`);
  } else {
    try {
      new URL(value);
    } catch {
      errors.push(`${fieldName} is not a valid URL`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates that a value is one of allowed values
 * @param {any} value - Value to validate
 * @param {any[]} allowedValues - Array of allowed values
 * @param {string} fieldName - Name of the field for error messages
 * @returns {ValidationResult}
 */
function validateEnum(value, allowedValues, fieldName) {
  const errors = [];
  
  if (value === undefined || value === null) {
    errors.push(`${fieldName} is required`);
  } else if (!allowedValues.includes(value)) {
    errors.push(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validates an array
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {Object} options - Validation options
 * @param {number} options.minLength - Minimum array length
 * @param {number} options.maxLength - Maximum array length
 * @returns {ValidationResult}
 */
function validateArray(value, fieldName, options = {}) {
  const errors = [];
  const { minLength = 0, maxLength = Infinity } = options;
  
  if (value === undefined || value === null) {
    errors.push(`${fieldName} is required`);
  } else if (!Array.isArray(value)) {
    errors.push(`${fieldName} must be an array`);
  } else {
    if (value.length < minLength) {
      errors.push(`${fieldName} must have at least ${minLength} items`);
    }
    if (value.length > maxLength) {
      errors.push(`${fieldName} must have at most ${maxLength} items`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Sanitizes a string to prevent XSS and injection attacks
 * @param {string} value - Value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  
  return value
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitizes an object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validates multiple fields at once
 * @param {Object} data - Data object to validate
 * @param {Object} schema - Validation schema
 * @returns {ValidationResult}
 */
function validateSchema(data, schema) {
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // Check required
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${field} is required`);
      continue;
    }
    
    // Skip optional fields that are not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Type validation
    if (rules.type) {
      switch (rules.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          }
          break;
        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${field} must be a number`);
          }
          break;
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`${field} must be a boolean`);
          }
          break;
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`${field} must be an array`);
          }
          break;
        case 'object':
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`${field} must be an object`);
          }
          break;
      }
    }
    
    // Custom validator
    if (rules.validator && typeof rules.validator === 'function') {
      const result = rules.validator(value);
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Express middleware for request validation
 * @param {Object} schema - Validation schema
 * @param {string} source - Source of data ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const result = validateSchema(data, schema);
    
    if (!result.valid) {
      logger.warn('Request validation failed', {
        path: req.path,
        method: req.method,
        errors: result.errors
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.errors
      });
    }
    
    // Sanitize the data
    req[source] = sanitizeObject(data);
    next();
  };
}

module.exports = {
  validateString,
  validatePositiveInteger,
  validateEmail,
  validatePhone,
  validateUrl,
  validateEnum,
  validateArray,
  sanitizeString,
  sanitizeObject,
  validateSchema,
  validateRequest
};
