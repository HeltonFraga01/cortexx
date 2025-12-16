/**
 * ChatWebSocketHandler - Handles real-time chat communication via WebSocket
 * 
 * Responsibilities:
 * - Connection authentication using session tokens
 * - Room management for conversations
 * - Typing indicators with auto-expire
 * - Presence tracking for online agents
 * - Message event broadcasting
 */

const { logger } = require('../utils/logger')
const { toBoolean, transformConversation } = require('../utils/responseTransformer')

class ChatWebSocketHandler {
  constructor(io, db = null) {
    this.io = io
    this.db = db
    this.typingTimers = new Map() // conversationId -> Map(agentId -> { timer, username })
    this.onlineAgents = new Map() // agentId -> { socketId, username, lastSeen }
    this.socketToAgent = new Map() // socketId -> agentId
    this.TYPING_TIMEOUT = 5000 // 5 seconds auto-expire
  }

  /**
   * Initialize chat WebSocket handlers on the /chat namespace
   */
  initialize() {
    const chatNamespace = this.io.of('/chat')
    
    chatNamespace.use(this.authMiddleware.bind(this))
    
    chatNamespace.on('connection', (socket) => {
      this.handleConnection(socket)
    })

    logger.info('Chat WebSocket handler initialized', { namespace: '/chat' })
    return chatNamespace
  }

  /**
   * Authentication middleware for chat namespace
   * Validates session token via WuzAPI and attaches user info to socket
   */
  async authMiddleware(socket, next) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token
      
      if (!token) {
        return next(new Error('Authentication required'))
      }

      // Validate token with WuzAPI
      const wuzapiClient = require('../utils/wuzapiClient')
      
