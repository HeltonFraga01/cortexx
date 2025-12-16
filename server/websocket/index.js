/**
 * WebSocket Server Module
 * 
 * Initializes Socket.IO and integrates chat WebSocket handlers
 */

const { Server } = require('socket.io')
const { logger } = require('../utils/logger')
const ChatWebSocketHandler = require('./ChatWebSocketHandler')

let io = null
let chatHandler = null

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 * @param {Database} db - Database instance (optional)
 * @returns {Server} Socket.IO server instance
 */
function initializeWebSocket(server, db = null) {
  const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001']

  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? corsOrigins
        : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  })

  // Main namespace connection handler
  io.on('connection', (socket) => {
    logger.debug('Client connected to main namespace', { socketId: socket.id })

    // Join instance-specific room for targeted updates
    socket.on('join-instance', (instanceId) => {
      socket.join(`instance:${instanceId}`)
      logger.debug('Socket joined instance room', { socketId: socket.id, instanceId })
    })

    socket.on('leave-instance', (instanceId) => {
      socket.leave(`instance:${instanceId}`)
      logger.debug('Socket left instance room', { socketId: socket.id, instanceId })
    })

    socket.on('disconnect', () => {
      logger.debug('Client disconnected from main namespace', { socketId: socket.id })
    })
  })

  // Initialize chat WebSocket handler
  chatHandler = new ChatWebSocketHandler(io, db)
  chatHandler.initialize()

  logger.info('WebSocket server initialized', { 
    corsOrigins: process.env.NODE_ENV === 'production' ? corsOrigins : 'development defaults'
  })

  return io
}

/**
 * Get Socket.IO server instance
 * @returns {Server|null}
 */
function getIO() {
  return io
}

/**
 * Get Chat WebSocket handler instance
 * @returns {ChatWebSocketHandler|null}
 */
function getChatHandler() {
  return chatHandler
}

// ==================== Broadcast Functions ====================

/**
 * Emit campaign progress update
 */
function emitCampaignProgress(instanceId, campaignId, progress) {
  if (io) {
    io.to(`instance:${instanceId}`).emit('campaign-progress', {
      campaignId,
      ...progress
    })
  }
}

/**
 * Emit campaign status change
 */
function emitCampaignStatus(instanceId, campaignId, status) {
  if (io) {
    io.to(`instance:${instanceId}`).emit('campaign-status', {
      campaignId,
      status
    })
  }
}

/**
 * Emit message sent notification
 */
function emitMessageSent(instanceId, data) {
  if (io) {
    io.to(`instance:${instanceId}`).emit('message-sent', data)
  }
}

/**
 * Emit queue update
 */
function emitQueueUpdate(instanceId, queueData) {
  if (io) {
    io.to(`instance:${instanceId}`).emit('queue-update', queueData)
  }
}

/**
 * Emit connection status change
 */
function emitConnectionStatus(instanceId, status) {
  if (io) {
    io.to(`instance:${instanceId}`).emit('connection-status', status)
  }
}

/**
 * Emit scheduled message update
 */
function emitScheduledMessageUpdate(instanceId, data) {
  if (io) {
    io.to(`instance:${instanceId}`).emit('scheduled-message-update', data)
  }
}

module.exports = {
  initializeWebSocket,
  getIO,
  getChatHandler,
  emitCampaignProgress,
  emitCampaignStatus,
  emitMessageSent,
  emitQueueUpdate,
  emitConnectionStatus,
  emitScheduledMessageUpdate
}
