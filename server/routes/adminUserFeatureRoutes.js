/**
 * Admin User Feature Routes
 * 
 * Endpoints for managing user feature flags.
 * All routes require admin authentication.
 * 
 * Requirements: 4.2, 4.4
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const FeatureFlagService = require('../services/FeatureFlagService');
const AdminAuditService = require('../services/AdminAuditService');

const router = express.Router();

let featureService = null;
let auditService = null;

function getFeatureService(req) {
  if (!featureService) {
    const db = req.app.locals.db;
    if (db) featureService = new FeatureFlagService(db);
  }
  return featureService;
}

function getAuditService(req) {
  if (!auditService) {
    const db = req.app.locals.db;
    if (db) auditService = new AdminAuditService(db);
  }
  return auditService;
}

/**
 * GET /api/admin/users/features
 * List all available features
 * Note: This route is mounted at /api/admin/users, so the full path is /api/admin/users/features
 */
router.get('/features', requireAdmin, async (req, res) => {
  try {
    const service = getFeatureService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const features = service.listAvailableFeatures();

    res.json({ success: true, data: features });
  } catch (error) {
    logger.error('Failed to list features', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/users/features'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/features
 * Get all features for a user
 */
router.get('/:userId/features', requireAdmin, async (req, res) => {
  try {
    const service = getFeatureService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;
    const features = await service.getUserFeatures(userId);

    logger.info('User features retrieved', {
      adminId: req.session.userId,
      targetUserId: userId,
      endpoint: `/api/admin/users/${userId}/features`
    });

    res.json({ success: true, data: features });
  } catch (error) {
    logger.error('Failed to get user features', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/features`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/features/:featureName
 * Set a feature override for a user
 */
router.put('/:userId/features/:featureName', requireAdmin, async (req, res) => {
  try {
    const service = getFeatureService(req);
    const audit = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId, featureName } = req.params;
    const { enabled } = req.body;

    // Validate feature name
    const validFeatures = Object.values(FeatureFlagService.FEATURE_FLAGS);
    if (!validFeatures.includes(featureName)) {
      return res.status(400).json({ 
        error: `Invalid feature. Must be one of: ${validFeatures.join(', ')}` 
      });
    }

    // Validate enabled
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    // Get current value for audit
    const currentEnabled = await service.isFeatureEnabled(userId, featureName);

    const override = await service.setFeatureOverride(
      userId, 
      featureName, 
      enabled, 
      req.session.userId
    );

    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.FEATURE_OVERRIDE_SET,
        userId,
        { 
          featureName, 
          newValue: enabled, 
          previousValue: currentEnabled 
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Feature override set', {
      adminId: req.session.userId,
      targetUserId: userId,
      featureName,
      enabled,
      endpoint: `/api/admin/users/${userId}/features/${featureName}`
    });

    res.json({ success: true, data: override });
  } catch (error) {
    logger.error('Failed to set feature override', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      featureName: req.params.featureName,
      endpoint: `/api/admin/users/${req.params.userId}/features/${req.params.featureName}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:userId/features/:featureName/override
 * Remove a feature override
 */
router.delete('/:userId/features/:featureName/override', requireAdmin, async (req, res) => {
  try {
    const service = getFeatureService(req);
    const audit = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId, featureName } = req.params;

    // Validate feature name
    const validFeatures = Object.values(FeatureFlagService.FEATURE_FLAGS);
    if (!validFeatures.includes(featureName)) {
      return res.status(400).json({ 
        error: `Invalid feature. Must be one of: ${validFeatures.join(', ')}` 
      });
    }

    await service.removeFeatureOverride(userId, featureName, req.session.userId);

    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.FEATURE_OVERRIDE_REMOVED,
        userId,
        { featureName },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Feature override removed', {
      adminId: req.session.userId,
      targetUserId: userId,
      featureName,
      endpoint: `/api/admin/users/${userId}/features/${featureName}/override`
    });

    res.json({ success: true, message: 'Feature override removed' });
  } catch (error) {
    logger.error('Failed to remove feature override', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      featureName: req.params.featureName,
      endpoint: `/api/admin/users/${req.params.userId}/features/${req.params.featureName}/override`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/features/:featureName
 * Check if a specific feature is enabled for a user
 */
router.get('/:userId/features/:featureName', requireAdmin, async (req, res) => {
  try {
    const service = getFeatureService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId, featureName } = req.params;

    // Validate feature name
    const validFeatures = Object.values(FeatureFlagService.FEATURE_FLAGS);
    if (!validFeatures.includes(featureName)) {
      return res.status(400).json({ 
        error: `Invalid feature. Must be one of: ${validFeatures.join(', ')}` 
      });
    }

    const enabled = await service.isFeatureEnabled(userId, featureName);
    const features = await service.getUserFeatures(userId);
    const feature = features.find(f => f.featureName === featureName);

    res.json({ 
      success: true, 
      data: {
        featureName,
        enabled,
        source: feature?.source || 'plan'
      }
    });
  } catch (error) {
    logger.error('Failed to check feature', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      featureName: req.params.featureName,
      endpoint: `/api/admin/users/${req.params.userId}/features/${req.params.featureName}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
