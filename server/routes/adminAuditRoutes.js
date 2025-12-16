/**
 * Admin Audit Routes
 * 
 * Endpoints for viewing and exporting audit logs.
 * All routes require admin authentication.
 * 
 * Requirements: 9.2, 9.3
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const AdminAuditService = require('../services/AdminAuditService');

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
 * GET /api/admin/audit
 * List audit logs with filters and pagination
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { adminId, targetUserId, actionType, startDate, endDate, page = 1, pageSize = 50 } = req.query;

    const filters = {};
    if (adminId) filters.adminId = adminId;
    if (targetUserId) filters.targetUserId = targetUserId;
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const pagination = {
      page: parseInt(page),
      pageSize: Math.min(parseInt(pageSize), 100) // Max 100 per page
    };

    const result = await service.listAuditLogs(filters, pagination);

    logger.info('Audit logs retrieved', {
      adminId: req.session.userId,
      filters,
      resultCount: result.logs.length,
      totalCount: result.total,
      endpoint: '/api/admin/audit'
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to list audit logs', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/audit'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit/export
 * Export audit logs
 */
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { adminId, targetUserId, actionType, startDate, endDate, format = 'json' } = req.query;

    const filters = {};
    if (adminId) filters.adminId = adminId;
    if (targetUserId) filters.targetUserId = targetUserId;
    if (actionType) filters.actionType = actionType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const exportData = await service.exportAuditLogs(filters, format);

    logger.info('Audit logs exported', {
      adminId: req.session.userId,
      filters,
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
 */
router.get('/admin/:adminId', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { adminId } = req.params;
    const { startDate, endDate } = req.query;

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const logs = await service.getAdminActions(adminId, dateRange);

    logger.info('Admin actions retrieved', {
      requestingAdminId: req.session.userId,
      targetAdminId: adminId,
      resultCount: logs.length,
      endpoint: `/api/admin/audit/admin/${adminId}`
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Failed to get admin actions', {
      error: error.message,
      adminId: req.session.userId,
      targetAdminId: req.params.adminId,
      endpoint: `/api/admin/audit/admin/${req.params.adminId}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/audit/user/:userId
 * Get audit history for a specific user
 */
router.get('/user/:userId', requireAdmin, async (req, res) => {
  try {
    const service = getAuditService(req);
    if (!service) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { userId } = req.params;

    const logs = await service.getUserAuditHistory(userId);

    logger.info('User audit history retrieved', {
      adminId: req.session.userId,
      targetUserId: userId,
      resultCount: logs.length,
      endpoint: `/api/admin/audit/user/${userId}`
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Failed to get user audit history', {
      error: error.message,
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/audit/user/${req.params.userId}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
