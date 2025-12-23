/**
 * SubscriptionEnsurer - Service for ensuring users have subscriptions
 * 
 * Handles automatic assignment of default plan to users without subscriptions
 * and migration of existing users.
 * 
 * UPDATED: Now uses tenant_plans instead of global plans table
 * Migrated to use SupabaseService directly (Task 14.1)
 * 
 * Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4
 */

const { logger } = require('../utils/logger');
const SubscriptionService = require('./SubscriptionService');
const SupabaseService = require('./SupabaseService');

class SubscriptionEnsurer {
  // eslint-disable-next-line no-unused-vars
  constructor(db) {
    // db parameter kept for backward compatibility but not used
    // All operations use SupabaseService directly
    this.subscriptionService = new SubscriptionService();
  }

  /**
   * Get the default plan for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} Default plan or null
   */
  async getDefaultPlanForTenant(tenantId) {
    try {
      const { data: plans, error } = await SupabaseService.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .eq('status', 'active')
        .limit(1);

      if (error) {
        logger.error('Failed to get default plan for tenant', { tenantId, error: error.message });
        return null;
      }

      if (!plans || plans.length === 0) {
        logger.warn('No default plan found for tenant', { tenantId });
        return null;
      }

      return plans[0];
    } catch (error) {
      logger.error('Error getting default plan for tenant', { tenantId, error: error.message });
      return null;
    }
  }

