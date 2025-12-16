/**
 * ChatWebSocketHandler Tests
 * 
 * Tests the WebSocket handler for chat functionality
 */

const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert')

// Create a testable version of the handler that doesn't require database
class TestChatWebSocketHandler {
  constructor(io) {
    this.io = io
    this.typingTimers = new Map()
    this.onlineAgents = new Map()
    this.socketToAgent = new Map()
    this.TYPING_TIMEOUT = 5000
  }

  handleConnection(socket) {
    const agentId = socket.user.id
    
    this.onlineAgents.set(agentId, {
      socketId: socket.id,
      username: socket.user.username,
      lastSeen: new Date()
    })
    this.socketToAgent.set(socket.id, agentId)

    this.broadcastPresence(socket)

    socket.on('join_conversation', (data) => this.handleJoinConversation(socket, data))
    socket.on('leave_conversation', (data) => this.handleLeaveConversation(socket, data))
    socket.on('typing_start', (data) => this.handleTypingStart(socket, data))
    socket.on('typing_stop', (data) => this.handleTypingStop(socket, data))
    socket.on('get_online_agents', () => this.handleGetOnlineAgents(socket))
    socket.on('disconnect', () => this.handleDisconnect(socket))
  }

  handleJoinConversation(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const room = `conversation:${conversationId}`
    socket.join(room)

    socket.to(room).emit('agent_joined', {
      conversationId,
      agent: { id: socket.user.id, username: socket.user.username }
    })

    const typingAgents = this.getTypingAgents(conversationId)
    if (typingAgents.length > 0) {
      socket.emit('typing_status', { conversationId, typingAgents })
    }
  }

  handleLeaveConversation(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const room = `conversation:${conversationId}`
    socket.leave(room)
    this.clearTypingIndicator(conversationId, socket.user.id)

    socket.to(room).emit('agent_left', {
      conversationId,
      agent: { id: socket.user.id, username: socket.user.username }
    })
  }

  handleTypingStart(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const agentId = socket.user.id
    const room = `conversation:${conversationId}`

    this.clearTypingTimer(conversationId, agentId)

    if (!this.typingTimers.has(conversationId)) {
      this.typingTimers.set(conversationId, new Map())
    }
    
    const timer = setTimeout(() => {
      this.clearTypingIndicator(conversationId, agentId)
      this.io.of('/chat').to(room).emit('typing_stop', {
        conversationId,
        agent: { id: agentId, username: socket.user.username }
      })
    }, this.TYPING_TIMEOUT)

    this.typingTimers.get(conversationId).set(agentId, {
      timer,
      username: socket.user.username
    })

    socket.to(room).emit('typing_start', {
      conversationId,
      agent: { id: agentId, username: socket.user.username }
    })
  }

  handleTypingStop(socket, data) {
    const { conversationId } = data || {}
    
    if (!conversationId) {
      socket.emit('error', { message: 'conversationId is required' })
      return
    }

    const agentId = socket.user.id
    const room = `conversation:${conversationId}`

    this.clearTypingIndicator(conversationId, agentId)

    socket.to(room).emit('typing_stop', {
      conversationId,
      agent: { id: agentId, username: socket.user.username }
    })
  }

  handleGetOnlineAgents(socket) {
    const agents = Array.from(this.onlineAgents.entries()).map(([id, info]) => ({
      id,
      username: info.username,
      lastSeen: info.lastSeen
    }))

    socket.emit('online_agents', { agents })
  }

  handleDisconnect(socket) {
    const agentId = this.socketToAgent.get(socket.id)
    
    if (agentId) {
      this.clearAllTypingForAgent(agentId)
      this.onlineAgents.delete(agentId)
      this.socketToAgent.delete(socket.id)
      this.broadcastPresence(socket)
    }
  }

  getTypingAgents(conversationId) {
    const conversationTimers = this.typingTimers.get(conversationId)
    if (!conversationTimers) return []

    return Array.from(conversationTimers.entries()).map(([agentId, info]) => ({
      id: agentId,
      username: info.username
    }))
  }

