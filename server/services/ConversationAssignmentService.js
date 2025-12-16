/**
 * ConversationAssignmentService
 * 
 * Handles automatic and manual conversation assignment to agents.
 * Implements round-robin distribution, pickup, transfer, and release operations.
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.4
 */

const { logger } = require('../utils/logger');

class ConversationAssignmentService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get count of active conversations assigned to an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<number>} Count of assigned conversations
   * 
   * Requirements: 7.4
   */
  async getAgentConversationCount(agentId) {
    try {
      const sql = `
        SELECT COUNT(*) as count 
        FROM conversations 
        WHERE assigned_agent_id = ? AND status = 'open'
      `;
      const { rows } = await this.db.query(sql, [agentId]);
      return rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to get agent conversation count', { 
        agentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get online agents for an inbox who can receive new assignments
   * @param {string} inboxId - Inbox ID
   * @param {number|null} maxConversations - Max conversations per agent (null = unlimited)
   * @returns {Promise<Array>} List of available agents
   */
  async getAvailableAgents(inboxId, maxConversations = null) {
    try {
      let sql = `
        SELECT a.id, a.name, a.availability,
          (SELECT COUNT(*) FROM conversations c 
           WHERE c.assigned_agent_id = a.id AND c.status = 'open') as conversation_count
        FROM agents a
        INNER JOIN inbox_members im ON a.id = im.agent_id
        WHERE im.inbox_id = ?
          AND a.availability = 'online'
          AND a.status = 'active'
      `;
      
      const params = [inboxId];
      
      if (maxConversations !== null) {
        sql += ` HAVING conversation_count < ?`;
        params.push(maxConversations);
      }
      
      sql += ` ORDER BY a.name`;
      
      const { rows } = await this.db.query(sql, params);
      return rows;
    } catch (error) {
      logger.error('Failed to get available agents', { 
        inboxId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get next agent for round-robin assignment
   * @param {string} inboxId - Inbox ID
   * @returns {Promise<string|null>} Agent ID or null if no agents available
   * 
   * Requirements: 1.2
   */
  async getNextAvailableAgent(inboxId) {
    try {
      // Get inbox configuration
      const inboxSql = `
        SELECT id, enable_auto_assignment, max_conversations_per_agent, last_assigned_agent_id
        FROM inboxes
        WHERE id = ?
      `;
      const { rows: inboxRows } = await this.db.query(inboxSql, [inboxId]);
      
      if (inboxRows.length === 0) {
        logger.warn('Inbox not found for assignment', { inboxId });
        return null;
      }
      
      const inbox = inboxRows[0];
      
      // Check if auto-assignment is enabled
      if (!inbox.enable_auto_assignment) {
        logger.debug('Auto-assignment disabled for inbox', { inboxId });
        return null;
      }
      
      // Get available agents
      const availableAgents = await this.getAvailableAgents(
        inboxId, 
        inbox.max_conversations_per_agent
      );
      
      if (availableAgents.length === 0) {
        logger.debug('No available agents for inbox', { inboxId });
        return null;
      }
      
      // Round-robin: find next agent after last assigned
      let nextAgent = null;
      const lastAssignedId = inbox.last_assigned_agent_id;
      
      if (lastAssignedId) {
        // Find index of last assigned agent
        const lastIndex = availableAgents.findIndex(a => a.id === lastAssignedId);
        
        if (lastIndex >= 0 && lastIndex < availableAgents.length - 1) {
          // Next agent in list
          nextAgent = availableAgents[lastIndex + 1];
        } else {
          // Wrap around to first agent
          nextAgent = availableAgents[0];
        }
      } else {
        // No previous assignment, start with first agent
        nextAgent = availableAgents[0];
      }
      
      logger.debug('Next available agent selected', { 
        inboxId, 
        agentId: nextAgent.id,
        agentName: nextAgent.name
      });
      
      return nextAgent.id;
    } catch (error) {
      logger.error('Failed to get next available agent', { 
        inboxId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Auto-assign a conversation to an available agent
   * @param {string} inboxId - Inbox ID
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<string|null>} Assigned agent ID or null
   * 
   * Requirements: 1.1, 1.2, 1.3
   */
  async autoAssign(inboxId, conversationId) {
    try {
      const agentId = await this.getNextAvailableAgent(inboxId);
      
      if (!agentId) {
        logger.info('No agent available for auto-assignment', { 
          inboxId, 
          conversationId 
        });
        return null;
      }
      
      // Assign conversation to agent
      const updateSql = `
        UPDATE conversations 
        SET assigned_agent_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      await this.db.query(updateSql, [agentId, conversationId]);
      
      // Update last assigned agent in inbox for round-robin
      const inboxUpdateSql = `
        UPDATE inboxes 
        SET last_assigned_agent_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      await this.db.query(inboxUpdateSql, [agentId, inboxId]);
      
      // Log assignment for audit
      await this.logAssignmentAction(conversationId, null, agentId, 'auto_assign');
      
      logger.info('Conversation auto-assigned', { 
        conversationId, 
        agentId, 
        inboxId 
      });
      
      return agentId;
    } catch (error) {
      logger.error('Failed to auto-assign conversation', { 
        inboxId, 
        conversationId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Agent picks up an unassigned conversation
   * @param {number} conversationId - Conversation ID
   * @param {string} agentId - Agent picking up
   * @returns {Promise<boolean>} True if pickup successful
   * 
   * Requirements: 2.3
   */
  async pickupConversation(conversationId, agentId) {
    try {
      // Use optimistic locking - only update if still unassigned
      const sql = `
        UPDATE conversations 
        SET assigned_agent_id = ?, updated_at = datetime('now')
        WHERE id = ? AND assigned_agent_id IS NULL
      `;
      
      const result = await this.db.query(sql, [agentId, conversationId]);
      
      if (result.changes === 0) {
        // Conversation was already assigned
        logger.warn('Conversation pickup failed - already assigned', { 
          conversationId, 
          agentId 
        });
        return false;
      }
      
      // Log pickup action
      await this.logAssignmentAction(conversationId, null, agentId, 'pickup');
      
      logger.info('Conversation picked up', { conversationId, agentId });
      return true;
    } catch (error) {
      logger.error('Failed to pickup conversation', { 
        conversationId, 
        agentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Transfer conversation to another agent
   * @param {number} conversationId - Conversation ID
   * @param {string} targetAgentId - Target agent ID
   * @param {string} sourceAgentId - Source agent ID (for audit)
   * @returns {Promise<void>}
   * 
   * Requirements: 5.1, 5.2, 5.3
   */
  async transferConversation(conversationId, targetAgentId, sourceAgentId) {
    try {
      const sql = `
        UPDATE conversations 
        SET assigned_agent_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      await this.db.query(sql, [targetAgentId, conversationId]);
      
      // Log transfer action
      await this.logAssignmentAction(conversationId, sourceAgentId, targetAgentId, 'transfer');
      
      logger.info('Conversation transferred', { 
        conversationId, 
        sourceAgentId, 
        targetAgentId 
      });
    } catch (error) {
      logger.error('Failed to transfer conversation', { 
        conversationId, 
        targetAgentId, 
        sourceAgentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Release conversation back to pool (unassign)
   * @param {number} conversationId - Conversation ID
   * @param {string} agentId - Agent releasing (for audit)
   * @returns {Promise<void>}
   * 
   * Requirements: 6.1, 6.2, 6.3
   */
  async releaseConversation(conversationId, agentId) {
    try {
      const sql = `
        UPDATE conversations 
        SET assigned_agent_id = NULL, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      await this.db.query(sql, [conversationId]);
      
      // Log release action - NOTE: Do NOT trigger auto-assignment here
      await this.logAssignmentAction(conversationId, agentId, null, 'release');
      
      logger.info('Conversation released', { conversationId, agentId });
    } catch (error) {
      logger.error('Failed to release conversation', { 
        conversationId, 
        agentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Manual assignment by owner/admin
   * @param {number} conversationId - Conversation ID
   * @param {string} targetAgentId - Target agent ID
   * @param {string} assignerId - User/owner performing assignment
   * @returns {Promise<void>}
   * 
   * Requirements: 3.3
   */
  async manualAssign(conversationId, targetAgentId, assignerId) {
    try {
      const sql = `
        UPDATE conversations 
        SET assigned_agent_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      await this.db.query(sql, [targetAgentId, conversationId]);
      
      // Log manual assignment
      await this.logAssignmentAction(conversationId, assignerId, targetAgentId, 'manual_assign');
      
      logger.info('Conversation manually assigned', { 
        conversationId, 
        targetAgentId, 
        assignerId 
      });
    } catch (error) {
      logger.error('Failed to manually assign conversation', { 
        conversationId, 
        targetAgentId, 
        assignerId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Log assignment action for audit
   * @param {number} conversationId - Conversation ID
   * @param {string|null} fromAgentId - Source agent ID
   * @param {string|null} toAgentId - Target agent ID
   * @param {string} action - Action type (auto_assign, pickup, transfer, release, manual_assign)
   */
  async logAssignmentAction(conversationId, fromAgentId, toAgentId, action) {
    try {
      const sql = `
        INSERT INTO audit_log (
          entity_type, entity_id, action, 
          old_value, new_value, 
          created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `;
      
      await this.db.query(sql, [
        'conversation_assignment',
        conversationId,
        action,
        fromAgentId ? JSON.stringify({ agent_id: fromAgentId }) : null,
        toAgentId ? JSON.stringify({ agent_id: toAgentId }) : null
      ]);
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      logger.error('Failed to log assignment action', { 
        conversationId, 
        action, 
        error: error.message 
      });
    }
  }

  /**
   * Check if agent has access to conversation (is member of inbox)
   * @param {string} agentId - Agent ID
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<boolean>} True if agent has access
   */
  async checkAgentAccess(agentId, conversationId) {
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
      logger.error('Failed to check agent access', { 
        agentId, 
        conversationId, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Get conversation assignment info
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<Object|null>} Assignment info or null
   */
  async getConversationAssignment(conversationId) {
    try {
      const sql = `
        SELECT c.id, c.assigned_agent_id, c.inbox_id,
          a.name as assigned_agent_name, a.availability as assigned_agent_availability
        FROM conversations c
        LEFT JOIN agents a ON c.assigned_agent_id = a.id
        WHERE c.id = ?
      `;
      
      const { rows } = await this.db.query(sql, [conversationId]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Failed to get conversation assignment', { 
        conversationId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get agents available for transfer in an inbox
   * @param {string} inboxId - Inbox ID
   * @param {string} excludeAgentId - Agent to exclude (current assignee)
   * @returns {Promise<Array>} List of agents
   */
  async getTransferableAgents(inboxId, excludeAgentId = null) {
    try {
      let sql = `
        SELECT a.id, a.name, a.avatar_url, a.availability,
          (SELECT COUNT(*) FROM conversations c 
           WHERE c.assigned_agent_id = a.id AND c.status = 'open') as conversation_count
        FROM agents a
        INNER JOIN inbox_members im ON a.id = im.agent_id
        WHERE im.inbox_id = ?
          AND a.status = 'active'
      `;
      
      const params = [inboxId];
      
      if (excludeAgentId) {
        sql += ` AND a.id != ?`;
        params.push(excludeAgentId);
      }
      
      sql += ` ORDER BY a.name`;
      
      const { rows } = await this.db.query(sql, params);
      return rows;
    } catch (error) {
      logger.error('Failed to get transferable agents', { 
        inboxId, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = ConversationAssignmentService;