  /**
   * Get account by userId
   * @param {string} userId - User ID (UUID or hash)
   * @returns {Promise<Object|null>} Account or null
   */
  async getAccountByUserId(userId) {
    try {
      // Normalize userId to UUID format
      const { normalizeToUUID } = require('../utils/userIdHelper');
      const uuidUserId = normalizeToUUID(userId);
      
      if (!uuidUserId) {
        return null;
      }

      const { data: accounts, error } = await SupabaseService.adminClient
        .from('accounts')
        .select('*')
        .eq('owner_user_id', uuidUserId)
        .limit(1);

      if (error || !accounts || accounts.length === 0) {
        // Try by wuzapi_token as fallback
        const { data: accountsByToken } = await SupabaseService.adminClient
          .from('accounts')
          .select('*')
          .eq('wuzapi_token', userId)
          .limit(1);
        
        if (accountsByToken && accountsByToken.length > 0) {
          return accountsByToken[0];
        }
        return null;
      }

      return accounts[0];
    } catch (error) {
      logger.error('Error getting account by userId', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Ensures a user has an active subscription
   * If no subscription exists, assigns the default plan from the user's tenant
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} The user's subscription or null if no default plan
   */
  async ensureSubscription(userId) {
    try {
      // Check if user already has a subscription
      const existing = await this.subscriptionService.getUserSubscription(userId);
      if (existing) {
        logger.debug('User already has subscription', { userId, planId: existing.planId });
        return existing;
      }

      // Get user's account to find tenant_id
      const account = await this.getAccountByUserId(userId);
      if (!account) {
        logger.warn('No account found for user, cannot assign subscription', { userId });
        return null;
      }

      if (!account.tenant_id) {
        logger.warn('Account has no tenant_id, cannot assign subscription', { userId, accountId: account.id });
        return null;
      }

      // Get default plan from tenant_plans
      const defaultPlan = await this.getDefaultPlanForTenant(account.tenant_id);
      if (!defaultPlan) {
        logger.warn('No default plan found for tenant, cannot assign subscription', { 
          userId, 
          accountId: account.id,
          tenantId: account.tenant_id 
        });
        return null;
      }

      // Assign default plan to user
      logger.info('Assigning default tenant plan to user', { 
        userId, 
        accountId: account.id,
        tenantId: account.tenant_id,
        planId: defaultPlan.id, 
        planName: defaultPlan.name 
      });
      
      const subscription = await this.subscriptionService.assignPlan(userId, defaultPlan.id, 'system');
      
      return subscription;
    } catch (error) {
      logger.error('Failed to ensure subscription', { error: error.message, userId });
      // Don't throw - we don't want to block the user from using the system
      return null;
    }
  }

  /**
   * Migrates all users without subscriptions to the default plan of their tenant
   * Users are identified by owner_user_id in the accounts table
   * 
   * @returns {Promise<{migrated: number, failed: number, skipped: number}>}
   */
  async migrateUsersWithoutSubscription() {
    const stats = { migrated: 0, failed: 0, skipped: 0 };
    
    try {
      // Find all accounts without subscriptions, grouped by tenant
      const { data: accountsWithoutSub, error } = await SupabaseService.adminClient
        .from('accounts')
        .select(`
          id,
          owner_user_id,
          tenant_id,
          name
        `)
        .not('tenant_id', 'is', null);

      if (error) {
        logger.error('Failed to query accounts', { error: error.message });
        return stats;
      }

      // Filter to only accounts without subscriptions
      const accountsToMigrate = [];
      for (const account of (accountsWithoutSub || [])) {
        const { data: subs } = await SupabaseService.adminClient
          .from('user_subscriptions')
          .select('id')
          .eq('account_id', account.id)
          .limit(1);
        
        if (!subs || subs.length === 0) {
          accountsToMigrate.push(account);
        }
      }

      if (accountsToMigrate.length === 0) {
        logger.info('No accounts without subscriptions found');
        return stats;
      }

      logger.info('Starting migration of accounts without subscriptions', { 
        accountCount: accountsToMigrate.length 
      });

      // Cache default plans by tenant
      const defaultPlansByTenant = {};

      // Migrate each account
      for (const account of accountsToMigrate) {
        try {
          // Get or cache default plan for tenant
          if (!defaultPlansByTenant[account.tenant_id]) {
            defaultPlansByTenant[account.tenant_id] = await this.getDefaultPlanForTenant(account.tenant_id);
          }
          
          const defaultPlan = defaultPlansByTenant[account.tenant_id];
          
          if (!defaultPlan) {
            stats.skipped++;
            logger.warn('No default plan for tenant, skipping account', { 
              accountId: account.id, 
              tenantId: account.tenant_id 
            });
            continue;
          }

          await this.subscriptionService.assignPlan(account.owner_user_id, defaultPlan.id, 'system-migration');
          stats.migrated++;
          logger.info('Account migrated to tenant default plan', { 
            accountId: account.id, 
            tenantId: account.tenant_id,
            planId: defaultPlan.id 
          });
        } catch (error) {
          stats.failed++;
          logger.error('Failed to migrate account', { accountId: account.id, error: error.message });
        }
      }

      logger.info('Migration completed', stats);
      return stats;
    } catch (error) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Gets the default plan quotas for fallback scenarios
   * Uses the default tenant's default plan
   * 
   * @returns {Promise<Object>} Default quotas
   */
  async getDefaultQuotas() {
    try {
      // Try to get default plan from default tenant
      const defaultTenantId = '00000000-0000-0000-0000-000000000001';
      const defaultPlan = await this.getDefaultPlanForTenant(defaultTenantId);
      
      if (defaultPlan && defaultPlan.quotas) {
        return defaultPlan.quotas;
      }
      
      // Hardcoded fallback if no default plan exists
      return {
        max_agents: 1,
        max_connections: 1,
        max_messages_per_day: 100,
        max_messages_per_month: 3000,
        max_inboxes: 1,
        max_teams: 1,
        max_webhooks: 5,
        max_campaigns: 1,
        max_storage_mb: 100
      };
    } catch (error) {
      logger.error('Failed to get default quotas', { error: error.message });
      return {
        max_agents: 1,
        max_connections: 1,
        max_messages_per_day: 100,
        max_messages_per_month: 3000,
        max_inboxes: 1,
        max_teams: 1,
        max_webhooks: 5,
        max_campaigns: 1,
        max_storage_mb: 100
      };
    }
  }
}

module.exports = SubscriptionEnsurer;
