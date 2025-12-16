/**
 * OutgoingWebhookService - Service for managing outgoing webhooks
 * 
 * Handles webhook configuration, delivery, and retry logic
 * 
 * Requirements: 16.1-16.6
 */

const crypto = require('crypto')
const axios = require('axios')
const { logger } = require('../utils/logger')
const { toBoolean } = require('../utils/responseTransformer')

class OutgoingWebhookService {
  constructor(db) {
    this.db = db
    this.MAX_RETRIES = 3
    this.RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff
  }

  /**
   * Configure a new webhook
   * @param {number} userId - User ID
   * @param {Object} data - Webhook configuration
   * @returns {Promise<Object>} Created webhook
   * 
   * Requirements: 16.1, 16.2
   */
  async configureWebhook(userId, data) {
    const { url, events = [], secret = null } = data

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

    // Generate secret if not provided
    const webhookSecret = secret || this.generateSecret()

    const sql = `
      INSERT INTO outgoing_webhooks (
        user_id, url, events, secret, is_active, 
        success_count, failure_count, created_at
      ) VALUES (?, ?, ?, ?, 1, 0, 0, datetime('now'))
    `

    const { lastID } = await this.db.query(sql, [
      userId,
      url,
      JSON.stringify(events),
      webhookSecret
    ])

    const webhook = await this.getWebhookById(lastID, userId)

    logger.info('Webhook configured', { webhookId: lastID, userId, events })

    return webhook
  }

  /**
   * Update a webhook
   * @param {number} webhookId - Webhook ID
   * @param {number} userId - User ID
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

    const updates = []
    const params = []

    if (url !== undefined) {
      updates.push('url = ?')
      params.push(url)
    }
    if (events !== undefined) {
      updates.push('events = ?')
      params.push(JSON.stringify(events))
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?')
      params.push(isActive ? 1 : 0)
    }

    if (updates.length === 0) {
      return webhook
    }

    params.push(webhookId, userId)

    const sql = `
      UPDATE outgoing_webhooks SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `

    await this.db.query(sql, params)

    logger.info('Webhook updated', { webhookId, userId })

    return this.getWebhookById(webhookId, userId)
  }

  /**
   * Delete a webhook
   * @param {number} webhookId - Webhook ID
   * @param {number} userId - User ID
   */
  async deleteWebhook(webhookId, userId) {
    const webhook = await this.getWebhookById(webhookId, userId)
    if (!webhook) {
      throw new Error('Webhook not found or unauthorized')
    }

    // Delete delivery logs first
    await this.db.query(
      'DELETE FROM webhook_deliveries WHERE webhook_id = ?',
      [webhookId]
    )

    // Delete webhook
    await this.db.query(
      'DELETE FROM outgoing_webhooks WHERE id = ? AND user_id = ?',
      [webhookId, userId]
    )

    logger.info('Webhook deleted', { webhookId, userId })
  }

  /**
   * Send webhook event to all configured webhooks
   * @param {number} userId - User ID
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<Array>} Delivery results
   * 
   * Requirements: 16.3, 16.4
   */
  async sendWebhookEvent(userId, eventType, payload) {
    // Get all active webhooks for this user that subscribe to this event
    const sql = `
      SELECT * FROM outgoing_webhooks 
      WHERE user_id = ? AND is_active = 1
    `
    const { rows: webhooks } = await this.db.query(sql, [userId])

    logger.info('Checking outgoing webhooks', {
      userId: userId?.substring(0, 10),
      eventType,
      webhooksFound: webhooks.length
    })

    const results = []

    for (const webhook of webhooks) {
      const events = JSON.parse(webhook.events || '[]')
      
      logger.debug('Webhook event check', {
        webhookId: webhook.id,
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
   * @param {number} webhookId - Webhook ID
   * @param {Object} data - Delivery data
   */
  async logDelivery(webhookId, data) {
    const sql = `
      INSERT INTO webhook_deliveries (
        webhook_id, delivery_id, event_type, payload, status, success, attempts,
        response_status, response_body, error, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `

    await this.db.query(sql, [
      webhookId,
      data.deliveryId,
      data.eventType,
      JSON.stringify(data.payload || {}),
      data.success ? 'success' : 'failed',
      data.success ? 1 : 0,
      data.attempts,
      data.responseStatus,
      data.responseBody,
      data.error,
      data.duration
    ])
  }

  /**
   * Update webhook statistics
   * @param {number} webhookId - Webhook ID
   * @param {boolean} success - Whether delivery was successful
   */
  async updateWebhookStats(webhookId, success) {
    const field = success ? 'success_count' : 'failure_count'
    const sql = `
      UPDATE outgoing_webhooks 
      SET ${field} = ${field} + 1, last_delivery_at = datetime('now')
      WHERE id = ?
    `
    await this.db.query(sql, [webhookId])
  }

  /**
   * Get webhook statistics
   * @param {number} webhookId - Webhook ID
   * @param {number} userId - User ID
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
    const deliveriesSql = `
      SELECT * FROM webhook_deliveries 
      WHERE webhook_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `
    const { rows: deliveries } = await this.db.query(deliveriesSql, [webhookId])

    // Calculate stats
    const totalDeliveries = deliveries.length
    const successfulDeliveries = deliveries.filter(d => d.success).length
    const failedDeliveries = totalDeliveries - successfulDeliveries
    const avgDuration = deliveries.length > 0
      ? deliveries.reduce((sum, d) => sum + (d.duration_ms || 0), 0) / deliveries.length
      : 0

    return {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: JSON.parse(webhook.events || '[]'),
        isActive: toBoolean(webhook.is_active),
        createdAt: webhook.created_at,
        lastDeliveryAt: webhook.last_delivery_at
      },
      stats: {
        totalSuccess: webhook.success_count,
        totalFailure: webhook.failure_count,
        recentDeliveries: totalDeliveries,
        recentSuccess: successfulDeliveries,
        recentFailure: failedDeliveries,
        avgDurationMs: Math.round(avgDuration)
      },
      // Requirements: 4.1 (websocket-data-transformation-fix) - use toBoolean for consistent boolean conversion
      recentDeliveries: deliveries.slice(0, 10).map(d => ({
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
   * @param {number} webhookId - Webhook ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Webhook or null
   */
  async getWebhookById(webhookId, userId) {
    const sql = 'SELECT * FROM outgoing_webhooks WHERE id = ? AND user_id = ?'
    const { rows } = await this.db.query(sql, [webhookId, userId])
    return rows[0] || null
  }

  /**
   * Get all webhooks for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Webhooks
   */
  async getWebhooks(userId) {
    const sql = `
      SELECT * FROM outgoing_webhooks 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `
    const { rows } = await this.db.query(sql, [userId])
    return rows.map(w => ({
      ...w,
      events: JSON.parse(w.events || '[]'),
      isActive: toBoolean(w.is_active)
    }))
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
