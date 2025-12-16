/**
 * InboxService - Service for managing inboxes in multi-user system
 * 
 * Handles inbox CRUD operations and agent assignment.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const MultiUserAuditService = require('./MultiUserAuditService');
const { ACTION_TYPES, RESOURCE_TYPES } = require('./MultiUserAuditService');
const wuzapiClient = require('../utils/wuzapiClient');

class InboxService {
  constructor(db, auditService = null) {
    this.db = db;
    this.auditService = auditService || new MultiUserAuditService(db);
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  // ==================== INBOX CRUD ====================

  /**
   * Count inboxes for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<number>} Number of inboxes
   */
  async countInboxes(accountId) {
    try {
      const result = await this.db.query(
        'SELECT COUNT(*) as count FROM inboxes WHERE account_id = ?',
        [accountId]
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count inboxes', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Generate a unique WUZAPI token
   * @param {string} inboxName - Inbox name for token prefix
   * @returns {string} Generated token
   */
  generateWuzapiToken(inboxName) {
    const sanitizedName = inboxName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    const randomCode = `${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`.toUpperCase();
    return `${sanitizedName}${randomCode}`;
  }

  /**
   * Create a WUZAPI user for a WhatsApp inbox
   * @param {string} inboxName - Inbox name
   * @param {string} token - WUZAPI token
   * @param {Object} options - Additional options (webhook, events, etc.)
   * @returns {Promise<Object>} WUZAPI user data
   */
  async createWuzapiUser(inboxName, token, options = {}) {
    try {
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      if (!adminToken) {
        throw new Error('WUZAPI_ADMIN_TOKEN não configurado');
      }

      const userData = {
        name: inboxName,
        token: token,
        webhook: options.webhook || '',
        events: options.events || 'Message',
        history: options.history || 0
      };

      const result = await wuzapiClient.createUser(userData, adminToken);
      
      if (!result.success) {
        throw new Error(result.error || 'Falha ao criar usuário WUZAPI');
      }

      logger.info('WUZAPI user created for inbox', { inboxName, token: token.substring(0, 8) + '...' });
      return result.data;
    } catch (error) {
      logger.error('Failed to create WUZAPI user', { error: error.message, inboxName });
      throw error;
    }
  }

  /**
   * Delete a WUZAPI user
   * @param {string} wuzapiUserId - WUZAPI user ID or token
   * @returns {Promise<void>}
   */
  async deleteWuzapiUser(wuzapiUserId) {
    try {
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      if (!adminToken) {
        logger.warn('WUZAPI_ADMIN_TOKEN não configurado, não foi possível deletar usuário WUZAPI');
        return;
      }

      const result = await wuzapiClient.deleteUserFull(wuzapiUserId, adminToken);
      
      if (!result.success) {
        logger.warn('Failed to delete WUZAPI user', { wuzapiUserId, error: result.error });
      } else {
        logger.info('WUZAPI user deleted', { wuzapiUserId });
      }
    } catch (error) {
      logger.error('Error deleting WUZAPI user', { error: error.message, wuzapiUserId });
      // Don't throw - this is a cleanup operation
    }
  }

  /**
   * Create a new inbox
   * @param {string} accountId - Account ID
   * @param {Object} data - Inbox data
   * @param {string} data.name - Inbox name
   * @param {string} [data.description] - Inbox description
   * @param {string} [data.channelType] - Channel type (default: 'whatsapp')
   * @param {string} [data.phoneNumber] - Phone number for WhatsApp inboxes
   * @param {boolean} [data.enableAutoAssignment] - Enable auto assignment
   * @param {Object} [data.autoAssignmentConfig] - Auto assignment config
   * @param {boolean} [data.greetingEnabled] - Enable greeting
   * @param {string} [data.greetingMessage] - Greeting message
   * @param {number} [data.maxInboxes] - Max inboxes allowed (for quota check)
   * @param {Object} [data.wuzapiConfig] - WUZAPI configuration (webhook, events)
   * @returns {Promise<Object>} Created inbox
   */
  async createInbox(accountId, data) {
    try {
      // Check quota if maxInboxes is provided
      if (data.maxInboxes !== undefined && data.maxInboxes !== null) {
        const currentCount = await this.countInboxes(accountId);
        if (currentCount >= data.maxInboxes) {
          const error = new Error('QUOTA_EXCEEDED');
          error.code = 'QUOTA_EXCEEDED';
          error.details = { current: currentCount, max: data.maxInboxes };
          throw error;
        }
      }

      const id = this.generateId();
      const now = new Date().toISOString();
      const channelType = data.channelType || 'whatsapp';
      
      // Use provided wuzapiToken/wuzapiUserId or create new ones for WhatsApp channels
      let wuzapiToken = data.wuzapiToken || null;
      let wuzapiUserId = data.wuzapiUserId || null;

      // Create WUZAPI user for WhatsApp channels if not already provided
      if (channelType === 'whatsapp' && !wuzapiToken) {
        wuzapiToken = this.generateWuzapiToken(data.name);
        
        try {
          const wuzapiUser = await this.createWuzapiUser(data.name, wuzapiToken, data.wuzapiConfig || {});
          wuzapiUserId = wuzapiUser?.id || wuzapiToken;
        } catch (wuzapiError) {
          logger.error('Failed to create WUZAPI user, inbox creation aborted', { 
            error: wuzapiError.message, 
            accountId, 
            inboxName: data.name 
          });
          throw new Error(`Falha ao criar conexão WhatsApp: ${wuzapiError.message}`);
        }
      }

      // Extract maxConversationsPerAgent from config for dedicated column
      const maxConversationsPerAgent = data.autoAssignmentConfig?.maxConversationsPerAgent ?? null;

      const sql = `
        INSERT INTO inboxes (
          id, account_id, name, description, channel_type, 
          phone_number, enable_auto_assignment, auto_assignment_config,
          max_conversations_per_agent,
          greeting_enabled, greeting_message, 
          wuzapi_token, wuzapi_user_id, wuzapi_connected,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id,
        accountId,
        data.name,
        data.description || null,
        channelType,
        data.phoneNumber || null,
        data.enableAutoAssignment !== false ? 1 : 0,
        JSON.stringify(data.autoAssignmentConfig || {}),
        maxConversationsPerAgent,
        data.greetingEnabled ? 1 : 0,
        data.greetingMessage || null,
        wuzapiToken,
        wuzapiUserId,
        0, // wuzapi_connected starts as false
        now,
        now
      ]);

      logger.info('Inbox created', { 
        inboxId: id, 
        accountId, 
        name: data.name, 
        channelType,
        hasWuzapi: !!wuzapiToken 
      });

      // Audit log
      await this.auditService.logAction({
        accountId,
        agentId: data.createdBy || null,
        action: ACTION_TYPES.INBOX_CREATED,
        resourceType: RESOURCE_TYPES.INBOX,
        resourceId: id,
        details: { name: data.name, channelType, hasWuzapi: !!wuzapiToken }
      });

      return this.getInboxById(id);
    } catch (error) {
      logger.error('Failed to create inbox', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get inbox by ID
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<Object|null>} Inbox or null
   */
  async getInboxById(inboxId) {
    try {
      const sql = 'SELECT * FROM inboxes WHERE id = ?';
      const result = await this.db.query(sql, [inboxId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatInbox(result.rows[0]);
    } catch (error) {
      logger.error('Failed to get inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * List inboxes for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object[]>} List of inboxes
   */
  async listInboxes(accountId) {
    try {
      const sql = 'SELECT * FROM inboxes WHERE account_id = ? ORDER BY name';
      const result = await this.db.query(sql, [accountId]);
      return result.rows.map(row => this.formatInbox(row));
    } catch (error) {
      logger.error('Failed to list inboxes', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * List inboxes with member count
   * @param {string} accountId - Account ID
   * @returns {Promise<Object[]>} List of inboxes with member count
   */
  async listInboxesWithStats(accountId) {
    try {
      const sql = `
        SELECT i.*, COUNT(im.agent_id) as member_count
        FROM inboxes i
        LEFT JOIN inbox_members im ON i.id = im.inbox_id
        WHERE i.account_id = ?
        GROUP BY i.id
        ORDER BY i.name
      `;
      const result = await this.db.query(sql, [accountId]);
      return result.rows.map(row => ({
        ...this.formatInbox(row),
        memberCount: row.member_count || 0
      }));
    } catch (error) {
      logger.error('Failed to list inboxes with stats', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update an inbox
   * @param {string} inboxId - Inbox ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated inbox
   */
  async updateInbox(inboxId, data) {
    try {
      const updates = [];
      const params = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.phoneNumber !== undefined) {
        updates.push('phone_number = ?');
        params.push(data.phoneNumber);
      }

      if (data.enableAutoAssignment !== undefined) {
        updates.push('enable_auto_assignment = ?');
        params.push(data.enableAutoAssignment ? 1 : 0);
      }

      if (data.autoAssignmentConfig !== undefined) {
        updates.push('auto_assignment_config = ?');
        params.push(JSON.stringify(data.autoAssignmentConfig));
        
        // Also update the dedicated column for max_conversations_per_agent
        // This is used by ConversationAssignmentService for round-robin
        if (data.autoAssignmentConfig.maxConversationsPerAgent !== undefined) {
          updates.push('max_conversations_per_agent = ?');
          params.push(data.autoAssignmentConfig.maxConversationsPerAgent);
        }
      }

      if (data.greetingEnabled !== undefined) {
        updates.push('greeting_enabled = ?');
        params.push(data.greetingEnabled ? 1 : 0);
      }

      if (data.greetingMessage !== undefined) {
        updates.push('greeting_message = ?');
        params.push(data.greetingMessage);
      }

      if (updates.length === 0) {
        return this.getInboxById(inboxId);
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(inboxId);

      const sql = `UPDATE inboxes SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(sql, params);

      logger.info('Inbox updated', { inboxId });

      return this.getInboxById(inboxId);
    } catch (error) {
      logger.error('Failed to update inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * Delete an inbox
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<void>}
   */
  async deleteInbox(inboxId, deletedBy = null) {
    try {
      const inbox = await this.getInboxById(inboxId);
      
      // Delete WUZAPI user if exists
      if (inbox?.wuzapiUserId || inbox?.wuzapiToken) {
        await this.deleteWuzapiUser(inbox.wuzapiUserId || inbox.wuzapiToken);
      }
      
      // Members will be deleted via CASCADE
      await this.db.query('DELETE FROM inboxes WHERE id = ?', [inboxId]);
      logger.info('Inbox deleted', { inboxId, hadWuzapi: !!(inbox?.wuzapiToken) });

      // Audit log
      if (inbox) {
        await this.auditService.logAction({
          accountId: inbox.accountId,
          agentId: deletedBy,
          action: ACTION_TYPES.INBOX_DELETED,
          resourceType: RESOURCE_TYPES.INBOX,
          resourceId: inboxId,
          details: { name: inbox.name, hadWuzapi: !!(inbox.wuzapiToken) }
        });
      }
    } catch (error) {
      logger.error('Failed to delete inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  // ==================== AGENT ASSIGNMENT ====================

  /**
   * Assign an agent to an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Created membership
   */
  async assignAgent(inboxId, agentId) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO inbox_members (id, inbox_id, agent_id, created_at)
        VALUES (?, ?, ?, ?)
      `;

      await this.db.query(sql, [id, inboxId, agentId, now]);

      logger.info('Agent assigned to inbox', { inboxId, agentId });

      // Audit log
      const inbox = await this.getInboxById(inboxId);
      if (inbox) {
        await this.auditService.logAction({
          accountId: inbox.accountId,
          action: ACTION_TYPES.INBOX_AGENT_ASSIGNED,
          resourceType: RESOURCE_TYPES.INBOX,
          resourceId: inboxId,
          details: { agentId }
        });
      }

      return { id, inboxId, agentId, createdAt: now };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('AGENT_ALREADY_IN_INBOX');
      }
      logger.error('Failed to assign agent to inbox', { error: error.message, inboxId, agentId });
      throw error;
    }
  }

  /**
   * Assign multiple agents to an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string[]} agentIds - Agent IDs
   * @returns {Promise<void>}
   */
  async assignAgents(inboxId, agentIds) {
    try {
      for (const agentId of agentIds) {
        try {
          await this.assignAgent(inboxId, agentId);
        } catch (error) {
          if (error.message !== 'AGENT_ALREADY_IN_INBOX') {
            throw error;
          }
          // Skip if already assigned
        }
      }
      logger.info('Agents assigned to inbox', { inboxId, count: agentIds.length });
    } catch (error) {
      logger.error('Failed to assign agents to inbox', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * Remove an agent from an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async removeAgent(inboxId, agentId) {
    try {
      const inbox = await this.getInboxById(inboxId);
      const sql = 'DELETE FROM inbox_members WHERE inbox_id = ? AND agent_id = ?';
      await this.db.query(sql, [inboxId, agentId]);
      logger.info('Agent removed from inbox', { inboxId, agentId });

      // Audit log
      if (inbox) {
        await this.auditService.logAction({
          accountId: inbox.accountId,
          action: ACTION_TYPES.INBOX_AGENT_REMOVED,
          resourceType: RESOURCE_TYPES.INBOX,
          resourceId: inboxId,
          details: { agentId }
        });
      }
    } catch (error) {
      logger.error('Failed to remove agent from inbox', { error: error.message, inboxId, agentId });
      throw error;
    }
  }

  /**
   * Get inbox members
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<Object[]>} List of members with agent info
   */
  async getInboxMembers(inboxId) {
    try {
      const sql = `
        SELECT a.id, a.email, a.name, a.avatar_url, a.role, a.availability, a.status, im.created_at as assigned_at
        FROM inbox_members im
        JOIN agents a ON im.agent_id = a.id
        WHERE im.inbox_id = ?
        ORDER BY a.name
      `;
      const result = await this.db.query(sql, [inboxId]);
      return result.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name,
        avatarUrl: row.avatar_url,
        role: row.role,
        availability: row.availability,
        status: row.status,
        assignedAt: row.assigned_at
      }));
    } catch (error) {
      logger.error('Failed to get inbox members', { error: error.message, inboxId });
      throw error;
    }
  }

  /**
   * Check if an agent has access to an inbox
   * @param {string} agentId - Agent ID
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<boolean>} True if agent has access
   */
  async checkAccess(agentId, inboxId) {
    try {
      const sql = 'SELECT 1 FROM inbox_members WHERE inbox_id = ? AND agent_id = ?';
      const result = await this.db.query(sql, [inboxId, agentId]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Failed to check inbox access', { error: error.message, inboxId, agentId });
      throw error;
    }
  }

  /**
   * Get inboxes for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of inboxes
   */
  async listAgentInboxes(agentId) {
    try {
      const sql = `
        SELECT i.*
        FROM inboxes i
        JOIN inbox_members im ON i.id = im.inbox_id
        WHERE im.agent_id = ?
        ORDER BY i.name
      `;
      const result = await this.db.query(sql, [agentId]);
      return result.rows.map(row => this.formatInbox(row));
    } catch (error) {
      logger.error('Failed to get agent inboxes', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== AUTO ASSIGNMENT ====================

  /**
   * Get available agents for auto assignment in an inbox
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<Object[]>} List of available agents
   */
  async getAvailableAgentsForAssignment(inboxId) {
    try {
      const sql = `
        SELECT a.id, a.name, a.availability
        FROM inbox_members im
        JOIN agents a ON im.agent_id = a.id
        WHERE im.inbox_id = ? 
          AND a.status = 'active' 
          AND a.availability = 'online'
        ORDER BY a.name
      `;
      const result = await this.db.query(sql, [inboxId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get available agents', { error: error.message, inboxId });
      throw error;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Format inbox row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted inbox
   */
  formatInbox(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      channelType: row.channel_type,
      phoneNumber: row.phone_number,
      enableAutoAssignment: row.enable_auto_assignment === 1,
      autoAssignmentConfig: this.parseJSON(row.auto_assignment_config, {}),
      greetingEnabled: row.greeting_enabled === 1,
      greetingMessage: row.greeting_message,
      wuzapiToken: row.wuzapi_token,
      wuzapiUserId: row.wuzapi_user_id,
      wuzapiConnected: row.wuzapi_connected === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Safely parse JSON string
   * @param {string} jsonString - JSON string
   * @param {*} defaultValue - Default value if parsing fails
   * @returns {*} Parsed value or default
   */
  parseJSON(jsonString, defaultValue = {}) {
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString || defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

module.exports = InboxService;
