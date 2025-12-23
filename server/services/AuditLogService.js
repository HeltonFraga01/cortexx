/**
 * AuditLogService - Service for managing automation audit logs
 * Migrated to use SupabaseService directly instead of raw SQL queries.
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class AuditLogService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  async logAutomation(entry) {
    const { userId, automationType, details, status, errorMessage } = entry;
    try {
      await SupabaseService.insert('automation_audit_log', {
        account_id: userId,
        automation_type: automationType,
        trigger_event: 'manual',
        action_taken: automationType,
        details: details ? (typeof details === 'string' ? JSON.parse(details) : details) : null,
        status: status,
        error_message: errorMessage || null
      });
      logger.debug('Automation logged', { userId, automationType, status });
    } catch (error) {
      logger.error('Failed to log automation', { error: error.message });
    }
  }

  async getAuditLog(filters = {}, pagination = {}) {
    const { limit = 20, offset = 0 } = pagination;
    const { userId, automationType, status, startDate, endDate } = filters;
    try {
      let query = SupabaseService.adminClient.from('automation_audit_log').select('*', { count: 'exact' });
      if (userId) query = query.eq('account_id', userId);
      if (automationType) query = query.eq('automation_type', automationType);
      if (status) query = query.eq('status', status);
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data: rows, count, error } = await query;
      if (error) throw error;
      return {
        entries: (rows || []).map(this.transformAuditLogEntry),
        pagination: { total: count || 0, limit, offset, hasMore: offset + (rows || []).length < (count || 0) }
      };
    } catch (error) {
      logger.error('Failed to get audit log', { error: error.message });
      throw error;
    }
  }

  async getStatistics(dateRange = {}) {
    const { startDate, endDate } = dateRange;
    try {
      let query = SupabaseService.adminClient.from('automation_audit_log').select('*');
      if (!startDate && !endDate) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      } else {
        if (startDate) query = query.gte('created_at', startDate);
        if (endDate) query = query.lte('created_at', endDate);
      }
      const { data: rows, error } = await query;
      if (error) throw error;

      const allRows = rows || [];
      const total = allRows.length;
      const successCount = allRows.filter(r => r.status === 'success').length;
      const failureCount = allRows.filter(r => r.status === 'failed').length;

      const byType = {};
      for (const row of allRows) {
        const type = row.automation_type;
        if (!byType[type]) byType[type] = { total: 0, success: 0, failed: 0 };
        byType[type].total++;
        if (row.status === 'success') byType[type].success++;
        if (row.status === 'failed') byType[type].failed++;
      }

      const recentFailures = allRows
        .filter(r => r.status === 'failed')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);

      return {
        totalAutomations: total,
        successCount,
        failureCount,
        successRate: total > 0 ? (successCount / total * 100).toFixed(1) : 0,
        byType,
        recentFailures: recentFailures.map(this.transformAuditLogEntry)
      };
    } catch (error) {
      logger.error('Failed to get statistics', { error: error.message });
      throw error;
    }
  }

  async archiveOldEntries(retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await SupabaseService.adminClient
        .from('automation_audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString())
        .select();

      if (error) throw error;

      const archivedCount = data ? data.length : 0;
      logger.info('Old audit log entries archived', { retentionDays, archivedCount });
      return archivedCount;
    } catch (error) {
      logger.error('Failed to archive old entries', { error: error.message });
      throw error;
    }
  }

  transformAuditLogEntry(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.account_id,
      automationType: row.automation_type,
      details: row.details,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at
    };
  }
}

module.exports = AuditLogService;
