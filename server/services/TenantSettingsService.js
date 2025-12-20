/**
 * TenantSettingsService - Service for managing tenant-specific system settings
 * 
 * This service ensures all settings operations are scoped to a specific tenant,
 * preventing cross-tenant access to settings data.
 * 
 * Requirements: REQ-3 (Multi-Tenant Isolation Audit)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

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
}

// Export singleton instance
module.exports = new TenantSettingsService();
