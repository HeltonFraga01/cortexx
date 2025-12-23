/**
 * Admin User Feature Routes
 * 
 * Endpoints for managing user feature flags.
 * All routes require admin authentication.
 * 
 * MULTI-TENANT ISOLATION: All operations validate that the target user
 * belongs to the admin's tenant before executing.
 * 
 * Requirements: 4.2, 4.4
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const FeatureFlagService = require('../services/FeatureFlagService');
const AdminAuditService = require('../services/AdminAuditService');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

// Services initialized at module level (use SupabaseService internally)
const featureService = new FeatureFlagService();
const auditService = new AdminAuditService();

/**
 * Validate that a user belongs to the specified tenant
 * @param {string} userId - User ID to validate
 * @param {string} tenantId - Tenant ID to check against
 * @returns {Promise<{valid: boolean, account: object|null}>}
 */
async function validateUserTenant(userId, tenantId) {
  if (!userId || !tenantId) {
    return { valid: false, account: null };
  }

  try {
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`owner_user_id.eq.${userId},wuzapi_token.eq.${userId}`)
      .limit(1);

    if (error) {
      logger.error('Failed to validate user tenant', { error: error.message, userId, tenantId });
      return { valid: false, account: null };
    }

    if (!accounts || accounts.length === 0) {
      return { valid: false, account: null };
    }

    return { valid: true, account: accounts[0] };
  } catch (error) {
    logger.error('Error in validateUserTenant', { error: error.message, userId, tenantId });
    return { valid: false, account: null };
  }
}

/**
 * GET /api/admin/users/features
 * List all available features
 * Note: This route is mounted at /api/admin/users, so the full path is /api/admin/users/features
 */
router.get('/features', requireAdmin, async (req, res) => {
  try {
    const service = featureService;
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
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.get('/:userId/features', requireAdmin, async (req, res) => {
  try {
    const service = featureService;
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant feature access blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/users/${userId}/features`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    const features = await service.getUserFeatures(userId);

    logger.info('User features retrieved', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      endpoint: `/api/admin/users/${userId}/features`
    });

    res.json({ success: true, data: features });
  } catch (error) {
    logger.error('Failed to get user features', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/features`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/features/:featureName
 * Set a feature override for a user
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.put('/:userId/features/:featureName', requireAdmin, async (req, res) => {
  try {
    const service = featureService;
    const audit = auditService;
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId, featureName } = req.params;
    const { enabled } = req.body;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant feature override blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        featureName,
        endpoint: `/api/admin/users/${userId}/features/${featureName}`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

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
          previousValue: currentEnabled,
          tenantId,
          accountId: account.id
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Feature override set', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      featureName,
      enabled,
      endpoint: `/api/admin/users/${userId}/features/${featureName}`
    });

    res.json({ success: true, data: override });
  } catch (error) {
    logger.error('Failed to set feature override', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
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
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.delete('/:userId/features/:featureName/override', requireAdmin, async (req, res) => {
  try {
    const service = featureService;
    const audit = auditService;
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId, featureName } = req.params;

    // CRITICAL: Validate user belongs to this tenant
    const { valid, account } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant feature override removal blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        featureName,
        endpoint: `/api/admin/users/${userId}/features/${featureName}/override`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

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
        { featureName, tenantId, accountId: account.id },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Feature override removed', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      accountId: account.id,
      featureName,
      endpoint: `/api/admin/users/${userId}/features/${featureName}/override`
    });

    res.json({ success: true, message: 'Feature override removed' });
  } catch (error) {
    logger.error('Failed to remove feature override', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
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
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.get('/:userId/features/:featureName', requireAdmin, async (req, res) => {
  try {
    const service = featureService;
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId, featureName } = req.params;

    // CRITICAL: Validate user belongs to this tenant
    const { valid } = await validateUserTenant(userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant feature check blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        featureName,
        endpoint: `/api/admin/users/${userId}/features/${featureName}`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

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
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      featureName: req.params.featureName,
      endpoint: `/api/admin/users/${req.params.userId}/features/${req.params.featureName}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
