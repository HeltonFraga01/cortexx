/**
 * MultiUserAuditService - Service for audit logging in multi-user system
 * 
 * Handles audit log creation and querying for agent actions.
 * Uses SupabaseService for all database operations.
 * 
 * Requirements: 6.2, 6.4, 7.4
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const supabaseService = require('./SupabaseService');

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
  constructor() {
    // No db parameter needed - uses SupabaseService directly
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

      const auditData = {
        id,
        account_id: data.accountId,
        agent_id: data.agentId || null,
        action: data.action,
        resource_type: data.resourceType,
        resource_id: data.resourceId || null,
        old_values: data.oldValues || null,
        new_values: data.details || data.newValues || {},
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        created_at: now
      };

      const { error } = await supabaseService.insert('audit_log', auditData);

      if (error) {
        // Don't throw - audit logging should not break the main operation
        logger.error('Failed to create audit log', { 
          error: error.message, 
          action: data.action 
        });
        return null;
      }

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
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Build query for logs
      const queryFn = (query) => {
        let q = query.select('*').eq('account_id', accountId);

        if (filters.agentId) {
          q = q.eq('agent_id', filters.agentId);
        }
        if (filters.action) {
          q = q.eq('action', filters.action);
        }
        if (filters.resourceType) {
          q = q.eq('resource_type', filters.resourceType);
        }
        if (filters.resourceId) {
          q = q.eq('resource_id', filters.resourceId);
        }
        if (filters.startDate) {
          q = q.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          q = q.lte('created_at', filters.endDate);
        }

        q = q.order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        return q;
      };

      // Build query for count
      const countQueryFn = (query) => {
        let q = query.select('*', { count: 'exact', head: true })
          .eq('account_id', accountId);

        if (filters.agentId) {
          q = q.eq('agent_id', filters.agentId);
        }
        if (filters.action) {
          q = q.eq('action', filters.action);
        }
        if (filters.resourceType) {
          q = q.eq('resource_type', filters.resourceType);
        }
        if (filters.resourceId) {
          q = q.eq('resource_id', filters.resourceId);
        }
        if (filters.startDate) {
          q = q.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          q = q.lte('created_at', filters.endDate);
        }

        return q;
      };

      const [logsResult, countResult] = await Promise.all([
        supabaseService.queryAsAdmin('audit_log', queryFn),
        supabaseService.queryAsAdmin('audit_log', countQueryFn)
      ]);

      if (logsResult.error) {
        throw logsResult.error;
      }

      const logs = logsResult.data || [];
      const total = countResult.count || 0;

      return {
        logs: logs.map(row => this.formatAuditLog(row)),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + logs.length < total
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
      const { data: log, error } = await supabaseService.getById('audit_log', logId);

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return log ? this.formatAuditLog(log) : null;
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
      const queryFn = (query) => query
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data: logs, error } = await supabaseService.queryAsAdmin('audit_log', queryFn);

      if (error) {
        throw error;
      }

      return (logs || []).map(row => this.formatAuditLog(row));
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
      const queryFn = (query) => query
        .select('*')
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data: logs, error } = await supabaseService.queryAsAdmin('audit_log', queryFn);

      if (error) {
        throw error;
      }

      return (logs || []).map(row => this.formatAuditLog(row));
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

      const queryFn = (query) => query
        .delete()
        .eq('account_id', accountId)
        .lt('created_at', cutoffDate.toISOString());

      const { error } = await supabaseService.queryAsAdmin('audit_log', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Old audit logs cleaned up', { accountId, retentionDays });
      return 1; // Supabase doesn't return count for delete
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
      oldValues: this.parseJSON(row.old_values, {}),
      newValues: this.parseJSON(row.new_values, {}),
      details: this.parseJSON(row.new_values, {}), // Alias for backward compatibility
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
