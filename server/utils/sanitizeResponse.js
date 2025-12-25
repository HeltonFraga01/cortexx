/**
 * Response Sanitization Utility
 * 
 * Centralizes sanitization of sensitive data in API responses.
 * Prevents token leakage and credential exposure.
 * 
 * @module server/utils/sanitizeResponse
 */

const { logger } = require('./logger');

/**
 * Masks sensitive token showing only last 4 characters
 * @param {string} token - Token to mask
 * @returns {string|null} Masked token (e.g., "***ULML") or null
 */
function maskToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (token.length <= 4) return '***';
  return '***' + token.slice(-4);
}

/**
 * Masks credentials in proxy URL
 * @param {string} url - Proxy URL (e.g., "socks5://user:pass@host:port")
 * @returns {string|null} Masked URL or null
 */
function maskProxyUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    // Handle socks5:// URLs which URL constructor may not parse correctly
    if (url.includes('@')) {
      // Replace credentials between :// and @
      return url.replace(/:\/\/[^@]+@/, '://***:***@');
    }
    return url;
  } catch {
    // If parsing fails, return masked version
    return url.replace(/:\/\/[^@]+@/, '://***:***@');
  }
}

/**
 * Sanitizes user data by masking sensitive fields
 * @param {Object} user - User object from WUZAPI
 * @param {Object} options - Sanitization options
 * @param {boolean} options.includeFullConfig - Include full config details (for admin detail view)
 * @param {boolean} options.minimal - Return minimal fields only (for list views)
 * @returns {Object|null} Sanitized user object
 */
function sanitizeUserData(user, options = {}) {
  if (!user) return null;
  
  const { includeFullConfig = false, minimal = false } = options;
  
  // Minimal mode - only essential fields for list views (Task 11)
  if (minimal) {
    return {
      id: user.id,
      name: user.name,
      connected: user.connected,
      loggedIn: user.loggedIn,
      jid: user.jid,
      token: maskToken(user.token),
      // Simplified config indicators
      hasWebhook: !!user.webhook,
      hasProxy: !!(user.proxy_config?.enabled || user.proxy_url),
      hasS3: !!user.s3_config?.enabled
    };
  }
  
  const sanitized = {
    id: user.id,
    name: user.name,
    connected: user.connected,
    loggedIn: user.loggedIn,
    jid: user.jid,
    webhook: user.webhook,
    events: user.events,
    expiration: user.expiration,
    qrcode: user.qrcode,
    // Mask sensitive token - CRITICAL
    token: maskToken(user.token),
  };
  
  // Sanitize proxy config
  if (user.proxy_config) {
    sanitized.proxy_config = {
      enabled: user.proxy_config.enabled,
      // Mask proxy URL if it contains credentials
      proxy_url: maskProxyUrl(user.proxy_config.proxy_url)
    };
  } else if (user.proxy_url) {
    // Handle flat proxy_url field
    sanitized.proxy_url = maskProxyUrl(user.proxy_url);
    sanitized.proxy_config = {
      enabled: !!user.proxy_url,
      proxy_url: maskProxyUrl(user.proxy_url)
    };
  }
  
  // Sanitize S3 config
  if (user.s3_config) {
    sanitized.s3_config = {
      enabled: user.s3_config.enabled,
      bucket: user.s3_config.bucket,
      // Always mask access key - CRITICAL
      access_key: '***'
    };
    
    // Include full config only if explicitly requested (admin detail view)
    if (includeFullConfig) {
      sanitized.s3_config.endpoint = user.s3_config.endpoint;
      sanitized.s3_config.region = user.s3_config.region;
      sanitized.s3_config.media_delivery = user.s3_config.media_delivery;
      sanitized.s3_config.path_style = user.s3_config.path_style;
      sanitized.s3_config.public_url = user.s3_config.public_url;
      sanitized.s3_config.retention_days = user.s3_config.retention_days;
    }
  }
  
  return sanitized;
}

/**
 * Sanitizes array of users
 * @param {Array} users - Array of user objects
 * @param {Object} options - Sanitization options
 * @returns {Array} Array of sanitized user objects
 */
function sanitizeUsersArray(users, options = {}) {
  if (!Array.isArray(users)) return [];
  return users.map(user => sanitizeUserData(user, options));
}

/**
 * Development-only: Check if response contains unsanitized tokens
 * Logs a warning if potential token patterns are detected
 * @param {Object} data - Response data to check
 * @param {string} endpoint - Endpoint name for logging context
 */
function warnIfUnsanitized(data, endpoint = 'unknown') {
  if (process.env.NODE_ENV !== 'development') return;
  
  try {
    const json = JSON.stringify(data);
    // Check for patterns that look like WUZAPI tokens (phone + MIN + random string)
    const tokenPattern = /\d{10,15}MIN[A-Z0-9]{10,}/;
    if (tokenPattern.test(json)) {
      logger.warn('⚠️ Possible unsanitized WUZAPI token detected in response', {
        type: 'security_warning',
        endpoint,
        pattern: 'WUZAPI token pattern detected',
        hint: 'Use sanitizeUserData() or sanitizeUsersArray() before sending response'
      });
    }
    
    // Check for AWS-style access keys
    const awsKeyPattern = /AKIA[0-9A-Z]{16}/;
    if (awsKeyPattern.test(json)) {
      logger.warn('⚠️ Possible unsanitized AWS access key detected in response', {
        type: 'security_warning',
        endpoint,
        pattern: 'AWS access key pattern detected'
      });
    }
  } catch (error) {
    // Silently ignore JSON stringify errors
  }
}

/**
 * Sanitizes dashboard stats response
 * Specifically handles the /api/admin/dashboard-stats response format
 * @param {Object} data - Dashboard stats data
 * @returns {Object} Sanitized dashboard stats
 */
function sanitizeDashboardStats(data) {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Sanitize users array if present
  if (sanitized.users && Array.isArray(sanitized.users)) {
    sanitized.users = sanitizeUsersArray(sanitized.users);
  }
  
  // Sanitize nested data.users if present
  if (sanitized.data && sanitized.data.users && Array.isArray(sanitized.data.users)) {
    sanitized.data = {
      ...sanitized.data,
      users: sanitizeUsersArray(sanitized.data.users)
    };
  }
  
  return sanitized;
}

module.exports = {
  maskToken,
  maskProxyUrl,
  sanitizeUserData,
  sanitizeUsersArray,
  sanitizeDashboardStats,
  warnIfUnsanitized
};
