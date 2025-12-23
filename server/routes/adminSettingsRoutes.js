/**
 * Admin Settings Routes
 * 
 * Endpoints for managing tenant-scoped system settings.
 * All routes require admin authentication and use tenant context.
 * 
 * Requirements: REQ-3 (Multi-Tenant Isolation Audit)
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const TenantSettingsService = require('../services/TenantSettingsService');
const AdminAuditService = require('../services/AdminAuditService');

const router = express.Router();

// Service initialized at module level (uses SupabaseService internally)
const auditService = new AdminAuditService();

/**
 * Get tenant ID from request context
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID
 */
function getTenantId(req) {
  return req.context?.tenantId || null;
}

/**
 * GET /api/admin/settings
 * Get all tenant settings
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const settings = await TenantSettingsService.getSettings(tenantId);

    logger.info('Tenant settings retrieved', {
      adminId: req.session.userId,
      tenantId,
      settingsCount: settings.length,
      endpoint: '/api/admin/settings'
    });

    res.json({ 
      success: true, 
      data: settings
    });
  } catch (error) {
    logger.error('Failed to get tenant settings', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/settings'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/settings/:key
 * Get a specific tenant setting
 */
router.get('/:key', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { key } = req.params;
    const setting = await TenantSettingsService.getSetting(tenantId, key);

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    logger.error('Failed to get tenant setting', {
      error: error.message,
      key: req.params.key,
      adminId: req.session.userId,
      tenantId: getTenantId(req),
      endpoint: `/api/admin/settings/${req.params.key}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a tenant setting
 */
router.put('/:key', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { key } = req.params;
    const { value } = req.body;
    const adminId = req.session.userId;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Get old value for audit
    const oldSetting = await TenantSettingsService.getSetting(tenantId, key);
    const oldValue = oldSetting?.value || null;

    // Update setting
    const updatedSetting = await TenantSettingsService.updateSetting(
      tenantId,
      key,
      value,
      adminId
    );

    // Log audit
    const audit = auditService;
    if (audit) {
      await audit.logAction(
        adminId,
        AdminAuditService.ACTION_TYPES.SETTING_CHANGED,
        null,
        { key, oldValue, newValue: String(value), tenantId },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Tenant setting updated', {
      adminId,
      tenantId,
      key,
      oldValue,
      newValue: value,
      endpoint: `/api/admin/settings/${key}`
    });

    res.json({
      success: true,
      data: updatedSetting,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update tenant setting', {
      error: error.message,
      key: req.params.key,
      adminId: req.session.userId,
      tenantId: getTenantId(req),
      endpoint: `/api/admin/settings/${req.params.key}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/settings
 * Update multiple tenant settings at once
 */
router.put('/', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { settings } = req.body;
    const adminId = req.session.userId;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    // Update settings
    const updatedSettings = await TenantSettingsService.updateSettings(
      tenantId,
      settings,
      adminId
    );

    // Log audit
    const audit = auditService;
    if (audit) {
      await audit.logAction(
        adminId,
        AdminAuditService.ACTION_TYPES.SETTING_CHANGED,
        null,
        { keys: Object.keys(settings), tenantId, action: 'bulk_update' },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Tenant settings bulk updated', {
      adminId,
      tenantId,
      keys: Object.keys(settings),
      endpoint: '/api/admin/settings'
    });

    res.json({
      success: true,
      data: updatedSettings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    logger.error('Failed to bulk update tenant settings', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/settings'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/settings/:key
 * Reset a tenant setting to default
 */
router.delete('/:key', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { key } = req.params;
    const adminId = req.session.userId;

    // Get old value for audit
    const oldSetting = await TenantSettingsService.getSetting(tenantId, key);
    const oldValue = oldSetting?.value || null;

    // Reset setting
    const resetSetting = await TenantSettingsService.resetSetting(tenantId, key);

    // Log audit
    const audit = auditService;
    if (audit) {
      await audit.logAction(
        adminId,
        AdminAuditService.ACTION_TYPES.SETTING_CHANGED,
        null,
        { key, oldValue, newValue: resetSetting.value, tenantId, action: 'reset_to_default' },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Tenant setting reset to default', {
      adminId,
      tenantId,
      key,
      oldValue,
      defaultValue: resetSetting.value,
      endpoint: `/api/admin/settings/${key}`
    });

    res.json({
      success: true,
      data: resetSetting,
      message: 'Setting reset to default'
    });
  } catch (error) {
    logger.error('Failed to reset tenant setting', {
      error: error.message,
      key: req.params.key,
      adminId: req.session.userId,
      tenantId: getTenantId(req),
      endpoint: `/api/admin/settings/${req.params.key}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
