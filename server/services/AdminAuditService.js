/**
 * AdminAuditService - Service for managing admin audit logs
 * 
 * Handles logging, querying, and exporting administrative actions.
 * Migrated to use SupabaseService directly.
 * 
 * Requirements: 9.1, 9.2, 9.3
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const SupabaseService = require('./SupabaseService');

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
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  generateId() {
    return crypto.randomUUID();
  }

  async logAction(adminId, actionType, targetUserId = null, details = {}, ipAddress = null, userAgent = null) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      // Map to actual database column names
      const { error } = await SupabaseService.insert('admin_audit_log', {
        id,
        admin_user_id: adminId,
        action: actionType,
        resource_type: details.resourceType || 'user',
        resource_id: targetUserId || details.resourceId || null,
        details: { ...details, targetUserId },
        ip_address: ipAddress,
        created_at: now
      });

      if (error) {
        throw error;
      }

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

      // Build query using Supabase query builder with correct column names
      const queryFn = (query) => {
        let q = query.select('*');

        if (adminId) {
          q = q.eq('admin_user_id', adminId);
        }

        if (targetUserId) {
          q = q.eq('resource_id', targetUserId);
        }

        if (actionType) {
          q = q.eq('action', actionType);
        }

        if (startDate) {
          q = q.gte('created_at', startDate);
        }

        if (endDate) {
          q = q.lte('created_at', endDate);
        }

        q = q.order('created_at', { ascending: false });
        q = q.range(offset, offset + pageSize - 1);

        return q;
      };

      // Count query
      const countQueryFn = (query) => {
        let q = query.select('*', { count: 'exact', head: true });

        if (adminId) {
          q = q.eq('admin_user_id', adminId);
        }

        if (targetUserId) {
          q = q.eq('resource_id', targetUserId);
        }

        if (actionType) {
          q = q.eq('action', actionType);
        }

        if (startDate) {
          q = q.gte('created_at', startDate);
        }

        if (endDate) {
          q = q.lte('created_at', endDate);
        }

        return q;
      };

      const [logsResult, countResult] = await Promise.all([
        SupabaseService.queryAsAdmin('admin_audit_log', queryFn),
        SupabaseService.queryAsAdmin('admin_audit_log', countQueryFn)
      ]);

      if (logsResult.error) {
        throw logsResult.error;
      }

      return {
        logs: (logsResult.data || []).map(this.formatLog),
        total: countResult.count || 0,
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
    const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details || {};
    return {
      id: row.id,
      adminId: row.admin_user_id,
      actionType: row.action,
      targetUserId: details.targetUserId || row.resource_id,
      targetResourceType: row.resource_type,
      targetResourceId: row.resource_id,
      details: details,
      ipAddress: row.ip_address,
      userAgent: null, // Column doesn't exist in current schema
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
