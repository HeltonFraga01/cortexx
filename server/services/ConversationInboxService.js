/**
 * ConversationInboxServiceSupabase - Service for conversation filtering by inbox using Supabase
 * Task 12.4: Refactor ConversationInboxService.js to use SupabaseService
 * 
 * Handles conversation filtering by inbox membership for multi-user system.
 * 
 * Requirements: 4.4, 6.1, 6.2, 7.1, 7.3
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

class ConversationInboxService {
  /**
   * Get conversations filtered by agent's inbox membership
   * 
   * @param {string} accountId - Account ID (UUID)
   * @param {string} agentId - Agent ID (UUID)
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Conversations with pagination
   */
  async getConversationsForAgent(accountId, agentId, filters = {}, pagination = {}, token = null) {
    const { limit = 20, cursor = null } = pagination;
    const { status = null, inboxId = null, search = null } = filters;

    try {
      // Get inboxes the agent is a member of
      const agentInboxes = await this.getAgentInboxIds(agentId, token);

      if (agentInboxes.length === 0) {
        logger.info('Agent has no inbox memberships', { agentId });
        return {
          conversations: [],
          pagination: { limit, cursor: null, hasMore: false }
        };
      }

      const queryFn = (query) => {
        let q = query.select(`
          *,
          inboxes(id, name)
        `);

        // Filter by agent's inboxes
        q = q.in('inbox_id', agentInboxes);

        if (status) {
          q = q.eq('status', status);
        }

        if (inboxId) {
          // Verify agent has access to this inbox
          if (!agentInboxes.includes(inboxId)) {
            throw new Error('Access denied to inbox');
          }
          q = q.eq('inbox_id', inboxId);
        }

        if (search) {
          q = q.or(`contact_name.ilike.%${search}%,contact_jid.ilike.%${search}%`);
        }

        // Cursor-based pagination
        if (cursor) {
          q = q.lt('last_message_at', cursor);
        }

        q = q.order('last_message_at', { ascending: false, nullsFirst: false });
        q = q.limit(limit + 1);

        return q;
      };

      const { data: conversations, error } = token
        ? await supabaseService.queryAsUser(token, 'conversations', queryFn)
        : await supabaseService.queryAsAdmin('conversations', queryFn);

      if (error) {
        throw error;
      }

      // Check if there are more results
      const hasMore = conversations && conversations.length > limit;
      const results = hasMore ? conversations.slice(0, limit) : (conversations || []);

      // Get next cursor
      const nextCursor = hasMore && results.length > 0
        ? results[results.length - 1].last_message_at
        : null;

      logger.info('Conversations retrieved for agent', {
        agentId,
        count: results.length,
        inboxCount: agentInboxes.length
      });

      return {
        conversations: results.map(conv => this.formatConversation(conv)),
        pagination: {
          limit,
          cursor: nextCursor,
          hasMore
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
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<boolean>} True if agent has access
   */
  async checkConversationAccess(agentId, conversationId, token = null) {
    try {
      const queryFn = (query) => query
        .select('conversations!inner(id)')
        .eq('agent_id', agentId)
        .eq('conversations.id', conversationId)
        .limit(1);

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'inbox_members', queryFn)
        : await supabaseService.queryAsAdmin('inbox_members', queryFn);

      if (error) {
        return false;
      }

      return data && data.length > 0;
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
   * @param {string} agentId - Agent ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<string[]>} Array of inbox IDs
   */
  async getAgentInboxIds(agentId, token = null) {
    try {
      const queryFn = (query) => query
        .select('inbox_id')
        .eq('agent_id', agentId);

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'inbox_members', queryFn)
        : await supabaseService.queryAsAdmin('inbox_members', queryFn);

      if (error) {
        throw error;
      }

      return (data || []).map(r => r.inbox_id);
    } catch (error) {
      logger.error('Failed to get agent inbox IDs', { agentId, error: error.message });
      return [];
    }
  }

  /**
   * Assign conversation to an inbox
   * 
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} inboxId - Inbox ID (UUID)
   * @param {string} agentId - Agent performing the action (for audit)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async assignToInbox(conversationId, inboxId, agentId, token = null) {
    try {
      const { error } = await supabaseService.update(
        'conversations',
        conversationId,
        {
          inbox_id: inboxId,
          updated_at: new Date().toISOString()
        },
        token
      );

      if (error) {
        throw error;
      }

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
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} assigneeAgentId - Agent to assign to (UUID)
   * @param {string} assignerAgentId - Agent performing the action (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async assignToAgent(conversationId, assigneeAgentId, assignerAgentId, token = null) {
    try {
      const { error } = await supabaseService.update(
        'conversations',
        conversationId,
        {
          assigned_agent_id: assigneeAgentId,
          updated_at: new Date().toISOString()
        },
        token
      );

      if (error) {
        throw error;
      }

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
   * Unassign conversation from agent
   * 
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} agentId - Agent performing the action (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async unassignFromAgent(conversationId, agentId, token = null) {
    try {
      const { error } = await supabaseService.update(
        'conversations',
        conversationId,
        {
          assigned_agent_id: null,
          updated_at: new Date().toISOString()
        },
        token
      );

      if (error) {
        throw error;
      }

      logger.info('Conversation unassigned from agent', {
        conversationId,
        agentId
      });
    } catch (error) {
      logger.error('Failed to unassign conversation', {
        conversationId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get conversations assigned to a specific agent
   * 
   * @param {string} agentId - Agent ID (UUID)
   * @param {Object} pagination - Pagination options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Conversations with pagination
   */
  async getAssignedConversations(agentId, pagination = {}, token = null) {
    const { limit = 20, cursor = null } = pagination;

    try {
      const queryFn = (query) => {
        let q = query.select(`
          *,
          inboxes(id, name)
        `);

        q = q.eq('assigned_agent_id', agentId);

        // Cursor-based pagination
        if (cursor) {
          q = q.lt('last_message_at', cursor);
        }

        q = q.order('last_message_at', { ascending: false, nullsFirst: false });
        q = q.limit(limit + 1);

        return q;
      };

      const { data: conversations, error } = token
        ? await supabaseService.queryAsUser(token, 'conversations', queryFn)
        : await supabaseService.queryAsAdmin('conversations', queryFn);

      if (error) {
        throw error;
      }

      // Check if there are more results
      const hasMore = conversations && conversations.length > limit;
      const results = hasMore ? conversations.slice(0, limit) : (conversations || []);

      // Get next cursor
      const nextCursor = hasMore && results.length > 0
        ? results[results.length - 1].last_message_at
        : null;

      return {
        conversations: results.map(conv => this.formatConversation(conv)),
        pagination: {
          limit,
          cursor: nextCursor,
          hasMore
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

  /**
   * Get unassigned conversations in agent's inboxes
   * 
   * @param {string} agentId - Agent ID (UUID)
   * @param {Object} pagination - Pagination options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Conversations with pagination
   */
  async getUnassignedConversations(agentId, pagination = {}, token = null) {
    const { limit = 20, cursor = null } = pagination;

    try {
      // Get inboxes the agent is a member of
      const agentInboxes = await this.getAgentInboxIds(agentId, token);

      if (agentInboxes.length === 0) {
        return {
          conversations: [],
          pagination: { limit, cursor: null, hasMore: false }
        };
      }

      const queryFn = (query) => {
        let q = query.select(`
          *,
          inboxes(id, name)
        `);

        q = q.in('inbox_id', agentInboxes);
        q = q.is('assigned_agent_id', null);

        // Cursor-based pagination
        if (cursor) {
          q = q.lt('last_message_at', cursor);
        }

        q = q.order('last_message_at', { ascending: false, nullsFirst: false });
        q = q.limit(limit + 1);

        return q;
      };

      const { data: conversations, error } = token
        ? await supabaseService.queryAsUser(token, 'conversations', queryFn)
        : await supabaseService.queryAsAdmin('conversations', queryFn);

      if (error) {
        throw error;
      }

      // Check if there are more results
      const hasMore = conversations && conversations.length > limit;
      const results = hasMore ? conversations.slice(0, limit) : (conversations || []);

      // Get next cursor
      const nextCursor = hasMore && results.length > 0
        ? results[results.length - 1].last_message_at
        : null;

      return {
        conversations: results.map(conv => this.formatConversation(conv)),
        pagination: {
          limit,
          cursor: nextCursor,
          hasMore
        }
      };
    } catch (error) {
      logger.error('Failed to get unassigned conversations', {
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format conversation from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted conversation
   */
  formatConversation(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      contactJid: row.contact_jid,
      contactName: row.contact_name,
      contactAvatarUrl: row.contact_avatar_url,
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      unreadCount: row.unread_count,
      assignedAgentId: row.assigned_agent_id,
      assignedBotId: row.assigned_bot_id,
      inboxId: row.inbox_id,
      status: row.status,
      isMuted: row.is_muted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      inbox: row.inboxes ? {
        id: row.inboxes.id,
        name: row.inboxes.name
      } : null
    };
  }
}

module.exports = ConversationInboxService;
