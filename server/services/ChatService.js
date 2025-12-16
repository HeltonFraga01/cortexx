/**
 * ChatService - Service for managing chat conversations and messages
 * 
 * Handles all chat-related operations including:
 * - Conversation management (list, create, update)
 * - Message sending and receiving
 * - Search functionality
 * - Read receipts
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 7.1, 7.2, 8.1, 8.2, 8.3
 */

const { logger } = require('../utils/logger');
const wuzapiClient = require('../utils/wuzapiClient');
const { audioConverterService } = require('./AudioConverterService');
const { toBoolean, transformConversation } = require('../utils/responseTransformer');

/**
 * Get current timestamp in Brazil timezone (America/Sao_Paulo)
 * @returns {string} ISO timestamp string in Brazil timezone
 */
function getBrazilTimestamp() {
  const now = new Date();
  
  // Use Intl.DateTimeFormat to get Brazil time components
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Format: YYYY-MM-DD HH:MM:SS (SQLite compatible)
  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value || '00';
  
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

class ChatService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get all conversations for a user, ordered by most recent activity
   * Implements Property 1: Conversation ordering by activity
   * 
   * @param {string} userId - User ID (token)
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status (optional)
   * @param {boolean} filters.hasUnread - Filter by unread (optional)
   * @param {string} filters.search - Search term (optional)
   * @param {Object} pagination - Pagination options
   * @param {number} pagination.limit - Max results (default 20)
   * @param {number} pagination.offset - Offset for pagination (default 0)
   * @returns {Promise<Object>} Conversations with pagination info
   * 
   * Requirements: 1.1, 1.5
   */
  async getConversations(userId, filters = {}, pagination = {}) {
    const { limit = 20, offset = 0 } = pagination;
    const { 
      status = null, hasUnread = false, search = null, 
      inboxId = null, inboxIds = null,
      assignedAgentId = undefined, assignedAgentIdIsNull = false, assignedAgentIdFilter = null
    } = filters;

    try {
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
          c.status,
          c.is_muted,
          c.created_at,
          c.updated_at,
          ab.name as bot_name,
          ab.avatar_url as bot_avatar_url,
          ag.name as assigned_agent_name,
          ag.avatar_url as assigned_agent_avatar_url
        FROM conversations c
        LEFT JOIN agent_bots ab ON c.assigned_bot_id = ab.id
        LEFT JOIN agents ag ON c.assigned_agent_id = ag.id
        WHERE c.user_id = ?
          AND (c.is_test = 0 OR c.is_test IS NULL)
      `;
      
      const params = [userId];

      if (status) {
        sql += ' AND c.status = ?';
        params.push(status);
      }

      if (hasUnread) {
        sql += ' AND c.unread_count > 0';
      }

      if (search) {
        sql += ' AND (c.contact_name LIKE ? OR c.contact_jid LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
      }

      // Filter by inbox - Requirements: 10.1, 10.2
      if (inboxId) {
        sql += ' AND c.inbox_id = ?';
        params.push(inboxId);
      } else if (inboxIds && inboxIds.length > 0) {
        // Filter by multiple inboxes (for agent access)
        const placeholders = inboxIds.map(() => '?').join(',');
        sql += ` AND c.inbox_id IN (${placeholders})`;
        params.push(...inboxIds);
      }

      // Filter by assignment - Requirements: 2.1, 2.4
      if (assignedAgentId !== undefined) {
        if (assignedAgentId === null || assignedAgentIdIsNull) {
          sql += ' AND c.assigned_agent_id IS NULL';
        } else {
          sql += ' AND c.assigned_agent_id = ?';
          params.push(assignedAgentId);
        }
      } else if (assignedAgentIdFilter) {
        // Complex filter: show assigned to specific agent OR unassigned
        const { agentId, includeUnassigned } = assignedAgentIdFilter;
        if (includeUnassigned) {
          sql += ' AND (c.assigned_agent_id = ? OR c.assigned_agent_id IS NULL)';
          params.push(agentId);
        } else {
          sql += ' AND c.assigned_agent_id = ?';
          params.push(agentId);
        }
      }

      sql += ' ORDER BY c.last_message_at DESC NULLS LAST';
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const { rows } = await this.db.query(sql, params);

      // Get total count for pagination (excluding test conversations)
      let countSql = 'SELECT COUNT(*) as total FROM conversations WHERE user_id = ? AND (is_test = 0 OR is_test IS NULL)';
      const countParams = [userId];
      
      if (status) {
        countSql += ' AND status = ?';
        countParams.push(status);
      }

      if (hasUnread) {
        countSql += ' AND unread_count > 0';
      }

      if (search) {
        countSql += ' AND (contact_name LIKE ? OR contact_jid LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      }

      // Filter by inbox for count - Requirements: 10.1, 10.2
      if (inboxId) {
        countSql += ' AND inbox_id = ?';
        countParams.push(inboxId);
      } else if (inboxIds && inboxIds.length > 0) {
        const placeholders = inboxIds.map(() => '?').join(',');
        countSql += ` AND inbox_id IN (${placeholders})`;
        countParams.push(...inboxIds);
      }

      // Filter by assignment for count - Requirements: 2.1, 2.4
      if (assignedAgentId !== undefined) {
        if (assignedAgentId === null || assignedAgentIdIsNull) {
          countSql += ' AND assigned_agent_id IS NULL';
        } else {
          countSql += ' AND assigned_agent_id = ?';
          countParams.push(assignedAgentId);
        }
      } else if (assignedAgentIdFilter) {
        const { agentId, includeUnassigned } = assignedAgentIdFilter;
        if (includeUnassigned) {
          countSql += ' AND (assigned_agent_id = ? OR assigned_agent_id IS NULL)';
          countParams.push(agentId);
        } else {
          countSql += ' AND assigned_agent_id = ?';
          countParams.push(agentId);
        }
      }

      const { rows: countRows } = await this.db.query(countSql, countParams);
      const total = countRows[0]?.total || 0;

      // Get labels for each conversation
      const conversationsWithLabels = await Promise.all(
        rows.map(async (conv) => {
          const labels = await this.getConversationLabels(conv.id);
          const botInfo = conv.assigned_bot_id ? {
            id: conv.assigned_bot_id,
            name: conv.bot_name,
            avatarUrl: conv.bot_avatar_url
          } : null;
          return transformConversation(conv, labels, botInfo);
        })
      );

      logger.info('Conversations retrieved', { userId, count: rows.length, total });

      return {
        conversations: conversationsWithLabels,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total
        }
      };
    } catch (error) {
      logger.error('Failed to get conversations', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get labels for a conversation
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<Array>} Labels
   */
  async getConversationLabels(conversationId) {
    const sql = `
      SELECT l.id, l.name, l.color
      FROM labels l
      INNER JOIN conversation_labels cl ON l.id = cl.label_id
      WHERE cl.conversation_id = ?
    `;
    
    const { rows } = await this.db.query(sql, [conversationId]);
    return rows;
  }

  /**
   * Get messages for a conversation
   * 
   * @param {number} conversationId - Conversation ID
   * @param {number} userId - User ID (for authorization)
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Messages with pagination info
   * 
   * Requirements: 1.4, 12.4
   */
  async getMessages(conversationId, userId, options = {}) {
    const { limit = 50, offset = 0, beforeTimestamp = null } = options;

    try {
      // Verify user owns this conversation
      logger.debug('getMessages called', { conversationId, userId: userId?.substring(0, 8), options });
      const conversation = await this.getConversationById(conversationId, userId);
      if (!conversation) {
        logger.warn('Conversation not found or unauthorized', { conversationId, userId: userId?.substring(0, 8) });
        throw new Error('Conversation not found or unauthorized');
      }

      let sql = `
        SELECT 
          m.id,
          m.conversation_id as conversationId,
          m.message_id as messageId,
          m.direction,
          m.message_type as messageType,
          m.content,
          m.media_url as mediaUrl,
          m.media_mime_type as mediaMimeType,
          m.media_filename as mediaFilename,
          m.reply_to_message_id as replyToMessageId,
          m.status,
          m.is_private_note as isPrivateNote,
          m.sender_type as senderType,
          m.sender_bot_id as senderBotId,
          m.participant_jid as participantJid,
          m.participant_name as participantName,
          m.is_edited as isEdited,
          m.is_deleted as isDeleted,
          m.poll_data as pollData,
          m.interactive_data as interactiveData,
          m.timestamp,
          m.created_at as createdAt
        FROM chat_messages m
        WHERE m.conversation_id = ?
      `;
      
      const params = [conversationId];

      if (beforeTimestamp) {
        sql += ' AND m.timestamp < ?';
        params.push(beforeTimestamp);
      }

      sql += ' ORDER BY m.timestamp DESC, m.id DESC';
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const { rows } = await this.db.query(sql, params);

      // Get reactions for each message and parse JSON fields
      const messagesWithReactions = await Promise.all(
        rows.map(async (msg) => {
          const reactions = await this.getMessageReactions(msg.id);
          const replyToMessage = msg.reply_to_message_id 
            ? await this.getMessageByMessageId(msg.reply_to_message_id, conversationId)
            : null;
          
          if (msg.reply_to_message_id && !replyToMessage) {
            logger.warn('Reply message not found', {
              messageId: msg.id,
              replyToMessageId: msg.reply_to_message_id,
              conversationId
            });
          }
          
          // Parse JSON fields for special message types
          let pollData = null;
          let interactiveData = null;
          
          if (msg.pollData) {
            try {
              pollData = typeof msg.pollData === 'string' ? JSON.parse(msg.pollData) : msg.pollData;
            } catch (e) {
              logger.warn('Failed to parse pollData', { messageId: msg.id, error: e.message });
            }
          }
          
          if (msg.interactiveData) {
            try {
              interactiveData = typeof msg.interactiveData === 'string' ? JSON.parse(msg.interactiveData) : msg.interactiveData;
            } catch (e) {
              logger.warn('Failed to parse interactiveData', { messageId: msg.id, error: e.message });
            }
          }
          
          return {
            ...msg,
            pollData,
            interactiveData,
            isEdited: Boolean(msg.isEdited),
            isDeleted: Boolean(msg.isDeleted),
            reactions,
            replyToMessage
          };
        })
      );

      // Get total count
      const { rows: countRows } = await this.db.query(
        'SELECT COUNT(*) as total FROM chat_messages WHERE conversation_id = ?',
        [conversationId]
      );
      const total = countRows[0]?.total || 0;

      logger.info('Messages retrieved', { conversationId, count: rows.length });

      return {
        messages: messagesWithReactions.reverse(), // Return in chronological order
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total
        }
      };
    } catch (error) {
      logger.error('Failed to get messages', { conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Get reactions for a message
   * @param {number} messageId - Message ID (internal)
   * @returns {Promise<Array>} Reactions
   */
  async getMessageReactions(messageId) {
    const sql = `
      SELECT id, emoji, reactor_jid, created_at
      FROM message_reactions
      WHERE message_id = ?
    `;
    
    const { rows } = await this.db.query(sql, [messageId]);
    return rows;
  }

  /**
   * Get a message by its WhatsApp message ID or internal ID
   * @param {string|number} messageId - WhatsApp message ID or internal ID
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<Object|null>} Message or null
   */
  async getMessageByMessageId(messageId, conversationId) {
    // Try to parse as internal ID first (numeric)
    const internalId = parseInt(messageId, 10);
    
    let sql, params;
    
    if (!isNaN(internalId)) {
      // Search by internal ID
      sql = `
        SELECT 
          id, 
          message_id as messageId, 
          direction, 
          message_type as messageType, 
          content,
          media_url as mediaUrl,
          media_mime_type as mediaMimeType,
          media_filename as mediaFilename,
          reply_to_message_id as replyToMessageId,
          status,
          is_private_note as isPrivateNote,
          sender_type as senderType,
          sender_bot_id as senderBotId,
          participant_jid as participantJid,
          participant_name as participantName,
          is_edited as isEdited,
          is_deleted as isDeleted,
          poll_data as pollData,
          interactive_data as interactiveData,
          timestamp,
          created_at as createdAt
        FROM chat_messages
        WHERE id = ? AND conversation_id = ?
      `;
      params = [internalId, conversationId];
    } else {
      // Search by WUZAPI message_id
      sql = `
        SELECT 
          id, 
          message_id as messageId, 
          direction, 
          message_type as messageType, 
          content,
          media_url as mediaUrl,
          media_mime_type as mediaMimeType,
          media_filename as mediaFilename,
          reply_to_message_id as replyToMessageId,
          status,
          is_private_note as isPrivateNote,
          sender_type as senderType,
          sender_bot_id as senderBotId,
          participant_jid as participantJid,
          participant_name as participantName,
          is_edited as isEdited,
          is_deleted as isDeleted,
          poll_data as pollData,
          interactive_data as interactiveData,
          timestamp,
          created_at as createdAt
        FROM chat_messages
        WHERE message_id = ? AND conversation_id = ?
      `;
      params = [messageId, conversationId];
    }
    
    const { rows } = await this.db.query(sql, params);
    
    if (rows.length === 0) {
      logger.debug('Message not found by messageId', { messageId, conversationId, isInternalId: !isNaN(internalId) });
      return null;
    }
    
    const message = rows[0];
    
    // Get reactions for this message
    const reactions = await this.getMessageReactions(message.id);
    
    // Parse JSON fields for special message types
    let pollData = null;
    let interactiveData = null;
    
    if (message.pollData) {
      try {
        pollData = typeof message.pollData === 'string' ? JSON.parse(message.pollData) : message.pollData;
      } catch (e) {
        logger.warn('Failed to parse pollData', { messageId: message.id, error: e.message });
      }
    }
    
    if (message.interactiveData) {
      try {
        interactiveData = typeof message.interactiveData === 'string' ? JSON.parse(message.interactiveData) : message.interactiveData;
      } catch (e) {
        logger.warn('Failed to parse interactiveData', { messageId: message.id, error: e.message });
      }
    }
    
    return {
      ...message,
      pollData,
      interactiveData,
      isEdited: Boolean(message.isEdited),
      isDeleted: Boolean(message.isDeleted),
      reactions
    };
  }

  /**
   * Get a conversation by ID
   * @param {number} conversationId - Conversation ID
   * @param {number} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Conversation or null
   */
  async getConversationById(conversationId, userId) {
    const sql = `
      SELECT * FROM conversations
      WHERE id = ? AND user_id = ?
    `;
    
    const { rows } = await this.db.query(sql, [conversationId, userId]);
    return rows[0] || null;
  }

  /**
   * Get a conversation by contact JID
   * @param {string} userId - User ID
   * @param {string} contactJid - Contact JID
   * @returns {Promise<Object|null>} Conversation or null
   */
  async getConversationByJid(userId, contactJid) {
    const sql = `
      SELECT * FROM conversations
      WHERE user_id = ? AND contact_jid = ?
    `;
    
    const { rows } = await this.db.query(sql, [userId, contactJid]);
    return rows[0] || null;
  }

  /**
   * Send a text message
   * Implements Property 4: Empty message rejection
   * 
   * @param {number} userId - User ID
   * @param {number} conversationId - Conversation ID
   * @param {string} content - Message content
   * @param {string} userToken - WUZAPI user token
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Sent message
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async sendMessage(userId, conversationId, content, userToken, options = {}) {
    const { replyToMessageId = null } = options;

    logger.debug('sendMessage called', { 
      userId, 
      conversationId, 
      replyToMessageId,
      replyToMessageIdType: typeof replyToMessageId
    });

    try {
      // Validate message content (Property 4)
      if (!this.validateMessageContent(content)) {
        throw new Error('Message content cannot be empty or whitespace only');
      }

      // Get conversation
      const conversation = await this.getConversationById(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      // Generate unique message ID
      const messageId = this.generateMessageId();

      // Create message record with pending status
      const insertSql = `
        INSERT INTO chat_messages (
          conversation_id, message_id, direction, message_type, content,
          reply_to_message_id, status, sender_type, timestamp
        ) VALUES (?, ?, 'outgoing', 'text', ?, ?, 'pending', 'user', ?)
      `;
      
      const { lastID } = await this.db.query(insertSql, [
        conversationId,
        messageId,
        content,
        replyToMessageId,
        getBrazilTimestamp()
      ]);

      // Send via WUZAPI
      // Detectar se é um grupo (JID termina com @g.us)
      const isGroup = conversation.contact_jid.endsWith('@g.us');
      
      const wuzapiPayload = {
        // Para grupos, usar o JID completo; para contatos, remover o sufixo
        Phone: isGroup 
          ? conversation.contact_jid 
          : conversation.contact_jid.replace('@s.whatsapp.net', ''),
        Body: content
      };

      // Add reply context if replying
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
      await this.updateMessageStatus(lastID, newStatus);

      // Update conversation
      await this.updateConversationLastMessage(conversationId, content);

      const message = await this.getMessageById(lastID);

      logger.info('Message sent', { 
        userId, 
        conversationId, 
        messageId,
        status: newStatus 
      });

      return message;
    } catch (error) {
      logger.error('Failed to send message', { 
        userId, 
        conversationId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Validate message content
   * Implements Property 4: Empty message rejection
   * 
   * @param {string} content - Message content
   * @returns {boolean} True if valid
   */
  validateMessageContent(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }
    // Reject if content is only whitespace
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
   * Update message status
   * @param {number} id - Internal message ID
   * @param {string} status - New status
   */
  async updateMessageStatus(id, status) {
    const sql = 'UPDATE chat_messages SET status = ? WHERE id = ?';
    await this.db.query(sql, [status, id]);
  }

  /**
   * Get message by internal ID
   * @param {number} id - Internal message ID
   * @returns {Promise<Object|null>} Message
   */
  async getMessageById(id) {
    const sql = `
      SELECT 
        m.id,
        m.conversation_id as conversationId,
        m.message_id as messageId,
        m.direction,
        m.message_type as messageType,
        m.content,
        m.media_url as mediaUrl,
        m.media_mime_type as mediaMimeType,
        m.media_filename as mediaFilename,
        m.reply_to_message_id as replyToMessageId,
        m.status,
        m.is_private_note as isPrivateNote,
        m.sender_type as senderType,
        m.sender_bot_id as senderBotId,
        m.participant_jid as participantJid,
        m.participant_name as participantName,
        m.is_edited as isEdited,
        m.is_deleted as isDeleted,
        m.poll_data as pollData,
        m.interactive_data as interactiveData,
        m.timestamp,
        m.created_at as createdAt
      FROM chat_messages m
      WHERE m.id = ?
    `;
    const { rows } = await this.db.query(sql, [id]);
    
    if (rows.length === 0) {
      return null;
    }
    
    const message = rows[0];
    
    // Get reactions
    const reactions = await this.getMessageReactions(message.id);
    
    // Get reply message if exists
    let replyToMessage = null;
    if (message.replyToMessageId) {
      replyToMessage = await this.getMessageByMessageId(message.replyToMessageId, message.conversationId);
    }
    
    // Parse JSON fields for special message types
    let pollData = null;
    let interactiveData = null;
    
    if (message.pollData) {
      try {
        pollData = typeof message.pollData === 'string' ? JSON.parse(message.pollData) : message.pollData;
      } catch (e) {
        logger.warn('Failed to parse pollData in getMessageById', { messageId: id, error: e.message });
      }
    }
    
    if (message.interactiveData) {
      try {
        interactiveData = typeof message.interactiveData === 'string' ? JSON.parse(message.interactiveData) : message.interactiveData;
      } catch (e) {
        logger.warn('Failed to parse interactiveData in getMessageById', { messageId: id, error: e.message });
      }
    }
    
    return {
      ...message,
      pollData,
      interactiveData,
      isEdited: Boolean(message.isEdited),
      isDeleted: Boolean(message.isDeleted),
      reactions,
      replyToMessage
    };
  }

  /**
   * Update conversation's last message info
   * @param {number} conversationId - Conversation ID
   * @param {string} preview - Message preview
   */
  async updateConversationLastMessage(conversationId, preview) {
    const timestamp = getBrazilTimestamp();
    const sql = `
      UPDATE conversations 
      SET last_message_at = ?,
          last_message_preview = ?,
          updated_at = ?
      WHERE id = ?
    `;
    await this.db.query(sql, [timestamp, preview.substring(0, 100), timestamp, conversationId]);
  }

  /**
   * Mark messages as read
   * Implements Property 8: Unread count consistency
   * 
   * @param {number} conversationId - Conversation ID
   * @param {number} userId - User ID
   * @param {string} userToken - WUZAPI user token
   * @returns {Promise<void>}
   * 
   * Requirements: 8.1, 8.2, 8.3
   */
  async markAsRead(conversationId, userId, userToken) {
    try {
      const conversation = await this.getConversationById(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      // Update all unread incoming messages to read
      const updateSql = `
        UPDATE chat_messages 
        SET status = 'read'
        WHERE conversation_id = ? 
          AND direction = 'incoming' 
          AND status != 'read'
      `;
      await this.db.query(updateSql, [conversationId]);

      // Reset unread count
      const resetSql = `
        UPDATE conversations 
        SET unread_count = 0, updated_at = ?
        WHERE id = ?
      `;
      await this.db.query(resetSql, [getBrazilTimestamp(), conversationId]);

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
   * Implements Property 6: Conversation search filtering
   * 
   * @param {number} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Matching conversations
   * 
   * Requirements: 7.1
   */
  async searchConversations(userId, query, options = {}) {
    const { limit = 20 } = options;

    try {
      if (!query || query.trim().length === 0) {
        return [];
      }

      const searchTerm = `%${query.toLowerCase()}%`;
      
      const sql = `
        SELECT 
          c.id,
          c.contact_jid,
          c.contact_name,
          c.contact_avatar_url,
          c.last_message_at,
          c.last_message_preview,
          c.unread_count,
          c.status
        FROM conversations c
        WHERE c.user_id = ?
          AND (
            LOWER(c.contact_name) LIKE ?
            OR LOWER(c.contact_jid) LIKE ?
          )
        ORDER BY c.last_message_at DESC
        LIMIT ?
      `;

      const { rows } = await this.db.query(sql, [userId, searchTerm, searchTerm, limit]);

      logger.info('Conversations searched', { userId, query, results: rows.length });

      return rows;
    } catch (error) {
      logger.error('Failed to search conversations', { userId, query, error: error.message });
      throw error;
    }
  }

  /**
   * Search messages within a conversation
   * Implements Property 7: Message search within conversation
   * 
   * @param {number} conversationId - Conversation ID
   * @param {number} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Matching messages
   * 
   * Requirements: 7.2
   */
  async searchMessages(conversationId, userId, query, options = {}) {
    const { limit = 50 } = options;

    try {
      // Verify user owns this conversation
      const conversation = await this.getConversationById(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or unauthorized');
      }

      if (!query || query.trim().length === 0) {
        return [];
      }

      const searchTerm = `%${query.toLowerCase()}%`;
      
      const sql = `
        SELECT 
          id,
          message_id,
          direction,
          message_type,
          content,
          timestamp
        FROM chat_messages
        WHERE conversation_id = ?
          AND LOWER(content) LIKE ?
          AND is_private_note = 0
        ORDER BY timestamp DESC, id DESC
        LIMIT ?
      `;

      const { rows } = await this.db.query(sql, [conversationId, searchTerm, limit]);

      logger.info('Messages searched', { conversationId, query, results: rows.length });

      return rows;
    } catch (error) {
      logger.error('Failed to search messages', { conversationId, query, error: error.message });
      throw error;
    }
  }

  /**
   * Create or get existing conversation for a contact
   * Implements Property 20: Conversation-contact uniqueness
   * 
   * @param {number} userId - User ID
   * @param {string} contactJid - Contact JID
   * @param {Object} contactInfo - Contact information
   * @returns {Promise<Object>} Conversation
   */
  async getOrCreateConversation(userId, contactJid, contactInfo = {}) {
    try {
      // Check if conversation exists
      const existingSql = `
        SELECT * FROM conversations
        WHERE user_id = ? AND contact_jid = ?
      `;
      const { rows } = await this.db.query(existingSql, [userId, contactJid]);

      if (rows.length > 0) {
        // Update contact info if provided
        if (contactInfo.name || contactInfo.avatarUrl || contactInfo.inboxId) {
          await this.updateConversationContact(rows[0].id, contactInfo);
        }
        return rows[0];
      }

      // Create new conversation
      // Auto-assign bot if user has active bots (Requirements: 1.1, 1.2, 1.3, 1.4)
      const BotService = require('./BotService');
      const botService = new BotService(this.db);
      const defaultBot = await botService.getHighestPriorityActiveBot(userId);
      
      const insertSql = `
        INSERT INTO conversations (
          user_id, contact_jid, contact_name, contact_avatar_url, status, assigned_bot_id, inbox_id
        ) VALUES (?, ?, ?, ?, 'open', ?, ?)
      `;
      
      const { lastID } = await this.db.query(insertSql, [
        userId,
        contactJid,
        contactInfo.name || null,
        contactInfo.avatarUrl || null,
        defaultBot?.id || null,
        contactInfo.inboxId || null
      ]);

      // Auto-assign to agent if inbox has auto-assignment enabled - Requirements: 1.1, 1.5, 7.2
      let assignedAgentId = null;
      if (contactInfo.inboxId) {
        try {
          const ConversationAssignmentService = require('./ConversationAssignmentService');
          const assignmentService = new ConversationAssignmentService(this.db);
          assignedAgentId = await assignmentService.autoAssign(contactInfo.inboxId, lastID);
        } catch (assignError) {
          // Don't fail conversation creation if auto-assignment fails
          logger.error('Auto-assignment failed', { 
            conversationId: lastID, 
            inboxId: contactInfo.inboxId, 
            error: assignError.message 
          });
        }
      }

      const newConversation = await this.getConversationById(lastID, userId);

      logger.info('Conversation created', { 
        userId, 
        contactJid, 
        conversationId: lastID,
        assignedBotId: defaultBot?.id || null,
        assignedAgentId
      });

      return newConversation;
    } catch (error) {
      logger.error('Failed to get/create conversation', { userId, contactJid, error: error.message });
      throw error;
    }
  }

  /**
   * Update conversation contact info
   * @param {number} conversationId - Conversation ID
   * @param {Object} contactInfo - Contact information
   */
  async updateConversationContact(conversationId, contactInfo) {
    const updates = [];
    const params = [];

    if (contactInfo.name) {
      updates.push('contact_name = ?');
      params.push(contactInfo.name);
    }
    if (contactInfo.avatarUrl) {
      updates.push('contact_avatar_url = ?');
      params.push(contactInfo.avatarUrl);
    }
    // Update inbox_id only if not already set
    if (contactInfo.inboxId) {
      updates.push('inbox_id = COALESCE(inbox_id, ?)');
      params.push(contactInfo.inboxId);
    }

    if (updates.length === 0) return;

    updates.push("updated_at = ?");
    params.push(getBrazilTimestamp());
    params.push(conversationId);

    const sql = `UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`;
    await this.db.query(sql, params);
  }

  /**
   * Store an incoming message from webhook
   * 
   * Enhanced to support:
   * - Message deduplication (Property 5)
   * - Custom sender_type for bot messages (Property 4, 6)
   * - Unread count invariant for outgoing messages (Property 2)
   * 
   * @param {number} conversationId - Conversation ID
   * @param {Object} messageData - Message data from webhook
   * @param {string} messageData.direction - Message direction (incoming or outgoing), defaults to 'incoming'
   * @param {string} messageData.senderType - Sender type override (user, bot, contact, system)
   * @param {boolean} messageData.isExternalBot - If true and outgoing, marks as bot message
   * @returns {Promise<Object>} Stored message
   * 
   * Requirements: 1.1, 1.3, 3.1, 4.1, 4.2
   */
  async storeIncomingMessage(conversationId, messageData) {
    try {
      const direction = messageData.direction || 'incoming'
      
      // Check for duplicate message (Property 5: Deduplication)
      if (messageData.messageId) {
        const exists = await this.messageExists(conversationId, messageData.messageId);
        if (exists) {
          logger.info('Message already exists, skipping insertion (deduplication)', {
            conversationId,
            messageId: messageData.messageId,
            direction
          });
          // Return existing message
          const sql = `
            SELECT id FROM chat_messages
            WHERE conversation_id = ? AND message_id = ?
          `;
          const { rows } = await this.db.query(sql, [conversationId, messageData.messageId]);
          if (rows.length > 0) {
            return await this.getMessageById(rows[0].id);
          }
          return null;
        }
      }
      
      // Outgoing messages from WhatsApp are already sent, incoming are delivered
      const status = direction === 'outgoing' ? 'sent' : 'delivered'
      
      // Determine sender_type (Property 4, 6)
      // Priority: explicit senderType > isExternalBot flag > default based on direction
      let senderType;
      if (messageData.senderType) {
        senderType = messageData.senderType;
      } else if (direction === 'outgoing' && messageData.isExternalBot) {
        // Outgoing message from external bot (via webhook, not from system)
        senderType = 'bot';
      } else {
        // Default: outgoing = user, incoming = contact
        senderType = direction === 'outgoing' ? 'user' : 'contact';
      }
      
      const insertSql = `
        INSERT INTO chat_messages (
          conversation_id, message_id, direction, message_type, content,
          media_url, media_mime_type, media_filename, media_metadata, reply_to_message_id, 
          status, sender_type, timestamp, participant_jid, participant_name,
          is_edited, is_deleted, poll_data, interactive_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      // Serialize media metadata to JSON if present
      const mediaMetadataJson = messageData.mediaMetadata 
        ? JSON.stringify(messageData.mediaMetadata) 
        : null;
      
      // Serialize poll data to JSON if present
      const pollDataJson = messageData.pollData 
        ? JSON.stringify(messageData.pollData) 
        : null;
      
      // Serialize interactive data to JSON if present
      const interactiveDataJson = messageData.interactiveData 
        ? JSON.stringify(messageData.interactiveData) 
        : null;
      
      const { lastID } = await this.db.query(insertSql, [
        conversationId,
        messageData.messageId,
        direction,
        messageData.type || 'text',
        messageData.content || null,
        messageData.mediaUrl || null,
        messageData.mediaMimeType || null,
        messageData.mediaFilename || null,
        mediaMetadataJson,
        messageData.replyToMessageId || null,
        status,
        senderType,
        messageData.timestamp || new Date().toISOString(),
        messageData.participantJid || null,
        messageData.participantName || null,
        messageData.isEdited ? 1 : 0,
        messageData.isDeleted ? 1 : 0,
        pollDataJson,
        interactiveDataJson
      ]);

      // Update conversation
      await this.updateConversationLastMessage(conversationId, messageData.content || '[Media]');
      
      // Only increment unread count for incoming messages (Property 2)
      if (direction === 'incoming') {
        await this.db.query(
          'UPDATE conversations SET unread_count = unread_count + 1 WHERE id = ?',
          [conversationId]
        );
      }

      const message = await this.getMessageById(lastID);

      logger.info('Message stored from webhook', { 
        conversationId, 
        messageId: messageData.messageId, 
        direction,
        senderType,
        status,
        hasReply: !!messageData.replyToMessageId 
      });

      return message;
    } catch (error) {
      logger.error('Failed to store incoming message', { conversationId, error: error.message });
      throw error;
    }
  }

  /**
   * Calculate unread count for a conversation
   * Used to verify Property 8: Unread count consistency
   * 
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<number>} Unread count
   */
  async calculateUnreadCount(conversationId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM chat_messages
      WHERE conversation_id = ?
        AND direction = 'incoming'
        AND status != 'read'
    `;
    
    const { rows } = await this.db.query(sql, [conversationId]);
    return rows[0]?.count || 0;
  }
}

module.exports = ChatService;

// ==================== Label Methods ====================

/**
 * Get all labels for a user
 * @param {string} userToken - User token (used as userId)
 * @returns {Promise<Array>} Labels
 */
ChatService.prototype.getLabels = async function(userToken) {
  const sql = `
    SELECT l.id, l.name, l.color, l.created_at,
           COUNT(cl.conversation_id) as usage_count
    FROM labels l
    LEFT JOIN conversation_labels cl ON l.id = cl.label_id
    WHERE l.user_id = ?
    GROUP BY l.id
    ORDER BY l.name
  `;
  
  const { rows } = await this.db.query(sql, [userToken]);
  return rows;
};

/**
 * Create a new label
 * @param {string} userToken - User token (used as userId)
 * @param {Object} data - Label data
 * @returns {Promise<Object>} Created label
 */
ChatService.prototype.createLabel = async function(userToken, data) {
  const { name, color = '#6366f1' } = data;
  
  const sql = `
    INSERT INTO labels (user_id, name, color)
    VALUES (?, ?, ?)
  `;
  
  const { lastID } = await this.db.query(sql, [userToken, name, color]);
  
  const { rows } = await this.db.query('SELECT * FROM labels WHERE id = ?', [lastID]);
  return rows[0];
};

/**
 * Update a label
 * @param {string} userToken - User token (used as userId)
 * @param {number} labelId - Label ID
 * @param {Object} data - Label data
 * @returns {Promise<Object>} Updated label
 */
ChatService.prototype.updateLabel = async function(userToken, labelId, data) {
  const { name, color } = data;
  
  const updates = [];
  const params = [];
  
  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (color) {
    updates.push('color = ?');
    params.push(color);
  }
  
  if (updates.length === 0) {
    throw new Error('No updates provided');
  }
  
  params.push(labelId, userToken);
  
  const sql = `
    UPDATE labels SET ${updates.join(', ')}
    WHERE id = ? AND user_id = ?
  `;
  
  await this.db.query(sql, params);
  
  const { rows } = await this.db.query('SELECT * FROM labels WHERE id = ?', [labelId]);
  return rows[0];
};

/**
 * Delete a label
 * @param {string} userToken - User token (used as userId)
 * @param {number} labelId - Label ID
 */
ChatService.prototype.deleteLabel = async function(userToken, labelId) {
  // First remove all associations
  await this.db.query(
    'DELETE FROM conversation_labels WHERE label_id = ?',
    [labelId]
  );
  
  // Then delete the label
  const sql = `
    DELETE FROM labels
    WHERE id = ? AND user_id = ?
  `;
  
  await this.db.query(sql, [labelId, userToken]);
};

/**
 * Assign a label to a conversation
 * @param {string} userToken - User token (used as userId)
 * @param {number} conversationId - Conversation ID
 * @param {number} labelId - Label ID
 */
ChatService.prototype.assignLabel = async function(userToken, conversationId, labelId) {
  // Verify conversation ownership
  const verifyConv = `
    SELECT id FROM conversations
    WHERE id = ? AND user_id = ?
  `;
  const { rows: convRows } = await this.db.query(verifyConv, [conversationId, userToken]);
  if (convRows.length === 0) {
    throw new Error('Conversation not found or unauthorized');
  }
  
  // Verify label ownership
  const verifyLabel = `
    SELECT id FROM labels
    WHERE id = ? AND user_id = ?
  `;
  const { rows: labelRows } = await this.db.query(verifyLabel, [labelId, userToken]);
  if (labelRows.length === 0) {
    throw new Error('Label not found or unauthorized');
  }
  
  // Insert (ignore if already exists)
  const sql = `
    INSERT OR IGNORE INTO conversation_labels (conversation_id, label_id)
    VALUES (?, ?)
  `;
  
  await this.db.query(sql, [conversationId, labelId]);
};

/**
 * Remove a label from a conversation
 * @param {string} userToken - User token
 * @param {number} conversationId - Conversation ID
 * @param {number} labelId - Label ID
 */
ChatService.prototype.removeLabel = async function(userToken, conversationId, labelId) {
  const sql = `
    DELETE FROM conversation_labels
    WHERE conversation_id = ? AND label_id = ?
  `;
  
  await this.db.query(sql, [conversationId, labelId]);
};

// ==================== Canned Response Methods ====================

/**
 * Get all canned responses for a user
 * @param {string} userToken - User token (used as userId)
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Canned responses
 */
ChatService.prototype.getCannedResponses = async function(userToken, options = {}) {
  const { search } = options;
  
  let sql = `
    SELECT id, shortcut, content, created_at, updated_at
    FROM canned_responses
    WHERE user_id = ?
  `;
  
  const params = [userToken];
  
  if (search) {
    sql += ' AND (LOWER(shortcut) LIKE ? OR LOWER(content) LIKE ?)';
    const searchTerm = `%${search.toLowerCase()}%`;
    params.push(searchTerm, searchTerm);
  }
  
  sql += ' ORDER BY shortcut';
  
  const { rows } = await this.db.query(sql, params);
  return rows;
};

/**
 * Create a new canned response
 * @param {string} userToken - User token (used as userId)
 * @param {Object} data - Canned response data
 * @returns {Promise<Object>} Created canned response
 */
ChatService.prototype.createCannedResponse = async function(userToken, data) {
  const { shortcut, content } = data;
  
  const sql = `
    INSERT INTO canned_responses (user_id, shortcut, content)
    VALUES (?, ?, ?)
  `;
  
  const { lastID } = await this.db.query(sql, [userToken, shortcut, content]);
  
  const { rows } = await this.db.query('SELECT * FROM canned_responses WHERE id = ?', [lastID]);
  return rows[0];
};

/**
 * Update a canned response
 * @param {string} userToken - User token (used as userId)
 * @param {number} responseId - Response ID
 * @param {Object} data - Canned response data
 * @returns {Promise<Object>} Updated canned response
 */
ChatService.prototype.updateCannedResponse = async function(userToken, responseId, data) {
  const { shortcut, content } = data;
  
  const updates = [];
  const params = [];
  
  if (shortcut) {
    updates.push('shortcut = ?');
    params.push(shortcut);
  }
  if (content) {
    updates.push('content = ?');
    params.push(content);
  }
  
  if (updates.length === 0) {
    throw new Error('No updates provided');
  }
  
  updates.push("updated_at = ?");
  params.push(getBrazilTimestamp());
  params.push(responseId, userToken);
  
  const sql = `
    UPDATE canned_responses SET ${updates.join(', ')}
    WHERE id = ? AND user_id = ?
  `;
  
  await this.db.query(sql, params);
  
  const { rows } = await this.db.query('SELECT * FROM canned_responses WHERE id = ?', [responseId]);
  return rows[0];
};

/**
 * Delete a canned response
 * @param {string} userToken - User token (used as userId)
 * @param {number} responseId - Response ID
 */
ChatService.prototype.deleteCannedResponse = async function(userToken, responseId) {
  const sql = `
    DELETE FROM canned_responses
    WHERE id = ? AND user_id = ?
  `;
  
  await this.db.query(sql, [responseId, userToken]);
};

// ==================== Additional Conversation Methods ====================

/**
 * Get a single conversation with labels (for routes)
 * @param {string} userToken - User token (used as userId)
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Conversation with labels
 */
ChatService.prototype.getConversation = async function(userToken, conversationId) {
  const sql = `
    SELECT c.*, ab.name as bot_name, ab.avatar_url as bot_avatar_url
    FROM conversations c
    LEFT JOIN agent_bots ab ON c.assigned_bot_id = ab.id
    WHERE c.id = ? AND c.user_id = ?
  `;
  
  const { rows } = await this.db.query(sql, [conversationId, userToken]);
  
  if (rows.length === 0) return null;
  
  const conversation = rows[0];
  const labels = await this.getConversationLabels(conversationId);
  const botInfo = conversation.assigned_bot_id ? {
    id: conversation.assigned_bot_id,
    name: conversation.bot_name,
    avatarUrl: conversation.bot_avatar_url
  } : null;
  
  return transformConversation(conversation, labels, botInfo);
};

/**
 * Delete a conversation and all its messages (for routes)
 * @param {string} userToken - User token
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<void>}
 */
ChatService.prototype.deleteConversation = async function(userToken, conversationId) {
  // Verify ownership
  const conversation = await this.getConversation(userToken, conversationId);
  if (!conversation) {
    throw new Error('Conversa não encontrada ou não autorizada');
  }

  // Delete in order: reactions -> messages -> labels -> conversation
  await this.db.query(
    `DELETE FROM message_reactions WHERE message_id IN (
      SELECT id FROM chat_messages WHERE conversation_id = ?
    )`,
    [conversationId]
  );

  await this.db.query(
    'DELETE FROM chat_messages WHERE conversation_id = ?',
    [conversationId]
  );

  await this.db.query(
    'DELETE FROM conversation_labels WHERE conversation_id = ?',
    [conversationId]
  );

  await this.db.query(
    'DELETE FROM conversations WHERE id = ? AND user_id = ?',
    [conversationId, userToken]
  );

  logger.info('Conversation deleted', { conversationId, userToken });
};

/**
 * Update a conversation (for routes)
 * @param {string} userToken - User token
 * @param {number} conversationId - Conversation ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated conversation
 */
ChatService.prototype.updateConversation = async function(userToken, conversationId, updates) {
  const { status, assignedBotId, isMuted } = updates;
  
  const updateParts = [];
  const params = [];
  
  if (status) {
    updateParts.push('status = ?');
    params.push(status);
  }
  if (assignedBotId !== undefined) {
    updateParts.push('assigned_bot_id = ?');
    params.push(assignedBotId || null);
  }
  if (isMuted !== undefined) {
    updateParts.push('is_muted = ?');
    params.push(isMuted ? 1 : 0);
  }
  
  if (updateParts.length === 0) {
    return this.getConversation(userToken, conversationId);
  }
  
  updateParts.push("updated_at = ?");
  params.push(getBrazilTimestamp());
  params.push(conversationId, userToken);
  
  const sql = `
    UPDATE conversations SET ${updateParts.join(', ')}
    WHERE id = ? AND user_id = ?
  `;
  
  await this.db.query(sql, params);
  
  return this.getConversation(userToken, conversationId);
};

/**
 * Mark conversation as read (for routes)
 * @param {string} userToken - User token
 * @param {number} conversationId - Conversation ID
 */
ChatService.prototype.markConversationAsRead = async function(userToken, conversationId) {
  // Verify ownership
  const conversation = await this.getConversation(userToken, conversationId);
  if (!conversation) {
    throw new Error('Conversation not found or unauthorized');
  }
  
  // Update all unread incoming messages to read
  const updateSql = `
    UPDATE chat_messages 
    SET status = 'read'
    WHERE conversation_id = ? 
      AND direction = 'incoming' 
      AND status != 'read'
  `;
  await this.db.query(updateSql, [conversationId]);
  
  // Reset unread count
  const resetSql = `
    UPDATE conversations 
    SET unread_count = 0, updated_at = ?
    WHERE id = ?
  `;
  await this.db.query(resetSql, [getBrazilTimestamp(), conversationId]);
};

/**
 * Create a message (for routes)
 * @param {string} userToken - User token
 * @param {number} conversationId - Conversation ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Created message
 */
ChatService.prototype.createMessage = async function(userToken, conversationId, messageData) {
  // Verify ownership
  const conversation = await this.getConversation(userToken, conversationId);
  if (!conversation) {
    throw new Error('Conversation not found or unauthorized');
  }
  
  const {
    direction = 'outgoing',
    messageType = 'text',
    content,
    mediaUrl,
    mediaFilename,
    mediaMimeType,
    replyToMessageId,
    status = 'pending'
  } = messageData;
  
  logger.debug('createMessage called', {
    conversationId,
    replyToMessageId,
    replyToMessageIdType: typeof replyToMessageId,
    messageType
  });
  
  const messageId = this.generateMessageId();
  
  // Detect mime type from base64 data URL if not provided
  let finalMimeType = mediaMimeType;
  if (!finalMimeType && mediaUrl && mediaUrl.startsWith('data:')) {
    const match = mediaUrl.match(/^data:([^;]+);/);
    if (match) {
      finalMimeType = match[1];
    }
  }
  // Default mime types based on message type
  if (!finalMimeType && messageType !== 'text') {
    const defaultMimes = {
      'image': 'image/jpeg',
      'video': 'video/mp4',
      'audio': 'audio/ogg; codecs=opus',
      'document': 'application/octet-stream'
    };
    finalMimeType = defaultMimes[messageType] || 'application/octet-stream';
  }
  
  const sql = `
    INSERT INTO chat_messages (
      conversation_id, message_id, direction, message_type, content,
      media_url, media_filename, media_mime_type, reply_to_message_id, status, sender_type, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', ?)
  `;
  
  const { lastID } = await this.db.query(sql, [
    conversationId,
    messageId,
    direction,
    messageType,
    content,
    mediaUrl || null,
    mediaFilename || null,
    finalMimeType || null,
    replyToMessageId || null,
    status,
    getBrazilTimestamp()
  ]);
  
  // Update conversation
  await this.updateConversationLastMessage(conversationId, content || '[Media]');
  
  return this.getMessageById(lastID);
};

/**
 * Search messages across all conversations (for routes)
 * @param {string} userToken - User token (used as userId)
 * @param {string} query - Search query
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Search results
 */
ChatService.prototype.searchMessages = async function(userToken, query, options = {}) {
  const { limit = 20 } = options;
  
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const sql = `
    SELECT 
      m.id,
      m.conversation_id,
      m.message_id,
      m.content,
      m.timestamp,
      c.contact_name,
      c.contact_jid
    FROM chat_messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = ?
      AND LOWER(m.content) LIKE ?
      AND m.is_private_note = 0
    ORDER BY m.timestamp DESC, m.id DESC
    LIMIT ?
  `;
  
  const { rows } = await this.db.query(sql, [userToken, searchTerm, limit]);
  return rows;
};


// ==================== Media Message Methods ====================

/**
 * Send an image message
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {Object} data - Image data
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Sent message
 * 
 * Requirements: 3.1
 */
ChatService.prototype.sendImageMessage = async function(userId, conversationId, data, userToken) {
  const { image, caption = '' } = data;

  try {
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messageId = this.generateMessageId();

    // Detect mime type from base64 data URL or default to image/jpeg
    let mimeType = 'image/jpeg';
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);/);
      if (match) {
        mimeType = match[1];
      }
    }

    // Create message record with pending status
    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        media_url, media_mime_type, status, sender_type, timestamp
      ) VALUES (?, ?, 'outgoing', 'image', ?, ?, ?, 'pending', 'user', ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      caption,
      image,
      mimeType,
      getBrazilTimestamp()
    ]);

    // Send via WUZAPI
    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    const response = await wuzapiClient.post('/chat/send/image', {
      Phone: phone,
      Image: image,
      Caption: caption
    }, {
      headers: { 'Token': userToken }
    });

    const newStatus = response.success ? 'sent' : 'failed';
    await this.updateMessageStatus(lastID, newStatus);
    await this.updateConversationLastMessage(conversationId, caption || '[Imagem]');

    const message = await this.getMessageById(lastID);
    logger.info('Image message sent', { userId, conversationId, messageId });

    return message;
  } catch (error) {
    logger.error('Failed to send image message', { userId, conversationId, error: error.message });
    throw error;
  }
};

/**
 * Send a video message
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {Object} data - Video data
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Sent message
 * 
 * Requirements: 3.2
 */
ChatService.prototype.sendVideoMessage = async function(userId, conversationId, data, userToken) {
  const { video, caption = '' } = data;

  try {
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messageId = this.generateMessageId();

    // Detect mime type from base64 data URL or default to video/mp4
    let mimeType = 'video/mp4';
    if (video.startsWith('data:')) {
      const match = video.match(/^data:([^;]+);/);
      if (match) {
        mimeType = match[1];
      }
    }

    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        media_url, media_mime_type, status, sender_type, timestamp
      ) VALUES (?, ?, 'outgoing', 'video', ?, ?, ?, 'pending', 'user', ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      caption,
      video,
      mimeType,
      getBrazilTimestamp()
    ]);

    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    const response = await wuzapiClient.post('/chat/send/video', {
      Phone: phone,
      Video: video,
      Caption: caption
    }, {
      headers: { 'Token': userToken }
    });

    const newStatus = response.success ? 'sent' : 'failed';
    await this.updateMessageStatus(lastID, newStatus);
    await this.updateConversationLastMessage(conversationId, caption || '[Vídeo]');

    const message = await this.getMessageById(lastID);
    logger.info('Video message sent', { userId, conversationId, messageId });

    return message;
  } catch (error) {
    logger.error('Failed to send video message', { userId, conversationId, error: error.message });
    throw error;
  }
};

/**
 * Send an audio message
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {Object} data - Audio data (Opus format)
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Sent message
 * 
 * Requirements: 3.3
 */
ChatService.prototype.sendAudioMessage = async function(userId, conversationId, data, userToken) {
  const { audio } = data;

  try {
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messageId = this.generateMessageId();

    // Detect input mime type from base64 data URL
    let inputMimeType = 'audio/webm'; // Default para gravações do navegador
    if (audio.startsWith('data:')) {
      const match = audio.match(/^data:([^;]+);/);
      if (match) {
        inputMimeType = match[1];
      }
    }

    // Converter áudio para OGG/Opus (formato requerido pelo WhatsApp)
    logger.info('Converting audio to OGG/Opus format', { 
      userId, 
      conversationId, 
      inputMimeType,
      ffmpegAvailable: audioConverterService.isEnabled()
    });

    const convertedAudio = await audioConverterService.convertToOpus(audio, inputMimeType);
    
    logger.info('Audio conversion result', {
      userId,
      conversationId,
      converted: convertedAudio.converted,
      outputMimeType: convertedAudio.mimeType,
      error: convertedAudio.error || null
    });

    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type,
        media_url, media_mime_type, status, sender_type, timestamp
      ) VALUES (?, ?, 'outgoing', 'audio', ?, ?, 'pending', 'user', ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      convertedAudio.base64,
      convertedAudio.mimeType,
      getBrazilTimestamp()
    ]);

    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    
    // WUZAPI expects: data:audio/ogg;base64,<base64data>
    // Audio must be in Opus codec inside OGG container
    // DO NOT include "codecs=opus" in the data URL - WUZAPI doesn't expect it
    let audioData = convertedAudio.base64;
    
    if (!audioData.startsWith('data:')) {
      // If it's just base64, add the proper prefix (without codecs=opus)
      audioData = `data:audio/ogg;base64,${audioData}`;
    } else {
      // Normalize any existing data URL to the format WUZAPI expects
      audioData = audioData.replace(/data:audio\/ogg;\s*codecs=opus;base64,/i, 'data:audio/ogg;base64,');
      audioData = audioData.replace(/data:audio\/webm;codecs=opus;base64,/i, 'data:audio/ogg;base64,');
      audioData = audioData.replace(/data:audio\/webm;base64,/i, 'data:audio/ogg;base64,');
    }
    
    const response = await wuzapiClient.post('/chat/send/audio', {
      Phone: phone,
      Audio: audioData
    }, {
      headers: { 'Token': userToken }
    });

    const newStatus = response.success ? 'sent' : 'failed';
    await this.updateMessageStatus(lastID, newStatus);
    await this.updateConversationLastMessage(conversationId, '[Áudio]');

    const message = await this.getMessageById(lastID);
    logger.info('Audio message sent', { 
      userId, 
      conversationId, 
      messageId,
      audioConverted: convertedAudio.converted
    });

    return message;
  } catch (error) {
    logger.error('Failed to send audio message', { userId, conversationId, error: error.message });
    throw error;
  }
};

/**
 * Send a document message
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {Object} data - Document data
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Sent message
 * 
 * Requirements: 3.4
 */
ChatService.prototype.sendDocumentMessage = async function(userId, conversationId, data, userToken) {
  const { document, filename, caption = '' } = data;

  try {
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messageId = this.generateMessageId();

    // Detect mime type from base64 data URL or infer from filename
    let mimeType = 'application/octet-stream';
    if (document.startsWith('data:')) {
      const match = document.match(/^data:([^;]+);/);
      if (match) {
        mimeType = match[1];
      }
    } else if (filename) {
      // Infer from extension
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeMap = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'zip': 'application/zip'
      };
      mimeType = mimeMap[ext] || mimeType;
    }

    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        media_url, media_filename, media_mime_type, status, sender_type, timestamp
      ) VALUES (?, ?, 'outgoing', 'document', ?, ?, ?, ?, 'pending', 'user', ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      caption,
      document,
      filename,
      mimeType,
      getBrazilTimestamp()
    ]);

    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    const response = await wuzapiClient.post('/chat/send/document', {
      Phone: phone,
      Document: document,
      FileName: filename,
      Caption: caption
    }, {
      headers: { 'Token': userToken }
    });

    const newStatus = response.success ? 'sent' : 'failed';
    await this.updateMessageStatus(lastID, newStatus);
    await this.updateConversationLastMessage(conversationId, caption || `[Documento: ${filename}]`);

    const message = await this.getMessageById(lastID);
    logger.info('Document message sent', { userId, conversationId, messageId, filename });

    return message;
  } catch (error) {
    logger.error('Failed to send document message', { userId, conversationId, error: error.message });
    throw error;
  }
};

/**
 * Send a location message
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {Object} data - Location data
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Sent message
 * 
 * Requirements: 9.1, 9.3
 */
ChatService.prototype.sendLocationMessage = async function(userId, conversationId, data, userToken) {
  const { latitude, longitude, name = '' } = data;

  try {
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messageId = this.generateMessageId();
    const locationContent = JSON.stringify({ latitude, longitude, name });

    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        status, sender_type, timestamp
      ) VALUES (?, ?, 'outgoing', 'location', ?, 'pending', 'user', ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      locationContent,
      getBrazilTimestamp()
    ]);

    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    const response = await wuzapiClient.post('/chat/send/location', {
      Phone: phone,
      Latitude: latitude,
      Longitude: longitude,
      Name: name
    }, {
      headers: { 'Token': userToken }
    });

    const newStatus = response.success ? 'sent' : 'failed';
    await this.updateMessageStatus(lastID, newStatus);
    await this.updateConversationLastMessage(conversationId, name || '[Localização]');

    const message = await this.getMessageById(lastID);
    logger.info('Location message sent', { userId, conversationId, messageId });

    return message;
  } catch (error) {
    logger.error('Failed to send location message', { userId, conversationId, error: error.message });
    throw error;
  }
};

/**
 * Send a contact message (vCard)
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {Object} data - Contact data
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Sent message
 * 
 * Requirements: 9.2, 9.4
 */
ChatService.prototype.sendContactMessage = async function(userId, conversationId, data, userToken) {
  const { vcard, displayName } = data;

  try {
    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messageId = this.generateMessageId();

    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        status, sender_type, timestamp
      ) VALUES (?, ?, 'outgoing', 'contact', ?, 'pending', 'user', ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      vcard,
      getBrazilTimestamp()
    ]);

    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    const response = await wuzapiClient.post('/chat/send/contact', {
      Phone: phone,
      Vcard: vcard,
      Name: displayName
    }, {
      headers: { 'Token': userToken }
    });

    const newStatus = response.success ? 'sent' : 'failed';
    await this.updateMessageStatus(lastID, newStatus);
    await this.updateConversationLastMessage(conversationId, `[Contato: ${displayName}]`);

    const message = await this.getMessageById(lastID);
    logger.info('Contact message sent', { userId, conversationId, messageId, displayName });

    return message;
  } catch (error) {
    logger.error('Failed to send contact message', { userId, conversationId, error: error.message });
    throw error;
  }
};

/**
 * Download media from a message
 * @param {number} messageId - Internal message ID
 * @param {number} userId - User ID
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Downloaded media data
 * 
 * Requirements: 3.5
 */
ChatService.prototype.downloadMedia = async function(messageId, userId, userToken) {
  try {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user owns the conversation
    const conversation = await this.getConversationById(message.conversation_id, userId);
    if (!conversation) {
      throw new Error('Unauthorized');
    }

    const mediaType = message.message_type;
    let endpoint;

    switch (mediaType) {
      case 'image':
        endpoint = '/chat/downloadimage';
        break;
      case 'video':
        endpoint = '/chat/downloadvideo';
        break;
      case 'audio':
        endpoint = '/chat/downloadaudio';
        break;
      case 'document':
        endpoint = '/chat/downloaddocument';
        break;
      default:
        throw new Error(`Unsupported media type: ${mediaType}`);
    }

    const response = await wuzapiClient.post(endpoint, {
      MessageId: message.message_id
    }, {
      headers: { 'Token': userToken }
    });

    logger.info('Media downloaded', { messageId, mediaType });

    return {
      data: response.data,
      mimeType: message.media_mime_type,
      filename: message.media_filename
    };
  } catch (error) {
    logger.error('Failed to download media', { messageId, error: error.message });
    throw error;
  }
};

// ==================== Reply Message Methods ====================

/**
 * Send a reply message
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {Object} data - Reply data
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Sent message
 * 
 * Requirements: 12.1, 12.2, 12.3
 */
ChatService.prototype.sendReplyMessage = async function(userId, conversationId, data, userToken) {
  const { content, replyToMessageId, messageType = 'text' } = data;

  try {
    if (messageType === 'text' && !this.validateMessageContent(content)) {
      throw new Error('Message content cannot be empty or whitespace only');
    }

    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    // Get the original message to reply to
    const originalMessage = await this.getMessageByMessageId(replyToMessageId, conversationId);
    if (!originalMessage) {
      throw new Error('Original message not found');
    }

    const messageId = this.generateMessageId();

    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        reply_to_message_id, status, sender_type, timestamp
      ) VALUES (?, ?, 'outgoing', ?, ?, ?, 'pending', 'user', ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      messageType,
      content,
      replyToMessageId,
      getBrazilTimestamp()
    ]);

    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    
    // Build WUZAPI payload with ContextInfo for reply
    const payload = {
      Phone: phone,
      Body: content,
      ContextInfo: {
        StanzaId: replyToMessageId,
        Participant: conversation.contact_jid
      }
    };

    const response = await wuzapiClient.post('/chat/send/text', payload, {
      headers: { 'Token': userToken }
    });

    const newStatus = response.success ? 'sent' : 'failed';
    await this.updateMessageStatus(lastID, newStatus);
    await this.updateConversationLastMessage(conversationId, content);

    const message = await this.getMessageById(lastID);
    logger.info('Reply message sent', { userId, conversationId, messageId, replyToMessageId });

    return message;
  } catch (error) {
    logger.error('Failed to send reply message', { userId, conversationId, error: error.message });
    throw error;
  }
};


// ==================== Private Notes Methods ====================

/**
 * Add a private note to a conversation
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {string} content - Note content
 * @returns {Promise<Object>} Created note
 * 
 * Requirements: 22.1, 22.2
 */
ChatService.prototype.addPrivateNote = async function(userId, conversationId, content) {
  try {
    if (!this.validateMessageContent(content)) {
      throw new Error('Note content cannot be empty');
    }

    const conversation = await this.getConversationById(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or unauthorized');
    }

    const messageId = this.generateMessageId();

    const sql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        is_private_note, sender_type, status, timestamp
      ) VALUES (?, ?, 'outgoing', 'text', ?, 1, 'user', 'sent', ?)
    `;

    const { lastID } = await this.db.query(sql, [
      conversationId,
      messageId,
      content,
      getBrazilTimestamp()
    ]);

    const note = await this.getMessageById(lastID);

    logger.info('Private note added', { userId, conversationId, noteId: lastID });

    return note;
  } catch (error) {
    logger.error('Failed to add private note', { userId, conversationId, error: error.message });
    throw error;
  }
};

/**
 * Get private notes for a conversation
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Private notes
 */
ChatService.prototype.getPrivateNotes = async function(conversationId, userId) {
  const conversation = await this.getConversationById(conversationId, userId);
  if (!conversation) {
    throw new Error('Conversation not found or unauthorized');
  }

  const sql = `
    SELECT * FROM chat_messages
    WHERE conversation_id = ? AND is_private_note = 1
    ORDER BY timestamp DESC, id DESC
  `;

  const { rows } = await this.db.query(sql, [conversationId]);
  return rows;
};

// ==================== Reaction Methods ====================

/**
 * Add a reaction to a message
 * @param {number} userId - User ID
 * @param {number} messageId - Internal message ID
 * @param {string} emoji - Reaction emoji
 * @param {string} userToken - WUZAPI user token
 * @returns {Promise<Object>} Created reaction
 * 
 * Requirements: 5.2, 5.3
 */
ChatService.prototype.addReaction = async function(userId, messageId, emoji, userToken) {
  try {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user owns the conversation
    const conversation = await this.getConversationById(message.conversation_id, userId);
    if (!conversation) {
      throw new Error('Unauthorized');
    }

    // Check if reaction already exists
    const existingSql = `
      SELECT id FROM message_reactions
      WHERE message_id = ? AND emoji = ? AND reactor_jid = 'self'
    `;
    const { rows: existing } = await this.db.query(existingSql, [messageId, emoji]);

    if (existing.length > 0) {
      // Remove existing reaction (toggle behavior)
      await this.removeReaction(userId, messageId, emoji, userToken);
      return { removed: true, emoji };
    }

    // Send reaction via WUZAPI
    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    await wuzapiClient.post('/chat/react', {
      Phone: phone,
      MessageId: message.message_id,
      Emoji: emoji
    }, {
      headers: { 'Token': userToken }
    });

    // Store reaction
    const insertSql = `
      INSERT INTO message_reactions (message_id, emoji, reactor_jid, created_at)
      VALUES (?, ?, 'self', ?)
    `;

    const { lastID } = await this.db.query(insertSql, [messageId, emoji, getBrazilTimestamp()]);

    logger.info('Reaction added', { userId, messageId, emoji });

    return {
      id: lastID,
      messageId,
      emoji,
      reactorJid: 'self',
      removed: false
    };
  } catch (error) {
    logger.error('Failed to add reaction', { userId, messageId, error: error.message });
    throw error;
  }
};

/**
 * Remove a reaction from a message
 * @param {number} userId - User ID
 * @param {number} messageId - Internal message ID
 * @param {string} emoji - Reaction emoji
 * @param {string} userToken - WUZAPI user token
 */
ChatService.prototype.removeReaction = async function(userId, messageId, emoji, userToken) {
  try {
    const message = await this.getMessageById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    const conversation = await this.getConversationById(message.conversation_id, userId);
    if (!conversation) {
      throw new Error('Unauthorized');
    }

    // Send empty reaction to remove via WUZAPI
    const phone = conversation.contact_jid.replace('@s.whatsapp.net', '');
    await wuzapiClient.post('/chat/react', {
      Phone: phone,
      MessageId: message.message_id,
      Emoji: '' // Empty emoji removes reaction
    }, {
      headers: { 'Token': userToken }
    });

    // Remove from database
    const sql = `
      DELETE FROM message_reactions
      WHERE message_id = ? AND emoji = ? AND reactor_jid = 'self'
    `;

    await this.db.query(sql, [messageId, emoji]);

    logger.info('Reaction removed', { userId, messageId, emoji });
  } catch (error) {
    logger.error('Failed to remove reaction', { userId, messageId, error: error.message });
    throw error;
  }
};

/**
 * Store an incoming reaction from webhook
 * @param {number} messageId - Internal message ID
 * @param {string} emoji - Reaction emoji
 * @param {string} reactorJid - Reactor JID
 * @returns {Promise<Object>} Stored reaction
 * 
 * Requirements: 5.4
 */
ChatService.prototype.storeIncomingReaction = async function(messageId, emoji, reactorJid) {
  try {
    // Check if this is a removal (empty emoji)
    if (!emoji) {
      const sql = `
        DELETE FROM message_reactions
        WHERE message_id = ? AND reactor_jid = ?
      `;
      await this.db.query(sql, [messageId, reactorJid]);
      
      logger.info('Incoming reaction removed', { messageId, reactorJid });
      return { removed: true };
    }

    // Check if reaction already exists
    const existingSql = `
      SELECT id FROM message_reactions
      WHERE message_id = ? AND reactor_jid = ?
    `;
    const { rows: existing } = await this.db.query(existingSql, [messageId, reactorJid]);

    if (existing.length > 0) {
      // Update existing reaction
      const updateSql = `
        UPDATE message_reactions
        SET emoji = ?, created_at = ?
        WHERE message_id = ? AND reactor_jid = ?
      `;
      await this.db.query(updateSql, [emoji, getBrazilTimestamp(), messageId, reactorJid]);

      return {
        id: existing[0].id,
        messageId,
        emoji,
        reactorJid,
        updated: true
      };
    }

    // Insert new reaction
    const insertSql = `
      INSERT INTO message_reactions (message_id, emoji, reactor_jid, created_at)
      VALUES (?, ?, ?, ?)
    `;

    const { lastID } = await this.db.query(insertSql, [messageId, emoji, reactorJid, getBrazilTimestamp()]);

    logger.info('Incoming reaction stored', { messageId, emoji, reactorJid });

    return {
      id: lastID,
      messageId,
      emoji,
      reactorJid,
      updated: false
    };
  } catch (error) {
    logger.error('Failed to store incoming reaction', { messageId, error: error.message });
    throw error;
  }
};


// ==================== Token-based Methods (for routes) ====================

/**
 * Get user ID from token
 * Note: This system uses WUZAPI tokens directly as user identifiers
 * There is no local users table - the token IS the userId
 * @param {string} userToken - User token
 * @returns {Promise<string>} User ID (same as token)
 */
ChatService.prototype.getUserIdFromToken = async function(userToken) {
  // Token is used directly as userId since there's no local users table
  return userToken;
};

/**
 * Get conversations by user token (wrapper for routes)
 * Overrides the original getConversations to accept userToken
 */
const originalGetConversations = ChatService.prototype.getConversations;
ChatService.prototype.getConversations = async function(userTokenOrId, filters = {}, pagination = {}) {
  // Token is used directly as userId since there's no local users table
  const userId = userTokenOrId;
  
  // Extract filters
  const { status, hasUnread, assignedBotId, labelId, search, inboxId, inboxIds } = filters;
  const { limit = 50, offset = 0 } = pagination;
  
  // Build query
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
      c.status,
      c.is_muted,
      c.inbox_id,
      c.created_at,
      c.updated_at,
      ab.name as bot_name,
      ab.avatar_url as bot_avatar_url
    FROM conversations c
    LEFT JOIN agent_bots ab ON c.assigned_bot_id = ab.id
    WHERE c.user_id = ?
      AND (c.is_test = 0 OR c.is_test IS NULL)
  `;
  
  const params = [userId];

  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  
  if (hasUnread) {
    sql += ' AND c.unread_count > 0';
  }
  
  if (assignedBotId) {
    sql += ' AND c.assigned_bot_id = ?';
    params.push(assignedBotId);
  }
  
  if (labelId) {
    sql += ' AND EXISTS (SELECT 1 FROM conversation_labels cl WHERE cl.conversation_id = c.id AND cl.label_id = ?)';
    params.push(labelId);
  }
  
  if (search) {
    sql += ' AND (LOWER(c.contact_name) LIKE ? OR LOWER(c.contact_jid) LIKE ?)';
    const searchTerm = `%${search.toLowerCase()}%`;
    params.push(searchTerm, searchTerm);
  }
  
  // Filter by inbox - single or multiple
  if (inboxId) {
    sql += ' AND c.inbox_id = ?';
    params.push(inboxId);
  } else if (inboxIds && inboxIds.length > 0) {
    const placeholders = inboxIds.map(() => '?').join(',');
    sql += ` AND c.inbox_id IN (${placeholders})`;
    params.push(...inboxIds);
  }

  sql += ' ORDER BY c.last_message_at DESC NULLS LAST';
  sql += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { rows } = await this.db.query(sql, params);

  // Get total count for pagination (excluding test conversations)
  let countSql = 'SELECT COUNT(*) as total FROM conversations WHERE user_id = ? AND (is_test = 0 OR is_test IS NULL)';
  const countParams = [userId];
  
  if (status) {
    countSql += ' AND status = ?';
    countParams.push(status);
  }
  if (hasUnread) {
    countSql += ' AND unread_count > 0';
  }
  if (assignedBotId) {
    countSql += ' AND assigned_bot_id = ?';
    countParams.push(assignedBotId);
  }
  if (labelId) {
    countSql += ' AND EXISTS (SELECT 1 FROM conversation_labels cl WHERE cl.conversation_id = id AND cl.label_id = ?)';
    countParams.push(labelId);
  }
  if (search) {
    countSql += ' AND (LOWER(contact_name) LIKE ? OR LOWER(contact_jid) LIKE ?)';
    const searchTerm = `%${search.toLowerCase()}%`;
    countParams.push(searchTerm, searchTerm);
  }
  if (inboxId) {
    countSql += ' AND inbox_id = ?';
    countParams.push(inboxId);
  } else if (inboxIds && inboxIds.length > 0) {
    const placeholders = inboxIds.map(() => '?').join(',');
    countSql += ` AND inbox_id IN (${placeholders})`;
    countParams.push(...inboxIds);
  }

  const { rows: countRows } = await this.db.query(countSql, countParams);
  const total = countRows[0]?.total || 0;

  // Get labels for each conversation and transform using centralized transformer
  const conversationsWithLabels = await Promise.all(
    rows.map(async (conv) => {
      const labels = await this.getConversationLabels(conv.id);
      const botInfo = conv.assigned_bot_id ? {
        id: conv.assigned_bot_id,
        name: conv.bot_name,
        avatarUrl: conv.bot_avatar_url
      } : null;
      return transformConversation(conv, labels, botInfo);
    })
  );

  logger.info('Conversations retrieved', { userId, count: rows.length, total });

  return {
    conversations: conversationsWithLabels,
    total
  };
};

/**
 * Get messages by user token (wrapper for routes)
 */
ChatService.prototype.getMessages = async function(userToken, conversationId, options = {}) {
  const userId = await this.getUserIdFromToken(userToken);
  if (!userId) {
    throw new Error('Invalid token');
  }
  
  const { limit = 50, before, after } = options;
  
  // Verify user owns this conversation
  const conversation = await this.getConversationById(parseInt(conversationId, 10), userId);
  if (!conversation) {
    throw new Error('Conversation not found or unauthorized');
  }

  let sql = `
    SELECT 
      m.id,
      m.conversation_id as conversationId,
      m.message_id as messageId,
      m.direction,
      m.message_type as messageType,
      m.content,
      m.media_url as mediaUrl,
      m.media_mime_type as mediaMimeType,
      m.media_filename as mediaFilename,
      m.reply_to_message_id as replyToMessageId,
      m.status,
      m.is_private_note as isPrivateNote,
      m.sender_type as senderType,
      m.sender_bot_id as senderBotId,
      m.participant_jid as participantJid,
      m.participant_name as participantName,
      m.is_edited as isEdited,
      m.is_deleted as isDeleted,
      m.poll_data as pollData,
      m.interactive_data as interactiveData,
      m.timestamp,
      m.created_at as createdAt
    FROM chat_messages m
    WHERE m.conversation_id = ?
  `;
  
  const params = [conversationId];

  if (before) {
    sql += ' AND m.timestamp < ?';
    params.push(before);
  }
  
  if (after) {
    sql += ' AND m.timestamp > ?';
    params.push(after);
  }

  sql += ' ORDER BY m.timestamp DESC, m.id DESC';
  sql += ' LIMIT ?';
  params.push(limit + 1); // Get one extra to check if there are more

  const { rows } = await this.db.query(sql, params);
  
  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit);

  // Get reactions for each message and parse JSON fields
  const messagesWithReactions = await Promise.all(
    messages.map(async (msg) => {
      const reactions = await this.getMessageReactions(msg.id);
      const replyToMessage = msg.replyToMessageId 
        ? await this.getMessageByMessageId(msg.replyToMessageId, conversationId)
        : null;
      
      if (msg.replyToMessageId && !replyToMessage) {
        logger.warn('Reply message not found', {
          messageId: msg.id,
          replyToMessageId: msg.replyToMessageId,
          conversationId
        });
      }
      
      // Parse JSON fields for special message types
      let pollData = null;
      let interactiveData = null;
      
      if (msg.pollData) {
        try {
          pollData = typeof msg.pollData === 'string' ? JSON.parse(msg.pollData) : msg.pollData;
        } catch (e) {
          logger.warn('Failed to parse pollData', { messageId: msg.id, error: e.message });
        }
      }
      
      if (msg.interactiveData) {
        try {
          interactiveData = typeof msg.interactiveData === 'string' ? JSON.parse(msg.interactiveData) : msg.interactiveData;
        } catch (e) {
          logger.warn('Failed to parse interactiveData', { messageId: msg.id, error: e.message });
        }
      }
      
      return {
        ...msg,
        pollData,
        interactiveData,
        isEdited: Boolean(msg.isEdited),
        isDeleted: Boolean(msg.isDeleted),
        reactions,
        replyToMessage
      };
    })
  );

  // Return in chronological order
  const sortedMessages = messagesWithReactions.reverse();
  
  return {
    messages: sortedMessages,
    hasMore,
    oldestTimestamp: sortedMessages.length > 0 ? sortedMessages[0].timestamp : null,
    newestTimestamp: sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].timestamp : null
  };
};

/**
 * Alias for searchMessages within a conversation (for routes)
 * This is used when searching messages within a specific conversation
 * @param {number} conversationId - Conversation ID
 * @param {string} userToken - User token (used as userId)
 * @param {string} query - Search query
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Search results
 */
ChatService.prototype.searchMessagesInConversation = async function(conversationId, userToken, query, options = {}) {
  // Call the original class method with token as userId
  return this.searchMessages(conversationId, userToken, query, options);
};


// ==================== Bot Message Methods ====================

/**
 * Check if a message with the given message_id already exists in a conversation
 * Used for deduplication to prevent storing the same message twice
 * 
 * Implements Property 5: Message deduplication idempotence
 * 
 * @param {number} conversationId - Conversation ID
 * @param {string} messageId - WUZAPI message ID
 * @returns {Promise<boolean>} True if message exists
 * 
 * Requirements: 4.1, 4.2
 */
ChatService.prototype.messageExists = async function(conversationId, messageId) {
  const sql = `
    SELECT id FROM chat_messages
    WHERE conversation_id = ? AND message_id = ?
    LIMIT 1
  `;
  
  const { rows } = await this.db.query(sql, [conversationId, messageId]);
  return rows.length > 0;
};

/**
 * Store a message sent by an external bot
 * 
 * This method is used to store messages sent via the bot proxy endpoint.
 * It ensures:
 * - sender_type is set to 'bot'
 * - unread_count is NOT incremented (outgoing messages)
 * - last_message_preview is updated
 * - WebSocket event is emitted for real-time updates
 * 
 * Implements Property 2: Unread count invariant for outgoing messages
 * Implements Property 3: Last message preview update
 * Implements Property 4: Bot proxy message registration
 * 
 * @param {number} conversationId - Conversation ID
 * @param {Object} messageData - Message data
 * @param {string} messageData.messageId - WUZAPI message ID
 * @param {string} messageData.content - Message content
 * @param {string} messageData.type - Message type (text, image, etc.)
 * @param {string} messageData.mediaUrl - Media URL (optional)
 * @param {string} messageData.mediaMimeType - Media MIME type (optional)
 * @param {string} messageData.mediaFilename - Media filename (optional)
 * @param {number} messageData.botId - Bot ID (optional)
 * @param {string} messageData.botName - Bot name for display (optional)
 * @param {Object} chatHandler - WebSocket handler for real-time updates (optional)
 * @returns {Promise<Object>} Stored message
 * 
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.3, 5.1, 5.2
 */
ChatService.prototype.storeBotMessage = async function(conversationId, messageData, chatHandler = null) {
  try {
    const {
      messageId,
      content,
      type = 'text',
      mediaUrl = null,
      mediaMimeType = null,
      mediaFilename = null,
      botId = null,
      botName = null,
      timestamp = null
    } = messageData;

    // Check for duplicate message (Property 5: Deduplication)
    const exists = await this.messageExists(conversationId, messageId);
    if (exists) {
      logger.info('Bot message already exists, skipping insertion', {
        conversationId,
        messageId
      });
      // Return existing message
      const sql = `
        SELECT * FROM chat_messages
        WHERE conversation_id = ? AND message_id = ?
      `;
      const { rows } = await this.db.query(sql, [conversationId, messageId]);
      if (rows.length > 0) {
        return await this.getMessageById(rows[0].id);
      }
      return null;
    }

    // Get current timestamp in Brazil timezone
    const messageTimestamp = timestamp || getBrazilTimestamp();

    // Insert message with sender_type = 'bot'
    const insertSql = `
      INSERT INTO chat_messages (
        conversation_id, message_id, direction, message_type, content,
        media_url, media_mime_type, media_filename,
        status, sender_type, sender_bot_id, timestamp
      ) VALUES (?, ?, 'outgoing', ?, ?, ?, ?, ?, 'sent', 'bot', ?, ?)
    `;
    
    const { lastID } = await this.db.query(insertSql, [
      conversationId,
      messageId,
      type,
      content || null,
      mediaUrl,
      mediaMimeType,
      mediaFilename,
      botId,
      messageTimestamp
    ]);

    // Update conversation last message preview (Property 3)
    // Note: We do NOT increment unread_count for outgoing messages (Property 2)
    await this.updateConversationLastMessage(conversationId, content || '[Media]');

    // Get the stored message
    const message = await this.getMessageById(lastID);

    // Emit WebSocket event for real-time updates (Property 7)
    if (chatHandler) {
      chatHandler.broadcastNewMessage(conversationId, message);
      
      // Also broadcast conversation update
      const conversation = await this.db.query(
        'SELECT * FROM conversations WHERE id = ?',
        [conversationId]
      );
      if (conversation.rows.length > 0) {
        chatHandler.broadcastConversationUpdate({
          ...conversation.rows[0],
          last_message_at: messageTimestamp,
          last_message_preview: content || '[Media]'
        });
      }
    }

    logger.info('Bot message stored', {
      conversationId,
      messageId,
      localId: lastID,
      botId,
      type
    });

    return message;
  } catch (error) {
    logger.error('Failed to store bot message', {
      conversationId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get current timestamp in Brazil timezone (America/Sao_Paulo)
 * Helper function for bot message storage
 * @returns {string} ISO timestamp string in Brazil timezone
 */
function getBrazilTimestamp() {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const get = (type) => parts.find(p => p.type === type)?.value || '00';
  
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
