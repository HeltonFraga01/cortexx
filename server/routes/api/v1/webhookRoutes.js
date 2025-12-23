/**
 * External Webhook API v1 Routes
 * 
 * CRUD operations for external webhook configurations
 * 
 * Requirements: REQ-2.3 (chat-api-realtime-migration)
 */

const router = require('express').Router()
const { logger } = require('../../../utils/logger')
const { apiKeyAuth } = require('../../../middleware/apiKeyAuth')
const ExternalWebhookService = require('../../../services/ExternalWebhookService')

/**
 * GET /api/v1/webhooks
 * List all webhooks for the account
 * Scope: webhooks:read
 */
router.get('/', apiKeyAuth(['webhooks:read']), async (req, res) => {
  try {
    const webhooks = await ExternalWebhookService.listWebhooks(req.accountId)
    
    res.json({
      success: true,
      data: webhooks
    })
  } catch (error) {
    logger.error('API v1: Failed to list webhooks', {
      error: error.message,
      accountId: req.accountId,
      endpoint: '/api/v1/webhooks'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/webhooks
 * Create a new webhook
 * Scope: webhooks:write
 */
router.post('/', apiKeyAuth(['webhooks:write']), async (req, res) => {
  try {
    const { url, secret, events, retryCount, timeoutMs } = req.body
    
    if (!url) {
      return res.status(400).json({ error: 'Webhook URL is required' })
    }
    
    if (!events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'At least one event type is required' })
    }
    
    // Validate event types
    const validEvents = [
      'message.received',
      'message.sent',
      'message.status',
      'conversation.created',
      'conversation.updated',
      'conversation.closed'
    ]
    
    const invalidEvents = events.filter(e => !validEvents.includes(e))
    if (invalidEvents.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid event types',
        invalidEvents,
        validEvents
      })
    }
    
    const webhook = await ExternalWebhookService.createWebhook(req.accountId, {
      url,
      secret,
      events,
      retryCount,
      timeoutMs
    })
    
    res.status(201).json({
      success: true,
      data: webhook
    })
  } catch (error) {
    logger.error('API v1: Failed to create webhook', {
      error: error.message,
      accountId: req.accountId,
      endpoint: '/api/v1/webhooks'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * PATCH /api/v1/webhooks/:id
 * Update a webhook
 * Scope: webhooks:write
 */
router.patch('/:id', apiKeyAuth(['webhooks:write']), async (req, res) => {
  try {
    const { url, secret, events, isActive, retryCount, timeoutMs } = req.body
    
    const updates = {}
    if (url !== undefined) updates.url = url
    if (secret !== undefined) updates.secret = secret
    if (events !== undefined) updates.events = events
    if (isActive !== undefined) updates.is_active = isActive
    if (retryCount !== undefined) updates.retry_count = retryCount
    if (timeoutMs !== undefined) updates.timeout_ms = timeoutMs
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' })
    }
    
    const webhook = await ExternalWebhookService.updateWebhook(
      req.params.id,
      req.accountId,
      updates
    )
    
    res.json({
      success: true,
      data: webhook
    })
  } catch (error) {
    logger.error('API v1: Failed to update webhook', {
      error: error.message,
      accountId: req.accountId,
      webhookId: req.params.id,
      endpoint: '/api/v1/webhooks/:id'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/v1/webhooks/:id
 * Delete a webhook
 * Scope: webhooks:write
 */
router.delete('/:id', apiKeyAuth(['webhooks:write']), async (req, res) => {
  try {
    await ExternalWebhookService.deleteWebhook(req.params.id, req.accountId)
    
    res.json({
      success: true,
      message: 'Webhook deleted'
    })
  } catch (error) {
    logger.error('API v1: Failed to delete webhook', {
      error: error.message,
      accountId: req.accountId,
      webhookId: req.params.id,
      endpoint: '/api/v1/webhooks/:id'
    })
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/v1/webhooks/:id/test
 * Test a webhook by sending a test event
 * Scope: webhooks:write
 */
router.post('/:id/test', apiKeyAuth(['webhooks:write']), async (req, res) => {
  try {
    const webhooks = await ExternalWebhookService.listWebhooks(req.accountId)
    const webhook = webhooks.find(w => w.id === req.params.id)
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' })
    }
    
    // Send test event
    const result = await ExternalWebhookService.deliverWebhook(
      webhook,
      'test',
      {
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString()
      }
    )
    
    res.json({
      success: result.success,
      data: result
    })
  } catch (error) {
    logger.error('API v1: Failed to test webhook', {
      error: error.message,
      accountId: req.accountId,
      webhookId: req.params.id,
      endpoint: '/api/v1/webhooks/:id/test'
    })
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