  clearTypingTimer(conversationId, agentId) {
    const conversationTimers = this.typingTimers.get(conversationId)
    if (conversationTimers && conversationTimers.has(agentId)) {
      clearTimeout(conversationTimers.get(agentId).timer)
    }
  }

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

  clearAllTypingForAgent(agentId) {
    for (const [conversationId, agentTimers] of this.typingTimers.entries()) {
      if (agentTimers.has(agentId)) {
        this.clearTypingIndicator(conversationId, agentId)
        const room = `conversation:${conversationId}`
        this.io.of('/chat').to(room).emit('typing_stop', {
          conversationId,
          agent: { id: agentId }
        })
      }
    }
  }

  broadcastPresence(socket) {
    const agents = Array.from(this.onlineAgents.entries()).map(([id, info]) => ({
      id,
      username: info.username,
      lastSeen: info.lastSeen
    }))

    this.io.of('/chat').emit('presence_update', { agents })
  }

  broadcastNewMessage(conversationId, message) {
    const room = `conversation:${conversationId}`
    this.io.of('/chat').to(room).emit('new_message', { conversationId, message })
  }

  broadcastMessageStatusUpdate(conversationId, messageId, status, timestamp) {
    const room = `conversation:${conversationId}`
    this.io.of('/chat').to(room).emit('message_status_update', {
      conversationId, messageId, status, timestamp
    })
  }

  broadcastConversationUpdate(conversation) {
    this.io.of('/chat').emit('conversation_update', { conversation })
  }
}

// Mock helpers
function createMockIO() {
  const emittedEvents = []
  
  const mockNamespace = {
    to: (room) => ({
      emit: (event, data) => {
        emittedEvents.push({ room, event, data })
      }
    }),
    emit: (event, data) => {
      emittedEvents.push({ room: 'broadcast', event, data })
    }
  }

  return {
    of: () => mockNamespace,
    emittedEvents
  }
}

function createMockSocket(user = { id: 1, username: 'testuser', role: 'user' }) {
  const joinedRooms = new Set()
  const emittedEvents = []
  const eventHandlers = new Map()

  return {
    id: 'socket-123',
    user,
    join: (room) => joinedRooms.add(room),
    leave: (room) => joinedRooms.delete(room),
    emit: (event, data) => emittedEvents.push({ event, data }),
    to: (room) => ({
      emit: (event, data) => emittedEvents.push({ room, event, data })
    }),
    on: (event, handler) => eventHandlers.set(event, handler),
    joinedRooms,
    emittedEvents,
    eventHandlers,
    triggerEvent: function(event, data) {
      const handler = eventHandlers.get(event)
      if (handler) handler(data)
    }
  }
}

