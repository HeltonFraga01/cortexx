/**
 * ApiSettingsService - Service for managing API configuration settings
 * 
 * Handles WUZAPI configuration stored in global_settings table with
 * encryption for sensitive values and fallback to environment variables.
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'wuzapi-manager-api-settings';

class ApiSettingsService {
  // Keys for global_settings table
  static KEYS = {
    WUZAPI_BASE_URL: 'api.wuzapi.baseUrl',
    WUZAPI_ADMIN_TOKEN: 'api.wuzapi.adminToken',
    WUZAPI_TIMEOUT: 'api.wuzapi.timeout'
  };

  // Environment variable fallbacks
  static ENV_FALLBACKS = {
    'api.wuzapi.baseUrl': 'WUZAPI_BASE_URL',
    'api.wuzapi.adminToken': 'WUZAPI_ADMIN_TOKEN',
    'api.wuzapi.timeout': 'REQUEST_TIMEOUT'
  };

  // Default values
  static DEFAULTS = {
    'api.wuzapi.baseUrl': 'https://wzapi.wasend.com.br',
    'api.wuzapi.timeout': '30000'
  };

  constructor() {
    this._cache = null;
    this._cacheExpiry = null;
    this._cacheTTL = 60000; // 1 minute cache
  }

  /**
   * Derives encryption key from SESSION_SECRET
   * @returns {Buffer} 32-byte key
   */
  _getEncryptionKey() {
    const secret = process.env.SESSION_SECRET || 'default-secret-change-me';
    return crypto.pbkdf2Sync(secret, SALT, 100000, 32, 'sha256');
  }

  /**
   * Encrypts a sensitive value using AES-256-GCM
   * @param {string} value - Plain text value
   * @returns {string} Encrypted value in format: iv:authTag:ciphertext (base64)
   */
  encryptValue(value) {
    if (!value) return null;
    
    try {
      const key = this._getEncryptionKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(value, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const authTag = cipher.getAuthTag();
      
      // Format: iv:authTag:ciphertext (all base64)
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      logger.error('Failed to encrypt value', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypts a value encrypted with encryptValue
   * @param {string} encryptedValue - Encrypted value in format: iv:authTag:ciphertext
   * @returns {string} Decrypted plain text
   */
  decryptValue(encryptedValue) {
    if (!encryptedValue) return null;
    
    try {
      const parts = encryptedValue.split(':');
      if (parts.length !== 3) {
        // Not encrypted, return as-is (for backward compatibility)
        return encryptedValue;
      }
      
      const [ivBase64, authTagBase64, ciphertext] = parts;
      const key = this._getEncryptionKey();
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt value', { error: error.message });
      // Return null instead of throwing to handle corrupted data gracefully
      return null;
    }
  }

  /**
   * Gets a single setting with source indication
   * @param {string} key - Setting key from KEYS
   * @returns {Promise<{value: string, source: 'database'|'environment'}>}
   */
  async getSetting(key) {
    try {
      // Try database first
      const { data: rows, error } = await SupabaseService.getMany('global_settings', { key });
      
      if (!error && rows && rows.length > 0) {
        let value = rows[0].value;
        
        // Decrypt if it's the admin token
        if (key === ApiSettingsService.KEYS.WUZAPI_ADMIN_TOKEN) {
          value = this.decryptValue(value);
        }
        
        if (value !== null && value !== undefined && value !== '') {
          return { value: String(value), source: 'database' };
        }
      }
      
      // Fallback to environment variable
      const envKey = ApiSettingsService.ENV_FALLBACKS[key];
      const envValue = envKey ? process.env[envKey] : null;
      
      if (envValue) {
        return { value: envValue, source: 'environment' };
      }
      
      // Fallback to default
      const defaultValue = ApiSettingsService.DEFAULTS[key];
      if (defaultValue) {
        return { value: defaultValue, source: 'environment' };
      }
      
      return { value: null, source: 'environment' };
    } catch (error) {
      logger.error('Failed to get setting', { key, error: error.message });
      
      // On error, fallback to environment
      const envKey = ApiSettingsService.ENV_FALLBACKS[key];
      const envValue = envKey ? process.env[envKey] : null;
      return { value: envValue || ApiSettingsService.DEFAULTS[key] || null, source: 'environment' };
    }
  }

  /**
   * Gets all API settings with sources
   * @returns {Promise<Object>} Settings object with values and sources
   */
  async getApiSettings() {
    // Check cache
    if (this._cache && this._cacheExpiry && Date.now() < this._cacheExpiry) {
      return this._cache;
    }

    try {
      const [baseUrl, adminToken, timeout] = await Promise.all([
        this.getSetting(ApiSettingsService.KEYS.WUZAPI_BASE_URL),
        this.getSetting(ApiSettingsService.KEYS.WUZAPI_ADMIN_TOKEN),
        this.getSetting(ApiSettingsService.KEYS.WUZAPI_TIMEOUT)
      ]);

      const settings = {
        wuzapiBaseUrl: {
          value: baseUrl.value,
          source: baseUrl.source,
          masked: false
        },
        wuzapiAdminToken: {
          value: adminToken.value ? '••••••••••••••••' : null,
          source: adminToken.source,
          masked: true,
          hasValue: !!adminToken.value
        },
        wuzapiTimeout: {
          value: timeout.value ? parseInt(timeout.value, 10) : 30000,
          source: timeout.source,
          masked: false
        }
      };

      // Update cache
      this._cache = settings;
      this._cacheExpiry = Date.now() + this._cacheTTL;

      return settings;
    } catch (error) {
      logger.error('Failed to get API settings', { error: error.message });
      throw error;
    }
  }

  /**
   * Updates API settings
   * @param {Object} updates - Settings to update
   * @returns {Promise<Object>} Updated settings
   */
  async updateApiSettings(updates) {
    try {
      const settingsToSave = [];

      if (updates.wuzapiBaseUrl !== undefined) {
        settingsToSave.push({
          key: ApiSettingsService.KEYS.WUZAPI_BASE_URL,
          value: updates.wuzapiBaseUrl
        });
      }

      if (updates.wuzapiAdminToken !== undefined && updates.wuzapiAdminToken !== '') {
        // Encrypt the token before saving
        const encryptedToken = this.encryptValue(updates.wuzapiAdminToken);
        settingsToSave.push({
          key: ApiSettingsService.KEYS.WUZAPI_ADMIN_TOKEN,
          value: encryptedToken
        });
      }

      if (updates.wuzapiTimeout !== undefined) {
        settingsToSave.push({
          key: ApiSettingsService.KEYS.WUZAPI_TIMEOUT,
          value: String(updates.wuzapiTimeout)
        });
      }

      // Save each setting
      for (const setting of settingsToSave) {
        const { data: existing } = await SupabaseService.getMany('global_settings', { key: setting.key });
        
        if (existing && existing.length > 0) {
          await SupabaseService.adminClient.from('global_settings')
            .update({ value: setting.value, updated_at: new Date().toISOString() })
            .eq('key', setting.key);
        } else {
          await SupabaseService.insert('global_settings', {
            key: setting.key,
            value: setting.value
          });
        }
      }

      // Invalidate cache
      this.invalidateCache();

      logger.info('API settings updated', { 
        updatedKeys: settingsToSave.map(s => s.key) 
      });

      return this.getApiSettings();
    } catch (error) {
      logger.error('Failed to update API settings', { error: error.message });
      throw error;
    }
  }

  /**
   * Deletes a setting from database (reverts to env fallback)
   * @param {string} key - Setting key to delete
   */
  async deleteSetting(key) {
    try {
      await SupabaseService.adminClient.from('global_settings')
        .delete()
        .eq('key', key);
      
      this.invalidateCache();
      logger.info('API setting deleted', { key });
    } catch (error) {
      logger.error('Failed to delete setting', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Gets the raw (decrypted) admin token for API calls
   * @returns {Promise<string|null>} Decrypted token
   */
  async getAdminToken() {
    const setting = await this.getSetting(ApiSettingsService.KEYS.WUZAPI_ADMIN_TOKEN);
    return setting.value;
  }

  /**
   * Gets the base URL for API calls
   * @returns {Promise<string>} Base URL
   */
  async getBaseUrl() {
    const setting = await this.getSetting(ApiSettingsService.KEYS.WUZAPI_BASE_URL);
    return setting.value || 'https://wzapi.wasend.com.br';
  }

  /**
   * Gets the timeout for API calls
   * @returns {Promise<number>} Timeout in milliseconds
   */
  async getTimeout() {
    const setting = await this.getSetting(ApiSettingsService.KEYS.WUZAPI_TIMEOUT);
    return parseInt(setting.value, 10) || 30000;
  }

  /**
   * Tests connection to WUZAPI with current settings
   * @returns {Promise<{success: boolean, details: string, responseTime?: number}>}
   */
  async testConnection() {
    const axios = require('axios');
    const startTime = Date.now();

    try {
      const [baseUrl, timeout] = await Promise.all([
        this.getBaseUrl(),
        this.getTimeout()
      ]);

      const response = await axios.get(`${baseUrl}/health`, {
        timeout: Math.min(timeout, 15000), // Max 15 seconds for test
        validateStatus: () => true
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        return {
          success: true,
          details: `Conexão OK (${responseTime}ms)`,
          responseTime
        };
      }

      return {
        success: false,
        details: `API retornou status ${response.status}`,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          details: 'Timeout: A API não respondeu a tempo',
          responseTime
        };
      }

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          details: 'Conexão recusada: Verifique se a URL está correta',
          responseTime
        };
      }

      if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          details: 'Host não encontrado: Verifique a URL',
          responseTime
        };
      }

      return {
        success: false,
        details: `Erro: ${error.message}`,
        responseTime
      };
    }
  }

  /**
   * Invalidates the settings cache
   */
  invalidateCache() {
    this._cache = null;
    this._cacheExpiry = null;
  }
}

module.exports = new ApiSettingsService();
