/**
 * Tenant Branding Routes
 * 
 * Handles tenant branding configuration for tenant admins.
 * Requirements: 5.3
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const TenantService = require('../services/TenantService');
const { requireTenantAdmin } = require('../middleware/tenantAuth');

// Initialize service
const tenantService = new TenantService();

/**
 * GET /api/tenant/branding
 * Get current tenant branding configuration
 * Requirements: 5.3 - Get tenant branding
 */
router.get('/branding', requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.context.tenantId;

    const branding = await tenantService.getBranding(tenantId);

    logger.info('Tenant branding retrieved', {
      tenantId,
      userId: req.session.userId,
      role: req.session.role
    });

    res.json({
      success: true,
      data: branding
    });
  } catch (error) {
    logger.error('Failed to get tenant branding', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/tenant/branding
 * Update tenant branding configuration
 * Requirements: 5.3 - Update tenant branding
 */
router.put('/branding', requireTenantAdmin, async (req, res) => {
  try {
    const tenantId = req.context.tenantId;
    const {
      app_name,
      logo_url,
      primary_color,
      secondary_color,
      primary_foreground,
      secondary_foreground,
      custom_home_html,
      support_phone,
      og_image_url
    } = req.body;

    // Validate required fields if provided
    const updates = {};
    
    if (app_name !== undefined) {
      if (typeof app_name !== 'string' || app_name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'App name must be a non-empty string'
        });
      }
      updates.app_name = app_name.trim();
    }

    if (logo_url !== undefined) {
      if (logo_url !== null && (typeof logo_url !== 'string' || !isValidUrl(logo_url))) {
        return res.status(400).json({
          success: false,
          error: 'Logo URL must be a valid URL or null'
        });
      }
      updates.logo_url = logo_url;
    }

    if (primary_color !== undefined) {
      if (!isValidHexColor(primary_color)) {
        return res.status(400).json({
          success: false,
          error: 'Primary color must be a valid hex color'
        });
      }
      updates.primary_color = primary_color;
    }

    if (secondary_color !== undefined) {
      if (!isValidHexColor(secondary_color)) {
        return res.status(400).json({
          success: false,
          error: 'Secondary color must be a valid hex color'
        });
      }
      updates.secondary_color = secondary_color;
    }

    if (primary_foreground !== undefined) {
      if (!isValidHexColor(primary_foreground)) {
        return res.status(400).json({
          success: false,
          error: 'Primary foreground must be a valid hex color'
        });
      }
      updates.primary_foreground = primary_foreground;
    }

    if (secondary_foreground !== undefined) {
      if (!isValidHexColor(secondary_foreground)) {
        return res.status(400).json({
          success: false,
          error: 'Secondary foreground must be a valid hex color'
        });
      }
      updates.secondary_foreground = secondary_foreground;
    }

    if (custom_home_html !== undefined) {
      if (custom_home_html !== null && typeof custom_home_html !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Custom home HTML must be a string or null'
        });
      }
      updates.custom_home_html = custom_home_html;
    }

    if (support_phone !== undefined) {
      if (support_phone !== null && (typeof support_phone !== 'string' || support_phone.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Support phone must be a non-empty string or null'
        });
      }
      updates.support_phone = support_phone?.trim() || null;
    }

    if (og_image_url !== undefined) {
      if (og_image_url !== null && (typeof og_image_url !== 'string' || !isValidUrl(og_image_url))) {
        return res.status(400).json({
          success: false,
          error: 'OG image URL must be a valid URL or null'
        });
      }
      updates.og_image_url = og_image_url;
    }

    // Check if there are any updates to apply
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid branding fields provided for update'
      });
    }

    // Update branding
    const updatedBranding = await tenantService.updateBranding(tenantId, updates);

    logger.info('Tenant branding updated', {
      tenantId,
      userId: req.session.userId,
      role: req.session.role,
      updatedFields: Object.keys(updates),
      isImpersonated: req.session.role === 'tenant_admin_impersonated'
    });

    res.json({
      success: true,
      data: updatedBranding,
      message: 'Branding updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update tenant branding', {
      error: error.message,
      tenantId: req.context?.tenantId,
      userId: req.session?.userId,
      updatedFields: Object.keys(req.body || {})
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Helper function to validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper function to validate hex color format
 * @param {string} color - Color to validate
 * @returns {boolean} True if valid hex color
 */
function isValidHexColor(color) {
  if (typeof color !== 'string') return false;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

module.exports = router;