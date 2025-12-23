/**
 * TenantSettingsService - Service for managing tenant-specific system settings
 * 
 * This service ensures all settings operations are scoped to a specific tenant,
 * preventing cross-tenant access to settings data.
 * 
 * Requirements: REQ-3 (Multi-Tenant Isolation Audit)
 * Requirements: Tenant Webhook Configuration (1.3, 1.4, 1.6, 6.4)
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// WUZAPI configuration keys
const WUZAPI_KEYS = {
  BASE_URL: 'wuzapi.baseUrl',
  ADMIN_TOKEN: 'wuzapi.adminToken',
  TIMEOUT: 'wuzapi.timeout',
  WEBHOOK_BASE_URL: 'webhook.baseUrl'
};

// Default settings with descriptions and types
const DEFAULT_SETTINGS = {
  default_plan: {
    value: 'free',
    description: 'Default plan assigned to new users',
    type: 'string'
  },
  trial_duration_days: {
    value: '14',
    description: 'Number of days for trial period',
    type: 'number'
  },
  grace_period_days: {
    value: '7',
    description: 'Grace period after payment failure before suspension',
    type: 'number'
  },
  password_min_length: {
    value: '8',
    description: 'Minimum password length',
    type: 'number'
  },
  password_require_uppercase: {
    value: 'true',
    description: 'Require uppercase letters in password',
    type: 'boolean'
  },
  password_require_numbers: {
    value: 'true',
    description: 'Require numbers in password',
    type: 'boolean'
  },
  password_require_special: {
    value: 'false',
    description: 'Require special characters in password',
    type: 'boolean'
  },
  rate_limit_api_requests: {
    value: '100',
    description: 'Maximum API requests per minute per user',
    type: 'number'
  },
  rate_limit_messages: {
    value: '60',
    description: 'Maximum messages per minute per user',
    type: 'number'
  },
  session_timeout_minutes: {
    value: '60',
    description: 'Session timeout in minutes',
    type: 'number'
  },
  enable_user_registration: {
    value: 'true',
    description: 'Allow new user registrations',
    type: 'boolean'
  },
  maintenance_mode: {
    value: 'false',
    description: 'Enable maintenance mode (blocks user access)',
    type: 'boolean'
  },
  support_email: {
    value: '',
    description: 'Support email address',
    type: 'string'
  },
  support_phone: {
    value: '',
    description: 'Support phone number',
    type: 'string'
  },
  timezone: {
    value: 'America/Sao_Paulo',
    description: 'Default timezone for the tenant',
    type: 'string'
  },
  locale: {
    value: 'pt-BR',
    description: 'Default locale for the tenant',
    type: 'string'
  }
};

class TenantSettingsService {
  /**
   * Get all settings for a tenant
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object[]>} Array of settings with metadata
   */
  async getSettings(tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Get tenant settings from database
      const { data: tenantSettings, error } = await SupabaseService.adminClient
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const storedSettings = tenantSettings?.settings || {};

      // Merge with defaults
      const settings = {};
      for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
        const storedValue = storedSettings[key];
        settings[key] = {
          key,
          value: storedValue !== undefined ? storedValue : config.value,
          description: config.description,
          type: config.type,
          isDefault: storedValue === undefined,
          updatedAt: tenantSettings?.updated_at || null
        };
      }

      // Include any custom settings not in defaults
      for (const [key, value] of Object.entries(storedSettings)) {
        if (!DEFAULT_SETTINGS[key]) {
          settings[key] = {
            key,
            value,
            description: '',
            type: 'string',
            isDefault: false,
            updatedAt: tenantSettings?.updated_at || null
          };
        }
      }

      logger.debug('Tenant settings retrieved', {
        tenantId,
        settingsCount: Object.keys(settings).length
      });

      return Object.values(settings);
    } catch (error) {
      logger.error('Failed to get tenant settings', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Get a specific setting for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} key - Setting key
   * @returns {Promise<Object>} Setting with metadata
   */
  async getSetting(tenantId, key) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { data: tenantSettings, error } = await SupabaseService.adminClient
        .from('tenant_settings')
        .select('settings, updated_at')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const storedSettings = tenantSettings?.settings || {};
      const defaultConfig = DEFAULT_SETTINGS[key];
      const storedValue = storedSettings[key];

      if (storedValue === undefined && !defaultConfig) {
        return null;
      }

      return {
        key,
        value: storedValue !== undefined ? storedValue : (defaultConfig?.value || null),
        description: defaultConfig?.description || '',
        type: defaultConfig?.type || 'string',
        isDefault: storedValue === undefined,
        updatedAt: tenantSettings?.updated_at || null
      };
    } catch (error) {
      logger.error('Failed to get tenant setting', {
        error: error.message,
        tenantId,
        key
      });
      throw error;
    }
  }

  /**
   * Update a specific setting for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} key - Setting key
   * @param {string} value - Setting value
   * @param {string} [adminId] - Admin who made the change
   * @returns {Promise<Object>} Updated setting
   */
  async updateSetting(tenantId, key, value, adminId = null) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Validate value type if it's a known setting
      const defaultConfig = DEFAULT_SETTINGS[key];
      if (defaultConfig) {
        if (defaultConfig.type === 'number' && isNaN(Number(value))) {
          throw new Error(`Value must be a number for setting: ${key}`);
        }
        if (defaultConfig.type === 'boolean' && !['true', 'false'].includes(String(value).toLowerCase())) {
          throw new Error(`Value must be true or false for setting: ${key}`);
        }
      }

      const now = new Date().toISOString();

      // Get existing settings
      const { data: existing, error: fetchError } = await SupabaseService.adminClient
        .from('tenant_settings')
        .select('id, settings')
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const currentSettings = existing?.settings || {};
      const updatedSettings = { ...currentSettings, [key]: String(value) };

      if (existing) {
        // Update existing record
        const { error: updateError } = await SupabaseService.adminClient
          .from('tenant_settings')
          .update({
            settings: updatedSettings,
            updated_at: now
          })
          .eq('tenant_id', tenantId);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await SupabaseService.adminClient
          .from('tenant_settings')
          .insert({
            tenant_id: tenantId,
            settings: updatedSettings,
            updated_at: now
          });

        if (insertError) throw insertError;
      }

      logger.info('Tenant setting updated', {
        tenantId,
        key,
        adminId
      });

      return {
        key,
        value: String(value),
        description: defaultConfig?.description || '',
        type: defaultConfig?.type || 'string',
        isDefault: false,
        updatedAt: now
      };
    } catch (error) {
      logger.error('Failed to update tenant setting', {
        error: error.message,
        tenantId,
        key
      });
      throw error;
    }
  }

  /**
   * Update multiple settings for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} settings - Key-value pairs of settings to update
   * @param {string} [adminId] - Admin who made the change
   * @returns {Promise<Object[]>} Updated settings
   */
  async updateSettings(tenantId, settings, adminId = null) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Validate all values
      for (const [key, value] of Object.entries(settings)) {
        const defaultConfig = DEFAULT_SETTINGS[key];
        if (defaultConfig) {
          if (defaultConfig.type === 'number' && isNaN(Number(value))) {
            throw new Error(`Value must be a number for setting: ${key}`);
          }
          if (defaultConfig.type === 'boolean' && !['true', 'false'].includes(String(value).toLowerCase())) {
            throw new Error(`Value must be true or false for setting: ${key}`);
          }
        }
      }

      const now = new Date().toISOString();

      // Get existing settings
      const { data: existing, error: fetchError } = await SupabaseService.adminClient
        .from('tenant_settings')
        .select('id, settings')
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const currentSettings = existing?.settings || {};
      const updatedSettings = { ...currentSettings };

      // Convert all values to strings
      for (const [key, value] of Object.entries(settings)) {
        updatedSettings[key] = String(value);
      }

      if (existing) {
        const { error: updateError } = await SupabaseService.adminClient
          .from('tenant_settings')
          .update({
            settings: updatedSettings,
            updated_at: now
          })
          .eq('tenant_id', tenantId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await SupabaseService.adminClient
          .from('tenant_settings')
          .insert({
            tenant_id: tenantId,
            settings: updatedSettings,
            updated_at: now
          });

        if (insertError) throw insertError;
      }

      logger.info('Tenant settings updated', {
        tenantId,
        keys: Object.keys(settings),
        adminId
      });

      // Return updated settings
      return this.getSettings(tenantId);
    } catch (error) {
      logger.error('Failed to update tenant settings', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Reset a setting to default for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} key - Setting key
   * @returns {Promise<Object>} Reset setting
   */
  async resetSetting(tenantId, key) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const defaultConfig = DEFAULT_SETTINGS[key];
      if (!defaultConfig) {
        throw new Error('Cannot reset unknown setting');
      }

      const now = new Date().toISOString();

      // Get existing settings
      const { data: existing, error: fetchError } = await SupabaseService.adminClient
        .from('tenant_settings')
        .select('id, settings')
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (!existing || existing.settings[key] === undefined) {
        // Already at default
        return {
          key,
          value: defaultConfig.value,
          description: defaultConfig.description,
          type: defaultConfig.type,
          isDefault: true,
          updatedAt: null
        };
      }

      // Remove the key from settings
      const updatedSettings = { ...existing.settings };
      delete updatedSettings[key];

      const { error: updateError } = await SupabaseService.adminClient
        .from('tenant_settings')
        .update({
          settings: updatedSettings,
          updated_at: now
        })
        .eq('tenant_id', tenantId);

      if (updateError) throw updateError;

      logger.info('Tenant setting reset to default', {
        tenantId,
        key
      });

      return {
        key,
        value: defaultConfig.value,
        description: defaultConfig.description,
        type: defaultConfig.type,
        isDefault: true,
        updatedAt: now
      };
    } catch (error) {
      logger.error('Failed to reset tenant setting', {
        error: error.message,
        tenantId,
        key
      });
      throw error;
    }
  }

  /**
   * Get default settings configuration
   * @returns {Object} Default settings
   */
  getDefaultSettings() {
    return DEFAULT_SETTINGS;
  }

  // ============================================
  // WUZAPI Configuration Methods
  // ============================================

  /**
   * Get encryption key from environment or generate deterministic key
   * @returns {Buffer} 32-byte encryption key
   * @private
   */
  _getEncryptionKey() {
    const secret = process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET || 'default-encryption-key-change-me';
    return crypto.scryptSync(secret, 'tenant-settings-salt', ENCRYPTION_KEY_LENGTH);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param {string} plaintext - Data to encrypt
   * @returns {string} Encrypted data with format: encrypted:iv:authTag:ciphertext
   */
  encryptToken(plaintext) {
    if (!plaintext) return null;
    
    try {
      const key = this._getEncryptionKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: encrypted:iv:authTag:ciphertext
      return `encrypted:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Token encryption failed', { error: error.message });
      throw new Error('Failed to encrypt token');
    }
  }

  /**
   * Decrypt sensitive data
   * @param {string} ciphertext - Encrypted data with format: encrypted:iv:authTag:ciphertext
   * @returns {string} Decrypted data
   */
  decryptToken(ciphertext) {
    if (!ciphertext) return null;
    
    // Check if it's encrypted format
    if (!ciphertext.startsWith('encrypted:')) {
      // Return as-is if not encrypted (legacy data)
      return ciphertext;
    }
    
    try {
      const parts = ciphertext.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted format');
      }
      
      const [, ivHex, authTagHex, encryptedHex] = parts;
      const key = this._getEncryptionKey();
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Token decryption failed', { error: error.message });
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Validate HTTPS URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid HTTPS URL
   */
  isValidHttpsUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || 
             (process.env.NODE_ENV === 'development' && parsed.protocol === 'http:');
    } catch {
      return false;
    }
  }

  /**
   * Get WUZAPI configuration for a tenant
   * Falls back to environment variables if not configured
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} WUZAPI configuration { baseUrl, adminToken, timeout }
   * Requirements: 1.6, 6.4
   */
  async getWuzapiConfig(tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      // Get tenant settings
      const { data: tenantSettings, error } = await SupabaseService.adminClient
        .from('tenant_settings')
        .select('settings')
        .eq('tenant_id', tenantId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const settings = tenantSettings?.settings || {};
      
      // Get values from tenant settings or fall back to env vars
      const baseUrl = settings[WUZAPI_KEYS.BASE_URL] || process.env.WUZAPI_BASE_URL || process.env.VITE_WUZAPI_BASE_URL;
      const encryptedToken = settings[WUZAPI_KEYS.ADMIN_TOKEN];
      const adminToken = encryptedToken ? this.decryptToken(encryptedToken) : (process.env.WUZAPI_ADMIN_TOKEN || process.env.VITE_ADMIN_TOKEN);
      const timeout = parseInt(settings[WUZAPI_KEYS.TIMEOUT] || process.env.WUZAPI_TIMEOUT || '30000', 10);
      const webhookBaseUrl = settings[WUZAPI_KEYS.WEBHOOK_BASE_URL] || process.env.WEBHOOK_BASE_URL;

      const config = {
        baseUrl: baseUrl || null,
        adminToken: adminToken || null,
        timeout,
        webhookBaseUrl: webhookBaseUrl || null,
        isConfigured: !!(baseUrl && adminToken),
        source: settings[WUZAPI_KEYS.BASE_URL] ? 'database' : 'environment'
      };

      logger.debug('WUZAPI config retrieved', {
        tenantId,
        isConfigured: config.isConfigured,
        source: config.source,
        hasBaseUrl: !!config.baseUrl,
        hasToken: !!config.adminToken
      });

      return config;
    } catch (error) {
      logger.error('Failed to get WUZAPI config', {
        error: error.message,
        tenantId
      });
      
      // Return fallback config on error
      return {
        baseUrl: process.env.WUZAPI_BASE_URL || process.env.VITE_WUZAPI_BASE_URL || null,
        adminToken: process.env.WUZAPI_ADMIN_TOKEN || process.env.VITE_ADMIN_TOKEN || null,
        timeout: parseInt(process.env.WUZAPI_TIMEOUT || '30000', 10),
        webhookBaseUrl: process.env.WEBHOOK_BASE_URL || null,
        isConfigured: false,
        source: 'environment'
      };
    }
  }

  /**
   * Save WUZAPI configuration for a tenant
   * Encrypts admin token before storing
   * @param {string} tenantId - Tenant UUID
   * @param {Object} config - Configuration { baseUrl, adminToken, timeout, webhookBaseUrl }
   * @param {string} [adminId] - Admin who made the change
   * @returns {Promise<Object>} Saved configuration (without decrypted token)
   * Requirements: 1.2, 1.3, 1.4
   */
  async saveWuzapiConfig(tenantId, config, adminId = null) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { baseUrl, adminToken, timeout, webhookBaseUrl } = config;

      // Validate URL format
      if (baseUrl && !this.isValidHttpsUrl(baseUrl)) {
        throw new Error('Base URL must be a valid HTTPS URL');
      }

      if (webhookBaseUrl && !this.isValidHttpsUrl(webhookBaseUrl)) {
        throw new Error('Webhook base URL must be a valid HTTPS URL');
      }

      const now = new Date().toISOString();

      // Get existing settings
      const { data: existing, error: fetchError } = await SupabaseService.adminClient
        .from('tenant_settings')
        .select('id, settings')
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const currentSettings = existing?.settings || {};
      const updatedSettings = { ...currentSettings };

      // Update WUZAPI settings
      if (baseUrl !== undefined) {
        updatedSettings[WUZAPI_KEYS.BASE_URL] = baseUrl;
      }
      
      if (adminToken !== undefined && adminToken !== null && adminToken !== '') {
        // Encrypt the token before storing
        updatedSettings[WUZAPI_KEYS.ADMIN_TOKEN] = this.encryptToken(adminToken);
      }
      
      if (timeout !== undefined) {
        updatedSettings[WUZAPI_KEYS.TIMEOUT] = String(timeout);
      }

      if (webhookBaseUrl !== undefined) {
        updatedSettings[WUZAPI_KEYS.WEBHOOK_BASE_URL] = webhookBaseUrl;
      }

      if (existing) {
        const { error: updateError } = await SupabaseService.adminClient
          .from('tenant_settings')
          .update({
            settings: updatedSettings,
            updated_at: now
          })
          .eq('tenant_id', tenantId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await SupabaseService.adminClient
          .from('tenant_settings')
          .insert({
            tenant_id: tenantId,
            settings: updatedSettings,
            updated_at: now
          });

        if (insertError) throw insertError;
      }

      logger.info('WUZAPI config saved', {
        tenantId,
        adminId,
        hasBaseUrl: !!baseUrl,
        hasToken: !!adminToken,
        hasWebhookBaseUrl: !!webhookBaseUrl
      });

      return {
        baseUrl: updatedSettings[WUZAPI_KEYS.BASE_URL] || null,
        timeout: parseInt(updatedSettings[WUZAPI_KEYS.TIMEOUT] || '30000', 10),
        webhookBaseUrl: updatedSettings[WUZAPI_KEYS.WEBHOOK_BASE_URL] || null,
        isConfigured: !!(updatedSettings[WUZAPI_KEYS.BASE_URL] && updatedSettings[WUZAPI_KEYS.ADMIN_TOKEN]),
        updatedAt: now
      };
    } catch (error) {
      logger.error('Failed to save WUZAPI config', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Test WUZAPI connection with provided credentials
   * @param {string} baseUrl - WUZAPI base URL
   * @param {string} adminToken - Admin token
   * @returns {Promise<Object>} Connection test result { success, responseTime, error, version }
   * Requirements: 1.5
   */
  async testWuzapiConnection(baseUrl, adminToken) {
    try {
      if (!baseUrl) {
        return { success: false, error: 'Base URL is required' };
      }

      if (!adminToken) {
        return { success: false, error: 'Admin token is required' };
      }

      const startTime = Date.now();
      
      // Make a simple health check request to WUZAPI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(`${baseUrl}/admin/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return {
            success: true,
            responseTime,
            version: data.version || 'unknown',
            usersCount: Array.isArray(data) ? data.length : undefined
          };
        } else {
          const errorText = await response.text().catch(() => 'Unknown error');
          return {
            success: false,
            responseTime,
            error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
          };
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          return { success: false, error: 'Connection timeout (15s)' };
        }
        
        return { success: false, error: fetchError.message };
      }
    } catch (error) {
      logger.error('WUZAPI connection test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if tenant has WUZAPI configured
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<boolean>} True if WUZAPI is configured
   */
  async hasWuzapiConfig(tenantId) {
    const config = await this.getWuzapiConfig(tenantId);
    return config.isConfigured;
  }
}

// Export singleton instance
module.exports = new TenantSettingsService();
