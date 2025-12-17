/**
 * ChatServiceSupabase - Service for managing chat conversations and messages using Supabase
 * Task 12.3: Refactor ChatService.js to use SupabaseService
 * 
 * Handles all chat-related operations including:
 * - Conversation management (list, create, update)
 * - Message sending and receiving
 * - Search functionality
 * - Read receipts
 * - Cursor-based pagination (Requirement 8.2)
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 6.1, 6.2, 7.1, 7.2, 8.1, 8.2, 8.3
 */

const { logger } = require('../utils/logger');
const wuzapiClient = require('../utils/wuzapiClient');
const supabaseService = require('./SupabaseService');

class ChatService {
  /**
   * Get account ID (UUID) from WUZAPI token
   * @param {string} userToken - WUZAPI token
   * @returns {Promise<string|null>} Account UUID or null
   */
  async getAccountIdFromToken(userToken) {
    try {
      // Check if userToken is already a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userToken)) {
        return userToken;
      }

      // Look up account by wuzapi_token
      const { data, error } = await supabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('wuzapi_token', userToken).single()
      );

      if (error || !data) {
        logger.warn('Account not found for token', { token: userToken?.substring(0, 10) });
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Failed to get account ID from token', { error: error.message });
      return null;
    }
  }

  /**
   * Get all conversations for a user, ordered by most recent activity
   * Implements cursor-based pagination (Requirement 8.2)
   * 
   * @param {string} userId - User ID (account owner) - can be WUZAPI token or UUID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Conversations with pagination info
   */
  async getConversations(userId, filters = {}, pagination = {}, token = null) {
    const { limit = 20, cursor = null } = pagination;
    const { status = null, hasUnread = false, search = null, inboxId = null, assignedAgentId = null } = filters;

    try {
      // Convert WUZAPI token to account UUID if needed
      const accountId = await this.getAccountIdFromToken(userId);
      if (!accountId) {
        throw new Error('Account not found for the provided token');
      }

      const queryFn = (query) => {
        let q = query.select(`
          *,
          agent_bots(id, name, avatar_url),
          agents!conversations_assigned_agent_id_fkey(id, name, avatar_url)
        `);

        // Filter by account UUID
        q = q.eq('account_id', accountId);

        // Exclude test conversations
        q = q.or('is_test.is.null,is_test.eq.false');

        if (status) {
          q = q.eq('status', status);
        }

        if (hasUnread) {
          q = q.gt('unread_count', 0);
        }

        if (search) {
          q = q.or(`contact_name.ilike.%${search}%,contact_jid.ilike.%${search}%`);
        }

        if (inboxId) {
          q = q.eq('inbox_id', inboxId);
        }

        if (assignedAgentId !== null) {
          if (assignedAgentId === 'unassigned') {
            q = q.is('assigned_agent_id', null);
          } else {
            q = q.eq('assigned_agent_id', assignedAgentId);
          }
        }

        // Cursor-based pagination
        if (cursor) {
          q = q.lt('last_message_at', cursor);
        }

        q = q.order('last_message_at', { ascending: false, nullsFirst: false });
        q = q.limit(limit + 1); // Fetch one extra to check if there's more

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

      // Get labels for each conversation
      const conversationsWithLabels = await Promise.all(
        results.map(async (conv) => {
          const labels = await this.getConversationLabels(conv.id, token);
          return this.formatConversation(conv, labels);
        })
      );

      logger.info('Conversations retrieved', { userId, count: results.length });

      return {
        conversations: conversationsWithLabels,
        pagination: {
          limit,
          cursor: nextCursor,
          hasMore
        }
      };
    } catch (error) {
      logger.error('Failed to get conversations', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get labels for a conversation
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Array>} Labels
   */
  async getConversationLabels(conversationId, token = null) {
    try {
      const queryFn = (query) => query
        .select(`
          labels(id, name, color)
        `)
        .eq('conversation_id', conversationId);

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'conversation_labels', queryFn)
        : await supabaseService.queryAsAdmin('conversation_labels', queryFn);

      if (error) {
        return [];
      }

      return (data || []).map(row => row.labels).filter(Boolean);
    } catch (error) {
      logger.error('Failed to get conversation labels', { conversationId, error: error.message });
      return [];
    }
  }

  /**
   * Get messages for a conversation with cursor-based pagination
   * Implements Property 15: Pagination Consistency (Requirement 8.2)
   * 
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} userId - User ID (for authorization)
   * @param {Object} options - Query options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Messages with pagination info
   */
  async getMessages(conversationId, userId, options = {}, token = null) {
    const { limit = 50, cursor = null } = options;

    try {
      // Verify user owns this conversation
      const conversation = await this.getConversationById(conversationId, userId, token);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      const queryFn = (query) => {
        let q = query.select(`
          *,
          agents!chat_messages_sender_agent_id_fkey(id, name, avatar_url),
          agent_bots!chat_messages_sender_bot_id_fkey(id, name, avatar_url)
        `);

        q = q.eq('conversation_id', conversationId);

        // Cursor-based pagination (using timestamp)
        if (cursor) {
          q = q.lt('timestamp', cursor);
        }

        q = q.order('timestamp', { ascending: false });
        q = q.limit(limit + 1);

        return q;
      };

      const { data: messages, error } = token
        ? await supabaseService.queryAsUser(token, 'chat_messages', queryFn)
        : await supabaseService.queryAsAdmin('chat_messages', queryFn);

      if (error) {
        throw error;
      }

      // Check if there are more results
      const hasMore = messages && messages.length > limit;
      const results = hasMore ? messages.slice(0, limit) : (messages || []);

      // Get next cursor
      const nextCursor = hasMore && results.length > 0
        ? results[results.length - 1].timestamp
        : null;

      // Get reactions for each message
      const messagesWithReactions = await Promise.all(
        results.map(async (msg) => {
          const reactions = await this.getMessageReactions(msg.id, token);
          return this.formatMessage(msg, reactions);
        })
      );

      logger.info('Messages retrieved', { conversationId, count: results.length });

      return {
        messages: messagesWithReactions.reverse(), // Return in chronological order
        pagination: {
          limit,
          cursor: nextCursor,
          hasMore
        }
      };
    } catch (error) {
      logger.error('Failed to get messages', { conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Get reactions for a message
   * @param {string} messageId - Message ID (UUID)
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Array>} Reactions
   */
  async getMessageReactions(messageId, token = null) {
    try {
      const { data, error } = await supabaseService.getMany(
        'message_reactions',
        { message_id: messageId },
        {},
        token
      );

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get a conversation by ID
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} userId - User ID (for authorization) - can be WUZAPI token or UUID
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object|null>} Conversation or null
   */
  async getConversationById(conversationId, userId, token = null) {
    try {
      // Convert WUZAPI token to account UUID if needed
      const accountId = await this.getAccountIdFromToken(userId);
      if (!accountId) {
        return null;
      }

      const queryFn = (query) => query
        .select('*')
        .eq('id', conversationId)
        .eq('account_id', accountId)
        .single();

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'conversations', queryFn)
        : await supabaseService.queryAsAdmin('conversations', queryFn);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Failed to get conversation', { conversationId, error: error.message });
      return null;
    }
  }

  /**
   * Get a conversation by ID (wrapper for backward compatibility)
   * @param {string} userId - User ID (WUZAPI token)
   * @param {string} conversationId - Conversation ID
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object|null>} Conversation or null
   */
  async getConversation(userId, conversationId, token = null) {
    return this.getConversationById(conversationId, userId, token);
  }

  /**
   * Get a conversation by contact JID
   * @param {string} userId - User ID (account) - can be WUZAPI token or UUID
   * @param {string} contactJid - Contact JID
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object|null>} Conversation or null
   */
  async getConversationByJid(userId, contactJid, token = null) {
    try {
      // Convert WUZAPI token to account UUID if needed
      const accountId = await this.getAccountIdFromToken(userId);
      if (!accountId) {
        return null;
      }

      const queryFn = (query) => query
        .select('*')
        .eq('account_id', accountId)
        .eq('contact_jid', contactJid)
        .single();

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'conversations', queryFn)
        : await supabaseService.queryAsAdmin('conversations', queryFn);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create or get existing conversation for a contact
   * @param {string} userId - User ID (account) - can be WUZAPI token or UUID
   * @param {string} contactJid - Contact JID
   * @param {Object} contactInfo - Contact information
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Conversation
   */
  async getOrCreateConversation(userId, contactJid, contactInfo = {}, token = null) {
    try {
      // Convert WUZAPI token to account UUID if needed
      const accountId = await this.getAccountIdFromToken(userId);
      if (!accountId) {
        throw new Error('Account not found for the provided token');
      }

      // Check if conversation exists
      const existing = await this.getConversationByJid(userId, contactJid, token);
      if (existing) {
        return existing;
      }

      // Create new conversation
      const conversationData = {
        account_id: accountId,
        contact_jid: contactJid,
        contact_name: contactInfo.name || contactJid.split('@')[0],
        contact_avatar_url: contactInfo.avatarUrl || null,
        status: 'open',
        unread_count: 0
      };

      const { data: conversation, error } = await supabaseService.insert('conversations', conversationData, token);

      if (error) {
        // Handle race condition - conversation might have been created
        if (error.code === 'DUPLICATE_KEY') {
          return this.getConversationByJid(userId, contactJid, token);
        }
        throw error;
      }

      logger.info('Conversation created', { conversationId: conversation.id, contactJid });

      return conversation;
    } catch (error) {
      logger.error('Failed to get or create conversation', { userId, contactJid, error: error.message });
      throw error;
    }
  }

  /**
   * Send a text message
   * @param {string} userId - User ID (account)
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} content - Message content
   * @param {string} userToken - WUZAPI user token
   * @param {Object} options - Additional options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Sent message
   */
  async sendMessage(userId, conversationId, content, userToken, options = {}, token = null) {
    const { replyToMessageId = null } = options;

    try {
      // Validate message content
      if (!this.validateMessageContent(content)) {
        throw new Error('Message content cannot be empty or whitespace only');
      }

      // Get conversation
      const conversation = await this.getConversationById(conversationId, userId, token);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      // Generate unique message ID
      const messageId = this.generateMessageId();

      // Create message record with pending status
      const messageData = {
        conversation_id: conversationId,
        message_id: messageId,
        direction: 'outgoing',
        message_type: 'text',
        content,
        reply_to_message_id: replyToMessageId,
        status: 'pending',
        sender_type: 'user',
        timestamp: new Date().toISOString()
      };

      const { data: message, error: insertError } = await supabaseService.insert('chat_messages', messageData, token);

      if (insertError) {
        throw insertError;
      }

      // Send via WUZAPI
      const isGroup = conversation.contact_jid.endsWith('@g.us');
      const wuzapiPayload = {
        Phone: isGroup
          ? conversation.contact_jid
          : conversation.contact_jid.replace('@s.whatsapp.net', ''),
        Body: content
      };

      if (replyToMessageId) {
        wuzapiPayload.ContextInfo = {
          StanzaId: replyToMessageId,
          Participant: conversation.contact_jid
        };
      }

      const response = await wuzapiClient.post('/chat/send/text', wuzapiPayload, {
        headers: { 'Token': userToken }
      });

      // Update message status based on response
      const newStatus = response.success ? 'sent' : 'failed';
      await supabaseService.update('chat_messages', message.id, { status: newStatus }, token);

      // Update conversation
      await this.updateConversationLastMessage(conversationId, content, token);

      logger.info('Message sent', { userId, conversationId, messageId, status: newStatus });

      return { ...message, status: newStatus };
    } catch (error) {
      logger.error('Failed to send message', { userId, conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate message content
   * @param {string} content - Message content
   * @returns {boolean} True if valid
   */
  validateMessageContent(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    return content.trim().length > 0;
  }

  /**
   * Generate a unique message ID
   * @returns {string} Message ID
   */
  generateMessageId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}_${random}`;
  }

  /**
   * Create a message record in the database
   * @param {string} userId - User ID (WUZAPI token)
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {Object} messageData - Message data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Created message
   */
  async createMessage(userId, conversationId, messageData, token = null) {
    try {
      const messageId = this.generateMessageId();
      
      const record = {
        conversation_id: conversationId,
        message_id: messageId,
        direction: messageData.direction || 'outgoing',
        message_type: messageData.messageType || 'text',
        content: messageData.content || '',
        media_url: messageData.mediaUrl || null,
        media_filename: messageData.mediaFilename || null,
        media_mime_type: messageData.mediaMimeType || null,
        reply_to_message_id: messageData.replyToMessageId || null,
        status: messageData.status || 'pending',
        sender_type: 'user',
        timestamp: new Date().toISOString()
      };

      const { data, error } = await supabaseService.insert('chat_messages', record, token);

      if (error) {
        throw error;
      }

      return data || { ...record, id: messageId };
    } catch (error) {
      logger.error('Failed to create message', { conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Update conversation's last message info
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} preview - Message preview
   * @param {string} [token] - User JWT token for RLS
   */
  async updateConversationLastMessage(conversationId, preview, token = null) {
    const now = new Date().toISOString();
    await supabaseService.update(
      'conversations',
      conversationId,
      {
        last_message_at: now,
        last_message_preview: preview.substring(0, 100),
        updated_at: now
      },
      token
    );
  }

  /**
   * Mark messages as read
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} userId - User ID (account)
   * @param {string} userToken - WUZAPI user token
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async markAsRead(conversationId, userId, userToken, token = null) {
    try {
      const conversation = await this.getConversationById(conversationId, userId, token);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      // Update all unread incoming messages to read
      const updateQueryFn = (query) => query
        .update({ status: 'read' })
        .eq('conversation_id', conversationId)
        .eq('direction', 'incoming')
        .neq('status', 'read');

      await supabaseService.queryAsAdmin('chat_messages', updateQueryFn);

      // Reset unread count
      await supabaseService.update(
        'conversations',
        conversationId,
        { unread_count: 0, updated_at: new Date().toISOString() },
        token
      );

      // Send read receipt to WUZAPI
      await wuzapiClient.post('/chat/markread', {
        Phone: conversation.contact_jid.replace('@s.whatsapp.net', '')
      }, {
        headers: { 'Token': userToken }
      });

      logger.info('Messages marked as read', { conversationId, userId });
    } catch (error) {
      logger.error('Failed to mark as read', { conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Search conversations by contact name or phone
   * @param {string} userId - User ID (account) - can be WUZAPI token or UUID
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Array>} Matching conversations
   */
  async searchConversations(userId, query, options = {}, token = null) {
    const { limit = 20 } = options;

    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      // Convert WUZAPI token to account UUID if needed
      const accountId = await this.getAccountIdFromToken(userId);
      if (!accountId) {
        return [];
      }

      const searchTerm = query.toLowerCase();

      const queryFn = (q) => q
        .select('id, contact_jid, contact_name, contact_avatar_url, last_message_at, last_message_preview, unread_count, status')
        .eq('account_id', accountId)
        .or(`contact_name.ilike.%${searchTerm}%,contact_jid.ilike.%${searchTerm}%`)
        .order('last_message_at', { ascending: false })
        .limit(limit);

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'conversations', queryFn)
        : await supabaseService.queryAsAdmin('conversations', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Conversations searched', { userId, query, results: (data || []).length });

      return data || [];
    } catch (error) {
      logger.error('Failed to search conversations', { userId, query, error: error.message });
      throw error;
    }
  }

  /**
   * Search messages within a conversation
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} userId - User ID (account)
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Array>} Matching messages
   */
  async searchMessages(conversationId, userId, query, options = {}, token = null) {
    const { limit = 50 } = options;

    try {
      // Verify user owns this conversation
      const conversation = await this.getConversationById(conversationId, userId, token);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      if (!query || query.trim().length === 0) {
        return [];
      }

      const searchTerm = query.toLowerCase();

      const queryFn = (q) => q
        .select('id, message_id, direction, message_type, content, timestamp')
        .eq('conversation_id', conversationId)
        .ilike('content', `%${searchTerm}%`)
        .eq('is_private_note', false)
        .order('timestamp', { ascending: false })
        .limit(limit);

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'chat_messages', queryFn)
        : await supabaseService.queryAsAdmin('chat_messages', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Messages searched', { conversationId, query, results: (data || []).length });

      return data || [];
    } catch (error) {
      logger.error('Failed to search messages', { conversationId, query, error: error.message });
      throw error;
    }
  }

  /**
   * Update conversation status
   * @param {string} conversationId - Conversation ID (UUID)
   * @param {string} status - New status
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Updated conversation
   */
  async updateConversationStatus(conversationId, status, token = null) {
    try {
      const { data, error } = await supabaseService.update(
        'conversations',
        conversationId,
        { status, updated_at: new Date().toISOString() },
        token
      );

      if (error) {
        throw error;
      }

      logger.info('Conversation status updated', { conversationId, status });

      return data;
    } catch (error) {
      logger.error('Failed to update conversation status', { conversationId, error: error.message });
      throw error;
    }
  }

  // ==================== LABELS METHODS ====================

  /**
   * Get all labels for a user account
   * @param {string} accountId - Account ID or WUZAPI token
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Array>} Labels array
   */
  async getLabels(accountId, token = null) {
    try {
      // Convert WUZAPI token to account UUID if needed
      const resolvedAccountId = await this.getAccountIdFromToken(accountId);
      if (!resolvedAccountId) {
        return [];
      }

      const queryFn = (query) => query
        .select('*')
        .eq('account_id', resolvedAccountId)
        .order('title', { ascending: true });

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'labels', queryFn)
        : await supabaseService.queryAsAdmin('labels', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Labels retrieved', { accountId, count: (data || []).length });

      return (data || []).map(label => ({
        id: label.id,
        name: label.title || label.name,
        color: label.color || '#6366f1',
        createdAt: label.created_at
      }));
    } catch (error) {
      logger.error('Failed to get labels', { accountId, error: error.message });
      return [];
    }
  }

  /**
   * Create a new label
   * @param {string} accountId - Account ID or WUZAPI token
   * @param {Object} data - Label data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Created label
   */
  async createLabel(accountId, data, token = null) {
    try {
      // Convert WUZAPI token to account UUID if needed
      const resolvedAccountId = await this.getAccountIdFromToken(accountId);
      if (!resolvedAccountId) {
        throw new Error('Account not found for the provided token');
      }

      const { name, color = '#6366f1' } = data;

      if (!name || name.trim().length === 0) {
        throw new Error('Label name is required');
      }

      const labelData = {
        account_id: resolvedAccountId,
        title: name.trim(),
        color
      };

      const { data: label, error } = await supabaseService.insert('labels', labelData, token);

      if (error) {
        throw error;
      }

      logger.info('Label created', { accountId, labelId: label.id });

      return {
        id: label.id,
        name: label.title || label.name,
        color: label.color,
        createdAt: label.created_at
      };
    } catch (error) {
      logger.error('Failed to create label', { accountId, error: error.message });
      throw error;
    }
  }

  /**
   * Update a label
   * @param {string} accountId - Account ID
   * @param {string} labelId - Label ID
   * @param {Object} data - Update data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Updated label
   */
  async updateLabel(accountId, labelId, data, token = null) {
    try {
      const { name, color } = data;
      const updates = {};

      if (name !== undefined) {
        if (!name || name.trim().length === 0) {
          throw new Error('Label name cannot be empty');
        }
        updates.name = name.trim();
      }
      if (color !== undefined) {
        updates.color = color;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      const { data: label, error } = await supabaseService.queryAsAdmin('labels', (query) =>
        query.update(updates).eq('id', labelId).eq('account_id', accountId).select().single()
      );

      if (error) {
        throw error;
      }

      logger.info('Label updated', { accountId, labelId });

      return {
        id: label.id,
        name: label.name,
        color: label.color,
        createdAt: label.created_at
      };
    } catch (error) {
      logger.error('Failed to update label', { accountId, labelId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a label
   * @param {string} accountId - Account ID
   * @param {string} labelId - Label ID
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async deleteLabel(accountId, labelId, token = null) {
    try {
      // First remove label from all conversations
      await supabaseService.queryAsAdmin('conversation_labels', (query) =>
        query.delete().eq('label_id', labelId)
      );

      // Then delete the label
      const { error } = await supabaseService.queryAsAdmin('labels', (query) =>
        query.delete().eq('id', labelId).eq('account_id', accountId)
      );

      if (error) {
        throw error;
      }

      logger.info('Label deleted', { accountId, labelId });
    } catch (error) {
      logger.error('Failed to delete label', { accountId, labelId, error: error.message });
      throw error;
    }
  }

  // ==================== CANNED RESPONSES METHODS ====================

  /**
   * Get all canned responses for a user account
   * @param {string} accountId - Account ID
   * @param {Object} options - Query options
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Array>} Canned responses array
   */
  async getCannedResponses(accountId, options = {}, token = null) {
    try {
      const { search = null } = options;

      const queryFn = (query) => {
        let q = query.select('*').eq('account_id', accountId);

        if (search) {
          q = q.or(`shortcut.ilike.%${search}%,content.ilike.%${search}%`);
        }

        return q.order('shortcut', { ascending: true });
      };

      const { data, error } = token
        ? await supabaseService.queryAsUser(token, 'canned_responses', queryFn)
        : await supabaseService.queryAsAdmin('canned_responses', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Canned responses retrieved', { accountId, count: (data || []).length });

      return (data || []).map(response => ({
        id: response.id,
        shortcut: response.shortcut,
        content: response.content,
        createdAt: response.created_at
      }));
    } catch (error) {
      logger.error('Failed to get canned responses', { accountId, error: error.message });
      return [];
    }
  }

  /**
   * Create a new canned response
   * @param {string} accountId - Account ID
   * @param {Object} data - Canned response data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Created canned response
   */
  async createCannedResponse(accountId, data, token = null) {
    try {
      const { shortcut, content } = data;

      if (!shortcut || shortcut.trim().length === 0) {
        throw new Error('Shortcut is required');
      }
      if (!content || content.trim().length === 0) {
        throw new Error('Content is required');
      }

      const responseData = {
        account_id: accountId,
        shortcut: shortcut.trim(),
        content: content.trim()
      };

      const { data: response, error } = await supabaseService.insert('canned_responses', responseData, token);

      if (error) {
        throw error;
      }

      logger.info('Canned response created', { accountId, responseId: response.id });

      return {
        id: response.id,
        shortcut: response.shortcut,
        content: response.content,
        createdAt: response.created_at
      };
    } catch (error) {
      logger.error('Failed to create canned response', { accountId, error: error.message });
      throw error;
    }
  }

  /**
   * Update a canned response
   * @param {string} accountId - Account ID
   * @param {string} responseId - Canned response ID
   * @param {Object} data - Update data
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<Object>} Updated canned response
   */
  async updateCannedResponse(accountId, responseId, data, token = null) {
    try {
      const { shortcut, content } = data;
      const updates = {};

      if (shortcut !== undefined) {
        if (!shortcut || shortcut.trim().length === 0) {
          throw new Error('Shortcut cannot be empty');
        }
        updates.shortcut = shortcut.trim();
      }
      if (content !== undefined) {
        if (!content || content.trim().length === 0) {
          throw new Error('Content cannot be empty');
        }
        updates.content = content.trim();
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No updates provided');
      }

      const { data: response, error } = await supabaseService.queryAsAdmin('canned_responses', (query) =>
        query.update(updates).eq('id', responseId).eq('account_id', accountId).select().single()
      );

      if (error) {
        throw error;
      }

      logger.info('Canned response updated', { accountId, responseId });

      return {
        id: response.id,
        shortcut: response.shortcut,
        content: response.content,
        createdAt: response.created_at
      };
    } catch (error) {
      logger.error('Failed to update canned response', { accountId, responseId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a canned response
   * @param {string} accountId - Account ID
   * @param {string} responseId - Canned response ID
   * @param {string} [token] - User JWT token for RLS
   * @returns {Promise<void>}
   */
  async deleteCannedResponse(accountId, responseId, token = null) {
    try {
      const { error } = await supabaseService.queryAsAdmin('canned_responses', (query) =>
        query.delete().eq('id', responseId).eq('account_id', accountId)
      );

      if (error) {
        throw error;
      }

      logger.info('Canned response deleted', { accountId, responseId });
    } catch (error) {
      logger.error('Failed to delete canned response', { accountId, responseId, error: error.message });
      throw error;
    }
  }

  // ==================== FORMATTERS ====================

  /**
   * Format conversation from database
   * @param {Object} row - Database row
   * @param {Array} labels - Conversation labels
   * @returns {Object} Formatted conversation
   */
  formatConversation(row, labels = []) {
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
      isTest: row.is_test,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      labels,
      assignedAgent: row.agents ? {
        id: row.agents.id,
        name: row.agents.name,
        avatarUrl: row.agents.avatar_url
      } : null,
      assignedBot: row.agent_bots ? {
        id: row.agent_bots.id,
        name: row.agent_bots.name,
        avatarUrl: row.agent_bots.avatar_url
      } : null
    };
  }

  /**
   * Format message from database
   * @param {Object} row - Database row
   * @param {Array} reactions - Message reactions
   * @returns {Object} Formatted message
   */
  formatMessage(row, reactions = []) {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      messageId: row.message_id,
      direction: row.direction,
      messageType: row.message_type,
      content: row.content,
      mediaUrl: row.media_url,
      mediaMimeType: row.media_mime_type,
      mediaFilename: row.media_filename,
      mediaSizeBytes: row.media_size_bytes,
      mediaDurationSeconds: row.media_duration_seconds,
      replyToMessageId: row.reply_to_message_id,
      status: row.status,
      isPrivateNote: row.is_private_note,
      senderType: row.sender_type,
      senderAgentId: row.sender_agent_id,
      senderBotId: row.sender_bot_id,
      metadata: row.metadata,
      timestamp: row.timestamp,
      createdAt: row.created_at,
      reactions,
      senderAgent: row.agents ? {
        id: row.agents.id,
        name: row.agents.name,
        avatarUrl: row.agents.avatar_url
      } : null,
      senderBot: row.agent_bots ? {
        id: row.agent_bots.id,
        name: row.agent_bots.name,
        avatarUrl: row.agent_bots.avatar_url
      } : null
    };
  }
}

module.exports = ChatService;
