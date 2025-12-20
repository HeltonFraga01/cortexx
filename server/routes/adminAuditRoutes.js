/**
 * Admin Audit Routes
 * 
 * Endpoints for viewing and exporting audit logs.
 * All routes require admin authentication.
 * 
 * MULTI-TENANT ISOLATION: All audit logs are filtered by the admin's
 * tenant to prevent cross-tenant data exposure.
 * 
 * Requirements: 9.2, 9.3
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const AdminAuditService = require('../services/AdminAuditService');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

let auditService = null;

function getAuditService(req) {
  if (!auditService) {
    const db = req.app.locals.db;
    if (db) auditService = new AdminAuditService(db);
  }
  return auditService;
}

/**
 * Validate that a user belongs to the specified tenant
 * @param {string} userId - User ID to validate
 * @param {string} tenantId - Tenant ID to check against
 * @returns {Promise<boolean>}
 */
async function isUserInTenant(userId, tenantId) {
  if (!userId || !tenantId) return false;

  try {
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`owner_user_id.eq.${userId},wuzapi_token.eq.${userId}`)
      .limit(1);

    return !error && accounts && accounts.length > 0;
  } catch (error) {
    logger.error('Error checking user tenant', { error: error.message, userId, tenantId });
    return false;
  }
}

/**
 * GET /api/admin/audit
 * List audit logs with filters and pagination
 * MULTI-TENANT: Only shows logs for resources within the admin's tenant
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { adminId, targetUserId, actionType, startDate, endDate, page = 1, pageSize = 50 } = req.query;

    // Build filters with tenant scope
    const filters = {
      tenantId // CRITICAL: Always filter by tenant
    };
    if (adminId) filters.adminId = adminId;
    if (targetUserId) {
      // Validate target user belongs to this tenant
      const isValid = await isUserInTenant(targetUserId, tenantId);
      if (!isValid) {
        return res.status(403).json({ error: 'Target user not found or access denied' });
      }
      filters.targetUserId = targetUserId;
    }
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const pagination = {
      page: parseInt(page),
      pageSize: Math.min(parseInt(pageSize), 100)
    };

    const result = await service.listAuditLogs(filters, pagination);

    logger.info('Audit logs retrieved', {
      adminId: req.session.userId,
      tenantId,
      filters: { ...filters, tenantId: '[filtered]' },
      resultCount: result.logs.length,
      totalCount: result.total,
      endpoint: '/api/admin/audit'
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to list audit logs', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/audit'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit/export
 * Export audit logs
 * MULTI-TENANT: Only exports logs for resources within the admin's tenant
 */
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { adminId, targetUserId, actionType, startDate, endDate, format = 'json' } = req.query;

    // Build filters with tenant scope
    const filters = {
      tenantId // CRITICAL: Always filter by tenant
    };
    if (adminId) filters.adminId = adminId;
    if (targetUserId) {
      // Validate target user belongs to this tenant
      const isValid = await isUserInTenant(targetUserId, tenantId);
      if (!isValid) {
        return res.status(403).json({ error: 'Target user not found or access denied' });
      }
      filters.targetUserId = targetUserId;
    }
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const exportData = await service.exportAuditLogs(filters, format);

    logger.info('Audit logs exported', {
      adminId: req.session.userId,
      tenantId,
      filters: { ...filters, tenantId: '[filtered]' },
      format,
      endpoint: '/api/admin/audit/export'
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.send(exportData);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
    res.send(exportData);
  } catch (error) {
    logger.error('Failed to export audit logs', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/audit/export'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit/actions
 * Get list of available action types
 */
router.get('/actions', requireAdmin, async (req, res) => {
  try {
    const actionTypes = Object.values(AdminAuditService.ACTION_TYPES);

    res.json({ success: true, data: actionTypes });
  } catch (error) {
    logger.error('Failed to get action types', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/audit/actions'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit/admin/:adminId
 * Get actions performed by a specific admin
 * MULTI-TENANT: Only shows actions within the admin's tenant
 */
router.get('/admin/:adminId', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { adminId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate the target admin belongs to this tenant
    const isValid = await isUserInTenant(adminId, tenantId);
    if (!isValid) {
      logger.warn('Cross-tenant admin audit access blocked', {
        tenantId,
        requestingAdminId: req.session.userId,
        targetAdminId: adminId,
        endpoint: `/api/admin/audit/admin/${adminId}`
      });
      return res.status(403).json({ error: 'Admin not found or access denied' });
    }

    const dateRange = { tenantId };
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const logs = await service.getAdminActions(adminId, dateRange);

    logger.info('Admin actions retrieved', {
      requestingAdminId: req.session.userId,
      tenantId,
      targetAdminId: adminId,
      resultCount: logs.length,
      endpoint: `/api/admin/audit/admin/${adminId}`
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Failed to get admin actions', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetAdminId: req.params.adminId,
      endpoint: `/api/admin/audit/admin/${req.params.adminId}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit/user/:userId
 * Get audit history for a specific user
 * MULTI-TENANT: Validates user belongs to admin's tenant
 */
router.get('/user/:userId', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userId } = req.params;

    // CRITICAL: Validate user belongs to this tenant
    const isValid = await isUserInTenant(userId, tenantId);
    if (!isValid) {
      logger.warn('Cross-tenant user audit access blocked', {
        tenantId,
        adminId: req.session.userId,
        targetUserId: userId,
        endpoint: `/api/admin/audit/user/${userId}`
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    const logs = await service.getUserAuditHistory(userId, tenantId);

    logger.info('User audit history retrieved', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      resultCount: logs.length,
      endpoint: `/api/admin/audit/user/${userId}`
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Failed to get user audit history', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/audit/user/${req.params.userId}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
