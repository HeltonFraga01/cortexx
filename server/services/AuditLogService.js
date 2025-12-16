/**
 * AuditLogService - Service for managing automation audit logs
 * 
 * Handles logging of automation actions and statistics calculation.
 * 
 * Requirements: 9.1-9.5, 10.2, 10.3, 14.3
 */

const { logger } = require('../utils/logger');

class AuditLogService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Log an automation action
   * @param {Object} entry - Audit log entry
   * @returns {Promise<void>}
   * 
   * Requirements: 9.2
   */
  async logAutomation(entry) {
    const { userId, automationType, details, status, errorMessage } = entry;

    try {
      await this.db.query(
        `INSERT INTO automation_audit_log (user_id, automation_type, details, status, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, automationType, details || null, status, errorMessage || null]
      );

      logger.debug('Automation logged', { userId, automationType, status });
    } catch (error) {
      logger.error('Failed to log automation', { error: error.message });
      // Don't throw - logging should not break the main flow
    }
  }

  /**
   * Get audit log entries with pagination and filters
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated audit log
   * 
   * Requirements: 9.1, 9.3, 9.4
   */
  async getAuditLog(filters = {}, pagination = {}) {
    const { limit = 20, offset = 0 } = pagination;
    const { userId, automationType, status, startDate, endDate } = filters;

    try {
      let sql = 'SELECT * FROM automation_audit_log WHERE 1=1';
      const params = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      if (automationType) {
        sql += ' AND automation_type = ?';
        params.push(automationType);
      }

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      if (startDate) {
        sql += ' AND created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND created_at <= ?';
        params.push(endDate);
      }

      // Get total count
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const { rows: countRows } = await this.db.query(countSql, params);
      const total = countRows[0]?.total || 0;

      // Get paginated results
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const { rows } = await this.db.query(sql, params);

      return {
        entries: rows.map(this.transformAuditLogEntry),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total
        }
      };
    } catch (error) {
      logger.error('Failed to get audit log', { error: error.message });
      throw error;
    }
  }

  /**
   * Get automation statistics for a date range
   * @param {Object} dateRange - Date range
   * @returns {Promise<Object>} Statistics
   * 
   * Requirements: 10.2, 10.3
   */
  async getStatistics(dateRange = {}) {
    const { startDate, endDate } = dateRange;

    try {
      let whereClauses = [];
      const params = [];

      // Default to last 7 days if no date range provided
      if (!startDate && !endDate) {
        whereClauses.push("created_at >= datetime('now', '-7 days')");
      } else {
        if (startDate) {
          whereClauses.push('created_at >= ?');
          params.push(startDate);
        }
        if (endDate) {
          whereClauses.push('created_at <= ?');
          params.push(endDate);
        }
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total counts
      const totalSql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failure_count
        FROM automation_audit_log
        ${whereClause}
      `;
      const { rows: totalRows } = await this.db.query(totalSql, params);
      const totals = totalRows[0] || { total: 0, success_count: 0, failure_count: 0 };

      // Get counts by type
      const byTypeSql = `
        SELECT 
          automation_type,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM automation_audit_log
        ${whereClause}
        GROUP BY automation_type
      `;
      const { rows: byTypeRows } = await this.db.query(byTypeSql, params);

      const byType = {};
      for (const row of byTypeRows) {
        byType[row.automation_type] = {
          total: row.total,
          success: row.success,
          failed: row.failed
        };
      }

      // Get recent failures
      const failuresSql = `
        SELECT * FROM automation_audit_log
        ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'failed'
        ORDER BY created_at DESC
        LIMIT 5
      `;
      const { rows: failureRows } = await this.db.query(failuresSql, params);

      return {
        totalAutomations: totals.total,
        successCount: totals.success_count,
        failureCount: totals.failure_count,
        successRate: totals.total > 0 ? (totals.success_count / totals.total * 100).toFixed(1) : 0,
        byType,
        recentFailures: failureRows.map(this.transformAuditLogEntry)
      };
    } catch (error) {
      logger.error('Failed to get statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Archive old audit log entries
   * @param {number} retentionDays - Number of days to retain
   * @returns {Promise<number>} Number of archived entries
   * 
   * Requirements: 9.5
   */
  async archiveOldEntries(retentionDays = 90) {
    try {
      const { changes } = await this.db.query(
        `DELETE FROM automation_audit_log 
         WHERE created_at < datetime('now', '-' || ? || ' days')`,
        [retentionDays]
      );

      logger.info('Old audit log entries archived', { retentionDays, archivedCount: changes });

      return changes || 0;
    } catch (error) {
      logger.error('Failed to archive old entries', { error: error.message });
      throw error;
    }
  }

  transformAuditLogEntry(row) {
    if (!row) return null;
    
    let details = null;
    if (row.details) {
      try {
        details = JSON.parse(row.details);
      } catch {
        details = row.details;
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      automationType: row.automation_type,
      details,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at
    };
  }
}

module.exports = AuditLogService;
