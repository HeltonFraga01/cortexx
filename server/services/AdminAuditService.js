/**
 * AdminAuditService - Service for managing admin audit logs
 * 
 * Handles logging, querying, and exporting administrative actions.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

const ACTION_TYPES = {
  PLAN_CREATED: 'plan_created',
  PLAN_UPDATED: 'plan_updated',
  PLAN_DELETED: 'plan_deleted',
  USER_PLAN_ASSIGNED: 'user_plan_assigned',
  USER_SUSPENDED: 'user_suspended',
  USER_REACTIVATED: 'user_reactivated',
  USER_DELETED: 'user_deleted',
  USER_PASSWORD_RESET: 'user_password_reset',
  QUOTA_OVERRIDE_SET: 'quota_override_set',
  QUOTA_OVERRIDE_REMOVED: 'quota_override_removed',
  FEATURE_OVERRIDE_SET: 'feature_override_set',
  FEATURE_OVERRIDE_REMOVED: 'feature_override_removed',
  BULK_ACTION_EXECUTED: 'bulk_action_executed',
  USER_IMPERSONATED: 'user_impersonated',
  SETTING_CHANGED: 'setting_changed',
  USER_DATA_EXPORTED: 'user_data_exported',
  NOTIFICATION_SENT: 'notification_sent'
};

class AdminAuditService {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomUUID();
  }

  async logAction(adminId, actionType, targetUserId = null, details = {}, ipAddress = null, userAgent = null) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      await this.db.query(
        `INSERT INTO admin_audit_log (id, admin_id, action_type, target_user_id, target_resource_type, target_resource_id, details, ip_address, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, adminId, actionType, targetUserId, details.resourceType || null, details.resourceId || null, JSON.stringify(details), ipAddress, userAgent, now]
      );

      logger.info('Admin action logged', { adminId, actionType, targetUserId });

      return { id, adminId, actionType, targetUserId, details, ipAddress, createdAt: now };
    } catch (error) {
      logger.error('Failed to log admin action', { error: error.message, adminId, actionType });
      throw error;
    }
  }


  async listAuditLogs(filters = {}, pagination = {}) {
    try {
      const { adminId, targetUserId, actionType, startDate, endDate } = filters;
      const { page = 1, pageSize = 50 } = pagination;
      const offset = (page - 1) * pageSize;

      let sql = 'SELECT * FROM admin_audit_log WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM admin_audit_log WHERE 1=1';
      const params = [];
      const countParams = [];

      if (adminId) {
        sql += ' AND admin_id = ?';
        countSql += ' AND admin_id = ?';
        params.push(adminId);
        countParams.push(adminId);
      }

      if (targetUserId) {
        sql += ' AND target_user_id = ?';
        countSql += ' AND target_user_id = ?';
        params.push(targetUserId);
        countParams.push(targetUserId);
      }

      if (actionType) {
        sql += ' AND action_type = ?';
        countSql += ' AND action_type = ?';
        params.push(actionType);
        countParams.push(actionType);
      }

      if (startDate) {
        sql += ' AND created_at >= ?';
        countSql += ' AND created_at >= ?';
        params.push(startDate);
        countParams.push(startDate);
      }

      if (endDate) {
        sql += ' AND created_at <= ?';
        countSql += ' AND created_at <= ?';
        params.push(endDate);
        countParams.push(endDate);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(pageSize, offset);

      const { rows: logsRows } = await this.db.query(sql, params);
      const { rows: countRows } = await this.db.query(countSql, countParams);

      return {
        logs: (logsRows || []).map(this.formatLog),
        total: countRows?.[0]?.total || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to list audit logs', { error: error.message, filters });
      throw error;
    }
  }

  async exportAuditLogs(filters = {}, format = 'json') {
    try {
      const { logs } = await this.listAuditLogs(filters, { page: 1, pageSize: 10000 });

      if (format === 'csv') {
        return this.toCSV(logs);
      }

      return JSON.stringify(logs, null, 2);
    } catch (error) {
      logger.error('Failed to export audit logs', { error: error.message, format });
      throw error;
    }
  }

  async getAdminActions(adminId, dateRange = {}) {
    try {
      const { logs } = await this.listAuditLogs({
        adminId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }, { page: 1, pageSize: 1000 });

      return logs;
    } catch (error) {
      logger.error('Failed to get admin actions', { error: error.message, adminId });
      throw error;
    }
  }

  async getUserAuditHistory(userId) {
    try {
      const { logs } = await this.listAuditLogs({
        targetUserId: userId
      }, { page: 1, pageSize: 1000 });

      return logs;
    } catch (error) {
      logger.error('Failed to get user audit history', { error: error.message, userId });
      throw error;
    }
  }

  formatLog(row) {
    return {
      id: row.id,
      adminId: row.admin_id,
      actionType: row.action_type,
      targetUserId: row.target_user_id,
      targetResourceType: row.target_resource_type,
      targetResourceId: row.target_resource_id,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details || {},
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    };
  }

  toCSV(logs) {
    const headers = ['id', 'adminId', 'actionType', 'targetUserId', 'details', 'ipAddress', 'createdAt'];
    const rows = logs.map(log => [
      log.id,
      log.adminId,
      log.actionType,
      log.targetUserId || '',
      JSON.stringify(log.details),
      log.ipAddress || '',
      log.createdAt
    ]);

    return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  }
}

AdminAuditService.ACTION_TYPES = ACTION_TYPES;

module.exports = AdminAuditService;
