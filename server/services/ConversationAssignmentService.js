/**
 * ConversationAssignmentService
 * 
 * Handles automatic and manual conversation assignment to agents.
 * Implements round-robin distribution, pickup, transfer, and release operations.
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.4
 * 
 * MIGRATED: Now uses SupabaseService directly instead of db parameter
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class ConversationAssignmentService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
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
      const { count, error } = await SupabaseService.count('conversations', { 
        assigned_agent_id: agentId, 
        status: 'open' 
      });
      
      if (error) {
        throw error;
      }
      
      return count || 0;
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
      // Get inbox members
      const { data: members, error: membersError } = await SupabaseService.queryAsAdmin('inbox_members', (query) =>
        query.select('agent_id').eq('inbox_id', inboxId)
      );
      
      if (membersError || !members || members.length === 0) {
        return [];
      }
      
      const agentIds = members.map(m => m.agent_id);
      
      // Get active online agents
      const { data: agents, error: agentsError } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.select('id, name, availability')
          .in('id', agentIds)
          .eq('availability', 'online')
          .eq('status', 'active')
          .order('name')
      );
      
      if (agentsError || !agents) {
        return [];
      }
      
      // Get conversation counts for each agent
      const agentsWithCounts = await Promise.all(agents.map(async (agent) => {
        const { count } = await SupabaseService.count('conversations', { 
          assigned_agent_id: agent.id, 
          status: 'open' 
        });
        return { ...agent, conversation_count: count || 0 };
      }));
      
      // Filter by max conversations if specified
      if (maxConversations !== null) {
        return agentsWithCounts.filter(a => a.conversation_count < maxConversations);
      }
      
      return agentsWithCounts;
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
      const { data: inbox, error: inboxError } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.select('id, enable_auto_assignment, max_conversations_per_agent, last_assigned_agent_id')
          .eq('id', inboxId)
          .single()
      );
      
      if (inboxError || !inbox) {
        logger.warn('Inbox not found for assignment', { inboxId });
        return null;
      }
      
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
        const lastIndex = availableAgents.findIndex(a => a.id === lastAssignedId);
        
        if (lastIndex >= 0 && lastIndex < availableAgents.length - 1) {
          nextAgent = availableAgents[lastIndex + 1];
        } else {
          nextAgent = availableAgents[0];
        }
      } else {
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
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ assigned_agent_id: agentId }).eq('id', conversationId)
      );
      
      // Update last assigned agent in inbox for round-robin
      await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.update({ last_assigned_agent_id: agentId }).eq('id', inboxId)
      );
      
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
      const { data, error } = await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ assigned_agent_id: agentId })
          .eq('id', conversationId)
          .is('assigned_agent_id', null)
          .select()
      );
      
      if (error || !data || data.length === 0) {
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
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ assigned_agent_id: targetAgentId }).eq('id', conversationId)
      );
      
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
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ assigned_agent_id: null }).eq('id', conversationId)
      );
      
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
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ assigned_agent_id: targetAgentId }).eq('id', conversationId)
      );
      
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
      await SupabaseService.insert('audit_log', {
        entity_type: 'conversation_assignment',
        entity_id: conversationId.toString(),
        action,
        old_value: fromAgentId ? JSON.stringify({ agent_id: fromAgentId }) : null,
        new_value: toAgentId ? JSON.stringify({ agent_id: toAgentId }) : null
      });
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
      // Get conversation's inbox
      const { data: conv, error: convError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.select('inbox_id').eq('id', conversationId).single()
      );
      
      if (convError || !conv) {
        return false;
      }
      
      // Check if agent is member of inbox
      const { data: member, error: memberError } = await SupabaseService.queryAsAdmin('inbox_members', (query) =>
        query.select('id').eq('inbox_id', conv.inbox_id).eq('agent_id', agentId).single()
      );
      
      return !memberError && !!member;
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
      const { data: conv, error: convError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.select('id, assigned_agent_id, inbox_id').eq('id', conversationId).single()
      );
      
      if (convError || !conv) {
        return null;
      }
      
      // Get agent info if assigned
      if (conv.assigned_agent_id) {
        const { data: agent } = await SupabaseService.queryAsAdmin('agents', (query) =>
          query.select('name, availability').eq('id', conv.assigned_agent_id).single()
        );
        
        return {
          ...conv,
          assigned_agent_name: agent?.name,
          assigned_agent_availability: agent?.availability
        };
      }
      
      return conv;
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
      // Get inbox members
      const { data: members, error: membersError } = await SupabaseService.queryAsAdmin('inbox_members', (query) =>
        query.select('agent_id').eq('inbox_id', inboxId)
      );
      
      if (membersError || !members || members.length === 0) {
        return [];
      }
      
      let agentIds = members.map(m => m.agent_id);
      
      // Exclude current assignee if specified
      if (excludeAgentId) {
        agentIds = agentIds.filter(id => id !== excludeAgentId);
      }
      
      if (agentIds.length === 0) {
        return [];
      }
      
      // Get active agents
      const { data: agents, error: agentsError } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.select('id, name, avatar_url, availability')
          .in('id', agentIds)
          .eq('status', 'active')
          .order('name')
      );
      
      if (agentsError || !agents) {
        return [];
      }
      
      // Get conversation counts for each agent
      const agentsWithCounts = await Promise.all(agents.map(async (agent) => {
        const { count } = await SupabaseService.count('conversations', { 
          assigned_agent_id: agent.id, 
          status: 'open' 
        });
        return { ...agent, conversation_count: count || 0 };
      }));
      
      return agentsWithCounts;
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
