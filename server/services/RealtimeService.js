/**
 * RealtimeService - Handles Supabase Realtime broadcasts for chat events
 * 
 * This service provides methods to broadcast events via Supabase Realtime channels,
 * enabling real-time updates for chat messages, conversations, and presence.
 * 
 * Requirements: REQ-1.2, REQ-1.3 (chat-api-realtime-migration)
 */

const { logger } = require('../utils/logger')
const SupabaseService = require('./SupabaseService')

class RealtimeService {
  constructor() {
    this.enabled = process.env.CHAT_REALTIME_PROVIDER !== 'socketio'
    this.channels = new Map()
  }

  /**
   * Transform snake_case keys to camelCase
   * @param {Object} obj - Object with snake_case keys
   * @returns {Object} Object with camelCase keys
   */
  transformToCamelCase(obj) {
    if (obj === null || obj === undefined) return obj
    if (Array.isArray(obj)) {
      return obj.map(item => this.transformToCamelCase(item))
    }
    if (typeof obj !== 'object') return obj

    const transformed = {}
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      transformed[camelKey] = this.transformToCamelCase(value)
    }
    return transformed
  }

  /**
   * Get or create a Supabase Realtime channel
   * @param {string} channelName - Name of the channel
   * @returns {Object} Supabase channel instance
   */
  getChannel(channelName) {
    if (!this.channels.has(channelName)) {
      const channel = SupabaseService.adminClient.channel(channelName)
      this.channels.set(channelName, channel)
    }
    return this.channels.get(channelName)
  }

  /**
   * Broadcast event to a conversation channel
   * @param {string} conversationId - The conversation ID
   * @param {string} event - Event type (e.g., 'message.new', 'message.status')
   * @param {Object} payload - Event payload
   */
  async broadcastToConversation(conversationId, event, payload) {
    if (!this.enabled) {
      logger.debug('RealtimeService disabled, skipping broadcast', { conversationId, event })
      return
    }

    try {
      const channelName = `conversation:${conversationId}`
      const transformedPayload = this.transformToCamelCase(payload)

      await SupabaseService.adminClient
        .channel(channelName)
        .send({
          type: 'broadcast',
          event,
          payload: transformedPayload
        })

      logger.debug('Realtime broadcast to conversation', { 
        channelName, 
        event, 
        conversationId,
        messageId: payload?.id 
      })
    } catch (error) {
      logger.error('Failed to broadcast to conversation', {
        error: error.message,
        conversationId,
        event
      })
    }
  }

  /**
   * Broadcast event to a user's inbox channel
   * @param {string} userId - The user/account ID
   * @param {string} event - Event type (e.g., 'conversation.new', 'conversation.updated')
   * @param {Object} payload - Event payload
   */
  async broadcastToUserInbox(userId, event, payload) {
    if (!this.enabled) {
      logger.debug('RealtimeService disabled, skipping inbox broadcast', { userId, event })
      return
    }

    try {
      const channelName = `user:${userId}:inbox`
      const transformedPayload = this.transformToCamelCase(payload)

      await SupabaseService.adminClient
        .channel(channelName)
        .send({
          type: 'broadcast',
          event,
          payload: transformedPayload
        })

      logger.debug('Realtime broadcast to user inbox', { 
        channelName, 
        event, 
        userId,
        conversationId: payload?.id 
      })
    } catch (error) {
      logger.error('Failed to broadcast to user inbox', {
        error: error.message,
        userId,
        event
      })
    }
  }

  /**
   * Broadcast new message event
   * @param {string} conversationId - The conversation ID
   * @param {Object} message - The message object
   * @param {Object} options - Additional options
   * @param {boolean} options.isMuted - Whether the conversation is muted
   */
  async broadcastNewMessage(conversationId, message, options = {}) {
    const { isMuted = false } = options

    await this.broadcastToConversation(conversationId, 'message.new', {
      conversationId,
      message,
      isMuted
    })
  }

  /**
   * Broadcast message status update
   * @param {string} conversationId - The conversation ID
   * @param {string} messageId - The message ID
   * @param {string} status - New status
   * @param {string} timestamp - Status update timestamp
   */
  async broadcastMessageStatus(conversationId, messageId, status, timestamp) {
    await this.broadcastToConversation(conversationId, 'message.status', {
      conversationId,
      messageId,
      status,
      timestamp
    })
  }

  /**
   * Broadcast message update (edit/delete)
   * @param {string} conversationId - The conversation ID
   * @param {Object} messageUpdate - The message update object
   */
  async broadcastMessageUpdate(conversationId, messageUpdate) {
    await this.broadcastToConversation(conversationId, 'message.updated', {
      conversationId,
      ...messageUpdate
    })
  }

  /**
   * Broadcast conversation update
   * @param {Object} conversation - The conversation object
   */
  async broadcastConversationUpdate(conversation) {
    // Broadcast to conversation channel
    await this.broadcastToConversation(conversation.id, 'conversation.updated', {
      conversation
    })

    // Also broadcast to user inbox
    if (conversation.account_id || conversation.accountId) {
      const userId = conversation.account_id || conversation.accountId
      await this.broadcastToUserInbox(userId, 'conversation.updated', {
        conversation
      })
    }
  }

  /**
   * Broadcast new conversation
   * @param {Object} conversation - The conversation object
   */
  async broadcastNewConversation(conversation) {
    const userId = conversation.account_id || conversation.accountId
    if (userId) {
      await this.broadcastToUserInbox(userId, 'conversation.new', {
        conversation
      })
    }
  }

  /**
   * Check if Realtime is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled
  }

  /**
   * Enable or disable Realtime broadcasts
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled
    logger.info('RealtimeService enabled state changed', { enabled })
  }
}

module.exports = new RealtimeService()
