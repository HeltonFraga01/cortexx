/**
 * WebhookAccountRouter
 * 
 * Routes incoming webhooks to the appropriate account and notifies relevant agents.
 * 
 * Requirements: 10.2, 10.4
 */

const { logger } = require('../utils/logger');

class WebhookAccountRouter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get account by WUZAPI user token
   * 
   * @param {string} userToken - WUZAPI user token
   * @returns {Promise<Object|null>} Account or null
   */
  async getAccountByToken(userToken) {
    try {
      const sql = `
        SELECT id, name, owner_user_id, wuzapi_token, status
        FROM accounts
        WHERE wuzapi_token = ? AND status = 'active'
      `;
      
      const { rows } = await this.db.query(sql, [userToken]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Failed to get account by token', { error: error.message });
      return null;
    }
  }

  /**
   * Get agents to notify for a webhook event
   * 
   * @param {string} accountId - Account ID
   * @param {string} inboxId - Inbox ID (optional)
   * @param {string} assignedAgentId - Assigned agent ID (optional)
   * @returns {Promise<Array>} List of agent IDs to notify
   */
  async getAgentsToNotify(accountId, inboxId = null, assignedAgentId = null) {
    try {
      const agentIds = new Set();

      // If there's an assigned agent, always notify them
      if (assignedAgentId) {
        agentIds.add(assignedAgentId);
      }

      // If there's an inbox, notify all inbox members
      if (inboxId) {
        const sql = `
          SELECT agent_id
          FROM inbox_members
          WHERE inbox_id = ?
        `;
        const { rows } = await this.db.query(sql, [inboxId]);
        rows.forEach(r => agentIds.add(r.agent_id));
      }

      // If no specific inbox, notify all online agents in the account
      if (!inboxId && agentIds.size === 0) {
        const sql = `
          SELECT id
          FROM agents
          WHERE account_id = ? 
            AND status = 'active'
            AND availability IN ('online', 'busy')
        `;
        const { rows } = await this.db.query(sql, [accountId]);
        rows.forEach(r => agentIds.add(r.id));
      }

      return Array.from(agentIds);
    } catch (error) {
      logger.error('Failed to get agents to notify', { 
        accountId, 
        inboxId, 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Route webhook event to account
   * 
   * @param {string} userToken - WUZAPI user token
   * @param {Object} event - Webhook event
   * @returns {Promise<Object>} Routing result
   */
  async routeWebhook(userToken, event) {
    try {
      // Get account by token
      const account = await this.getAccountByToken(userToken);
      
      if (!account) {
        logger.warn('No account found for webhook token', { 
          tokenPrefix: userToken?.substring(0, 8) 
        });
        return { 
          routed: false, 
          reason: 'account_not_found' 
        };
      }

      // Extract conversation info if available
      let inboxId = null;
      let assignedAgentId = null;
      
      if (event.conversationId) {
        const convSql = `
          SELECT inbox_id, assigned_agent_id
          FROM conversations
          WHERE id = ?
        `;
        const { rows } = await this.db.query(convSql, [event.conversationId]);
        if (rows[0]) {
          inboxId = rows[0].inbox_id;
          assignedAgentId = rows[0].assigned_agent_id;
        }
      }

      // Get agents to notify
      const agentsToNotify = await this.getAgentsToNotify(
        account.id, 
        inboxId, 
        assignedAgentId
      );

      logger.info('Webhook routed to account', {
        accountId: account.id,
        accountName: account.name,
        eventType: event.type,
        agentsToNotify: agentsToNotify.length
      });

      return {
        routed: true,
        account: {
          id: account.id,
          name: account.name
        },
        inboxId,
        assignedAgentId,
        agentsToNotify
      };
    } catch (error) {
      logger.error('Failed to route webhook', { 
        error: error.message,
        tokenPrefix: userToken?.substring(0, 8)
      });
      return { 
        routed: false, 
        reason: 'error',
        error: error.message 
      };
    }
  }

  /**
   * Log webhook event for audit
   * 
   * @param {string} accountId - Account ID
   * @param {Object} event - Webhook event
   * @param {Object} routingResult - Routing result
   */
  async logWebhookEvent(accountId, event, routingResult) {
    try {
      const sql = `
        INSERT INTO audit_log (
          id, account_id, action, resource_type, resource_id, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      const id = `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.db.query(sql, [
        id,
        accountId,
        'webhook_received',
        'webhook',
        event.type,
        JSON.stringify({
          eventType: event.type,
          routed: routingResult.routed,
          agentsNotified: routingResult.agentsToNotify?.length || 0
        })
      ]);
    } catch (error) {
      // Don't throw - logging failure shouldn't break webhook processing
      logger.error('Failed to log webhook event', { error: error.message });
    }
  }
}

module.exports = WebhookAccountRouter;
