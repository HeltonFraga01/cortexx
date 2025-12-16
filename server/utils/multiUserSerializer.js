/**
 * Multi-User Data Serialization Utilities
 * 
 * Provides JSON serialization/deserialization with schema validation
 * for multi-user system entities (Agent, Account, Team, Inbox, CustomRole)
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

const { logger } = require('./logger');

// Schema definitions for validation
const SCHEMAS = {
  agent: {
    required: ['id', 'accountId', 'email', 'name', 'role', 'status'],
    optional: ['avatarUrl', 'customRoleId', 'availability', 'lastActivityAt', 'createdAt', 'updatedAt'],
    types: {
      id: 'string',
      accountId: 'string',
      email: 'string',
      name: 'string',
      avatarUrl: ['string', 'null'],
      role: 'string',
      customRoleId: ['string', 'null'],
      availability: 'string',
      status: 'string',
      lastActivityAt: ['string', 'null'],
      createdAt: 'string',
      updatedAt: 'string'
    },
    enums: {
      role: ['owner', 'administrator', 'agent', 'viewer'],
      availability: ['online', 'busy', 'offline'],
      status: ['active', 'inactive', 'pending']
    }
  },
  account: {
    required: ['id', 'name', 'ownerUserId', 'status'],
    optional: ['wuzapiToken', 'timezone', 'locale', 'settings', 'createdAt', 'updatedAt'],
    types: {
      id: 'string',
      name: 'string',
      ownerUserId: 'string',
      wuzapiToken: ['string', 'null'],
      timezone: 'string',
      locale: 'string',
      status: 'string',
      settings: 'object',
      createdAt: 'string',
      updatedAt: 'string'
    },
    enums: {
      status: ['active', 'inactive', 'suspended']
    }
  },
  team: {
    required: ['id', 'accountId', 'name'],
    optional: ['description', 'allowAutoAssign', 'members', 'createdAt', 'updatedAt'],
    types: {
      id: 'string',
      accountId: 'string',
      name: 'string',
      description: ['string', 'null'],
      allowAutoAssign: 'boolean',
      members: 'array',
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  inbox: {
    required: ['id', 'accountId', 'name'],
    optional: ['description', 'channelType', 'enableAutoAssignment', 'autoAssignmentConfig', 'greetingEnabled', 'greetingMessage', 'members', 'createdAt', 'updatedAt'],
    types: {
      id: 'string',
      accountId: 'string',
      name: 'string',
      description: ['string', 'null'],
      channelType: 'string',
      enableAutoAssignment: 'boolean',
      autoAssignmentConfig: 'object',
      greetingEnabled: 'boolean',
      greetingMessage: ['string', 'null'],
      members: 'array',
      createdAt: 'string',
      updatedAt: 'string'
    }
  },
  customRole: {
    required: ['id', 'accountId', 'name', 'permissions'],
    optional: ['description', 'createdAt', 'updatedAt'],
    types: {
      id: 'string',
      accountId: 'string',
      name: 'string',
      description: ['string', 'null'],
      permissions: 'array',
      createdAt: 'string',
      updatedAt: 'string'
    }
  }
};

/**
 * Validates a value against expected type(s)
 * @param {any} value - Value to validate
 * @param {string|string[]} expectedType - Expected type(s)
 * @returns {boolean}
 */
function validateType(value, expectedType) {
  if (Array.isArray(expectedType)) {
    return expectedType.some(type => validateType(value, type));
  }
  
  if (expectedType === 'null') {
    return value === null || value === undefined;
  }
  
  if (expectedType === 'array') {
    return Array.isArray(value);
  }
  
  return typeof value === expectedType;
}

/**
 * Validates data against a schema
 * @param {object} data - Data to validate
 * @param {string} schemaName - Name of schema to use
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSchema(data, schemaName) {
  const schema = SCHEMAS[schemaName];
  if (!schema) {
    return { valid: false, errors: [`Unknown schema: ${schemaName}`] };
  }
  
  const errors = [];
  
  // Check required fields
  for (const field of schema.required) {
    if (data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check types for all fields
  const allFields = [...schema.required, ...schema.optional];
  for (const field of allFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const expectedType = schema.types[field];
      if (expectedType && !validateType(data[field], expectedType)) {
        errors.push(`Invalid type for ${field}: expected ${JSON.stringify(expectedType)}, got ${typeof data[field]}`);
      }
    }
  }
  
  // Check enum values
  if (schema.enums) {
    for (const [field, allowedValues] of Object.entries(schema.enums)) {
      if (data[field] !== undefined && data[field] !== null) {
        if (!allowedValues.includes(data[field])) {
          errors.push(`Invalid value for ${field}: ${data[field]}. Allowed: ${allowedValues.join(', ')}`);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Serializes an entity to JSON string
 * @param {object} data - Entity data
 * @param {string} schemaName - Schema name for validation
 * @returns {{ success: boolean, json?: string, error?: string }}
 */
function serialize(data, schemaName) {
  try {
    const validation = validateSchema(data, schemaName);
    if (!validation.valid) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('Serialization validation failed', { schemaName, errors: validation.errors });
      }
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }
    
    const json = JSON.stringify(data);
    return { success: true, json };
  } catch (error) {
    if (logger && typeof logger.error === 'function') {
      logger.error('Serialization error', { schemaName, error: error.message });
    }
    return { success: false, error: error.message };
  }
}

/**
 * Deserializes JSON string to entity with validation
 * @param {string} json - JSON string
 * @param {string} schemaName - Schema name for validation
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
function deserialize(json, schemaName) {
  try {
    const parsed = JSON.parse(json);
    // Convert to regular object to ensure proper prototype chain
    const data = { ...parsed };
    
    const validation = validateSchema(data, schemaName);
    if (!validation.valid) {
      if (logger && typeof logger.warn === 'function') {
        logger.warn('Deserialization validation failed', { schemaName, errors: validation.errors });
      }
      return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` };
    }
    
    return { success: true, data };
  } catch (error) {
    if (logger && typeof logger.error === 'function') {
      logger.error('Deserialization error', { schemaName, error: error.message });
    }
    return { success: false, error: error.message };
  }
}

/**
 * Converts database row to entity object (snake_case to camelCase)
 * @param {object} row - Database row
 * @returns {object}
 */
function fromDatabaseRow(row) {
  if (!row) return null;
  
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    
    // Parse JSON fields
    if (typeof value === 'string' && (key === 'settings' || key === 'permissions' || key === 'auto_assignment_config')) {
      try {
        result[camelKey] = JSON.parse(value);
      } catch {
        result[camelKey] = value;
      }
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

/**
 * Converts entity object to database row (camelCase to snake_case)
 * @param {object} entity - Entity object
 * @returns {object}
 */
function toDatabaseRow(entity) {
  if (!entity) return null;
  
  const result = {};
  for (const [key, value] of Object.entries(entity)) {
    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    
    // Stringify objects/arrays for JSON fields
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[snakeKey] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      result[snakeKey] = JSON.stringify(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Serializes permissions array to JSON string
 * @param {string[]} permissions - Array of permission strings
 * @returns {string}
 */
function serializePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return '[]';
  }
  return JSON.stringify(permissions);
}

/**
 * Deserializes permissions JSON string to array
 * @param {string} json - JSON string
 * @returns {string[]}
 */
function deserializePermissions(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  SCHEMAS,
  validateSchema,
  serialize,
  deserialize,
  fromDatabaseRow,
  toDatabaseRow,
  serializePermissions,
  deserializePermissions
};
