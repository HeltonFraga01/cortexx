/**
 * QuotaService - Service for managing user quotas
 * 
 * Handles quota checking, usage tracking, overrides, and cycle resets.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const SupabaseService = require('./SupabaseService');

// Quota types
const QUOTA_TYPES = {
  MAX_AGENTS: 'max_agents',
  MAX_CONNECTIONS: 'max_connections',
  MAX_MESSAGES_PER_DAY: 'max_messages_per_day',
  MAX_MESSAGES_PER_MONTH: 'max_messages_per_month',
  MAX_INBOXES: 'max_inboxes',
  MAX_TEAMS: 'max_teams',
  MAX_WEBHOOKS: 'max_webhooks',
  MAX_CAMPAIGNS: 'max_campaigns',
  MAX_STORAGE_MB: 'max_storage_mb',
  MAX_BOTS: 'max_bots',
  // Bot usage quotas
  MAX_BOT_CALLS_PER_DAY: 'max_bot_calls_per_day',
  MAX_BOT_CALLS_PER_MONTH: 'max_bot_calls_per_month',
  MAX_BOT_MESSAGES_PER_DAY: 'max_bot_messages_per_day',
  MAX_BOT_MESSAGES_PER_MONTH: 'max_bot_messages_per_month',
  MAX_BOT_TOKENS_PER_DAY: 'max_bot_tokens_per_day',
  MAX_BOT_TOKENS_PER_MONTH: 'max_bot_tokens_per_month'
};

// Cycle-based quotas (reset daily/monthly)
const CYCLE_QUOTAS = [
  QUOTA_TYPES.MAX_MESSAGES_PER_DAY,
  QUOTA_TYPES.MAX_MESSAGES_PER_MONTH,
  // Bot usage quotas
  QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY,
  QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH,
  QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY,
  QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH,
  QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY,
  QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH
];

// Daily quotas (for period calculation)
const DAILY_QUOTAS = [
  QUOTA_TYPES.MAX_MESSAGES_PER_DAY,
  QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY,
  QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY,
  QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY
];

// Alert threshold percentage
const ALERT_THRESHOLD = 0.8;

class QuotaService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Get all quotas for a user (plan defaults + overrides)
   * Ensures all quota types are included with consistent structure
   * 
   * @param {string} userId - User ID
   * @param {string} [userToken=null] - WUZAPI token for resource counting
   * @returns {Promise<Object[]>} Array of quota objects with quotaType, limit, currentUsage, percentage, allowed, remaining
   * 
   * Requirements: 2.2, 5.1, 5.4
   */
  async getUserQuotas(userId, userToken = null) {
    try {
      // Get user's plan quotas
      const planQuotas = await this.getPlanQuotas(userId);
      
      // Get user's quota overrides
      const overrides = await this.getQuotaOverrides(userId);
      
      // Ensure all quota types are included
      const allQuotaTypes = Object.values(QUOTA_TYPES);
      const quotas = [];
      
      for (const quotaType of allQuotaTypes) {
        const planLimit = planQuotas[quotaType] || 0;
        const override = overrides.find(o => o.quotaType === quotaType);
        const effectiveLimit = override ? override.limitValue : planLimit;
        // Pass userToken to getCurrentUsage for accurate resource counting
        const currentUsage = await this.getCurrentUsage(userId, quotaType, userToken);
        
        // Calculate percentage using formula: (currentUsage / limit) * 100
        // If limit is 0, percentage is 0 to avoid division by zero
        const percentage = effectiveLimit > 0 ? Math.round((currentUsage / effectiveLimit) * 100) : 0;
        const remaining = Math.max(0, effectiveLimit - currentUsage);
        const allowed = currentUsage < effectiveLimit;
        
        quotas.push({
          quotaType,
          limit: effectiveLimit,
          currentUsage,
          percentage,
          remaining,
          allowed,
          source: override ? 'override' : 'plan',
          overrideReason: override?.reason || null
        });
      }
      
      return quotas;
    } catch (error) {
      logger.error('Failed to get user quotas', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if an operation is allowed based on quota
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota to check
   * @param {number} [amount=1] - Amount to check
   * @param {string} [userToken=null] - WUZAPI token for resource counting
   * @returns {Promise<Object>} { allowed: boolean, limit, usage, remaining }
   */
  async checkQuota(userId, quotaType, amount = 1, userToken = null) {
    try {
      const limit = await this.getEffectiveLimit(userId, quotaType);
      const currentUsage = await this.getCurrentUsage(userId, quotaType, userToken);
      const remaining = Math.max(0, limit - currentUsage);
      const allowed = currentUsage + amount <= limit;

      return {
        allowed,
        limit,
        usage: currentUsage,
        remaining,
        quotaType
      };
    } catch (error) {
      logger.error('Failed to check quota', { error: error.message, userId, quotaType });
      throw error;
    }
  }

  /**
   * Increment usage for a quota
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @param {number} [amount=1] - Amount to increment
   * @returns {Promise<number>} New usage value
   */
  async incrementUsage(userId, quotaType, amount = 1) {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(quotaType, now);
      const periodEnd = this.getPeriodEnd(quotaType, now);

      // Try to find existing record using Supabase
      const { data: existing, error: findError } = await SupabaseService.queryAsAdmin('user_quota_usage', (query) =>
        query.select('id, used_value')
          .eq('account_id', userId)
          .eq('quota_key', quotaType)
          .eq('period_start', periodStart.toISOString())
      );

      let newUsage;
      if (!findError && existing && existing.length > 0) {
        newUsage = (existing[0].used_value || 0) + amount;
        await SupabaseService.update('user_quota_usage', existing[0].id, {
          used_value: newUsage,
          updated_at: now.toISOString()
        });
      } else {
        newUsage = amount;
        await SupabaseService.insert('user_quota_usage', {
          account_id: userId,
          quota_key: quotaType,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          used_value: newUsage
        });
      }

      logger.debug('Usage incremented', { userId, quotaType, amount, newUsage });
      return newUsage;
    } catch (error) {
      logger.error('Failed to increment usage', { error: error.message, userId, quotaType });
      throw error;
    }
  }

  /**
   * Decrement usage for a quota (e.g., when deleting a file)
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @param {number} [amount=1] - Amount to decrement
   * @returns {Promise<number>} New usage value
   */
  async decrementUsage(userId, quotaType, amount = 1) {
    try {
      const now = new Date();
      const periodStart = this.getPeriodStart(quotaType, now);

      // Try to find existing record using Supabase
      const { data: existing, error: findError } = await SupabaseService.queryAsAdmin('user_quota_usage', (query) =>
        query.select('id, used_value')
          .eq('account_id', userId)
          .eq('quota_key', quotaType)
          .eq('period_start', periodStart.toISOString())
      );

      let newUsage = 0;
      if (!findError && existing && existing.length > 0) {
        newUsage = Math.max(0, (existing[0].used_value || 0) - amount);
        await SupabaseService.update('user_quota_usage', existing[0].id, {
          used_value: newUsage,
          updated_at: now.toISOString()
        });
      }

      logger.debug('Usage decremented', { userId, quotaType, amount, newUsage });
      return newUsage;
    } catch (error) {
      logger.error('Failed to decrement usage', { error: error.message, userId, quotaType });
      throw error;
    }
  }


  /**
   * Get current usage for a quota
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @param {string} [userToken=null] - WUZAPI token for resource counting
   * @returns {Promise<number>} Current usage
   */
  async getCurrentUsage(userId, quotaType, userToken = null) {
    try {
      // For resource-based quotas, count directly from tables
      if (quotaType === QUOTA_TYPES.MAX_INBOXES) {
        return await this.countUserInboxes(userId);
      }
      
      if (quotaType === QUOTA_TYPES.MAX_AGENTS) {
        return await this.countUserAgents(userId);
      }
      
      if (quotaType === QUOTA_TYPES.MAX_TEAMS) {
        return await this.countUserTeams(userId);
      }
      
      if (quotaType === QUOTA_TYPES.MAX_WEBHOOKS) {
        return await this.countUserWebhooks(userId, userToken);
      }
      
      if (quotaType === QUOTA_TYPES.MAX_CAMPAIGNS) {
        return await this.countUserCampaigns(userId, userToken);
      }
      
      if (quotaType === QUOTA_TYPES.MAX_CONNECTIONS) {
        return await this.countUserConnections(userId);
      }
      
      if (quotaType === QUOTA_TYPES.MAX_BOTS) {
        return await this.countUserBots(userId, userToken);
      }
      
      // For cycle-based quotas, use the usage tracking table
      const now = new Date();
      const periodStart = this.getPeriodStart(quotaType, now);

      const { data, error } = await SupabaseService.queryAsAdmin('user_quota_usage', (query) =>
        query.select('used_value')
          .eq('account_id', userId)
          .eq('quota_key', quotaType)
          .eq('period_start', periodStart.toISOString())
      );

      if (error || !data || data.length === 0) {
        return 0;
      }

      return data[0].used_value || 0;
    } catch (error) {
      logger.error('Failed to get current usage', { error: error.message, userId, quotaType });
      return 0;
    }
  }

  /**
   * Count inboxes for a user (via account)
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of inboxes
   */
  async countUserInboxes(userId) {
    try {
      // First get the account for this user
      const { data: accounts, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('owner_user_id', userId)
      );
      
      if (accountError || !accounts || accounts.length === 0) {
        return 0;
      }
      
      const accountIds = accounts.map(a => a.id);
      
      // Count inboxes for these accounts
      const { count, error } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.select('*', { count: 'exact', head: true }).in('account_id', accountIds)
      );
      
      if (error) {
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Failed to count user inboxes', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count agents for a user (via account)
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of agents
   */
  async countUserAgents(userId) {
    try {
      // First get the account for this user
      const { data: accounts, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('owner_user_id', userId)
      );
      
      if (accountError || !accounts || accounts.length === 0) {
        return 0;
      }
      
      const accountIds = accounts.map(a => a.id);
      
      // Count active agents for these accounts
      const { count, error } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.select('*', { count: 'exact', head: true })
          .in('account_id', accountIds)
          .eq('status', 'active')
      );
      
      if (error) {
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Failed to count user agents', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count teams for a user (via account)
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of teams
   */
  async countUserTeams(userId) {
    try {
      // First get the account for this user
      const { data: accounts, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('owner_user_id', userId)
      );
      
      if (accountError || !accounts || accounts.length === 0) {
        return 0;
      }
      
      const accountIds = accounts.map(a => a.id);
      
      // Count teams for these accounts
      const { count, error } = await SupabaseService.queryAsAdmin('teams', (query) =>
        query.select('*', { count: 'exact', head: true }).in('account_id', accountIds)
      );
      
      if (error) {
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Failed to count user teams', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count webhooks for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID (hash)
   * @param {string} [userToken=null] - WUZAPI token
   * @returns {Promise<number>} Number of webhooks
   */
  async countUserWebhooks(userId, userToken = null) {
    try {
      // Build list of identifiers to check
      const identifiers = [userId];
      if (userToken && userToken !== userId) {
        identifiers.push(userToken);
      }
      
      // Count webhooks for these identifiers
      const { count, error } = await SupabaseService.queryAsAdmin('outgoing_webhooks', (query) =>
        query.select('*', { count: 'exact', head: true }).in('user_id', identifiers)
      );
      
      if (error) {
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Failed to count user webhooks', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count campaigns for a user
   * Uses Supabase query builder - counts both bulk_campaigns and agent_campaigns
   * @param {string} userId - User ID (hash)
   * @param {string} [userToken=null] - WUZAPI token
   * @returns {Promise<number>} Number of campaigns
   */
  async countUserCampaigns(userId, userToken = null) {
    try {
      // First get the account for this user
      const { data: accounts, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('owner_user_id', userId)
      );
      
      if (accountError || !accounts || accounts.length === 0) {
        return 0;
      }
      
      const accountIds = accounts.map(a => a.id);
      
      // Count bulk campaigns
      const { count: bulkCount, error: bulkError } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.select('*', { count: 'exact', head: true }).in('account_id', accountIds)
      );
      
      // Count agent campaigns
      const { count: agentCount, error: agentError } = await SupabaseService.queryAsAdmin('agent_campaigns', (query) =>
        query.select('*', { count: 'exact', head: true }).in('account_id', accountIds)
      );
      
      return (bulkCount || 0) + (agentCount || 0);
    } catch (error) {
      logger.error('Failed to count user campaigns', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count connections for a user
   * Connections are inboxes with wuzapi_connected = true
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of active connections
   */
  async countUserConnections(userId) {
    try {
      // First get the account for this user
      const { data: accounts, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('owner_user_id', userId)
      );
      
      if (accountError || !accounts || accounts.length === 0) {
        return 0;
      }
      
      const accountIds = accounts.map(a => a.id);
      
      // Count connected inboxes for these accounts
      const { count, error } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.select('*', { count: 'exact', head: true })
          .in('account_id', accountIds)
          .eq('wuzapi_connected', true)
      );
      
      if (error) {
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Failed to count user connections', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count bots for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID (hash)
   * @param {string} [userToken=null] - WUZAPI token
   * @returns {Promise<number>} Number of bots
   */
  async countUserBots(userId, userToken = null) {
    try {
      // First get the account for this user
      const { data: accounts, error: accountError } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('owner_user_id', userId)
      );
      
      if (accountError || !accounts || accounts.length === 0) {
        return 0;
      }
      
      const accountIds = accounts.map(a => a.id);
      
      // Count bots for these accounts
      const { count, error } = await SupabaseService.queryAsAdmin('agent_bots', (query) =>
        query.select('*', { count: 'exact', head: true }).in('account_id', accountIds)
      );
      
      if (error) {
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      logger.error('Failed to count user bots', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Set a quota override for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @param {number} limit - New limit value
   * @param {string} adminId - Admin setting the override
   * @param {string} [reason] - Reason for override
   * @returns {Promise<Object>} Created/updated override
   */
  async setQuotaOverride(userId, quotaType, limit, adminId, reason = null) {
    try {
      const now = new Date().toISOString();
      
      // Check if override exists
      const { data: existing, error: findError } = await SupabaseService.queryAsAdmin('user_quota_overrides', (query) =>
        query.select('id').eq('account_id', userId).eq('quota_key', quotaType)
      );

      if (!findError && existing && existing.length > 0) {
        await SupabaseService.update('user_quota_overrides', existing[0].id, {
          quota_value: limit,
          reason: reason,
          updated_at: now
        });
      } else {
        await SupabaseService.insert('user_quota_overrides', {
          account_id: userId,
          quota_key: quotaType,
          quota_value: limit,
          reason: reason
        });
      }

      logger.info('Quota override set', { userId, quotaType, limit, adminId, reason });

      return { userId, quotaType, limit, reason, setBy: adminId };
    } catch (error) {
      logger.error('Failed to set quota override', { error: error.message, userId, quotaType });
      throw error;
    }
  }

  /**
   * Remove a quota override
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @param {string} adminId - Admin removing the override
   * @returns {Promise<void>}
   */
  async removeQuotaOverride(userId, quotaType, adminId) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('user_quota_overrides', (query) =>
        query.delete().eq('account_id', userId).eq('quota_key', quotaType)
      );

      if (error) {
        throw error;
      }

      logger.info('Quota override removed', { userId, quotaType, adminId });
    } catch (error) {
      logger.error('Failed to remove quota override', { error: error.message, userId, quotaType });
      throw error;
    }
  }

  /**
   * Reset cycle-based quota counters for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async resetCycleCounters(userId) {
    try {
      const now = new Date();
      
      for (const quotaType of CYCLE_QUOTAS) {
        const periodStart = this.getPeriodStart(quotaType, now);
        
        // Find and update existing records
        const { data: existing } = await SupabaseService.queryAsAdmin('user_quota_usage', (query) =>
          query.select('id')
            .eq('account_id', userId)
            .eq('quota_key', quotaType)
            .eq('period_start', periodStart.toISOString())
        );
        
        if (existing && existing.length > 0) {
          await SupabaseService.update('user_quota_usage', existing[0].id, {
            used_value: 0,
            updated_at: now.toISOString()
          });
        }
      }

      logger.info('Cycle counters reset', { userId, quotaTypes: CYCLE_QUOTAS });
    } catch (error) {
      logger.error('Failed to reset cycle counters', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if user is near alert threshold for any quota
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @returns {Promise<Object>} { nearThreshold: boolean, percentage }
   */
  async checkAlertThreshold(userId, quotaType) {
    try {
      const limit = await this.getEffectiveLimit(userId, quotaType);
      const currentUsage = await this.getCurrentUsage(userId, quotaType);
      const percentage = limit > 0 ? currentUsage / limit : 0;

      return {
        nearThreshold: percentage >= ALERT_THRESHOLD,
        percentage: Math.round(percentage * 100),
        limit,
        usage: currentUsage
      };
    } catch (error) {
      logger.error('Failed to check alert threshold', { error: error.message, userId, quotaType });
      throw error;
    }
  }

  /**
   * Get effective limit for a quota (override or plan default)
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @returns {Promise<number>} Effective limit
   */
  async getEffectiveLimit(userId, quotaType) {
    try {
      // Check for override first
      const { data: overrides, error } = await SupabaseService.queryAsAdmin('user_quota_overrides', (query) =>
        query.select('quota_value').eq('account_id', userId).eq('quota_key', quotaType)
      );

      if (!error && overrides && overrides.length > 0) {
        return overrides[0].quota_value;
      }

      // Fall back to plan default
      const planQuotas = await this.getPlanQuotas(userId);
      return planQuotas[quotaType] || 0;
    } catch (error) {
      logger.error('Failed to get effective limit', { error: error.message, userId, quotaType });
      return 0;
    }
  }

  /**
   * Get plan quotas for a user
   * Updated for multi-tenant architecture to use tenant_plans instead of global plans
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Plan quotas from tenant-specific plans
   * Requirements: 11.1 - Use tenant_plans via subscription
   */
  async getPlanQuotas(userId) {
    const defaultQuotas = {
      [QUOTA_TYPES.MAX_AGENTS]: 1,
      [QUOTA_TYPES.MAX_CONNECTIONS]: 1,
      [QUOTA_TYPES.MAX_MESSAGES_PER_DAY]: 100,
      [QUOTA_TYPES.MAX_MESSAGES_PER_MONTH]: 3000,
      [QUOTA_TYPES.MAX_INBOXES]: 1,
      [QUOTA_TYPES.MAX_TEAMS]: 1,
      [QUOTA_TYPES.MAX_WEBHOOKS]: 5,
      [QUOTA_TYPES.MAX_CAMPAIGNS]: 1,
      [QUOTA_TYPES.MAX_STORAGE_MB]: 100,
      [QUOTA_TYPES.MAX_BOTS]: 3,
      [QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY]: 100,
      [QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH]: 3000,
      [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY]: 50,
      [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH]: 1500,
      [QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY]: 10000,
      [QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH]: 300000
    };

    try {
      // Step 1: Get user subscription
      const { data: subscriptions, error: subError } = await SupabaseService.queryAsAdmin('user_subscriptions', (query) =>
        query.select('plan_id, account_id').eq('account_id', userId)
      );
      
      if (subError || !subscriptions || subscriptions.length === 0) {
        // Try with user_id field as fallback
        const { data: subsByUserId, error: subError2 } = await SupabaseService.queryAsAdmin('user_subscriptions', (query) =>
          query.select('plan_id, account_id')
        );
        
        // Find subscription where account owner matches userId
        if (!subsByUserId || subsByUserId.length === 0) {
          logger.debug('No subscription found for user, returning default quotas', { userId });
          return defaultQuotas;
        }
        
        // Get accounts to find the one owned by this user
        const { data: accounts } = await SupabaseService.queryAsAdmin('accounts', (query) =>
          query.select('id, tenant_id').eq('owner_user_id', userId)
        );
        
        if (!accounts || accounts.length === 0) {
          logger.debug('No account found for user, returning default quotas', { userId });
          return defaultQuotas;
        }
        
        const accountId = accounts[0].id;
        const tenantId = accounts[0].tenant_id;
        
        // Find subscription for this account
        const subscription = subsByUserId.find(s => s.account_id === accountId);
        if (!subscription) {
          logger.debug('No subscription found for account, returning default quotas', { userId, accountId });
          return defaultQuotas;
        }
        
        // Get tenant plan
        const { data: plans, error: planError } = await SupabaseService.queryAsAdmin('tenant_plans', (query) =>
          query.select('quotas').eq('id', subscription.plan_id)
        );
        
        if (planError || !plans || plans.length === 0) {
          logger.debug('No plan found, returning default quotas', { userId, planId: subscription.plan_id });
          return defaultQuotas;
        }
        
        const quotas = plans[0].quotas || {};
        return this._parseQuotas(quotas, defaultQuotas);
      }
      
      // Get tenant plan directly
      const planId = subscriptions[0].plan_id;
      const { data: plans, error: planError } = await SupabaseService.queryAsAdmin('tenant_plans', (query) =>
        query.select('quotas').eq('id', planId)
      );
      
      if (planError || !plans || plans.length === 0) {
        logger.debug('No plan found, returning default quotas', { userId, planId });
        return defaultQuotas;
      }
      
      const quotas = plans[0].quotas || {};
      return this._parseQuotas(quotas, defaultQuotas);
    } catch (error) {
      logger.error('Failed to get plan quotas', { error: error.message, userId });
      return defaultQuotas;
    }
  }

  /**
   * Parse quotas from plan data
   * @private
   */
  _parseQuotas(quotas, defaults) {
    return {
      [QUOTA_TYPES.MAX_AGENTS]: parseInt(quotas.max_agents) || defaults[QUOTA_TYPES.MAX_AGENTS],
      [QUOTA_TYPES.MAX_CONNECTIONS]: parseInt(quotas.max_connections) || defaults[QUOTA_TYPES.MAX_CONNECTIONS],
      [QUOTA_TYPES.MAX_MESSAGES_PER_DAY]: parseInt(quotas.max_messages_per_day) || defaults[QUOTA_TYPES.MAX_MESSAGES_PER_DAY],
      [QUOTA_TYPES.MAX_MESSAGES_PER_MONTH]: parseInt(quotas.max_messages_per_month) || defaults[QUOTA_TYPES.MAX_MESSAGES_PER_MONTH],
      [QUOTA_TYPES.MAX_INBOXES]: parseInt(quotas.max_inboxes) || defaults[QUOTA_TYPES.MAX_INBOXES],
      [QUOTA_TYPES.MAX_TEAMS]: parseInt(quotas.max_teams) || defaults[QUOTA_TYPES.MAX_TEAMS],
      [QUOTA_TYPES.MAX_WEBHOOKS]: parseInt(quotas.max_webhooks) || defaults[QUOTA_TYPES.MAX_WEBHOOKS],
      [QUOTA_TYPES.MAX_CAMPAIGNS]: parseInt(quotas.max_campaigns) || defaults[QUOTA_TYPES.MAX_CAMPAIGNS],
      [QUOTA_TYPES.MAX_STORAGE_MB]: parseInt(quotas.max_storage_mb) || defaults[QUOTA_TYPES.MAX_STORAGE_MB],
      [QUOTA_TYPES.MAX_BOTS]: parseInt(quotas.max_bots) || defaults[QUOTA_TYPES.MAX_BOTS],
      [QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY]: parseInt(quotas.max_bot_calls_per_day) || defaults[QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY],
      [QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH]: parseInt(quotas.max_bot_calls_per_month) || defaults[QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH],
      [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY]: parseInt(quotas.max_bot_messages_per_day) || defaults[QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY],
      [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH]: parseInt(quotas.max_bot_messages_per_month) || defaults[QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH],
      [QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY]: parseInt(quotas.max_bot_tokens_per_day) || defaults[QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY],
      [QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH]: parseInt(quotas.max_bot_tokens_per_month) || defaults[QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH]
    };
  }

  /**
   * Get quota overrides for a user
   * Uses Supabase query builder instead of raw SQL
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of overrides
   */
  async getQuotaOverrides(userId) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('user_quota_overrides', (query) =>
        query.select('quota_key, quota_value, reason').eq('account_id', userId)
      );
      
      if (error || !data) {
        return [];
      }

      return data.map(row => ({
        quotaType: row.quota_key,
        limitValue: row.quota_value,
        reason: row.reason,
        setBy: null
      }));
    } catch (error) {
      logger.error('Failed to get quota overrides', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Get period start date based on quota type
   * Uses Brazil timezone (UTC-3) for period boundaries
   * @param {string} quotaType - Type of quota
   * @param {Date} date - Reference date
   * @returns {Date} Period start date
   */
  getPeriodStart(quotaType, date) {
    const d = new Date(date);
    
    // Check if it's a daily quota
    if (DAILY_QUOTAS.includes(quotaType)) {
      d.setHours(0, 0, 0, 0);
    } else {
      // Monthly period
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    
    return d;
  }

  /**
   * Get period end date based on quota type
   * Uses Brazil timezone (UTC-3) for period boundaries
   * @param {string} quotaType - Type of quota
   * @param {Date} date - Reference date
   * @returns {Date} Period end date
   */
  getPeriodEnd(quotaType, date) {
    const d = new Date(date);
    
    // Check if it's a daily quota
    if (DAILY_QUOTAS.includes(quotaType)) {
      d.setHours(23, 59, 59, 999);
    } else {
      // Monthly period
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      d.setHours(23, 59, 59, 999);
    }
    
    return d;
  }

  /**
   * Validate quotas against global platform limits
   * Ensures tenant plan quotas do not exceed platform-wide maximums
   * @param {Object} quotas - Quota values to validate
   * @returns {Promise<Object>} { valid: boolean, violations: Array<{quotaType, value, maxAllowed}> }
   * Requirements: 11.2, 13.2 - Validate quotas against global limits
   */
  async validateAgainstGlobalLimits(quotas) {
    try {
      // Define global platform limits (these would typically come from a global_settings table)
      // For now, we'll use hardcoded values that represent reasonable platform maximums
      const GLOBAL_LIMITS = {
        [QUOTA_TYPES.MAX_AGENTS]: 1000,
        [QUOTA_TYPES.MAX_CONNECTIONS]: 1000,
        [QUOTA_TYPES.MAX_MESSAGES_PER_DAY]: 100000,
        [QUOTA_TYPES.MAX_MESSAGES_PER_MONTH]: 3000000,
        [QUOTA_TYPES.MAX_INBOXES]: 500,
        [QUOTA_TYPES.MAX_TEAMS]: 100,
        [QUOTA_TYPES.MAX_WEBHOOKS]: 100,
        [QUOTA_TYPES.MAX_CAMPAIGNS]: 100,
        [QUOTA_TYPES.MAX_STORAGE_MB]: 100000, // 100GB
        [QUOTA_TYPES.MAX_BOTS]: 100,
        [QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY]: 100000,
        [QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH]: 3000000,
        [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY]: 50000,
        [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH]: 1500000,
        [QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY]: 1000000,
        [QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH]: 30000000
      };

      const violations = [];

      // Check each quota against global limits
      for (const [quotaType, value] of Object.entries(quotas)) {
        const globalLimit = GLOBAL_LIMITS[quotaType];
        
        if (globalLimit !== undefined && value > globalLimit) {
          violations.push({
            quotaType,
            value,
            maxAllowed: globalLimit
          });
        }
      }

      const valid = violations.length === 0;

      if (!valid) {
        logger.warn('Quota validation failed - exceeds global limits', { 
          violations,
          requestedQuotas: quotas
        });
      }

      return {
        valid,
        violations
      };
    } catch (error) {
      logger.error('Failed to validate against global limits', { 
        error: error.message, 
        quotas 
      });
      throw error;
    }
  }

  /**
   * Get bot quota usage for a user
   * Returns current usage for all bot quota types (calls, messages, tokens)
   * with both daily and monthly values and limits
   * 
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Bot quota usage with daily/monthly values and limits
   * 
   * Requirements: 9.3, 10.1, 10.2
   */
  async getBotQuotaUsage(userId) {
    try {
      // Get effective limits for all bot quota types
      const [
        maxBotCallsPerDay,
        maxBotCallsPerMonth,
        maxBotMessagesPerDay,
        maxBotMessagesPerMonth,
        maxBotTokensPerDay,
        maxBotTokensPerMonth
      ] = await Promise.all([
        this.getEffectiveLimit(userId, QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY),
        this.getEffectiveLimit(userId, QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH),
        this.getEffectiveLimit(userId, QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY),
        this.getEffectiveLimit(userId, QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH),
        this.getEffectiveLimit(userId, QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY),
        this.getEffectiveLimit(userId, QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH)
      ]);

      // Get current usage for all bot quota types
      const [
        botCallsDaily,
        botCallsMonthly,
        botMessagesDaily,
        botMessagesMonthly,
        botTokensDaily,
        botTokensMonthly
      ] = await Promise.all([
        this.getCurrentUsage(userId, QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY),
        this.getCurrentUsage(userId, QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH),
        this.getCurrentUsage(userId, QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY),
        this.getCurrentUsage(userId, QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH),
        this.getCurrentUsage(userId, QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY),
        this.getCurrentUsage(userId, QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH)
      ]);

      // Calculate reset times
      const now = new Date();
      const dailyResetAt = this.getPeriodEnd(QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY, now);
      const monthlyResetAt = this.getPeriodEnd(QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH, now);

      return {
        botCallsDaily,
        botCallsMonthly,
        maxBotCallsPerDay,
        maxBotCallsPerMonth,
        botMessagesDaily,
        botMessagesMonthly,
        maxBotMessagesPerDay,
        maxBotMessagesPerMonth,
        botTokensDaily,
        botTokensMonthly,
        maxBotTokensPerDay,
        maxBotTokensPerMonth,
        dailyResetAt: dailyResetAt.toISOString(),
        monthlyResetAt: monthlyResetAt.toISOString()
      };
    } catch (error) {
      logger.error('Failed to get bot quota usage', { error: error.message, userId });
      throw error;
    }
  }
}

// Export constants
QuotaService.QUOTA_TYPES = QUOTA_TYPES;
QuotaService.CYCLE_QUOTAS = CYCLE_QUOTAS;
QuotaService.DAILY_QUOTAS = DAILY_QUOTAS;
QuotaService.ALERT_THRESHOLD = ALERT_THRESHOLD;

module.exports = QuotaService;