      try {
        // Validate token by checking session status
        const response = await wuzapiClient.get('/session/status', {
          headers: { token: token }
        })
        
        // Token is valid, get user info
        let userId = token // Default to token as userId
        let username = token.substring(0, 8)
        
        // Try to get actual userId from admin endpoint
        const adminToken = process.env.WUZAPI_ADMIN_TOKEN
        if (adminToken) {
          try {
            const adminResponse = await wuzapiClient.getAdmin('/admin/users', adminToken)
            if (adminResponse.success && adminResponse.data?.data) {
              const users = adminResponse.data.data
              const user = users.find(u => u.token === token)
              if (user) {
                userId = user.id
                username = user.name || user.token.substring(0, 8)
              }
            }
          } catch (adminError) {
            logger.warn('Could not fetch user info from admin endpoint', { error: adminError.message })
          }
        }

        // Attach user info to socket
        socket.user = {
          id: userId,
          token: token,
          username: username,
          role: 'user'
        }

        next()
      } catch (validationError) {
        logger.warn('Chat WebSocket token validation failed', { error: validationError.message })
        return next(new Error('Invalid or expired token'))
      }
    } catch (error) {
      logger.error('Chat WebSocket auth error', { error: error.message })
      next(new Error('Authentication failed'))
    }
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const agentId = socket.user.id
    
    logger.info('Chat agent connected', { 
      agentId, 
      username: socket.user.username, 
      socketId: socket.id 
    })

    // Track online agent
    this.onlineAgents.set(agentId, {
      socketId: socket.id,
      username: socket.user.username,
      lastSeen: new Date()
    })
    this.socketToAgent.set(socket.id, agentId)

    // Broadcast presence update
    this.broadcastPresence(socket)

    // Register event handlers
    socket.on('join_conversation', (data) => this.handleJoinConversation(socket, data))
    socket.on('leave_conversation', (data) => this.handleLeaveConversation(socket, data))
    socket.on('typing_start', (data) => this.handleTypingStart(socket, data))
    socket.on('typing_stop', (data) => this.handleTypingStop(socket, data))
    socket.on('get_online_agents', () => this.handleGetOnlineAgents(socket))
    socket.on('disconnect', () => this.handleDisconnect(socket))
  }


  /**
   * Handle agent joining a conversation room
   */
  handleJoinConversation(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const room = `conversation:${conversationId}`
    socket.join(room)
    
    logger.debug('Agent joined conversation', { 
      agentId: socket.user.id, 
      username: socket.user.username, 
      conversationId 
    })

    // Notify others in the room
    socket.to(room).emit('agent_joined', {
      conversationId,
      agent: {
        id: socket.user.id,
        username: socket.user.username
      }
    })

    // Send current typing status for this conversation
    const typingAgents = this.getTypingAgents(conversationId)
    if (typingAgents.length > 0) {
      socket.emit('typing_status', {
        conversationId,
        typingAgents
      })
    }
  }

  /**
   * Handle agent leaving a conversation room
   */
  handleLeaveConversation(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const room = `conversation:${conversationId}`
    socket.leave(room)
    
    logger.debug('Agent left conversation', { 
      agentId: socket.user.id, 
      username: socket.user.username, 
      conversationId 
    })

    // Clear any typing indicator for this agent in this conversation
    this.clearTypingIndicator(conversationId, socket.user.id)

    // Notify others in the room
    socket.to(room).emit('agent_left', {
      conversationId,
      agent: {
        id: socket.user.id,
        username: socket.user.username
      }
    })
  }

  /**
   * Handle typing start event
   */
  handleTypingStart(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const agentId = socket.user.id
    const room = `conversation:${conversationId}`

    // Clear existing timer if any
    this.clearTypingTimer(conversationId, agentId)

    // Set up auto-expire timer
    if (!this.typingTimers.has(conversationId)) {
      this.typingTimers.set(conversationId, new Map())
    }
    
    const timer = setTimeout(() => {
      this.clearTypingIndicator(conversationId, agentId)
      this.io.of('/chat').to(room).emit('typing_stop', {
        conversationId,
        agent: {
          id: agentId,
          username: socket.user.username
        }
      })
    }, this.TYPING_TIMEOUT)

    this.typingTimers.get(conversationId).set(agentId, {
      timer,
      username: socket.user.username
    })

    // Broadcast typing start to room (except sender)
    socket.to(room).emit('typing_start', {
      conversationId,
      agent: {
        id: agentId,
        username: socket.user.username
      }
    })
  }

  /**
   * Handle typing stop event
   */
  handleTypingStop(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const agentId = socket.user.id
    const room = `conversation:${conversationId}`

    // Clear typing indicator
    this.clearTypingIndicator(conversationId, agentId)

    // Broadcast typing stop to room (except sender)
    socket.to(room).emit('typing_stop', {
      conversationId,
      agent: {
        id: agentId,
        username: socket.user.username
      }
    })
  }

  /**
   * Handle request for online agents list
   */
  handleGetOnlineAgents(socket) {
    const agents = Array.from(this.onlineAgents.entries()).map(([id, info]) => ({
      id,
      username: info.username,
      lastSeen: info.lastSeen
    }))

    socket.emit('online_agents', { agents })
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socket) {
    const agentId = this.socketToAgent.get(socket.id)
    
    if (agentId) {
      logger.info('Chat agent disconnected', { 
        agentId, 
        username: socket.user?.username 
      })

      // Clear all typing indicators for this agent
      this.clearAllTypingForAgent(agentId)

      // Remove from online agents
      this.onlineAgents.delete(agentId)
      this.socketToAgent.delete(socket.id)

      // Broadcast presence update
      this.broadcastPresence(socket)
    }
  }


  // ==================== Helper Methods ====================

  /**
   * Get list of agents currently typing in a conversation
   */
  getTypingAgents(conversationId) {
    const conversationTimers = this.typingTimers.get(conversationId)
    if (!conversationTimers) return []

    return Array.from(conversationTimers.entries()).map(([agentId, info]) => ({
      id: agentId,
      username: info.username
    }))
  }

  /**
   * Clear typing timer for a specific agent in a conversation
   */
  clearTypingTimer(conversationId, agentId) {
    const conversationTimers = this.typingTimers.get(conversationId)
    if (conversationTimers && conversationTimers.has(agentId)) {
      clearTimeout(conversationTimers.get(agentId).timer)
    }
  }

  /**
   * Clear typing indicator for a specific agent in a conversation
   */
  clearTypingIndicator(conversationId, agentId) {
    this.clearTypingTimer(conversationId, agentId)
    const conversationTimers = this.typingTimers.get(conversationId)
    if (conversationTimers) {
      conversationTimers.delete(agentId)
      if (conversationTimers.size === 0) {
        this.typingTimers.delete(conversationId)
      }
    }
  }

  /**
   * Clear all typing indicators for an agent across all conversations
   */
  clearAllTypingForAgent(agentId) {
    for (const [conversationId, agentTimers] of this.typingTimers.entries()) {
      if (agentTimers.has(agentId)) {
        this.clearTypingIndicator(conversationId, agentId)
        
        // Broadcast typing stop to the conversation room
        const room = `conversation:${conversationId}`
        this.io.of('/chat').to(room).emit('typing_stop', {
          conversationId,
          agent: { id: agentId }
        })
      }
    }
  }

  /**
   * Broadcast presence update to all connected clients
   */
  broadcastPresence(socket) {
    const agents = Array.from(this.onlineAgents.entries()).map(([id, info]) => ({
      id,
      username: info.username,
      lastSeen: info.lastSeen
    }))

    this.io.of('/chat').emit('presence_update', { agents })
  }

  // ==================== Broadcast Methods (called from routes/services) ====================

  /**
   * Broadcast new message to conversation room AND globally for notifications
   */
  broadcastNewMessage(conversationId, message, options = {}) {
    const room = `conversation:${conversationId}`
    const { isMuted = false } = options
    
    // Emit to specific conversation room (for message display)
    this.io.of('/chat').to(room).emit('new_message', {
      conversationId,
      message
    })

    // Also emit globally for notification sounds (all connected clients)
    // This allows clients to play notification sounds even if not viewing the conversation
    // Include isMuted flag so clients can decide whether to play sound
    this.io.of('/chat').emit('new_message_notification', {
      conversationId,
      message,
      isMuted
    })

    logger.debug('Broadcast new message', { conversationId, messageId: message.id, isMuted })
  }

  /**
   * Broadcast message status update to conversation room
   */
  broadcastMessageStatusUpdate(conversationId, messageId, status, timestamp) {
    const room = `conversation:${conversationId}`
    this.io.of('/chat').to(room).emit('message_status_update', {
      conversationId,
      messageId,
      status,
      timestamp
    })

    logger.debug('Broadcast message status update', { conversationId, messageId, status })
  }

  /**
   * Broadcast message reaction to conversation room
   */
  broadcastMessageReaction(conversationId, messageId, reaction) {
    const room = `conversation:${conversationId}`
    this.io.of('/chat').to(room).emit('message_reaction', {
      conversationId,
      messageId,
      reaction
    })

    logger.debug('Broadcast message reaction', { conversationId, messageId, emoji: reaction.emoji })
  }

  /**
   * Broadcast conversation update to all connected clients
   * Requirements: 2.1, 2.2, 2.3 (websocket-data-transformation-fix)
   */
  broadcastConversationUpdate(conversation) {
    // Transform to camelCase with proper boolean conversion
    const transformed = transformConversation(conversation)
    
    this.io.of('/chat').emit('conversation_update', { conversation: transformed })

    logger.debug('Broadcast conversation update', { conversationId: conversation.id })
  }

  /**
   * Broadcast message update (edit/delete) to conversation room
   * Requirements: 2.2, 3.2 (unsupported-message-types)
   * Requirements: 1.1, 1.2 (websocket-data-transformation-fix)
   */
  broadcastMessageUpdate(conversationId, messageUpdate) {
    const room = `conversation:${conversationId}`
    
    // Transform to camelCase with proper boolean conversion
    const transformedUpdate = {
      id: messageUpdate.id,
      content: messageUpdate.content,
      isEdited: toBoolean(messageUpdate.is_edited),
      isDeleted: toBoolean(messageUpdate.is_deleted)
    }
    
    this.io.of('/chat').to(room).emit('message_update', {
      conversationId,
      ...transformedUpdate
    })

    logger.debug('Broadcast message update', { 
      conversationId, 
      messageId: transformedUpdate.id,
      isEdited: transformedUpdate.isEdited,
      isDeleted: transformedUpdate.isDeleted
    })
  }

  /**
   * Broadcast new conversation to all connected clients
   */
  broadcastNewConversation(conversation) {
    this.io.of('/chat').emit('new_conversation', { conversation })

    logger.debug('Broadcast new conversation', { conversationId: conversation.id })
  }
}

module.exports = ChatWebSocketHandler
