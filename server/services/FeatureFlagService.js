/**
 * FeatureFlagService - Service for managing feature flags
 * 
 * Handles feature flag checking, overrides, and propagation.
 * Separates USER_FEATURES (controlled by plans) from ADMIN_FEATURES (admin-only).
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const SupabaseService = require('./SupabaseService');

// User features - controlled by subscription plans
const USER_FEATURES = {
  BULK_CAMPAIGNS: 'bulk_campaigns',
  NOCODB_INTEGRATION: 'nocodb_integration',
  BOT_AUTOMATION: 'bot_automation',
  ADVANCED_REPORTS: 'advanced_reports',
  API_ACCESS: 'api_access',
  WEBHOOKS: 'webhooks',
  SCHEDULED_MESSAGES: 'scheduled_messages',
  MEDIA_STORAGE: 'media_storage'
};

// Admin features - not controlled by plans, admin-only access
const ADMIN_FEATURES = {
  PAGE_BUILDER: 'page_builder',
  CUSTOM_BRANDING: 'custom_branding'
};

// Combined feature flags for backward compatibility
const FEATURE_FLAGS = {
  ...USER_FEATURES,
  ...ADMIN_FEATURES
};

// Default feature values for user features in plans
const DEFAULT_USER_FEATURES = {
  [USER_FEATURES.BULK_CAMPAIGNS]: false,
  [USER_FEATURES.NOCODB_INTEGRATION]: false,
  [USER_FEATURES.BOT_AUTOMATION]: false,
  [USER_FEATURES.ADVANCED_REPORTS]: false,
  [USER_FEATURES.API_ACCESS]: true,
  [USER_FEATURES.WEBHOOKS]: true,
  [USER_FEATURES.SCHEDULED_MESSAGES]: false,
  [USER_FEATURES.MEDIA_STORAGE]: true
};

// Legacy DEFAULT_FEATURES for backward compatibility
const DEFAULT_FEATURES = {
  ...DEFAULT_USER_FEATURES
};

class FeatureFlagService {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Get all user features (plan defaults + overrides)
   * Only returns USER_FEATURES, excludes ADMIN_FEATURES
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of feature objects
   */
  async getUserFeatures(userId) {
    try {
      const planFeatures = await this.getPlanFeatures(userId);
      const overrides = await this.getFeatureOverrides(userId);
      
      const features = [];
      
      // Only iterate over USER_FEATURES, not ADMIN_FEATURES
      for (const featureName of Object.values(USER_FEATURES)) {
        const override = overrides.find(o => o.featureName === featureName);
        const planValue = planFeatures[featureName] ?? DEFAULT_USER_FEATURES[featureName] ?? false;
        
        features.push({
          featureName,
          enabled: override ? override.enabled : planValue,
          source: override ? 'override' : 'plan'
        });
      }
      
      return features;
    } catch (error) {
      logger.error('Failed to get user features', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if a feature is an admin-only feature
   * @param {string} featureName - Feature name
   * @returns {boolean} True if admin-only
   */
  isAdminFeature(featureName) {
    return Object.values(ADMIN_FEATURES).includes(featureName);
  }

  /**
   * Check if a feature is a valid user feature
   * @param {string} featureName - Feature name
   * @returns {boolean} True if valid user feature
   */
  isUserFeature(featureName) {
    return Object.values(USER_FEATURES).includes(featureName);
  }

  /**
   * Check if a feature is enabled for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @param {string} featureName - Feature name
   * @returns {Promise<boolean>} True if enabled
   */
  async isFeatureEnabled(userId, featureName) {
    try {
      // Check for override first
      const { data: overrides, error } = await SupabaseService.queryAsAdmin('user_feature_overrides', (query) =>
        query.select('enabled').eq('account_id', userId).eq('feature_key', featureName)
      );

      if (!error && overrides && overrides.length > 0) {
        return overrides[0].enabled === true;
      }

      // Fall back to plan default
      const planFeatures = await this.getPlanFeatures(userId);
      return planFeatures[featureName] ?? DEFAULT_FEATURES[featureName] ?? false;
    } catch (error) {
      logger.error('Failed to check feature', { error: error.message, userId, featureName });
      return false;
    }
  }

  /**
   * Set a feature override for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @param {string} featureName - Feature name
   * @param {boolean} enabled - Whether feature is enabled
   * @param {string} adminId - Admin setting the override
   * @returns {Promise<Object>} Created/updated override
   */
  async setFeatureOverride(userId, featureName, enabled, adminId) {
    try {
      if (!Object.values(FEATURE_FLAGS).includes(featureName)) {
        throw new Error(`Invalid feature: ${featureName}`);
      }

      const now = new Date().toISOString();
      
      const { data: existing, error: findError } = await SupabaseService.queryAsAdmin('user_feature_overrides', (query) =>
        query.select('id').eq('account_id', userId).eq('feature_key', featureName)
      );

      if (!findError && existing && existing.length > 0) {
        await SupabaseService.update('user_feature_overrides', existing[0].id, {
          enabled: enabled,
          reason: adminId,
          updated_at: now
        });
      } else {
        await SupabaseService.insert('user_feature_overrides', {
          account_id: userId,
          feature_key: featureName,
          enabled: enabled,
          reason: adminId
        });
      }

      logger.info('Feature override set', { userId, featureName, enabled, adminId });

      return { userId, featureName, enabled, setBy: adminId };
    } catch (error) {
      logger.error('Failed to set feature override', { error: error.message, userId, featureName });
      throw error;
    }
  }

  /**
   * Remove a feature override
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @param {string} featureName - Feature name
   * @param {string} adminId - Admin removing the override
   * @returns {Promise<void>}
   */
  async removeFeatureOverride(userId, featureName, adminId) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('user_feature_overrides', (query) =>
        query.delete().eq('account_id', userId).eq('feature_key', featureName)
      );

      if (error) {
        throw error;
      }

      logger.info('Feature override removed', { userId, featureName, adminId });
    } catch (error) {
      logger.error('Failed to remove feature override', { error: error.message, userId, featureName });
      throw error;
    }
  }

  /**
   * Propagate plan feature change to all users on that plan
   * Uses Supabase query builder instead of raw SQL
   * @param {string} planId - Plan ID
   * @param {string} featureName - Feature name
   * @param {boolean} enabled - New value
   * @returns {Promise<number>} Number of users affected
   */
  async propagatePlanFeatureChange(planId, featureName, enabled) {
    try {
      // Get users on this plan
      const { data: subscriptions, error: subError } = await SupabaseService.queryAsAdmin('user_subscriptions', (query) =>
        query.select('account_id').eq('plan_id', planId)
      );

      if (subError || !subscriptions) {
        return 0;
      }

      // Get users with overrides for this feature
      const { data: overrides } = await SupabaseService.queryAsAdmin('user_feature_overrides', (query) =>
        query.select('account_id').eq('feature_key', featureName)
      );

      const overrideAccountIds = new Set((overrides || []).map(o => o.account_id));
      
      // Count users without overrides
      const usersAffected = subscriptions.filter(s => !overrideAccountIds.has(s.account_id)).length;

      logger.info('Plan feature change propagated', {
        planId,
        featureName,
        enabled,
        usersAffected
      });

      return usersAffected;
    } catch (error) {
      logger.error('Failed to propagate feature change', { error: error.message, planId, featureName });
      throw error;
    }
  }

  /**
   * List all available user features (excludes admin features)
   * @returns {Object[]} Array of feature definitions
   */
  listAvailableFeatures() {
    return Object.entries(USER_FEATURES).map(([key, value]) => ({
      key,
      name: value,
      defaultValue: DEFAULT_USER_FEATURES[value] ?? false
    }));
  }

  /**
   * List all admin features
   * @returns {Object[]} Array of admin feature definitions
   */
  listAdminFeatures() {
    return Object.entries(ADMIN_FEATURES).map(([key, value]) => ({
      key,
      name: value
    }));
  }

  /**
   * Get plan features for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Plan features
   */
  async getPlanFeatures(userId) {
    try {
      // Get user subscription with plan
      const { data: subscriptions, error: subError } = await SupabaseService.queryAsAdmin('user_subscriptions', (query) =>
        query.select('plan_id').eq('account_id', userId)
      );
      
      if (subError || !subscriptions || subscriptions.length === 0) {
        return {};
      }
      
      const planId = subscriptions[0].plan_id;
      
      // Get plan features
      const { data: plans, error: planError } = await SupabaseService.queryAsAdmin('plans', (query) =>
        query.select('features').eq('id', planId)
      );
      
      if (planError || !plans || plans.length === 0) {
        return {};
      }

      const features = plans[0].features;
      return typeof features === 'string' ? JSON.parse(features) : features || {};
    } catch (error) {
      logger.error('Failed to get plan features', { error: error.message, userId });
      return {};
    }
  }

  /**
   * Get feature overrides for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of overrides
   */
  async getFeatureOverrides(userId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('user_feature_overrides', (query) =>
        query.select('feature_key, enabled, reason').eq('account_id', userId)
      );
      
      if (error || !data) {
        return [];
      }

      return data.map(row => ({
        featureName: row.feature_key,
        enabled: row.enabled === true,
        setBy: row.reason
      }));
    } catch (error) {
      logger.error('Failed to get feature overrides', { error: error.message, userId });
      return [];
    }
  }
}

// Export constants
FeatureFlagService.USER_FEATURES = USER_FEATURES;
FeatureFlagService.ADMIN_FEATURES = ADMIN_FEATURES;
FeatureFlagService.FEATURE_FLAGS = FEATURE_FLAGS;
FeatureFlagService.DEFAULT_USER_FEATURES = DEFAULT_USER_FEATURES;
FeatureFlagService.DEFAULT_FEATURES = DEFAULT_FEATURES; // Legacy compatibility

module.exports = FeatureFlagService;
