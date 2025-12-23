/**
 * TestConversationService
 * 
 * Manages test conversations for bot testing functionality.
 * Handles simulated JID generation, test conversation lifecycle,
 * and message history management.
 * 
 * Requirements: 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4
 * 
 * MIGRATED: Now uses SupabaseService directly instead of db parameter
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class TestConversationService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Generate a simulated JID for test conversations
   * Format: test_<userId>_<timestamp>@s.whatsapp.net
   * 
   * @param {string|number} userId - User ID
   * @returns {string} Simulated JID
   * 
   * Requirements: 1.4
   */
  generateSimulatedJid(userId) {
    const timestamp = Date.now();
    return `test_${userId}_${timestamp}@s.whatsapp.net`;
  }

  /**
   * Create a test conversation for bot testing
   * 
   * @param {string|number} userId - User ID
   * @param {number} botId - Bot ID being tested
   * @param {string} [botName] - Bot name for display
   * @returns {Promise<Object>} Created test conversation
   * 
   * Requirements: 1.3
   */
  async createTestConversation(userId, botId, botName = 'Bot Test') {
    try {
      const simulatedJid = this.generateSimulatedJid(userId);
      
      const { data, error } = await SupabaseService.insert('conversations', {
        user_id: userId,
        contact_jid: simulatedJid,
        contact_name: `🧪 Teste: ${botName}`,
        assigned_bot_id: botId,
        is_test: true,
        status: 'open'
      });

      if (error) {
        throw error;
      }

      logger.info('Test conversation created', {
        conversationId: data.id,
        userId,
        botId,
        simulatedJid
      });

      return {
        id: data.id,
        userId,
        contactJid: simulatedJid,
        contactName: `🧪 Teste: ${botName}`,
        assignedBotId: botId,
        isTest: true,
        status: 'open'
      };
    } catch (error) {
      logger.error('Failed to create test conversation', {
        error: error.message,
        userId,
        botId
      });
      throw error;
    }
  }

  /**
   * Archive a test conversation when testing is complete
   * 
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<void>}
   * 
   * Requirements: 1.5
   */
  async archiveTestConversation(conversationId) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ status: 'archived' }).eq('id', conversationId).eq('is_test', true)
      );

      if (error) {
        throw error;
      }

      logger.info('Test conversation archived', { conversationId });
    } catch (error) {
      logger.error('Failed to archive test conversation', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }

  /**
   * Get a test conversation by ID
   * 
   * @param {number} conversationId - Conversation ID
   * @param {string|number} userId - User ID for ownership verification
   * @returns {Promise<Object|null>} Test conversation or null
   */
  async getTestConversation(conversationId, userId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.select('*').eq('id', conversationId).eq('user_id', userId).eq('is_test', true).single()
      );
      
      if (error || !data) {
        return null;
      }
      
      return data;
    } catch (error) {
      logger.error('Failed to get test conversation', {
        error: error.message,
        conversationId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get messages from a test conversation
   * 
   * @param {number} conversationId - Conversation ID
   * @param {number} [limit=10] - Max messages to return
   * @returns {Promise<Array>} Messages array
   * 
   * Requirements: 6.1, 6.2
   */
  async getTestMessages(conversationId, limit = 10) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
        query.select('id, message_id, content, sender_type, created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(limit)
      );
      
      if (error) {
        throw error;
      }
      
      // Return in chronological order (oldest first)
      return (data || []).reverse().map(row => ({
        id: row.message_id || row.id.toString(),
        text: row.content,
        timestamp: new Date(row.created_at).getTime(),
        fromMe: row.sender_type === 'user'
      }));
    } catch (error) {
      logger.error('Failed to get test messages', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }

  /**
   * Clear all messages from a test conversation
   * 
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<void>}
   * 
   * Requirements: 6.4
   */
  async clearTestHistory(conversationId) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('chat_messages', (query) =>
        query.delete().eq('conversation_id', conversationId)
      );

      if (error) {
        throw error;
      }

      logger.info('Test conversation history cleared', { conversationId });
    } catch (error) {
      logger.error('Failed to clear test history', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }

  /**
   * Add a message to a test conversation
   * 
   * @param {number} conversationId - Conversation ID
   * @param {string} text - Message text
   * @param {string} senderType - 'user' or 'bot'
   * @returns {Promise<Object>} Created message
   */
  async addTestMessage(conversationId, text, senderType) {
    try {
      const messageId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      
      // Determine direction based on sender type
      // user = outgoing (user sending to bot)
      // bot = incoming (bot responding to user)
      const direction = senderType === 'user' ? 'outgoing' : 'incoming';
      
      const { error: msgError } = await SupabaseService.insert('chat_messages', {
        conversation_id: conversationId,
        message_id: messageId,
        direction,
        message_type: 'text',
        content: text,
        sender_type: senderType,
        status: 'delivered',
        timestamp
      });

      if (msgError) {
        throw msgError;
      }

      // Update conversation last_message_at
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ 
          last_message_at: timestamp,
          last_message_preview: text.substring(0, 100)
        }).eq('id', conversationId)
      );

      return {
        id: messageId,
        text,
        timestamp: Date.now(),
        fromMe: senderType === 'user'
      };
    } catch (error) {
      logger.error('Failed to add test message', {
        error: error.message,
        conversationId,
        senderType
      });
      throw error;
    }
  }

  /**
   * Delete a test conversation and all its messages
   * 
   * @param {number} conversationId - Conversation ID
   * @returns {Promise<void>}
   */
  async deleteTestConversation(conversationId) {
    try {
      // Delete messages first
      await SupabaseService.queryAsAdmin('chat_messages', (query) =>
        query.delete().eq('conversation_id', conversationId)
      );
      
      // Delete conversation
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.delete().eq('id', conversationId).eq('is_test', true)
      );

      logger.info('Test conversation deleted', { conversationId });
    } catch (error) {
      logger.error('Failed to delete test conversation', {
        error: error.message,
        conversationId
      });
      throw error;
    }
  }
}

module.exports = TestConversationService;
