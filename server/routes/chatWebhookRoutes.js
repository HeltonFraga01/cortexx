/**
 * Chat Webhook Routes
 * 
 * Receives webhook events from WUZAPI for chat functionality
 * 
 * Requirements: 11.1, 11.2, 11.3
 */

const express = require('express')
const router = express.Router()
const { logger } = require('../utils/logger')
const ChatMessageHandler = require('../webhooks/chatMessageHandler')

// Cache handler instance per request
let handlerInstance = null

/**
 * Get or create ChatMessageHandler instance
 */
function getHandler(req) {
  const db = req.app.locals.db
  const chatHandler = req.app.locals.chatHandler
  
  if (!handlerInstance || handlerInstance.db !== db) {
    handlerInstance = new ChatMessageHandler(db, chatHandler)
  } else if (handlerInstance.chatHandler !== chatHandler) {
    handlerInstance.setChatHandler(chatHandler)
  }
  
  return handlerInstance
}

/**
 * POST /api/chat/webhook
 * Receive webhook events from WUZAPI
 */
router.post('/', async (req, res) => {
  try {
    const userToken = req.headers.token || req.headers['x-user-token']
    const event = req.body

    if (!userToken) {
      logger.warn('Webhook received without user token')
      return res.status(400).json({ 
        success: false, 
        error: 'User token required in headers' 
      })
    }

    if (!event || !event.type) {
      logger.warn('Webhook received without event type')
      return res.status(400).json({ 
        success: false, 
        error: 'Event type required' 
      })
    }

    const db = req.app.locals.db
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not available' 
      })
    }

    const handler = getHandler(req)
    const result = await handler.handleEvent(userToken, event)

    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('Webhook processing error', { error: error.message })
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

/**
 * POST /api/chat/webhook/batch
 * Receive multiple webhook events at once
 */
router.post('/batch', async (req, res) => {
  try {
    const userToken = req.headers.token || req.headers['x-user-token']
    const { events } = req.body

    if (!userToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'User token required in headers' 
      })
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Events array required' 
      })
    }

    const db = req.app.locals.db
    if (!db) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database not available' 
      })
    }

    const handler = getHandler(req)
    const results = []

    for (const event of events) {
      try {
        const result = await handler.handleEvent(userToken, event)
        results.push({ success: true, ...result })
      } catch (error) {
        results.push({ success: false, error: error.message, type: event.type })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.length - successCount

    res.json({ 
      success: true, 
      processed: results.length,
      successCount,
      failCount,
      results 
    })
  } catch (error) {
    logger.error('Batch webhook processing error', { error: error.message })
    res.status(500).json({ 
      success: false, 
      error: error.message 
    })
  }
})

/**
 * GET /api/chat/webhook/health
 * Health check for webhook endpoint
 */
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

module.exports = router
