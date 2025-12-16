/**
 * ConversationInboxService
 * 
 * Handles conversation filtering by inbox membership for multi-user system.
 * 
 * Requirements: 4.4, 7.1, 7.3
 */

const { logger } = require('../utils/logger');

class ConversationInboxService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get conversations filtered by agent's inbox membership
   * 
   * @param {string} accountId - Account ID
   * @param {string} agentId - Agent ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Conversations with pagination
   * 
   * Requirements: 4.4, 7.1
   */
  async getConversationsForAgent(accountId, agentId, filters = {}, pagination = {}) {
    const { limit = 20, offset = 0 } = pagination;
    const { status = null, inboxId = null, search = null } = filters;

    try {
      // Get inboxes the agent is a member of
      const agentInboxes = await this.getAgentInboxIds(agentId);
      
      if (agentInboxes.length === 0) {
        logger.info('Agent has no inbox memberships', { agentId });
        return {
          conversations: [],
          pagination: { total: 0, limit, offset, hasMore: false }
        };
      }

      // Build query with inbox filter
      let sql = `
        SELECT 
          c.id,
          c.user_id,
          c.contact_jid,
          c.contact_name,
          c.contact_avatar_url,
          c.last_message_at,
          c.last_message_preview,
          c.unread_count,
          c.assigned_bot_id,
          c.assigned_agent_id,
          c.inbox_id,
          c.status,
          c.is_muted,
          c.created_at,
          c.updated_at,
          i.name as inbox_name
        FROM conversations c
        LEFT JOIN inboxes i ON c.inbox_id = i.id
        WHERE c.inbox_id IN (${agentInboxes.map(() => '?').join(',')})
      `;
      
      const params = [...agentInboxes];

      if (status) {
        sql += ' AND c.status = ?';
        params.push(status);
      }

      if (inboxId) {
        // Verify agent has access to this inbox
        if (!agentInboxes.includes(inboxId)) {
          throw new Error('Access denied to inbox');
        }
        sql += ' AND c.inbox_id = ?';
        params.push(inboxId);
      }

      if (search) {
        sql += ' AND (c.contact_name LIKE ? OR c.contact_jid LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      sql += ' ORDER BY c.last_message_at DESC NULLS LAST';
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const { rows } = await this.db.query(sql, params);

      // Get total count
      let countSql = `
        SELECT COUNT(*) as total 
        FROM conversations c
        WHERE c.inbox_id IN (${agentInboxes.map(() => '?').join(',')})
      `;
      const countParams = [...agentInboxes];

      if (status) {
        countSql += ' AND c.status = ?';
        countParams.push(status);
      }

      if (inboxId) {
        countSql += ' AND c.inbox_id = ?';
        countParams.push(inboxId);
      }

      if (search) {
        countSql += ' AND (c.contact_name LIKE ? OR c.contact_jid LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const { rows: countRows } = await this.db.query(countSql, countParams);
      const total = countRows[0]?.total || 0;

      logger.info('Conversations retrieved for agent', { 
        agentId, 
        count: rows.length, 
        total,
        inboxCount: agentInboxes.length 
      });

      return {
        conversations: rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total
        }
      };
    } catch (error) {
      logger.error('Failed to get conversations for agent', { 
        agentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Check if agent has access to a specific conversation
   * 
   * @param {string} agentId - Agent ID
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<boolean>} True if agent has access
   * 
   * Requirements: 7.3
   */
  async checkConversationAccess(agentId, conversationId) {
    try {
      const sql = `
        SELECT c.id
        FROM conversations c
        INNER JOIN inbox_members im ON c.inbox_id = im.inbox_id
        WHERE c.id = ? AND im.agent_id = ?
      `;
      
      const { rows } = await this.db.query(sql, [conversationId, agentId]);
      return rows.length > 0;
    } catch (error) {
      logger.error('Failed to check conversation access', { 
        agentId, 
        conversationId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Get inbox IDs for an agent
   * 
   * @param {string} agentId - Agent ID
   * @returns {Promise<string[]>} Array of inbox IDs
   */
  async getAgentInboxIds(agentId) {
    const sql = `
      SELECT inbox_id 
      FROM inbox_members 
      WHERE agent_id = ?
    `;
    
    const { rows } = await this.db.query(sql, [agentId]);
    return rows.map(r => r.inbox_id);
  }

  /**
   * Assign conversation to an inbox
   * 
   * @param {number} conversationId - Conversation ID
   * @param {string} inboxId - Inbox ID
   * @param {string} agentId - Agent performing the action (for audit)
   * @returns {Promise<void>}
   */
  async assignToInbox(conversationId, inboxId, agentId) {
    try {
      const sql = `
        UPDATE conversations 
        SET inbox_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      await this.db.query(sql, [inboxId, conversationId]);
      
      logger.info('Conversation assigned to inbox', { 
        conversationId, 
        inboxId, 
        agentId 
      });
    } catch (error) {
      logger.error('Failed to assign conversation to inbox', { 
        conversationId, 
        inboxId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Assign conversation to an agent
   * 
   * @param {number} conversationId - Conversation ID
   * @param {string} assigneeAgentId - Agent to assign to
   * @param {string} assignerAgentId - Agent performing the action
   * @returns {Promise<void>}
   * 
   * Requirements: 7.4
   */
  async assignToAgent(conversationId, assigneeAgentId, assignerAgentId) {
    try {
      const sql = `
        UPDATE conversations 
        SET assigned_agent_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      await this.db.query(sql, [assigneeAgentId, conversationId]);
      
      logger.info('Conversation assigned to agent', { 
        conversationId, 
        assigneeAgentId, 
        assignerAgentId 
      });
    } catch (error) {
      logger.error('Failed to assign conversation to agent', { 
        conversationId, 
        assigneeAgentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get conversations assigned to a specific agent
   * 
   * @param {string} agentId - Agent ID
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Conversations with pagination
   */
  async getAssignedConversations(agentId, pagination = {}) {
    const { limit = 20, offset = 0 } = pagination;

    try {
      const sql = `
        SELECT 
          c.id,
          c.contact_jid,
          c.contact_name,
          c.last_message_at,
          c.last_message_preview,
          c.unread_count,
          c.status,
          i.name as inbox_name
        FROM conversations c
        LEFT JOIN inboxes i ON c.inbox_id = i.id
        WHERE c.assigned_agent_id = ?
        ORDER BY c.last_message_at DESC NULLS LAST
        LIMIT ? OFFSET ?
      `;
      
      const { rows } = await this.db.query(sql, [agentId, limit, offset]);

      const { rows: countRows } = await this.db.query(
        'SELECT COUNT(*) as total FROM conversations WHERE assigned_agent_id = ?',
        [agentId]
      );
      const total = countRows[0]?.total || 0;

      return {
        conversations: rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total
        }
      };
    } catch (error) {
      logger.error('Failed to get assigned conversations', { 
        agentId, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = ConversationInboxService;
