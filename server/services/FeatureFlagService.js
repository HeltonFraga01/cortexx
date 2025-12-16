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
   * @param {string} userId - User ID
   * @param {string} featureName - Feature name
   * @returns {Promise<boolean>} True if enabled
   */
  async isFeatureEnabled(userId, featureName) {
    try {
      // Check for override first
      const overrideResult = await this.db.query(
        'SELECT enabled FROM user_feature_overrides WHERE user_id = ? AND feature_name = ?',
        [userId, featureName]
      );

      if (overrideResult.rows.length > 0) {
        return overrideResult.rows[0].enabled === 1;
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
      const enabledInt = enabled ? 1 : 0;
      
      const existing = await this.db.query(
        'SELECT id FROM user_feature_overrides WHERE user_id = ? AND feature_name = ?',
        [userId, featureName]
      );

      if (existing.rows.length > 0) {
        await this.db.query(
          `UPDATE user_feature_overrides 
           SET enabled = ?, set_by = ?, updated_at = ?
           WHERE user_id = ? AND feature_name = ?`,
          [enabledInt, adminId, now, userId, featureName]
        );
      } else {
        await this.db.query(
          `INSERT INTO user_feature_overrides (id, user_id, feature_name, enabled, set_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [this.generateId(), userId, featureName, enabledInt, adminId, now, now]
        );
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
   * @param {string} userId - User ID
   * @param {string} featureName - Feature name
   * @param {string} adminId - Admin removing the override
   * @returns {Promise<void>}
   */
  async removeFeatureOverride(userId, featureName, adminId) {
    try {
      await this.db.query(
        'DELETE FROM user_feature_overrides WHERE user_id = ? AND feature_name = ?',
        [userId, featureName]
      );

      logger.info('Feature override removed', { userId, featureName, adminId });
    } catch (error) {
      logger.error('Failed to remove feature override', { error: error.message, userId, featureName });
      throw error;
    }
  }

  /**
   * Propagate plan feature change to all users on that plan
   * @param {string} planId - Plan ID
   * @param {string} featureName - Feature name
   * @param {boolean} enabled - New value
   * @returns {Promise<number>} Number of users affected
   */
  async propagatePlanFeatureChange(planId, featureName, enabled) {
    try {
      // Get users on this plan without override for this feature
      const result = await this.db.query(
        `SELECT s.user_id FROM user_subscriptions s
         WHERE s.plan_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM user_feature_overrides o 
           WHERE o.user_id = s.user_id AND o.feature_name = ?
         )`,
        [planId, featureName]
      );

      logger.info('Plan feature change propagated', {
        planId,
        featureName,
        enabled,
        usersAffected: result.rows.length
      });

      return result.rows.length;
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
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Plan features
   */
  async getPlanFeatures(userId) {
    try {
      const result = await this.db.query(
        `SELECT p.features FROM user_subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ?`,
        [userId]
      );

      if (result.rows.length === 0) {
        return {};
      }

      const features = result.rows[0].features;
      return typeof features === 'string' ? JSON.parse(features) : features || {};
    } catch (error) {
      logger.error('Failed to get plan features', { error: error.message, userId });
      return {};
    }
  }

  /**
   * Get feature overrides for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of overrides
   */
  async getFeatureOverrides(userId) {
    try {
      const result = await this.db.query(
        'SELECT feature_name, enabled, set_by FROM user_feature_overrides WHERE user_id = ?',
        [userId]
      );

      return result.rows.map(row => ({
        featureName: row.feature_name,
        enabled: row.enabled === 1,
        setBy: row.set_by
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
