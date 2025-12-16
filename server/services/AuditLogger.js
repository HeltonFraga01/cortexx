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
const SupabaseService = require('./SupabaseService');

class AuditLogger {
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

    try {
      const { error } = await SupabaseService.queryAsAdmin('campaign_audit_logs', (query) =>
        query.insert({
          id,
          campaign_id: campaignId,
          user_id: userId,
          action,
          details: details || null,
          ip_address: ipAddress,
          user_agent: userAgent
        })
      );

      if (error) {
        throw error;
      }

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
      const { data, error } = await SupabaseService.queryAsAdmin('campaign_audit_logs', (query) => {
        let q = query
          .select('id, campaign_id, user_id, action, details, ip_address, user_agent, created_at')
          .eq('campaign_id', campaignId);
        
        if (action) {
          q = q.eq('action', action);
        }
        
        return q.order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
      });

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        campaignId: row.campaign_id,
        userId: row.user_id,
        action: row.action,
        details: row.details,
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
      const { data, error } = await SupabaseService.queryAsAdmin('campaign_audit_logs', (query) =>
        query
          .select('id, campaign_id, user_id, action, details, ip_address, user_agent, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
      );

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        campaignId: row.campaign_id,
        userId: row.user_id,
        action: row.action,
        details: row.details,
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
      // Calculate cutoff dates
      const regularCutoff = new Date();
      regularCutoff.setDate(regularCutoff.getDate() - retentionDays);
      
      const deletedCampaignCutoff = new Date();
      deletedCampaignCutoff.setDate(deletedCampaignCutoff.getDate() - deletedCampaignRetentionDays);

      // Delete old logs for existing campaigns
      // Note: Supabase doesn't support subqueries in delete, so we need to do this differently
      // For now, we'll just delete based on date
      const { data: regularDeleted, error: regularError } = await SupabaseService.queryAsAdmin('campaign_audit_logs', (query) =>
        query.delete().lt('created_at', regularCutoff.toISOString())
      );

      if (regularError) {
        logger.warn('AuditLogger: Regular cleanup had issues', { error: regularError.message });
      }

      const totalDeleted = regularDeleted?.length || 0;

      logger.info('AuditLogger: Cleanup completed', {
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
      // Supabase doesn't support GROUP BY directly, so we fetch and aggregate in JS
      const { data, error } = await SupabaseService.queryAsAdmin('campaign_audit_logs', (query) => {
        let q = query.select('action, created_at');
        if (campaignId) {
          q = q.eq('campaign_id', campaignId);
        }
        return q;
      });

      if (error) {
        throw error;
      }

      const stats = {
        byAction: {},
        total: 0
      };

      // Aggregate in JavaScript
      const actionMap = new Map();
      for (const row of (data || [])) {
        if (!actionMap.has(row.action)) {
          actionMap.set(row.action, {
            count: 0,
            firstAt: row.created_at,
            lastAt: row.created_at
          });
        }
        const actionStats = actionMap.get(row.action);
        actionStats.count++;
        if (row.created_at < actionStats.firstAt) {
          actionStats.firstAt = row.created_at;
        }
        if (row.created_at > actionStats.lastAt) {
          actionStats.lastAt = row.created_at;
        }
        stats.total++;
      }

      for (const [action, actionStats] of actionMap) {
        stats.byAction[action] = actionStats;
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
