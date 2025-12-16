/**
 * Automation Validator
 * 
 * Validation functions for automation-related inputs.
 * 
 * Requirements: 2.2, 5.2, 6.2, 7.2
 */

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate bot template input
 * @param {Object} data - Bot template data
 * @returns {Object} Validation result
 */
function validateBotTemplate(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid input data'] };
  }

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('Name is required');
  }

  if (!data.outgoingUrl || typeof data.outgoingUrl !== 'string' || !data.outgoingUrl.trim()) {
    errors.push('Outgoing URL is required');
  } else if (!isValidUrl(data.outgoingUrl)) {
    errors.push('Invalid outgoing URL format');
  }

  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    errors.push('Description must be a string');
  }

  if (data.includeHistory !== undefined && typeof data.includeHistory !== 'boolean') {
    errors.push('Include history must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate default label input
 * @param {Object} data - Label data
 * @returns {Object} Validation result
 */
function validateDefaultLabel(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid input data'] };
  }

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('Name is required');
  }

  if (!data.color || typeof data.color !== 'string' || !data.color.trim()) {
    errors.push('Color is required');
  } else if (!/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
    // Validate hex color format
    errors.push('Color must be a valid hex color (e.g., #FF5733)');
  }

  if (data.sortOrder !== undefined && (typeof data.sortOrder !== 'number' || data.sortOrder < 0)) {
    errors.push('Sort order must be a non-negative number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate default canned response input
 * @param {Object} data - Canned response data
 * @returns {Object} Validation result
 */
function validateDefaultCannedResponse(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid input data'] };
  }

  if (!data.shortcut || typeof data.shortcut !== 'string' || !data.shortcut.trim()) {
    errors.push('Shortcut is required');
  } else if (data.shortcut.length > 50) {
    errors.push('Shortcut must be 50 characters or less');
  }

  if (!data.content || typeof data.content !== 'string' || !data.content.trim()) {
    errors.push('Content is required');
  } else if (data.content.length > 4096) {
    errors.push('Content must be 4096 characters or less');
  }

  if (data.sortOrder !== undefined && (typeof data.sortOrder !== 'number' || data.sortOrder < 0)) {
    errors.push('Sort order must be a non-negative number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate global settings input
 * @param {Object} data - Settings data
 * @returns {Object} Validation result
 */
function validateGlobalSettings(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid input data'] };
  }

  if (data.automationsEnabled) {
    if (typeof data.automationsEnabled !== 'object') {
      errors.push('automationsEnabled must be an object');
    } else {
      const validKeys = ['bot', 'labels', 'cannedResponses', 'webhooks'];
      for (const key of Object.keys(data.automationsEnabled)) {
        if (!validKeys.includes(key)) {
          errors.push(`Invalid automation type: ${key}`);
        } else if (typeof data.automationsEnabled[key] !== 'boolean') {
          errors.push(`${key} must be a boolean`);
        }
      }
    }
  }

  if (data.defaultBotTemplateId !== undefined && data.defaultBotTemplateId !== null) {
    if (typeof data.defaultBotTemplateId !== 'number' || data.defaultBotTemplateId < 1) {
      errors.push('defaultBotTemplateId must be a positive number or null');
    }
  }

  if (data.defaultWebhookUrl !== undefined && data.defaultWebhookUrl !== null) {
    if (typeof data.defaultWebhookUrl !== 'string') {
      errors.push('defaultWebhookUrl must be a string or null');
    } else if (data.defaultWebhookUrl.trim() && !isValidUrl(data.defaultWebhookUrl)) {
      errors.push('defaultWebhookUrl must be a valid URL');
    }
  }

  if (data.defaultWebhookEvents !== undefined) {
    if (!Array.isArray(data.defaultWebhookEvents)) {
      errors.push('defaultWebhookEvents must be an array');
    } else {
      for (const event of data.defaultWebhookEvents) {
        if (typeof event !== 'string') {
          errors.push('Each webhook event must be a string');
          break;
        }
      }
    }
  }

  if (data.auditLogRetentionDays !== undefined) {
    if (typeof data.auditLogRetentionDays !== 'number' || data.auditLogRetentionDays < 1) {
      errors.push('auditLogRetentionDays must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate bulk apply input
 * @param {Object} data - Bulk apply data
 * @returns {Object} Validation result
 */
function validateBulkApply(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid input data'] };
  }

  if (!data.userIds || !Array.isArray(data.userIds) || data.userIds.length === 0) {
    errors.push('userIds array is required and must not be empty');
  } else {
    for (const userId of data.userIds) {
      if (typeof userId !== 'string' || !userId.trim()) {
        errors.push('Each userId must be a non-empty string');
        break;
      }
    }
  }

  if (data.automationTypes !== undefined) {
    if (!Array.isArray(data.automationTypes)) {
      errors.push('automationTypes must be an array');
    } else {
      const validTypes = ['bot', 'labels', 'cannedResponses', 'webhooks'];
      for (const type of data.automationTypes) {
        if (!validTypes.includes(type)) {
          errors.push(`Invalid automation type: ${type}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  isValidUrl,
  validateBotTemplate,
  validateDefaultLabel,
  validateDefaultCannedResponse,
  validateGlobalSettings,
  validateBulkApply
};
