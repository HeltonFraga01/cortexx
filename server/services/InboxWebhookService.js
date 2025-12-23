/**
 * InboxWebhookService - Service for managing webhooks per inbox
 * 
 * This service handles webhook configuration for individual inboxes,
 * using the tenant's WUZAPI credentials for API calls.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.5
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');
const TenantSettingsService = require('./TenantSettingsService');

// Default webhook events for chat inbox
const DEFAULT_WEBHOOK_EVENTS = [
  'Message',
  'ReadReceipt', 
  'ChatPresence',
  'MessageStatus'
];

class InboxWebhookService {

  /**
   * Generate webhook URL for an inbox
   * Uses tenant's subdomain to create unique webhook URL per tenant
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID (optional, for unique URL)
   * @param {string} [baseUrl] - Optional base URL override
   * @returns {Promise<string>} Webhook URL
   * Requirements: 2.1, 5.2
   */
  async generateWebhookUrl(tenantId, inboxId = null, baseUrl = null) {
    try {
      // Get tenant's webhook base URL from settings
      const wuzapiConfig = await TenantSettingsService.getWuzapiConfig(tenantId);
      
      let webhookBase = baseUrl || wuzapiConfig.webhookBaseUrl;
      
      // If no base URL configured, construct from tenant subdomain
      if (!webhookBase) {
        const { data: tenant, error } = await SupabaseService.adminClient
          .from('tenants')
          .select('subdomain')
          .eq('id', tenantId)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        // First check for explicit WEBHOOK_BASE_URL env var
        if (process.env.WEBHOOK_BASE_URL) {
          webhookBase = process.env.WEBHOOK_BASE_URL;
        } else if (tenant?.subdomain) {
          // Construct URL from tenant subdomain
          // Format: {subdomain}.{main_domain}
          const mainDomain = process.env.MAIN_DOMAIN || 'localhost:8080';
          const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
          
          // Build tenant-specific URL with subdomain
          webhookBase = `${protocol}://${tenant.subdomain}.${mainDomain}`;
          
          logger.debug('Webhook URL constructed from tenant subdomain', {
            tenantId,
            subdomain: tenant.subdomain,
            mainDomain,
            webhookBase
          });
        }
      }
      
      if (!webhookBase) {
        logger.warn('No webhook base URL configured and no tenant subdomain found', { tenantId });
        return null;
      }
      
      // Ensure no trailing slash
      webhookBase = webhookBase.replace(/\/$/, '');
      
      // Generate webhook URL
      const webhookUrl = `${webhookBase}/api/webhook/events`;
      
      logger.debug('Webhook URL generated', {
        tenantId,
        inboxId,
        webhookUrl
      });
      
      return webhookUrl;
    } catch (error) {
      logger.error('Failed to generate webhook URL', {
        error: error.message,
        tenantId,
        inboxId
      });
      throw error;
    }
  }

  /**
   * Configure webhook for an inbox using tenant's WUZAPI credentials
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID
   * @param {string[]} [events] - Events to subscribe (defaults to DEFAULT_WEBHOOK_EVENTS)
   * @param {string} [customWebhookUrl] - Optional custom webhook URL
   * @returns {Promise<Object>} Configuration result { success, webhookUrl, events, error }
   * Requirements: 2.2, 2.5
   */
  async configureWebhook(tenantId, inboxId, events = null, customWebhookUrl = null) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }
      
      if (!inboxId) {
        throw new Error('Inbox ID is required');
      }

      // Get inbox
      const { data: inbox, error: inboxError } = await SupabaseService.adminClient
        .from('inboxes')
        .select('id, name, wuzapi_token, account_id')
        .eq('id', inboxId)
        .single();

      if (inboxError || !inbox) {
        throw new Error('Inbox not found');
      }

      // Get account to verify tenant ownership
      const { data: account, error: accountError } = await SupabaseService.adminClient
        .from('accounts')
        .select('id, tenant_id')
        .eq('id', inbox.account_id)
        .single();

      if (accountError || !account) {
        throw new Error('Account not found for inbox');
      }

      // Verify inbox belongs to tenant
      if (account.tenant_id !== tenantId) {
        throw new Error('Inbox does not belong to this tenant');
      }

      if (!inbox.wuzapi_token) {
        throw new Error('Inbox does not have a WUZAPI token configured');
      }

      // Get tenant's WUZAPI configuration
      const wuzapiConfig = await TenantSettingsService.getWuzapiConfig(tenantId);
      
      if (!wuzapiConfig.isConfigured) {
        throw new Error('WUZAPI not configured for this tenant. Please configure API settings first.');
      }

      // Generate webhook URL
      const webhookUrl = customWebhookUrl || await this.generateWebhookUrl(tenantId, inboxId);
      
      if (!webhookUrl) {
        throw new Error('Could not generate webhook URL. Please configure webhook base URL.');
      }

      const webhookEvents = events || DEFAULT_WEBHOOK_EVENTS;

      // Call WUZAPI to configure webhook
      const response = await fetch(`${wuzapiConfig.baseUrl}/user/webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${inbox.wuzapi_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookURL: webhookUrl,
          subscribe: webhookEvents
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`WUZAPI error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const now = new Date().toISOString();

      // Update inbox with webhook configuration
      const webhookConfig = {
        url: webhookUrl,
        events: webhookEvents,
        configured_at: now,
        status: 'active'
      };

      await this.updateInboxWebhookConfig(inboxId, webhookConfig);

      logger.info('Webhook configured for inbox', {
        tenantId,
        inboxId,
        webhookUrl,
        eventsCount: webhookEvents.length
      });

      return {
        success: true,
        webhookUrl,
        events: webhookEvents,
        configuredAt: now
      };
    } catch (error) {
      logger.error('Failed to configure webhook', {
        error: error.message,
        tenantId,
        inboxId
      });

      // Update inbox with error status
      try {
        await this.updateInboxWebhookConfig(inboxId, {
          status: 'error',
          last_error: error.message,
          error_at: new Date().toISOString()
        });
      } catch (updateError) {
        logger.error('Failed to update inbox webhook error status', {
          error: updateError.message
        });
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current webhook status for an inbox
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID
   * @returns {Promise<Object>} Webhook status { isConfigured, url, events, status, lastError }
   * Requirements: 5.1
   */
  async getWebhookStatus(tenantId, inboxId) {
    try {
      if (!tenantId || !inboxId) {
        throw new Error('Tenant ID and Inbox ID are required');
      }

      // Get inbox with webhook config
      const { data: inbox, error } = await SupabaseService.adminClient
        .from('inboxes')
        .select('id, name, wuzapi_token, webhook_config, account_id')
        .eq('id', inboxId)
        .single();

      if (error) {
        logger.error('Supabase error fetching inbox', {
          inboxId,
          tenantId,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details
        });
        throw new Error(`Inbox query failed: ${error.message}`);
      }
      
      if (!inbox) {
        logger.error('Inbox not found (null result)', {
          inboxId,
          tenantId
        });
        throw new Error('Inbox not found');
      }

      // Get account to verify tenant ownership
      const { data: account, error: accountError } = await SupabaseService.adminClient
        .from('accounts')
        .select('id, tenant_id')
        .eq('id', inbox.account_id)
        .single();

      if (accountError || !account) {
        logger.error('Account not found for inbox', {
          inboxId,
          accountId: inbox.account_id,
          error: accountError?.message
        });
        throw new Error('Account not found for inbox');
      }

      // Verify inbox belongs to tenant
      if (account.tenant_id !== tenantId) {
        logger.warn('Inbox does not belong to tenant', {
          inboxId,
          inboxTenantId: account.tenant_id,
          requestedTenantId: tenantId
        });
        throw new Error('Inbox does not belong to this tenant');
      }

      const webhookConfig = inbox.webhook_config || {};
      
      // Also try to get current status from WUZAPI if token exists
      let wuzapiStatus = null;
      if (inbox.wuzapi_token) {
        try {
          const wuzapiConfig = await TenantSettingsService.getWuzapiConfig(tenantId);
          if (wuzapiConfig.isConfigured) {
            const response = await fetch(`${wuzapiConfig.baseUrl}/user/webhook`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${inbox.wuzapi_token}`,
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              wuzapiStatus = await response.json();
            }
          }
        } catch (wuzapiError) {
          logger.debug('Could not fetch WUZAPI webhook status', {
            error: wuzapiError.message
          });
        }
      }

      return {
        isConfigured: !!(webhookConfig.url && webhookConfig.status === 'active'),
        url: webhookConfig.url || null,
        events: webhookConfig.events || [],
        status: webhookConfig.status || 'not_configured',
        configuredAt: webhookConfig.configured_at || null,
        lastError: webhookConfig.last_error || null,
        errorAt: webhookConfig.error_at || null,
        wuzapiStatus: wuzapiStatus ? {
          webhook: wuzapiStatus.webhookURL || wuzapiStatus.webhook,
          events: wuzapiStatus.subscribe || wuzapiStatus.events || []
        } : null
      };
    } catch (error) {
      logger.error('Failed to get webhook status', {
        error: error.message,
        tenantId,
        inboxId
      });
      throw error;
    }
  }

  /**
   * Update inbox with webhook configuration
   * @param {string} inboxId - Inbox UUID
   * @param {Object} config - Webhook configuration to merge
   * @returns {Promise<void>}
   * Requirements: 2.3
   */
  async updateInboxWebhookConfig(inboxId, config) {
    try {
      // Get current config
      const { data: inbox, error: fetchError } = await SupabaseService.adminClient
        .from('inboxes')
        .select('webhook_config')
        .eq('id', inboxId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const currentConfig = inbox?.webhook_config || {};
      const updatedConfig = { ...currentConfig, ...config };

      const { error: updateError } = await SupabaseService.adminClient
        .from('inboxes')
        .update({
          webhook_config: updatedConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', inboxId);

      if (updateError) {
        throw updateError;
      }

      logger.debug('Inbox webhook config updated', {
        inboxId,
        status: updatedConfig.status
      });
    } catch (error) {
      logger.error('Failed to update inbox webhook config', {
        error: error.message,
        inboxId
      });
      throw error;
    }
  }

  /**
   * Get all inboxes with webhook status for a tenant
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Array>} List of inboxes with webhook status
   */
  async listInboxesWithWebhookStatus(tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { data: inboxes, error } = await SupabaseService.adminClient
        .from('inboxes')
        .select(`
          id, name, phone_number, wuzapi_token, webhook_config, wuzapi_connected,
          accounts!inner(id, name, tenant_id)
        `)
        .eq('accounts.tenant_id', tenantId);

      if (error) {
        throw error;
      }

      return (inboxes || []).map(inbox => ({
        id: inbox.id,
        name: inbox.name,
        phoneNumber: inbox.phone_number,
        hasWuzapiToken: !!inbox.wuzapi_token,
        isConnected: inbox.wuzapi_connected,
        webhookStatus: {
          isConfigured: !!(inbox.webhook_config?.url && inbox.webhook_config?.status === 'active'),
          url: inbox.webhook_config?.url || null,
          status: inbox.webhook_config?.status || 'not_configured',
          events: inbox.webhook_config?.events || []
        },
        accountId: inbox.accounts.id,
        accountName: inbox.accounts.name
      }));
    } catch (error) {
      logger.error('Failed to list inboxes with webhook status', {
        error: error.message,
        tenantId
      });
      throw error;
    }
  }

  /**
   * Clear webhook configuration for an inbox
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID
   * @returns {Promise<Object>} Result { success, error }
   */
  async clearWebhook(tenantId, inboxId) {
    try {
      if (!tenantId || !inboxId) {
        throw new Error('Tenant ID and Inbox ID are required');
      }

      // Verify inbox belongs to tenant
      const { data: inbox, error: inboxError } = await SupabaseService.adminClient
        .from('inboxes')
        .select(`
          id, wuzapi_token,
          accounts!inner(tenant_id)
        `)
        .eq('id', inboxId)
        .single();

      if (inboxError || !inbox) {
        throw new Error('Inbox not found');
      }

      if (inbox.accounts.tenant_id !== tenantId) {
        throw new Error('Inbox does not belong to this tenant');
      }

      // Clear webhook in WUZAPI if token exists
      if (inbox.wuzapi_token) {
        try {
          const wuzapiConfig = await TenantSettingsService.getWuzapiConfig(tenantId);
          if (wuzapiConfig.isConfigured) {
            await fetch(`${wuzapiConfig.baseUrl}/user/webhook`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${inbox.wuzapi_token}`,
                'Content-Type': 'application/json'
              }
            });
          }
        } catch (wuzapiError) {
          logger.warn('Could not clear WUZAPI webhook', {
            error: wuzapiError.message
          });
        }
      }

      // Clear webhook config in database
      await this.updateInboxWebhookConfig(inboxId, {
        url: null,
        events: [],
        status: 'not_configured',
        configured_at: null
      });

      logger.info('Webhook cleared for inbox', {
        tenantId,
        inboxId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to clear webhook', {
        error: error.message,
        tenantId,
        inboxId
      });
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new InboxWebhookService();
