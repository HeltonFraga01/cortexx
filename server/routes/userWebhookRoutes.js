/**
 * User Webhook Routes
 * 
 * Handles outgoing webhook configuration for users
 * 
 * Requirements: 16.1-16.6
 */

const express = require('express')
const router = express.Router()
const { logger } = require('../utils/logger')
const OutgoingWebhookService = require('../services/OutgoingWebhookService')
const SupabaseService = require('../services/SupabaseService')
const { toBoolean } = require('../utils/responseTransformer')
const { quotaMiddleware } = require('../middleware/quotaEnforcement')
const { featureMiddleware } = require('../middleware/featureEnforcement')

// Use global verifyUserToken middleware for consistent user identification
const verifyUserToken = require('../middleware/verifyUserToken')

/**
 * GET /api/user/outgoing-webhooks
 * List all outgoing webhooks for the user
 */
router.get('/', verifyUserToken, async (req, res) => {
  try {
    const webhookService = new OutgoingWebhookService(SupabaseService)
    
    const webhooks = await webhookService.getWebhooks(req.userId)

    res.json({ success: true, data: webhooks })
  } catch (error) {
    logger.error('Error fetching webhooks', { error: error.message, userId: req.userId })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/user/outgoing-webhooks/:id
 * Get a specific webhook
 */
router.get('/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const webhookService = new OutgoingWebhookService(SupabaseService)
    
    const webhook = await webhookService.getWebhookById(parseInt(id, 10), req.userId)
    
    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' })
    }

    res.json({ 
      success: true, 
      data: {
        ...webhook,
        events: JSON.parse(webhook.events || '[]'),
        isActive: toBoolean(webhook.is_active)
      }
    })
  } catch (error) {
    logger.error('Error fetching webhook', { error: error.message, webhookId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user/outgoing-webhooks
 * Create a new outgoing webhook
 */
router.post('/', verifyUserToken, featureMiddleware.webhooks, quotaMiddleware.webhooks, async (req, res) => {
  try {
    const { url, events, secret } = req.body
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' })
    }
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one event type is required' })
    }

    const webhookService = new OutgoingWebhookService(SupabaseService)
    
    const webhook = await webhookService.configureWebhook(req.userId, {
      url,
      events,
      secret
    })

    res.status(201).json({ success: true, data: webhook })
  } catch (error) {
    logger.error('Error creating webhook', { error: error.message, userId: req.userId })
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/user/outgoing-webhooks/:id
 * Update a webhook
 */
router.put('/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params
    const { url, events, isActive } = req.body

    const webhookService = new OutgoingWebhookService(SupabaseService)
    
    const webhook = await webhookService.updateWebhook(parseInt(id, 10), req.userId, {
      url,
      events,
      isActive
    })

    res.json({ success: true, data: webhook })
  } catch (error) {
    logger.error('Error updating webhook', { error: error.message, webhookId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/user/outgoing-webhooks/:id
 * Delete a webhook
 */
router.delete('/:id', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const webhookService = new OutgoingWebhookService(SupabaseService)
    
    await webhookService.deleteWebhook(parseInt(id, 10), req.userId)

    res.json({ success: true, message: 'Webhook deleted' })
  } catch (error) {
    logger.error('Error deleting webhook', { error: error.message, webhookId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/user/outgoing-webhooks/:id/stats
 * Get webhook delivery statistics
 */
router.get('/:id/stats', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const webhookService = new OutgoingWebhookService(SupabaseService)
    
    const stats = await webhookService.getWebhookStats(parseInt(id, 10), req.userId)

    res.json({ success: true, data: stats })
  } catch (error) {
    logger.error('Error fetching webhook stats', { error: error.message, webhookId: req.params.id })
    
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user/outgoing-webhooks/:id/test
 * Send a test webhook event
 */
router.post('/:id/test', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params

    const webhookService = new OutgoingWebhookService(SupabaseService)
    
    // Get webhook to verify ownership
    const webhook = await webhookService.getWebhookById(parseInt(id, 10), req.userId)
    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' })
    }

    // Send test event
    const result = await webhookService.deliverWebhook(webhook, 'test', {
      message: 'This is a test webhook event',
      timestamp: new Date().toISOString()
    })

    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('Error testing webhook', { error: error.message, webhookId: req.params.id })
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
