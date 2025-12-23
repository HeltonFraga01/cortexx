/**
 * Admin Tenant API Settings Routes
 * 
 * Endpoints for managing tenant-specific WUZAPI configuration.
 * Each tenant can configure their own WUZAPI URL and admin token.
 * 
 * Requirements: 1.1, 1.2, 1.5, 4.4 (Tenant Webhook Configuration)
 */

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const TenantSettingsService = require('../services/TenantSettingsService');
const { z } = require('zod');

// Validation schemas
const wuzapiConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  adminToken: z.string().min(1).optional(),
  timeout: z.number().int().min(1000).max(120000).optional(),
  webhookBaseUrl: z.string().url().optional()
});

const testConnectionSchema = z.object({
  baseUrl: z.string().url(),
  adminToken: z.string().min(1)
});

/**
 * Helper to get tenant ID from request context
 */
function getTenantId(req) {
  return req.context?.tenantId || req.session?.tenantId || null;
}

/**
 * GET /api/admin/tenant/api-settings
 * Get current tenant WUZAPI configuration
 * Requirements: 1.1
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(403).json({ 
        error: 'Contexto de tenant não encontrado',
        code: 'TENANT_CONTEXT_REQUIRED'
      });
    }

    const config = await TenantSettingsService.getWuzapiConfig(tenantId);
    
    // Don't expose the actual token, just indicate if it's configured
    res.json({
      success: true,
      data: {
        baseUrl: config.baseUrl || '',
        hasAdminToken: !!config.adminToken,
        timeout: config.timeout,
        webhookBaseUrl: config.webhookBaseUrl || '',
        isConfigured: config.isConfigured,
        source: config.source
      }
    });
  } catch (error) {
    logger.error('Failed to get tenant API settings', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/tenant/api-settings'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/tenant/api-settings
 * Update tenant WUZAPI configuration
 * Requirements: 1.2, 1.3
 */
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(403).json({ 
        error: 'Contexto de tenant não encontrado',
        code: 'TENANT_CONTEXT_REQUIRED'
      });
    }

    // Validate input
    const validation = wuzapiConfigSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validation.error.errors
      });
    }

    const { baseUrl, adminToken, timeout, webhookBaseUrl } = validation.data;

    // Save configuration
    const result = await TenantSettingsService.saveWuzapiConfig(tenantId, {
      baseUrl,
      adminToken,
      timeout,
      webhookBaseUrl
    }, req.user?.id || req.session?.userId);

    logger.info('Tenant API settings updated', {
      tenantId,
      adminId: req.user?.id || req.session?.userId,
      hasBaseUrl: !!baseUrl,
      hasToken: !!adminToken,
      hasWebhookBaseUrl: !!webhookBaseUrl
    });

    res.json({
      success: true,
      data: {
        baseUrl: result.baseUrl || '',
        hasAdminToken: result.isConfigured,
        timeout: result.timeout,
        webhookBaseUrl: result.webhookBaseUrl || '',
        isConfigured: result.isConfigured,
        updatedAt: result.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to update tenant API settings', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/tenant/api-settings'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/tenant/api-settings/test
 * Test connection to WUZAPI with provided or saved credentials
 * Requirements: 1.5
 */
router.post('/test', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(403).json({ 
        error: 'Contexto de tenant não encontrado',
        code: 'TENANT_CONTEXT_REQUIRED'
      });
    }

    let baseUrl, adminToken;

    // If credentials provided in body, use them; otherwise use saved config
    if (req.body.baseUrl && req.body.adminToken) {
      const validation = testConnectionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: validation.error.errors
        });
      }
      baseUrl = validation.data.baseUrl;
      adminToken = validation.data.adminToken;
    } else {
      // Use saved configuration
      const config = await TenantSettingsService.getWuzapiConfig(tenantId);
      baseUrl = config.baseUrl;
      adminToken = config.adminToken;
    }

    if (!baseUrl || !adminToken) {
      return res.status(400).json({
        error: 'Configuração WUZAPI não encontrada. Configure a URL base e o token de admin.',
        code: 'CONFIG_NOT_FOUND'
      });
    }

    const result = await TenantSettingsService.testWuzapiConnection(baseUrl, adminToken);

    logger.info('Tenant API connection test', {
      tenantId,
      adminId: req.user?.id || req.session?.userId,
      success: result.success,
      responseTime: result.responseTime
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to test tenant API connection', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/tenant/api-settings/test'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/tenant/api-settings
 * Clear tenant WUZAPI configuration (reverts to env fallback)
 */
router.delete('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(403).json({ 
        error: 'Contexto de tenant não encontrado',
        code: 'TENANT_CONTEXT_REQUIRED'
      });
    }

    // Clear by saving empty values
    await TenantSettingsService.saveWuzapiConfig(tenantId, {
      baseUrl: null,
      adminToken: null,
      timeout: null,
      webhookBaseUrl: null
    }, req.user?.id || req.session?.userId);

    logger.info('Tenant API settings cleared', {
      tenantId,
      adminId: req.user?.id || req.session?.userId
    });

    // Get the fallback config
    const config = await TenantSettingsService.getWuzapiConfig(tenantId);

    res.json({
      success: true,
      message: 'Configuração removida. Usando valores padrão do ambiente.',
      data: {
        baseUrl: config.baseUrl || '',
        hasAdminToken: !!config.adminToken,
        timeout: config.timeout,
        webhookBaseUrl: config.webhookBaseUrl || '',
        isConfigured: config.isConfigured,
        source: config.source
      }
    });
  } catch (error) {
    logger.error('Failed to clear tenant API settings', {
      error: error.message,
      tenantId: getTenantId(req),
      endpoint: '/api/admin/tenant/api-settings'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
