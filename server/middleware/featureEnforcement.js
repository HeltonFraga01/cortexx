/**
 * Feature Enforcement Middleware
 * 
 * Middleware to check if a feature is enabled for a user.
 * Separates USER_FEATURES (plan-controlled) from ADMIN_FEATURES (admin-only).
 * Returns 403 with feature info when disabled.
 * 
 * Requirements: 4.2, 4.3
 */

const { logger } = require('../utils/logger');
const FeatureFlagService = require('../services/FeatureFlagService');

// FeatureFlagService instance - initialized lazily from app.locals.db
let featureService = null;

/**
 * Get or initialize the FeatureFlagService instance
 * @param {Object} req - Express request with app.locals.db
 * @returns {FeatureFlagService|null} FeatureFlagService instance or null if db not available
 */
function getFeatureService(req) {
  if (!featureService && req.app?.locals?.db) {
    featureService = new FeatureFlagService(req.app.locals.db);
    logger.debug('FeatureFlagService initialized from app.locals.db');
  }
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
      // Get FeatureFlagService instance from app.locals.db
      const service = getFeatureService(req);
      if (!service) {
        logger.warn('Feature check skipped - FeatureFlagService not initialized', { featureName });
        return next();
      }

      // Skip feature check for admin users
      if (req.session?.role === 'admin') {
        return next();
      }
      
      // Check if this is an admin-only feature - deny for non-admin users
      if (isAdminFeature(featureName)) {
        logger.warn('Admin feature access denied for non-admin user', {
          userId: req.user?.id || req.userId || req.session?.userId,
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
      
      // Get user ID from authenticated request
      const userId = req.user?.id || req.userId || req.session?.userId;
      
      if (!userId) {
        logger.warn('Feature check skipped - no user ID', { featureName });
        return next();
      }

      // Check if feature is enabled for user
      const isEnabled = await service.isFeatureEnabled(userId, featureName);

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
        userId: req.user?.id
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
