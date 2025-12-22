/**
 * Public Routes
 * 
 * Handles public endpoints that don't require authentication.
 * Includes subdomain resolution for multi-tenant architecture.
 * Requirements: 8.1
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const tenantService = require('../services/TenantService');

/**
 * GET /api/public/branding
 * Get tenant branding for landing page based on subdomain
 * Requirements: 8.1 - Return tenant branding for landing page
 */
router.get('/branding', async (req, res) => {
  const startTime = Date.now();
  
  try {
    let tenant = null;
    let branding = null;

    // Extract subdomain from request
    const hostname = req.get('host') || req.hostname;
    const subdomain = extractSubdomain(hostname);

    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      // Try to get tenant by subdomain
      try {
        tenant = await tenantService.getBySubdomain(subdomain);
        
        if (tenant && tenant.status === 'active') {
          // Get tenant-specific branding
          branding = await tenantService.getBranding(tenant.id);
        }
      } catch (error) {
        logger.warn('Failed to resolve tenant by subdomain', {
          subdomain,
          hostname,
          error: error.message
        });
      }
    }

    // If no tenant found or tenant is inactive, use default branding
    if (!branding) {
      branding = {
        app_name: 'WUZAPI Manager',
        logo_url: null,
        primary_color: '#0ea5e9',
        secondary_color: '#64748b',
        primary_foreground: '#ffffff',
        secondary_foreground: '#ffffff',
        custom_home_html: null,
        support_phone: null,
        og_image_url: null
      };
    }

    // Return only public data (no sensitive information)
    const publicBrandingData = {
      appName: branding.app_name,
      logoUrl: branding.logo_url,
      primaryColor: branding.primary_color,
      secondaryColor: branding.secondary_color,
      primaryForeground: branding.primary_foreground,
      secondaryForeground: branding.secondary_foreground,
      customHomeHtml: branding.custom_home_html,
      supportPhone: branding.support_phone,
      ogImageUrl: branding.og_image_url,
      tenant: tenant ? {
        subdomain: tenant.subdomain,
        name: tenant.name
      } : null
    };

    const responseTime = Date.now() - startTime;

    logger.info('Public branding configuration retrieved', {
      url: req.url,
      method: req.method,
      responseTimeMs: responseTime,
      subdomain,
      hostname,
      tenantId: tenant?.id,
      tenantName: tenant?.name,
      appName: publicBrandingData.appName,
      hasCustomHtml: !!publicBrandingData.customHomeHtml,
      hasSupportPhone: !!publicBrandingData.supportPhone,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Configure cache for better performance
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes

    return res.status(200).json({
      success: true,
      data: publicBrandingData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Internal error in public branding route', {
      url: req.url,
      method: req.method,
      responseTimeMs: responseTime,
      error: error.message,
      stack: error.stack,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/public/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * GET /api/public/tenant-info
 * Get basic tenant information by subdomain
 * Requirements: 8.1 - Subdomain resolution
 */
router.get('/tenant-info', async (req, res) => {
  try {
    const hostname = req.get('host') || req.hostname;
    const subdomain = extractSubdomain(hostname);

    if (!subdomain || subdomain === 'www' || subdomain === 'api') {
      return res.json({
        success: true,
        data: {
          tenant: null,
          subdomain: null,
          isMultiTenant: false
        }
      });
    }

    let tenant = null;
    try {
      tenant = await tenantService.getBySubdomain(subdomain);
    } catch (error) {
      logger.warn('Failed to resolve tenant info by subdomain', {
        subdomain,
        hostname,
        error: error.message
      });
    }

    if (!tenant || tenant.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found or inactive',
        data: {
          subdomain,
          tenant: null,
          isMultiTenant: true
        }
      });
    }

    // Return only public tenant information
    const publicTenantInfo = {
      subdomain: tenant.subdomain,
      name: tenant.name,
      status: tenant.status
    };

    logger.info('Tenant info retrieved', {
      subdomain,
      tenantId: tenant.id,
      tenantName: tenant.name,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        tenant: publicTenantInfo,
        subdomain,
        isMultiTenant: true
      }
    });
  } catch (error) {
    logger.error('Failed to get tenant info', {
      error: error.message,
      hostname: req.get('host'),
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Helper function to extract subdomain from hostname
 * @param {string} hostname - Full hostname
 * @returns {string|null} Subdomain or null
 */
function extractSubdomain(hostname) {
  if (!hostname) return null;

  // Remove port if present
  const cleanHostname = hostname.split(':')[0];
  
  // Split by dots
  const parts = cleanHostname.split('.');
  
  // Special case for localhost: subdomain.localhost
  if (parts.length === 2 && parts[1] === 'localhost') {
    const subdomain = parts[0].toLowerCase();
    // Don't treat 'localhost' itself as a subdomain
    if (subdomain !== 'localhost') {
      return subdomain;
    }
    return null;
  }
  
  // If less than 3 parts, no subdomain (e.g., localhost, example.com)
  if (parts.length < 3) return null;
  
  // Return the first part as subdomain
  return parts[0].toLowerCase();
}

module.exports = router;