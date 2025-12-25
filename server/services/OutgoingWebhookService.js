/**
 * OutgoingWebhookService - Service for managing outgoing webhooks
 * 
 * Handles webhook configuration, delivery, and retry logic
 * Uses SupabaseService for database operations
 * 
 * Requirements: 16.1-16.6
 */

const crypto = require('crypto')
const axios = require('axios')
const { logger } = require('../utils/logger')
const { toBoolean } = require('../utils/responseTransformer')
const supabaseService = require('./SupabaseService')

class OutgoingWebhookService {
  constructor() {
    this.MAX_RETRIES = 3
    this.RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff
  }

  /**
   * Configure a new webhook
   * @param {string} userId - User ID
   * @param {Object} data - Webhook configuration
   * @param {string} [data.inboxId] - Inbox ID (optional for legacy webhooks)
   * @returns {Promise<Object>} Created webhook
   * 
   * Requirements: 16.1, 16.2, 3.1, 3.6
   */
  async configureWebhook(userId, data) {
    const { url, events = [], secret = null, inboxId = null } = data

    // Validate URL format
    try {
      new URL(url)
    } catch {
      throw new Error('Invalid webhook URL format')
    }

    // Validate events array
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('At least one event type is required')
    }

    // Validate inbox ownership if inboxId provided
    if (inboxId) {
      await this.validateInboxOwnership(userId, inboxId)
    }

    // Generate secret if not provided
    const webhookSecret = secret || this.generateSecret()

    const webhookData = {
      user_id: userId,
      inbox_id: inboxId,
      url,
      events: JSON.stringify(events),
      secret: webhookSecret,
      is_active: true,
      success_count: 0,
      failure_count: 0
    }

    const { data: webhook, error } = await supabaseService.insert('outgoing_webhooks', webhookData)

    if (error) {
      logger.error('Failed to configure webhook', { userId, inboxId, error: error.message })
      throw new Error(`Failed to configure webhook: ${error.message}`)
    }

    logger.info('Webhook configured', { webhookId: webhook.id, userId, inboxId, events })

