/**
 * WebhookAccountRouter
 * 
 * Routes incoming webhooks to the appropriate account and notifies relevant agents.
 * 
 * Requirements: 10.2, 10.4, 3.1, 3.4, 3.5 (Tenant Webhook Configuration)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');
const TenantSettingsService = require('./TenantSettingsService');

// Cache for tenant WUZAPI configs (TTL: 5 minutes)
const configCache = new Map();
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

class WebhookAccountRouter {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Get account by WUZAPI user token with tenant context
   * Updated for multi-tenant architecture to include tenant information
   * 
   * @param {string} userToken - WUZAPI user token
   * @returns {Promise<Object|null>} Account with tenant context or null
   * Requirements: 12.3 - Route webhooks to correct account based on wuzapi_token mapping
   */
  async getAccountByToken(userToken) {
    try {
      const { data: accounts, error } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select(`
          id, name, owner_user_id, wuzapi_token, status, tenant_id,
          tenants!inner(id, subdomain, name, status)
        `)
        .eq('wuzapi_token', userToken)
        .eq('status', 'active')
        .eq('tenants.status', 'active')
        .limit(1)
      );
      
      if (error) throw error;
      
      if (accounts && accounts.length > 0) {
        const account = accounts[0];
        const tenant = account.tenants;
        return {
          id: account.id,
          name: account.name,
          owner_user_id: account.owner_user_id,
          wuzapi_token: account.wuzapi_token,
          status: account.status,
          tenant_id: account.tenant_id,
          tenant: {
            id: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.name,
            status: tenant.status
          }
        };
      }
      
      return null;
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
        const { data: members, error: membersError } = await SupabaseService.queryAsAdmin('inbox_members', (query) =>
          query.select('agent_id').eq('inbox_id', inboxId)
        );
        
        if (!membersError && members) {
          members.forEach(r => agentIds.add(r.agent_id));
        }
      }

      // If no specific inbox, notify all online agents in the account
      if (!inboxId && agentIds.size === 0) {
        const { data: agents, error: agentsError } = await SupabaseService.queryAsAdmin('agents', (query) =>
          query.select('id')
            .eq('account_id', accountId)
            .eq('status', 'active')
            .in('availability', ['online', 'busy'])
        );
        
        if (!agentsError && agents) {
          agents.forEach(r => agentIds.add(r.id));
        }
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
   * Validate tenant context for webhook routing
   * Ensures webhook is being processed in the correct tenant context
   * 
   * @param {Object} account - Account with tenant information
   * @param {string} [expectedTenantId] - Expected tenant ID (optional)
   * @returns {boolean} True if tenant context is valid
   */
  validateTenantContext(account, expectedTenantId = null) {
    if (!account || !account.tenant) {
      return false;
    }

    // If no expected tenant ID provided, just check that tenant is active
    if (!expectedTenantId) {
      return account.tenant.status === 'active';
    }

    // Validate that account belongs to expected tenant
    return account.tenant_id === expectedTenantId && account.tenant.status === 'active';
  }

  /**
   * Route webhook event to account with tenant context
   * Updated for multi-tenant architecture
   * 
   * @param {string} userToken - WUZAPI user token
   * @param {Object} event - Webhook event
   * @param {string} [expectedTenantId] - Expected tenant ID for validation (optional)
   * @returns {Promise<Object>} Routing result with tenant context
   * Requirements: 12.3 - Route webhooks to correct account based on wuzapi_token mapping
   */
  async routeWebhook(userToken, event, expectedTenantId = null) {
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

      // Validate tenant context
      if (!this.validateTenantContext(account, expectedTenantId)) {
        logger.warn('Invalid tenant context for webhook', {
          accountId: account.id,
          accountTenantId: account.tenant_id,
          expectedTenantId,
          tenantStatus: account.tenant?.status
        });
        return {
          routed: false,
          reason: 'invalid_tenant_context'
        };
      }

      // Extract conversation info if available
      let inboxId = null;
      let assignedAgentId = null;
      
      if (event.conversationId) {
        const { data: conv, error: convError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
          query.select('inbox_id, assigned_agent_id')
            .eq('id', event.conversationId)
            .single()
        );
        
        if (!convError && conv) {
          inboxId = conv.inbox_id;
          assignedAgentId = conv.assigned_agent_id;
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
        tenantId: account.tenant_id,
        tenantSubdomain: account.tenant?.subdomain,
        eventType: event.type,
        agentsToNotify: agentsToNotify.length
      });

      return {
        routed: true,
        account: {
          id: account.id,
          name: account.name,
          tenant_id: account.tenant_id
        },
        tenant: account.tenant,
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
   * Log webhook event for audit with tenant context
   * Updated for multi-tenant architecture
   * 
   * @param {string} accountId - Account ID
   * @param {Object} event - Webhook event
   * @param {Object} routingResult - Routing result with tenant context
   */
  async logWebhookEvent(accountId, event, routingResult) {
    try {
      const id = `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await SupabaseService.insert('audit_log', {
        id,
        account_id: accountId,
        action: 'webhook_received',
        resource_type: 'webhook',
        resource_id: event.type,
        details: {
          eventType: event.type,
          routed: routingResult.routed,
          agentsNotified: routingResult.agentsToNotify?.length || 0,
          tenantId: routingResult.tenant?.id,
          tenantSubdomain: routingResult.tenant?.subdomain
        },
        created_at: new Date().toISOString()
      });
    } catch (error) {
      // Don't throw - logging failure shouldn't break webhook processing
      logger.error('Failed to log webhook event', { error: error.message });
    }
  }

  /**
   * Get tenant's WUZAPI configuration with caching
   * Delegates to TenantSettingsService with cache layer
   * 
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} WUZAPI configuration
   * Requirements: 3.1
   */
  async getTenantWuzapiConfig(tenantId) {
    try {
      if (!tenantId) {
        return null;
      }

      // Check cache first
      const cacheKey = `wuzapi-config-${tenantId}`;
      const cached = configCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < CONFIG_CACHE_TTL) {
        return cached.config;
      }

      // Get from TenantSettingsService
      const config = await TenantSettingsService.getWuzapiConfig(tenantId);
      
      // Cache the result
      configCache.set(cacheKey, {
        config,
        timestamp: Date.now()
      });

      return config;
    } catch (error) {
      logger.error('Failed to get tenant WUZAPI config', {
        error: error.message,
        tenantId
      });
      return null;
    }
  }

  /**
   * Clear cached config for a tenant
   * Call this when tenant settings are updated
   * 
   * @param {string} tenantId - Tenant UUID
   */
  clearConfigCache(tenantId) {
    if (tenantId) {
      configCache.delete(`wuzapi-config-${tenantId}`);
    }
  }

  /**
   * Log webhook routing decision for audit
   * 
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID (optional)
   * @param {Object} event - Webhook event
   * @param {Object} result - Routing result
   * Requirements: 3.5
   */
  async logRoutingDecision(tenantId, inboxId, event, result) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        tenantId,
        inboxId: inboxId || null,
        eventType: event?.type || 'unknown',
        routed: result.routed,
        reason: result.reason || null,
        accountId: result.account?.id || null,
        agentsNotified: result.agentsToNotify?.length || 0
      };

      logger.info('Webhook routing decision', logEntry);

      // Also log to audit_log table if we have an account
      if (result.account?.id) {
        const id = `whr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        await SupabaseService.insert('audit_log', {
          id,
          account_id: result.account.id,
          action: 'webhook_routing_decision',
          resource_type: 'webhook',
          resource_id: event?.type || 'unknown',
          details: logEntry,
          created_at: logEntry.timestamp
        }).catch(err => {
          // Don't fail on audit log errors
          logger.debug('Could not write routing decision to audit_log', { error: err.message });
        });
      }
    } catch (error) {
      // Don't throw - logging failure shouldn't break webhook processing
      logger.error('Failed to log routing decision', { error: error.message });
    }
  }

  /**
   * Get inbox by WUZAPI token with tenant context
   * 
   * @param {string} wuzapiToken - WUZAPI user token
   * @returns {Promise<Object|null>} Inbox with tenant context or null
   */
  async getInboxByToken(wuzapiToken) {
    try {
      const { data: inboxes, error } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.select(`
          id, name, phone_number, wuzapi_token, webhook_config, account_id,
          accounts!inner(id, name, tenant_id, status,
            tenants!inner(id, subdomain, name, status)
          )
        `)
        .eq('wuzapi_token', wuzapiToken)
        .limit(1)
      );

      if (error) throw error;

      if (inboxes && inboxes.length > 0) {
        const inbox = inboxes[0];
        const account = inbox.accounts;
        const tenant = account.tenants;

        return {
          id: inbox.id,
          name: inbox.name,
          phoneNumber: inbox.phone_number,
          wuzapiToken: inbox.wuzapi_token,
          webhookConfig: inbox.webhook_config,
          account: {
            id: account.id,
            name: account.name,
            tenantId: account.tenant_id,
            status: account.status
          },
          tenant: {
            id: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.name,
            status: tenant.status
          }
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get inbox by token', { error: error.message });
      return null;
    }
  }

  /**
   * Enhanced route webhook with full tenant context and config lookup
   * 
   * @param {string} userToken - WUZAPI user token
   * @param {Object} event - Webhook event
   * @param {string} [expectedTenantId] - Expected tenant ID for validation (optional)
   * @returns {Promise<Object>} Routing result with tenant context and config
   * Requirements: 3.1, 3.4
   */
  async routeWebhookWithConfig(userToken, event, expectedTenantId = null) {
    const startTime = Date.now();
    
    try {
      // First try to get inbox by token (more specific)
      const inbox = await this.getInboxByToken(userToken);
      
      if (inbox) {
        // Validate tenant is active
        if (inbox.tenant.status !== 'active') {
          const result = {
            routed: false,
            reason: 'tenant_inactive'
          };
          await this.logRoutingDecision(inbox.tenant.id, inbox.id, event, result);
          return result;
        }

        // Validate expected tenant if provided
        if (expectedTenantId && inbox.tenant.id !== expectedTenantId) {
          const result = {
            routed: false,
            reason: 'invalid_tenant_context'
          };
          await this.logRoutingDecision(inbox.tenant.id, inbox.id, event, result);
          return result;
        }

        // Get tenant's WUZAPI config
        const wuzapiConfig = await this.getTenantWuzapiConfig(inbox.tenant.id);

        // Get agents to notify
        const agentsToNotify = await this.getAgentsToNotify(
          inbox.account.id,
          inbox.id,
          null
        );

        const result = {
          routed: true,
          inbox: {
            id: inbox.id,
            name: inbox.name,
            phoneNumber: inbox.phoneNumber
          },
          account: {
            id: inbox.account.id,
            name: inbox.account.name,
            tenant_id: inbox.tenant.id
          },
          tenant: inbox.tenant,
          wuzapiConfig,
          agentsToNotify,
          processingTime: Date.now() - startTime
        };

        await this.logRoutingDecision(inbox.tenant.id, inbox.id, event, result);
        return result;
      }

      // Fallback to account-based routing
      const routingResult = await this.routeWebhook(userToken, event, expectedTenantId);
      
      if (routingResult.routed && routingResult.tenant) {
        // Get tenant's WUZAPI config
        routingResult.wuzapiConfig = await this.getTenantWuzapiConfig(routingResult.tenant.id);
        routingResult.processingTime = Date.now() - startTime;
        
        await this.logRoutingDecision(
          routingResult.tenant.id,
          routingResult.inboxId,
          event,
          routingResult
        );
      }

      return routingResult;
    } catch (error) {
      logger.error('Failed to route webhook with config', {
        error: error.message,
        tokenPrefix: userToken?.substring(0, 8)
      });
      
      return {
        routed: false,
        reason: 'error',
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
}

module.exports = WebhookAccountRouter;