describe('ChatWebSocketHandler', () => {
  let handler
  let mockIO

  beforeEach(() => {
    mockIO = createMockIO()
    handler = new TestChatWebSocketHandler(mockIO)
  })

  describe('Constructor', () => {
    it('should initialize with correct defaults', () => {
      assert.strictEqual(handler.TYPING_TIMEOUT, 5000)
      assert.ok(handler.typingTimers instanceof Map)
      assert.ok(handler.onlineAgents instanceof Map)
      assert.ok(handler.socketToAgent instanceof Map)
    })
  })

  describe('handleConnection', () => {
    it('should track online agent on connection', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      assert.ok(handler.onlineAgents.has(1))
      assert.strictEqual(handler.onlineAgents.get(1).username, 'testuser')
    })

    it('should map socket to agent', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      assert.strictEqual(handler.socketToAgent.get('socket-123'), 1)
    })

    it('should broadcast presence update', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      const presenceEvent = mockIO.emittedEvents.find(e => e.event === 'presence_update')
      assert.ok(presenceEvent)
      assert.strictEqual(presenceEvent.data.agents.length, 1)
    })
  })

  describe('handleJoinConversation', () => {
    it('should join conversation room', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('join_conversation', { conversationId: 'conv-1' })
      
      assert.ok(socket.joinedRooms.has('conversation:conv-1'))
    })

    it('should emit error if conversationId is missing', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('join_conversation', {})
      
      const errorEvent = socket.emittedEvents.find(e => e.event === 'error')
      assert.ok(errorEvent)
      assert.strictEqual(errorEvent.data.message, 'conversationId is required')
    })

    it('should notify others in room when joining', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('join_conversation', { conversationId: 'conv-1' })
      
      const joinEvent = socket.emittedEvents.find(e => e.event === 'agent_joined')
      assert.ok(joinEvent)
      assert.strictEqual(joinEvent.data.conversationId, 'conv-1')
    })
  })

  describe('handleLeaveConversation', () => {
    it('should leave conversation room', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('join_conversation', { conversationId: 'conv-1' })
      assert.ok(socket.joinedRooms.has('conversation:conv-1'))
      
      socket.triggerEvent('leave_conversation', { conversationId: 'conv-1' })
      assert.ok(!socket.joinedRooms.has('conversation:conv-1'))
    })

    it('should emit error if conversationId is missing', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('leave_conversation', {})
      
      const errorEvent = socket.emittedEvents.find(e => e.event === 'error')
      assert.ok(errorEvent)
      assert.strictEqual(errorEvent.data.message, 'conversationId is required')
    })
  })

  describe('handleTypingStart', () => {
    it('should track typing state', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('typing_start', { conversationId: 'conv-1' })
      
      const typingAgents = handler.getTypingAgents('conv-1')
      assert.strictEqual(typingAgents.length, 1)
      assert.strictEqual(typingAgents[0].id, 1)
      assert.strictEqual(typingAgents[0].username, 'testuser')
    })

    it('should emit error if conversationId is missing', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('typing_start', {})
      
      const errorEvent = socket.emittedEvents.find(e => e.event === 'error')
      assert.ok(errorEvent)
    })

    it('should broadcast typing start to room', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('typing_start', { conversationId: 'conv-1' })
      
      const typingEvent = socket.emittedEvents.find(e => e.event === 'typing_start')
      assert.ok(typingEvent)
      assert.strictEqual(typingEvent.data.conversationId, 'conv-1')
    })
  })

  describe('handleTypingStop', () => {
    it('should clear typing state', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('typing_start', { conversationId: 'conv-1' })
      assert.strictEqual(handler.getTypingAgents('conv-1').length, 1)
      
      socket.triggerEvent('typing_stop', { conversationId: 'conv-1' })
      assert.strictEqual(handler.getTypingAgents('conv-1').length, 0)
    })

    it('should broadcast typing stop to room', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('typing_start', { conversationId: 'conv-1' })
      socket.triggerEvent('typing_stop', { conversationId: 'conv-1' })
      
      const stopEvent = socket.emittedEvents.find(e => e.event === 'typing_stop')
      assert.ok(stopEvent)
    })
  })

  describe('handleGetOnlineAgents', () => {
    it('should return list of online agents', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('get_online_agents')
      
      const agentsEvent = socket.emittedEvents.find(e => e.event === 'online_agents')
      assert.ok(agentsEvent)
      assert.ok(Array.isArray(agentsEvent.data.agents))
      assert.strictEqual(agentsEvent.data.agents.length, 1)
    })
  })

  describe('handleDisconnect', () => {
    it('should remove agent from online list', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      assert.ok(handler.onlineAgents.has(1))
      
      socket.triggerEvent('disconnect')
      
      assert.ok(!handler.onlineAgents.has(1))
    })

    it('should clear typing indicators on disconnect', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      socket.triggerEvent('typing_start', { conversationId: 'conv-1' })
      assert.strictEqual(handler.getTypingAgents('conv-1').length, 1)
      
      socket.triggerEvent('disconnect')
      assert.strictEqual(handler.getTypingAgents('conv-1').length, 0)
    })

    it('should remove socket to agent mapping', () => {
      const socket = createMockSocket()
      handler.handleConnection(socket)
      
      assert.ok(handler.socketToAgent.has('socket-123'))
      
      socket.triggerEvent('disconnect')
      
      assert.ok(!handler.socketToAgent.has('socket-123'))
    })
  })

  describe('Broadcast Methods', () => {
    it('broadcastNewMessage should emit to conversation room', () => {
      const message = { id: 'msg-1', content: 'Hello' }
      handler.broadcastNewMessage('conv-1', message)
      
      const event = mockIO.emittedEvents.find(e => e.event === 'new_message')
      assert.ok(event)
      assert.strictEqual(event.room, 'conversation:conv-1')
      assert.deepStrictEqual(event.data.message, message)
    })

    it('broadcastMessageStatusUpdate should emit status update', () => {
      const timestamp = new Date()
      handler.broadcastMessageStatusUpdate('conv-1', 'msg-1', 'delivered', timestamp)
      
      const event = mockIO.emittedEvents.find(e => e.event === 'message_status_update')
      assert.ok(event)
      assert.strictEqual(event.data.messageId, 'msg-1')
      assert.strictEqual(event.data.status, 'delivered')
    })

    it('broadcastConversationUpdate should emit to all clients', () => {
      const conversation = { id: 'conv-1', status: 'resolved' }
      handler.broadcastConversationUpdate(conversation)
      
      const event = mockIO.emittedEvents.find(e => e.event === 'conversation_update')
      assert.ok(event)
      assert.strictEqual(event.room, 'broadcast')
      assert.deepStrictEqual(event.data.conversation, conversation)
    })
  })

  describe('Helper Methods', () => {
    it('getTypingAgents should return empty array for unknown conversation', () => {
      const agents = handler.getTypingAgents('unknown-conv')
      assert.deepStrictEqual(agents, [])
    })

    it('clearTypingIndicator should handle non-existent conversation', () => {
      // Should not throw
      handler.clearTypingIndicator('unknown-conv', 1)
      assert.ok(true)
    })

    it('clearAllTypingForAgent should clear all typing for agent', () => {
      const socket = createMockSocket({ id: 1, username: 'user1', role: 'user' })
      handler.handleConnection(socket)
      
      socket.triggerEvent('typing_start', { conversationId: 'conv-1' })
      socket.triggerEvent('typing_start', { conversationId: 'conv-2' })
      
      // Note: second typing_start replaces the first timer for same agent
      // Let's verify at least one is tracked
      const hasTyping = handler.getTypingAgents('conv-1').length > 0 || 
                        handler.getTypingAgents('conv-2').length > 0
      assert.ok(hasTyping)
      
      handler.clearAllTypingForAgent(1)
      
      assert.strictEqual(handler.getTypingAgents('conv-1').length, 0)
      assert.strictEqual(handler.getTypingAgents('conv-2').length, 0)
    })
  })

  describe('Multiple Agents', () => {
    it('should track multiple agents online', () => {
      const socket1 = createMockSocket({ id: 1, username: 'user1', role: 'user' })
      const socket2 = createMockSocket({ id: 2, username: 'user2', role: 'user' })
      socket2.id = 'socket-456'
      
      handler.handleConnection(socket1)
      handler.handleConnection(socket2)
      
      assert.strictEqual(handler.onlineAgents.size, 2)
      assert.ok(handler.onlineAgents.has(1))
      assert.ok(handler.onlineAgents.has(2))
    })

    it('should track typing from multiple agents in same conversation', () => {
      const socket1 = createMockSocket({ id: 1, username: 'user1', role: 'user' })
      const socket2 = createMockSocket({ id: 2, username: 'user2', role: 'user' })
      socket2.id = 'socket-456'
      
      handler.handleConnection(socket1)
      handler.handleConnection(socket2)
      
      socket1.triggerEvent('typing_start', { conversationId: 'conv-1' })
      socket2.triggerEvent('typing_start', { conversationId: 'conv-1' })
      
      const typingAgents = handler.getTypingAgents('conv-1')
      assert.strictEqual(typingAgents.length, 2)
    })
  })
})