    return this.formatWebhook(webhook)
  }

  /**
   * Validate that inbox belongs to user
   * @param {string} userId - User ID
   * @param {string} inboxId - Inbox ID
   * @throws {Error} If inbox doesn't belong to user
   * 
   * Requirements: 3.6, 4.3, 4.4, 4.5
   */
  async validateInboxOwnership(userId, inboxId) {
    const { data: inbox, error } = await supabaseService.queryAsAdmin('inboxes', (query) =>
      query
        .select('id, accounts!inner(owner_user_id)')
        .eq('id', inboxId)
        .single()
    )

    if (error || !inbox) {
      logger.warn('Inbox not found for ownership validation', { userId, inboxId })
      throw new Error('Inbox not found or unauthorized')
    }

    if (inbox.accounts.owner_user_id !== userId) {
      logger.warn('Inbox ownership validation failed', { 
        userId, 
        inboxId, 
        actualOwner: inbox.accounts.owner_user_id 
      })
      throw new Error('Inbox not found or unauthorized')
    }
  }

  /**
   * Update a webhook
   * @param {string} webhookId - Webhook ID
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated webhook
   */
  async updateWebhook(webhookId, userId, data) {
    const { url, events, isActive } = data

    const webhook = await this.getWebhookById(webhookId, userId)
    if (!webhook) {
      throw new Error('Webhook not found or unauthorized')
    }

    if (url) {
      try {
        new URL(url)
      } catch {
        throw new Error('Invalid webhook URL format')
      }
    }

    const updates = {}

    if (url !== undefined) {
      updates.url = url
    }
    if (events !== undefined) {
      updates.events = JSON.stringify(events)
    }
    if (isActive !== undefined) {
      updates.is_active = isActive
    }

    if (Object.keys(updates).length === 0) {
      return webhook
    }

    // Use queryAsAdmin to update with user_id filter
    const { data: updated, error } = await supabaseService.queryAsAdmin('outgoing_webhooks', (query) =>
      query.update(updates).eq('id', webhookId).eq('user_id', userId).select().single()
    )

    if (error) {
      logger.error('Failed to update webhook', { webhookId, userId, error: error.message })
      throw new Error(`Failed to update webhook: ${error.message}`)
    }

    logger.info('Webhook updated', { webhookId, userId })

    return this.formatWebhook(updated)
  }

  /**
   * Delete a webhook
   * @param {string} webhookId - Webhook ID
   * @param {string} userId - User ID
   */
  async deleteWebhook(webhookId, userId) {
    const webhook = await this.getWebhookById(webhookId, userId)
    if (!webhook) {
      throw new Error('Webhook not found or unauthorized')
    }

    // Delete delivery logs first
    await supabaseService.queryAsAdmin('webhook_deliveries', (query) =>
      query.delete().eq('webhook_id', webhookId)
    )

    // Delete webhook
    const { error } = await supabaseService.queryAsAdmin('outgoing_webhooks', (query) =>
      query.delete().eq('id', webhookId).eq('user_id', userId)
    )

    if (error) {
      logger.error('Failed to delete webhook', { webhookId, userId, error: error.message })
      throw new Error(`Failed to delete webhook: ${error.message}`)
    }

    logger.info('Webhook deleted', { webhookId, userId })
  }

  /**
   * Send webhook event to inbox-specific and legacy webhooks
   * @param {string} userId - User ID
   * @param {string} inboxId - Inbox ID (required for inbox-specific routing)
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<Array>} Delivery results
   * 
   * Requirements: 16.3, 16.4, 3.5, 8.1, 8.2, 9.1, 9.2
   */
  async sendWebhookEvent(userId, inboxId, eventType, payload) {
    // Get webhooks for this specific inbox
    const inboxWebhooks = inboxId ? await this.getWebhooks(userId, inboxId) : []
    
    // Also get legacy webhooks (inbox_id IS NULL) for backward compatibility
    const legacyWebhooks = await this.getWebhooks(userId, null)
    
    // Combine both sets, filtering for active webhooks only
    const allWebhooks = [...inboxWebhooks, ...legacyWebhooks].filter(w => w.isActive)

    logger.info('Checking outgoing webhooks', {
      userId: userId?.substring(0, 10),
      inboxId: inboxId?.substring(0, 8),
      eventType,
      inboxWebhooksFound: inboxWebhooks.length,
      legacyWebhooksFound: legacyWebhooks.length,
      totalActive: allWebhooks.length
    })

    const results = []

    for (const webhook of allWebhooks) {
      const events = Array.isArray(webhook.events) ? webhook.events : this.parseEvents(webhook.events)
      
      logger.debug('Webhook event check', {
        webhookId: webhook.id,
        webhookInboxId: webhook.inboxId,
        subscribedEvents: events,
        eventType,
        matches: events.includes(eventType) || events.includes('*')
      })
      
      // Check if webhook subscribes to this event
      if (!events.includes(eventType) && !events.includes('*')) {
        continue
      }

      const result = await this.deliverWebhook(webhook, eventType, payload)
      results.push(result)
    }

    return results
  }


  /**
   * Deliver webhook with retry logic
   * @param {Object} webhook - Webhook configuration
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<Object>} Delivery result
   * 
   * Requirements: 16.5
   */
  async deliverWebhook(webhook, eventType, payload) {
    const deliveryId = crypto.randomUUID()
    const startTime = Date.now()

    // Use payload directly if it's already in WUZAPI format (has 'event' or 'type' field)
    // Otherwise wrap it in our standard format
    const isWuzapiFormat = payload && (payload.event || payload.type === 'Message')
    
    const webhookPayload = isWuzapiFormat 
      ? payload  // Send WUZAPI-compatible payload directly
      : {
          id: deliveryId,
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload
        }

    // Generate signature
    const signature = this.generateSignature(webhookPayload, webhook.secret)

    let lastError = null
    let attempt = 0
    let success = false
    let responseStatus = null
    let responseBody = null

    // Retry loop with exponential backoff
    while (attempt < this.MAX_RETRIES && !success) {
      attempt++

      try {
        const response = await axios.post(webhook.url, webhookPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Id': webhook.id.toString(),
            'X-Webhook-Signature': signature,
            'X-Delivery-Id': deliveryId,
            'X-Event-Type': eventType
          },
          timeout: 10000,
          validateStatus: (status) => status < 500 // Don't retry on 4xx
        })

        responseStatus = response.status
        responseBody = JSON.stringify(response.data).substring(0, 1000)

        if (response.status >= 200 && response.status < 300) {
          success = true
        } else if (response.status >= 400 && response.status < 500) {
          // Client error, don't retry
          lastError = `HTTP ${response.status}`
          break
        }
      } catch (error) {
        lastError = error.message
        responseStatus = error.response?.status || 0

        // Wait before retry (exponential backoff)
        if (attempt < this.MAX_RETRIES) {
          await this.sleep(this.RETRY_DELAYS[attempt - 1])
        }
      }
    }

    const duration = Date.now() - startTime

    // Log delivery attempt
    await this.logDelivery(webhook.id, {
      deliveryId,
      eventType,
      payload: webhookPayload,
      success,
      attempts: attempt,
      responseStatus,
      responseBody,
      error: lastError,
      duration
    })

    // Update webhook stats
    await this.updateWebhookStats(webhook.id, success)

    logger.info('Webhook delivered', {
      webhookId: webhook.id,
      deliveryId,
      eventType,
      success,
      attempts: attempt,
      duration
    })

    return {
      webhookId: webhook.id,
      deliveryId,
      success,
      attempts: attempt,
      error: lastError
    }
  }

  /**
   * Log webhook delivery
   * @param {string} webhookId - Webhook ID
   * @param {Object} data - Delivery data
   */
  async logDelivery(webhookId, data) {
    const deliveryData = {
      webhook_id: webhookId,
      delivery_id: data.deliveryId,
      event_type: data.eventType,
      payload: data.payload || {},
      status: data.success ? 'success' : 'failed',
      success: data.success,
      attempts: data.attempts,
      response_status: data.responseStatus,
      response_body: data.responseBody,
      error: data.error,
      duration_ms: data.duration
    }

    const { error } = await supabaseService.insert('webhook_deliveries', deliveryData)

    if (error) {
      logger.error('Failed to log webhook delivery', { webhookId, error: error.message })
    }
  }

  /**
   * Update webhook statistics
   * @param {string} webhookId - Webhook ID
   * @param {boolean} success - Whether delivery was successful
   */
  async updateWebhookStats(webhookId, success) {
    // Get current stats
    const { data: webhook, error: getError } = await supabaseService.getById('outgoing_webhooks', webhookId)
    
    if (getError || !webhook) {
      logger.error('Failed to get webhook for stats update', { webhookId })
      return
    }

    const updates = {
      last_delivery_at: new Date().toISOString()
    }

    if (success) {
      updates.success_count = (webhook.success_count || 0) + 1
    } else {
      updates.failure_count = (webhook.failure_count || 0) + 1
    }

    const { error } = await supabaseService.update('outgoing_webhooks', webhookId, updates)

    if (error) {
      logger.error('Failed to update webhook stats', { webhookId, error: error.message })
    }
  }

  /**
   * Get webhook statistics
   * @param {string} webhookId - Webhook ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Webhook stats
   * 
   * Requirements: 16.6
   */
  async getWebhookStats(webhookId, userId) {
    const webhook = await this.getWebhookById(webhookId, userId)
    if (!webhook) {
      throw new Error('Webhook not found or unauthorized')
    }

    // Get recent deliveries
    const { data: deliveries, error } = await supabaseService.queryAsAdmin('webhook_deliveries', (query) =>
      query
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(100)
    )

    if (error) {
      logger.error('Failed to get webhook deliveries', { webhookId, error: error.message })
      throw new Error(`Failed to get webhook stats: ${error.message}`)
    }

    const deliveryList = deliveries || []

    // Calculate stats
    const totalDeliveries = deliveryList.length
    const successfulDeliveries = deliveryList.filter(d => d.success).length
    const failedDeliveries = totalDeliveries - successfulDeliveries
    const avgDuration = deliveryList.length > 0
      ? deliveryList.reduce((sum, d) => sum + (d.duration_ms || 0), 0) / deliveryList.length
      : 0

    return {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
        lastDeliveryAt: webhook.lastDeliveryAt
      },
      stats: {
        totalSuccess: webhook.successCount || 0,
        totalFailure: webhook.failureCount || 0,
        recentDeliveries: totalDeliveries,
        recentSuccess: successfulDeliveries,
        recentFailure: failedDeliveries,
        avgDurationMs: Math.round(avgDuration)
      },
      recentDeliveries: deliveryList.slice(0, 10).map(d => ({
        id: d.delivery_id,
        eventType: d.event_type,
        success: toBoolean(d.success),
        attempts: d.attempts,
        responseStatus: d.response_status,
        error: d.error,
        durationMs: d.duration_ms,
        createdAt: d.created_at
      }))
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Get webhook by ID
   * @param {string} webhookId - Webhook ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Webhook or null
   */
  async getWebhookById(webhookId, userId) {
    const { data: webhooks, error } = await supabaseService.queryAsAdmin('outgoing_webhooks', (query) =>
      query.select('*').eq('id', webhookId).eq('user_id', userId)
    )

    if (error || !webhooks || webhooks.length === 0) {
      return null
    }

    return this.formatWebhook(webhooks[0])
  }

  /**
   * Get all webhooks for a user, optionally filtered by inbox
   * @param {string} userId - User ID
   * @param {string|null|undefined} inboxId - Inbox ID filter:
   *   - undefined: return all webhooks (no inbox filter)
   *   - null: return only legacy webhooks (inbox_id IS NULL)
   *   - string: return webhooks for specific inbox
   * @returns {Promise<Array>} Webhooks
   * 
   * Requirements: 3.2, 3.3, 3.4
   */
  async getWebhooks(userId, inboxId = undefined) {
    let query

    if (inboxId === undefined) {
      // No inbox filter - return all webhooks for user
      const { data: webhooks, error } = await supabaseService.queryAsAdmin('outgoing_webhooks', (q) =>
        q.select('*').eq('user_id', userId).order('created_at', { ascending: false })
      )

      if (error) {
        logger.error('Failed to get webhooks', { userId, error: error.message })
        return []
      }

      return (webhooks || []).map(w => this.formatWebhook(w))
    } else if (inboxId === null) {
      // Return only legacy webhooks (inbox_id IS NULL)
      const { data: webhooks, error } = await supabaseService.queryAsAdmin('outgoing_webhooks', (q) =>
        q.select('*').eq('user_id', userId).is('inbox_id', null).order('created_at', { ascending: false })
      )

      if (error) {
        logger.error('Failed to get legacy webhooks', { userId, error: error.message })
        return []
      }

      return (webhooks || []).map(w => this.formatWebhook(w))
    } else {
      // Return webhooks for specific inbox
      const { data: webhooks, error } = await supabaseService.queryAsAdmin('outgoing_webhooks', (q) =>
        q.select('*').eq('user_id', userId).eq('inbox_id', inboxId).order('created_at', { ascending: false })
      )

      if (error) {
        logger.error('Failed to get inbox webhooks', { userId, inboxId, error: error.message })
        return []
      }

      return (webhooks || []).map(w => this.formatWebhook(w))
    }
  }

  /**
   * Format webhook from database
   * @param {Object} webhook - Raw webhook from database
   * @returns {Object} Formatted webhook
   * 
   * Requirements: 4.6
   */
  formatWebhook(webhook) {
    return {
      id: webhook.id,
      userId: webhook.user_id,
      inboxId: webhook.inbox_id || null,
      url: webhook.url,
      events: this.parseEvents(webhook.events),
      secret: webhook.secret,
      isActive: toBoolean(webhook.is_active),
      successCount: webhook.success_count || 0,
      failureCount: webhook.failure_count || 0,
      lastDeliveryAt: webhook.last_delivery_at,
      createdAt: webhook.created_at
    }
  }

  /**
   * Parse events from database (handles both string and array)
   * @param {string|Array} events - Events from database
   * @returns {Array} Parsed events array
   */
  parseEvents(events) {
    if (Array.isArray(events)) {
      return events
    }
    try {
      return JSON.parse(events || '[]')
    } catch {
      return []
    }
  }

  /**
   * Generate webhook secret
   * @returns {string} Secret
   */
  generateSecret() {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`
  }

  /**
   * Generate HMAC signature for payload
   * @param {Object} payload - Payload to sign
   * @param {string} secret - Webhook secret
   * @returns {string} Signature
   */
  generateSignature(payload, secret) {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(JSON.stringify(payload))
    return `sha256=${hmac.digest('hex')}`
  }

  /**
   * Sleep helper
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

module.exports = OutgoingWebhookService
