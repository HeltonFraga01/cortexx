/**
 * TestConversationService
 * 
 * Manages test conversations for bot testing functionality.
 * Handles simulated JID generation, test conversation lifecycle,
 * and message history management.
 * 
 * Requirements: 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4
 */

const { logger } = require('../utils/logger');

class TestConversationService {
  constructor(db) {
    this.db = db;
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
      
      const sql = `
        INSERT INTO conversations (
          user_id, 
          contact_jid, 
          contact_name, 
          assigned_bot_id, 
          is_test, 
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 1, 'open', datetime('now'), datetime('now'))
      `;
      
      const result = await this.db.query(sql, [
        userId,
        simulatedJid,
        `🧪 Teste: ${botName}`,
        botId
      ]);

      const conversationId = result.lastInsertRowid || result.lastID;

      logger.info('Test conversation created', {
        conversationId,
        userId,
        botId,
        simulatedJid
      });

      return {
        id: conversationId,
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
      const sql = `
        UPDATE conversations 
        SET status = 'archived', updated_at = datetime('now')
        WHERE id = ? AND is_test = 1
      `;
      
      await this.db.query(sql, [conversationId]);

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
      const sql = `
        SELECT * FROM conversations 
        WHERE id = ? AND user_id = ? AND is_test = 1
      `;
      
      const { rows } = await this.db.query(sql, [conversationId, userId]);
      return rows[0] || null;
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
      const sql = `
        SELECT 
          id,
          message_id,
          content as text,
          sender_type,
          created_at as timestamp,
          CASE WHEN sender_type = 'user' THEN 1 ELSE 0 END as fromMe
        FROM chat_messages 
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;
      
      const { rows } = await this.db.query(sql, [conversationId, limit]);
      
      // Return in chronological order (oldest first)
      return rows.reverse().map(row => ({
        id: row.message_id || row.id.toString(),
        text: row.text,
        timestamp: new Date(row.timestamp).getTime(),
        fromMe: row.fromMe === 1
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
      const sql = `
        DELETE FROM chat_messages 
        WHERE conversation_id = ?
      `;
      
      await this.db.query(sql, [conversationId]);

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
      
      const sql = `
        INSERT INTO chat_messages (
          conversation_id,
          message_id,
          direction,
          message_type,
          content,
          sender_type,
          status,
          timestamp,
          created_at
        ) VALUES (?, ?, ?, 'text', ?, ?, 'delivered', ?, datetime('now'))
      `;
      
      await this.db.query(sql, [
        conversationId,
        messageId,
        direction,
        text,
        senderType,
        timestamp
      ]);

      // Update conversation last_message_at
      await this.db.query(`
        UPDATE conversations 
        SET last_message_at = datetime('now'),
            last_message_preview = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [text.substring(0, 100), conversationId]);

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
      await this.db.query(
        'DELETE FROM chat_messages WHERE conversation_id = ?',
        [conversationId]
      );
      
      // Delete conversation
      await this.db.query(
        'DELETE FROM conversations WHERE id = ? AND is_test = 1',
        [conversationId]
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
