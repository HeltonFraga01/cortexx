/**
 * Feature Enforcement Middleware
 * 
 * Middleware to check if a feature is enabled for a user.
 * Separates USER_FEATURES (plan-controlled) from ADMIN_FEATURES (admin-only).
 * Returns 403 with feature info when disabled.
 * Supports both JWT (Supabase Auth) and session-based authentication.
 * 
 * Migrated to use module-level service initialization (Task 14.1)
 * 
 * Requirements: 4.2, 4.3
 */

const { logger } = require('../utils/logger');
const FeatureFlagService = require('../services/FeatureFlagService');

// Module-level service instance (FeatureFlagService now uses SupabaseService internally)
const featureService = new FeatureFlagService();

/**
 * Helper to get user ID from request (JWT or session)
 */
function getUserId(req) {
  return req.user?.id || req.userId || req.session?.userId;
}

/**
 * Helper to get user role from request (JWT or session)
 */
function getUserRole(req) {
  return req.user?.role || req.session?.role;
}

/**
 * Get the FeatureFlagService instance
 * @returns {FeatureFlagService} FeatureFlagService instance
 */
function getFeatureService() {
  return featureService;
}

/**
 * Check if a feature is an admin-only feature
 * @param {string} featureName - Feature name
 * @returns {boolean} True if admin-only
 */
function isAdminFeature(featureName) {
  return Object.values(FeatureFlagService.ADMIN_FEATURES).includes(featureName);
}

/**
 * Create feature enforcement middleware for a specific feature
 * @param {string} featureName - Name of the feature to check
 * @returns {Function} Express middleware
 */
function requireFeature(featureName) {
  return async (req, res, next) => {
    try {
      // Skip feature check for admin users (JWT or session)
      const userRole = getUserRole(req);
      
      // Debug logging for feature enforcement
      logger.debug('Feature enforcement check', {
        featureName,
        userRole,
        hasUser: !!req.user,
        userRoleFromUser: req.user?.role,
        sessionRole: req.session?.role,
        isAdminFeature: isAdminFeature(featureName),
        path: req.path
      });
      
      if (userRole === 'admin' || userRole === 'superadmin') {
        logger.debug('Feature check bypassed for admin', { featureName, userRole });
        return next();
      }
      
      // Check if this is an admin-only feature - deny for non-admin users
      if (isAdminFeature(featureName)) {
        const userId = getUserId(req);
        logger.warn('Admin feature access denied for non-admin user', {
          userId,
          featureName
        });

        return res.status(403).json({
          error: 'Feature not available',
          code: 'ADMIN_FEATURE',
          details: {
            featureName,
            message: `The ${formatFeatureName(featureName)} feature is only available for administrators.`
          }
        });
      }
      
      // Get user ID from authenticated request (JWT or session)
      const userId = getUserId(req);
      
      if (!userId) {
        logger.warn('Feature check skipped - no user ID', { featureName });
        return next();
      }

      // Check if feature is enabled for user
      const isEnabled = await featureService.isFeatureEnabled(userId, featureName);

      if (!isEnabled) {
        logger.warn('Feature disabled for user', {
          userId,
          featureName
        });

        return res.status(403).json({
          error: 'Feature not available',
          code: 'FEATURE_DISABLED',
          details: {
            featureName,
            message: `The ${formatFeatureName(featureName)} feature is not available on your current plan. Please upgrade to access this feature.`
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Feature enforcement error', {
        error: error.message,
        featureName,
        userId: getUserId(req)
      });
      
      // Don't block on feature check errors, but log them
      next();
    }
  };
}

/**
 * Format feature name for user-friendly display
 * @param {string} featureName - Feature name
 * @returns {string} Formatted name
 */
function formatFeatureName(featureName) {
  const names = {
    'page_builder': 'Page Builder',
    'bulk_campaigns': 'Bulk Campaigns',
    'nocodb_integration': 'NocoDB Integration',
    'bot_automation': 'Bot Automation',
    'advanced_reports': 'Advanced Reports',
    'api_access': 'API Access',
    'webhooks': 'Webhooks',
    'scheduled_messages': 'Scheduled Messages',
    'media_storage': 'Media Storage',
    'custom_branding': 'Custom Branding'
  };
  
  return names[featureName] || featureName.replace(/_/g, ' ');
}

// Pre-configured middleware for user features (plan-controlled)
const featureMiddleware = {
  // User features - controlled by subscription plans
  bulkCampaigns: requireFeature(FeatureFlagService.USER_FEATURES.BULK_CAMPAIGNS),
  nocodbIntegration: requireFeature(FeatureFlagService.USER_FEATURES.NOCODB_INTEGRATION),
  botAutomation: requireFeature(FeatureFlagService.USER_FEATURES.BOT_AUTOMATION),
  advancedReports: requireFeature(FeatureFlagService.USER_FEATURES.ADVANCED_REPORTS),
  apiAccess: requireFeature(FeatureFlagService.USER_FEATURES.API_ACCESS),
  webhooks: requireFeature(FeatureFlagService.USER_FEATURES.WEBHOOKS),
  scheduledMessages: requireFeature(FeatureFlagService.USER_FEATURES.SCHEDULED_MESSAGES),
  mediaStorage: requireFeature(FeatureFlagService.USER_FEATURES.MEDIA_STORAGE),
  
  // Admin features - admin-only access (will deny non-admin users)
  pageBuilder: requireFeature(FeatureFlagService.ADMIN_FEATURES.PAGE_BUILDER),
  customBranding: requireFeature(FeatureFlagService.ADMIN_FEATURES.CUSTOM_BRANDING)
};

module.exports = {
  requireFeature,
  featureMiddleware,
  getFeatureService,
  isAdminFeature
};
