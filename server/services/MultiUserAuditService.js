/**
 * MultiUserAuditService - Service for audit logging in multi-user system
 * 
 * Handles audit log creation and querying for agent actions.
 * 
 * Requirements: 6.2, 6.4, 7.4
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Action types
const ACTION_TYPES = {
  // Account actions
  ACCOUNT_CREATED: 'account.created',
  ACCOUNT_UPDATED: 'account.updated',
  ACCOUNT_DEACTIVATED: 'account.deactivated',
  ACCOUNT_ACTIVATED: 'account.activated',
  
  // Agent actions
  AGENT_CREATED: 'agent.created',
  AGENT_UPDATED: 'agent.updated',
  AGENT_DEACTIVATED: 'agent.deactivated',
  AGENT_ACTIVATED: 'agent.activated',
  AGENT_ROLE_CHANGED: 'agent.role_changed',
  AGENT_PASSWORD_CHANGED: 'agent.password_changed',
  
  // Session actions
  AGENT_LOGIN: 'agent.login',
  AGENT_LOGOUT: 'agent.logout',
  AGENT_LOGIN_FAILED: 'agent.login_failed',
  AGENT_LOCKED: 'agent.locked',
  
  // Team actions
  TEAM_CREATED: 'team.created',
  TEAM_UPDATED: 'team.updated',
  TEAM_DELETED: 'team.deleted',
  TEAM_MEMBER_ADDED: 'team.member_added',
  TEAM_MEMBER_REMOVED: 'team.member_removed',
  
  // Inbox actions
  INBOX_CREATED: 'inbox.created',
  INBOX_UPDATED: 'inbox.updated',
  INBOX_DELETED: 'inbox.deleted',
  INBOX_AGENT_ASSIGNED: 'inbox.agent_assigned',
  INBOX_AGENT_REMOVED: 'inbox.agent_removed',
  
  // Role actions
  ROLE_CREATED: 'role.created',
  ROLE_UPDATED: 'role.updated',
  ROLE_DELETED: 'role.deleted',
  
  // Message actions
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELETED: 'message.deleted',
  
  // Conversation actions
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_RESOLVED: 'conversation.resolved',
  CONVERSATION_REOPENED: 'conversation.reopened'
};

// Resource types
const RESOURCE_TYPES = {
  ACCOUNT: 'account',
  AGENT: 'agent',
  TEAM: 'team',
  INBOX: 'inbox',
  ROLE: 'role',
  MESSAGE: 'message',
  CONVERSATION: 'conversation',
  SESSION: 'session'
};

class MultiUserAuditService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Log an action
   * @param {Object} data - Audit log data
   * @param {string} data.accountId - Account ID
   * @param {string} [data.agentId] - Agent ID (who performed the action)
   * @param {string} data.action - Action type
   * @param {string} data.resourceType - Resource type
   * @param {string} [data.resourceId] - Resource ID
   * @param {Object} [data.details] - Additional details
   * @param {string} [data.ipAddress] - Client IP address
   * @param {string} [data.userAgent] - Client user agent
   * @returns {Promise<Object>} Created audit log entry
   */
  async logAction(data) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO audit_log (id, account_id, agent_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id,
        data.accountId,
        data.agentId || null,
        data.action,
        data.resourceType,
        data.resourceId || null,
        JSON.stringify(data.details || {}),
        data.ipAddress || null,
        data.userAgent || null,
        now
      ]);

      logger.debug('Audit log created', { 
        auditId: id, 
        action: data.action, 
        resourceType: data.resourceType 
      });

      return {
        id,
        accountId: data.accountId,
        agentId: data.agentId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        details: data.details || {},
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        createdAt: now
      };
    } catch (error) {
      logger.error('Failed to create audit log', { error: error.message, action: data.action });
      // Don't throw - audit logging should not break the main operation
      return null;
    }
  }

  /**
   * Query audit logs
   * @param {string} accountId - Account ID
   * @param {Object} [filters] - Query filters
   * @param {string} [filters.agentId] - Filter by agent
   * @param {string} [filters.action] - Filter by action
   * @param {string} [filters.resourceType] - Filter by resource type
   * @param {string} [filters.resourceId] - Filter by resource ID
   * @param {string} [filters.startDate] - Start date (ISO string)
   * @param {string} [filters.endDate] - End date (ISO string)
   * @param {number} [filters.limit] - Limit results (default: 50)
   * @param {number} [filters.offset] - Offset for pagination
   * @returns {Promise<Object>} Audit logs with pagination info
   */
  async queryLogs(accountId, filters = {}) {
    try {
      let sql = 'SELECT * FROM audit_log WHERE account_id = ?';
      let countSql = 'SELECT COUNT(*) as total FROM audit_log WHERE account_id = ?';
      const params = [accountId];
      const countParams = [accountId];

      if (filters.agentId) {
        sql += ' AND agent_id = ?';
        countSql += ' AND agent_id = ?';
        params.push(filters.agentId);
        countParams.push(filters.agentId);
      }

      if (filters.action) {
        sql += ' AND action = ?';
        countSql += ' AND action = ?';
        params.push(filters.action);
        countParams.push(filters.action);
      }

      if (filters.resourceType) {
        sql += ' AND resource_type = ?';
        countSql += ' AND resource_type = ?';
        params.push(filters.resourceType);
        countParams.push(filters.resourceType);
      }

      if (filters.resourceId) {
        sql += ' AND resource_id = ?';
        countSql += ' AND resource_id = ?';
        params.push(filters.resourceId);
        countParams.push(filters.resourceId);
      }

      if (filters.startDate) {
        sql += ' AND created_at >= ?';
        countSql += ' AND created_at >= ?';
        params.push(filters.startDate);
        countParams.push(filters.startDate);
      }

      if (filters.endDate) {
        sql += ' AND created_at <= ?';
        countSql += ' AND created_at <= ?';
        params.push(filters.endDate);
        countParams.push(filters.endDate);
      }

      sql += ' ORDER BY created_at DESC';

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [logsResult, countResult] = await Promise.all([
        this.db.query(sql, params),
        this.db.query(countSql, countParams)
      ]);

      const total = countResult.rows[0]?.total || 0;

      return {
        logs: logsResult.rows.map(row => this.formatAuditLog(row)),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + logsResult.rows.length < total
        }
      };
    } catch (error) {
      logger.error('Failed to query audit logs', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get audit log by ID
   * @param {string} logId - Audit log ID
   * @returns {Promise<Object|null>} Audit log or null
   */
  async getLogById(logId) {
    try {
      const sql = 'SELECT * FROM audit_log WHERE id = ?';
      const result = await this.db.query(sql, [logId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatAuditLog(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get audit log', { error: error.message, logId });
      throw error;
    }
  }

  /**
   * Get recent activity for an agent
   * @param {string} agentId - Agent ID
   * @param {number} [limit] - Limit results (default: 20)
   * @returns {Promise<Object[]>} Recent audit logs
   */
  async getAgentActivity(agentId, limit = 20) {
    try {
      const sql = `
        SELECT * FROM audit_log 
        WHERE agent_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      const result = await this.db.query(sql, [agentId, limit]);
      return result.rows.map(row => this.formatAuditLog(row));
    } catch (error) {
      logger.error('Failed to get agent activity', { error: error.message, agentId });
      throw error;
    }
  }

  /**
   * Get activity for a specific resource
   * @param {string} resourceType - Resource type
   * @param {string} resourceId - Resource ID
   * @param {number} [limit] - Limit results (default: 50)
   * @returns {Promise<Object[]>} Audit logs for resource
   */
  async getResourceActivity(resourceType, resourceId, limit = 50) {
    try {
      const sql = `
        SELECT * FROM audit_log 
        WHERE resource_type = ? AND resource_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `;
      const result = await this.db.query(sql, [resourceType, resourceId, limit]);
      return result.rows.map(row => this.formatAuditLog(row));
    } catch (error) {
      logger.error('Failed to get resource activity', { error: error.message, resourceType, resourceId });
      throw error;
    }
  }

  /**
   * Delete old audit logs (retention policy)
   * @param {string} accountId - Account ID
   * @param {number} retentionDays - Days to retain (default: 90)
   * @returns {Promise<number>} Number of deleted logs
   */
  async cleanupOldLogs(accountId, retentionDays = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const sql = 'DELETE FROM audit_log WHERE account_id = ? AND created_at < ?';
      const result = await this.db.query(sql, [accountId, cutoffDate.toISOString()]);

      if (result.rowCount > 0) {
        logger.info('Old audit logs cleaned up', { accountId, deleted: result.rowCount });
      }

      return result.rowCount;
    } catch (error) {
      logger.error('Failed to cleanup old audit logs', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Log agent login
   */
  async logLogin(accountId, agentId, ipAddress, userAgent, success = true) {
    return this.logAction({
      accountId,
      agentId,
      action: success ? ACTION_TYPES.AGENT_LOGIN : ACTION_TYPES.AGENT_LOGIN_FAILED,
      resourceType: RESOURCE_TYPES.SESSION,
      details: { success },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log agent logout
   */
  async logLogout(accountId, agentId, ipAddress) {
    return this.logAction({
      accountId,
      agentId,
      action: ACTION_TYPES.AGENT_LOGOUT,
      resourceType: RESOURCE_TYPES.SESSION,
      ipAddress
    });
  }

  /**
   * Log message sent
   */
  async logMessageSent(accountId, agentId, messageId, details = {}) {
    return this.logAction({
      accountId,
      agentId,
      action: ACTION_TYPES.MESSAGE_SENT,
      resourceType: RESOURCE_TYPES.MESSAGE,
      resourceId: messageId,
      details
    });
  }

  // ==================== HELPERS ====================

  /**
   * Format audit log row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted audit log
   */
  formatAuditLog(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      agentId: row.agent_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: this.parseJSON(row.details, {}),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at
    };
  }

  /**
   * Safely parse JSON string
   */
  parseJSON(jsonString, defaultValue = {}) {
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString || defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

module.exports = MultiUserAuditService;
module.exports.ACTION_TYPES = ACTION_TYPES;
module.exports.RESOURCE_TYPES = RESOURCE_TYPES;
