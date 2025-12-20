/**
 * Superadmin Impersonation Routes
 * 
 * Handles tenant impersonation for superadmins.
 * Requirements: 4.1, 4.2, 4.3
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { requireSuperadmin, auditSuperadminAction } = require('../middleware/superadminAuth');

// Use singleton service instance
const superadminService = SuperadminService;

/**
 * POST /api/superadmin/impersonate/:tenantId
 * Start impersonating a tenant
 * Requirements: 4.1, 4.2 - Start impersonation with audit logging
 */
router.post('/impersonate/:tenantId', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { reason } = req.body;
    const superadminId = req.session.userId;

    // Validate tenant exists and is active
    const tenant = await superadminService.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    if (tenant.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Cannot impersonate inactive tenant'
      });
    }

    // Start impersonation
    const impersonationResult = await superadminService.impersonateTenant(
      superadminId, 
      tenantId, 
      req.ip
    );

    // Store impersonation context in session
    req.session.impersonation = {
      tenantId: tenantId,
      tenantSubdomain: tenant.subdomain,
      tenantName: tenant.name,
      sessionId: impersonationResult.sessionId,
      startedAt: new Date().toISOString(),
      reason
    };

    // Set tenant context for subsequent requests
    req.session.tenantContext = {
      tenantId: tenantId,
      role: 'tenant_admin' // Impersonating as tenant admin
    };

    logger.warn('Superadmin started tenant impersonation', {
      superadminId,
      tenantId,
      tenantSubdomain: tenant.subdomain,
      reason,
      sessionId: impersonationResult.sessionId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        impersonation: {
          tenantId: tenantId,
          tenantSubdomain: tenant.subdomain,
          tenantName: tenant.name,
          sessionId: impersonationResult.sessionId,
          startedAt: req.session.impersonation.startedAt
        },
        tenant: {
          id: tenant.id,
          subdomain: tenant.subdomain,
          name: tenant.name,
          status: tenant.status
        }
      },
      message: `Now impersonating tenant: ${tenant.name}`
    });
  } catch (error) {
    logger.error('Failed to start tenant impersonation', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.tenantId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/end-impersonation
 * End current impersonation session
 * Requirements: 4.3 - End impersonation with audit logging
 */
router.post('/end-impersonation', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const superadminId = req.session.userId;
    const impersonation = req.session.impersonation;

    if (!impersonation) {
      return res.status(400).json({
        success: false,
        error: 'No active impersonation session'
      });
    }

    // End impersonation
    await superadminService.endImpersonation(impersonation.sessionId, {
      endedBy: superadminId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Calculate session duration
    const startedAt = new Date(impersonation.startedAt);
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - startedAt.getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    logger.warn('Superadmin ended tenant impersonation', {
      superadminId,
      tenantId: impersonation.tenantId,
      tenantSubdomain: impersonation.tenantSubdomain,
      sessionId: impersonation.sessionId,
      durationMinutes,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Clear impersonation context from session
    delete req.session.impersonation;
    delete req.session.tenantContext;

    res.json({
      success: true,
      data: {
        endedImpersonation: {
          tenantId: impersonation.tenantId,
          tenantSubdomain: impersonation.tenantSubdomain,
          tenantName: impersonation.tenantName,
          durationMinutes
        }
      },
      message: 'Impersonation ended successfully'
    });
  } catch (error) {
    logger.error('Failed to end tenant impersonation', {
      error: error.message,
      superadminId: req.session?.userId,
      impersonationSessionId: req.session?.impersonation?.sessionId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/impersonation/status
 * Get current impersonation status
 * Requirements: 4.3 - Check impersonation status
 */
router.get('/impersonation/status', requireSuperadmin, async (req, res) => {
  try {
    const impersonation = req.session.impersonation;

    if (!impersonation) {
      return res.json({
        success: true,
        data: {
          isImpersonating: false,
          impersonation: null
        }
      });
    }

    // Calculate session duration
    const startedAt = new Date(impersonation.startedAt);
    const now = new Date();
    const durationMs = now.getTime() - startedAt.getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    res.json({
      success: true,
      data: {
        isImpersonating: true,
        impersonation: {
          tenantId: impersonation.tenantId,
          tenantSubdomain: impersonation.tenantSubdomain,
          tenantName: impersonation.tenantName,
          sessionId: impersonation.sessionId,
          startedAt: impersonation.startedAt,
          durationMinutes,
          reason: impersonation.reason
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get impersonation status', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/impersonation/history
 * Get impersonation history for audit purposes
 * Requirements: 4.2 - Audit trail for impersonation
 */
router.get('/impersonation/history', requireSuperadmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      tenantId, 
      superadminId: filterSuperadminId,
      startDate,
      endDate 
    } = req.query;

    const filters = {};
    if (tenantId) filters.tenantId = tenantId;
    if (filterSuperadminId) filters.superadminId = filterSuperadminId;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const history = await superadminService.getImpersonationHistory({
      page: parseInt(page),
      limit: parseInt(limit),
      filters
    });

    logger.info('Impersonation history retrieved by superadmin', {
      superadminId: req.session.userId,
      page,
      limit,
      filters,
      totalRecords: history.total
    });

    res.json({
      success: true,
      data: history.records,
      pagination: {
        page: history.page,
        limit: history.limit,
        total: history.total,
        totalPages: history.totalPages
      }
    });
  } catch (error) {
    logger.error('Failed to get impersonation history', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;