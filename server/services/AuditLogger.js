/**
 * AuditLogger Service
 * 
 * Centralizes audit logging for campaign operations.
 * Records all campaign actions (create, pause, resume, cancel, delete)
 * with timestamps, user information, and operation details.
 * 
 * Requirements: 8.1, 8.2, 8.4
 * 
 * @module server/services/AuditLogger
 */

const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class AuditLogger {
  /**
   * @param {Object} db - Database instance
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Log a campaign operation
   * 
   * @param {Object} entry - Audit entry data
   * @param {string} entry.campaignId - Campaign ID
   * @param {string} entry.userId - User ID who performed the action
   * @param {string} entry.action - Action type (create, pause, resume, cancel, delete, update, start, complete, fail)
   * @param {Object} [entry.details] - Additional details about the operation
   * @param {string} [entry.ipAddress] - IP address of the request
   * @param {string} [entry.userAgent] - User agent of the request
   * @returns {Promise<string>} The ID of the created audit log entry
   */
  async log(entry) {
    const {
      campaignId,
      userId,
      action,
      details = null,
      ipAddress = null,
      userAgent = null
    } = entry;

    if (!campaignId || !userId || !action) {
      logger.warn('AuditLogger: Missing required fields', {
        hasCampaignId: !!campaignId,
        hasUserId: !!userId,
        hasAction: !!action
      });
      throw new Error('campaignId, userId, and action are required');
    }

    const validActions = ['create', 'pause', 'resume', 'cancel', 'delete', 'update', 'start', 'complete', 'fail'];
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action: ${action}. Must be one of: ${validActions.join(', ')}`);
    }

    const id = uuidv4();
    const detailsJson = details ? JSON.stringify(details) : null;

    try {
      const sql = `
        INSERT INTO campaign_audit_logs (id, campaign_id, user_id, action, details, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [id, campaignId, userId, action, detailsJson, ipAddress, userAgent]);

      logger.info('AuditLogger: Entry created', {
        id,
        campaignId,
        userId: userId.substring(0, 8) + '...',
        action
      });

      return id;

    } catch (error) {
      logger.error('AuditLogger: Failed to create entry', {
        error: error.message,
        campaignId,
        action
      });
      throw error;
    }
  }

  /**
   * Get audit history for a campaign
   * 
   * @param {string} campaignId - Campaign ID
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=50] - Maximum number of entries to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @param {string} [options.action] - Filter by action type
   * @returns {Promise<Array>} Array of audit log entries
   */
  async getHistory(campaignId, options = {}) {
    const { limit = 50, offset = 0, action = null } = options;

    try {
      let sql = `
        SELECT id, campaign_id, user_id, action, details, ip_address, user_agent, created_at
        FROM campaign_audit_logs
        WHERE campaign_id = ?
      `;
      const params = [campaignId];

      if (action) {
        sql += ' AND action = ?';
        params.push(action);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const { rows } = await this.db.query(sql, params);

      return rows.map(row => ({
        id: row.id,
        campaignId: row.campaign_id,
        userId: row.user_id,
        action: row.action,
        details: row.details ? JSON.parse(row.details) : null,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at
      }));

    } catch (error) {
      logger.error('AuditLogger: Failed to get history', {
        error: error.message,
        campaignId
      });
      throw error;
    }
  }

  /**
   * Get audit history for a user
   * 
   * @param {string} userId - User ID
   * @param {Object} [options] - Query options
   * @param {number} [options.limit=50] - Maximum number of entries to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @returns {Promise<Array>} Array of audit log entries
   */
  async getUserHistory(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    try {
      const sql = `
        SELECT id, campaign_id, user_id, action, details, ip_address, user_agent, created_at
        FROM campaign_audit_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const { rows } = await this.db.query(sql, [userId, limit, offset]);

      return rows.map(row => ({
        id: row.id,
        campaignId: row.campaign_id,
        userId: row.user_id,
        action: row.action,
        details: row.details ? JSON.parse(row.details) : null,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        createdAt: row.created_at
      }));

    } catch (error) {
      logger.error('AuditLogger: Failed to get user history', {
        error: error.message,
        userId: userId.substring(0, 8) + '...'
      });
      throw error;
    }
  }

  /**
   * Cleanup old audit logs based on retention policy
   * 
   * @param {number} retentionDays - Number of days to retain logs (default: 30)
   * @param {number} [deletedCampaignRetentionDays=90] - Retention for deleted campaigns
   * @returns {Promise<number>} Number of deleted entries
   */
  async cleanup(retentionDays = 30, deletedCampaignRetentionDays = 90) {
    try {
      // Delete old logs for existing campaigns (30 days)
      const regularCleanupSql = `
        DELETE FROM campaign_audit_logs
        WHERE created_at < datetime('now', '-' || ? || ' days')
        AND campaign_id IN (SELECT id FROM campaigns)
      `;

      const { changes: regularDeleted } = await this.db.query(regularCleanupSql, [retentionDays]);

      // Delete very old logs for deleted campaigns (90 days)
      // These are logs where the campaign no longer exists
      const deletedCampaignCleanupSql = `
        DELETE FROM campaign_audit_logs
        WHERE created_at < datetime('now', '-' || ? || ' days')
        AND campaign_id NOT IN (SELECT id FROM campaigns)
      `;

      const { changes: deletedCampaignDeleted } = await this.db.query(deletedCampaignCleanupSql, [deletedCampaignRetentionDays]);

      const totalDeleted = (regularDeleted || 0) + (deletedCampaignDeleted || 0);

      logger.info('AuditLogger: Cleanup completed', {
        regularDeleted,
        deletedCampaignDeleted,
        totalDeleted,
        retentionDays,
        deletedCampaignRetentionDays
      });

      return totalDeleted;

    } catch (error) {
      logger.error('AuditLogger: Cleanup failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get statistics for audit logs
   * 
   * @param {string} [campaignId] - Optional campaign ID to filter
   * @returns {Promise<Object>} Statistics object
   */
  async getStats(campaignId = null) {
    try {
      let sql = `
        SELECT 
          action,
          COUNT(*) as count,
          MIN(created_at) as first_at,
          MAX(created_at) as last_at
        FROM campaign_audit_logs
      `;
      const params = [];

      if (campaignId) {
        sql += ' WHERE campaign_id = ?';
        params.push(campaignId);
      }

      sql += ' GROUP BY action';

      const { rows } = await this.db.query(sql, params);

      const stats = {
        byAction: {},
        total: 0
      };

      for (const row of rows) {
        stats.byAction[row.action] = {
          count: row.count,
          firstAt: row.first_at,
          lastAt: row.last_at
        };
        stats.total += row.count;
      }

      return stats;

    } catch (error) {
      logger.error('AuditLogger: Failed to get stats', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = AuditLogger;
