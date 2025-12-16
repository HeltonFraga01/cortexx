/**
 * QuotaService - Service for managing user quotas
 * 
 * Handles quota checking, usage tracking, overrides, and cycle resets.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

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

      // Try to update existing record
      const existingResult = await this.db.query(
        `SELECT id, current_usage FROM user_quota_usage 
         WHERE user_id = ? AND quota_type = ? AND period_start = ?`,
        [userId, quotaType, periodStart.toISOString()]
      );

      let newUsage;
      if (existingResult.rows.length > 0) {
        newUsage = existingResult.rows[0].current_usage + amount;
        await this.db.query(
          `UPDATE user_quota_usage SET current_usage = ?, updated_at = ? 
           WHERE id = ?`,
          [newUsage, now.toISOString(), existingResult.rows[0].id]
        );
      } else {
        newUsage = amount;
        await this.db.query(
          `INSERT INTO user_quota_usage (id, user_id, quota_type, period_start, period_end, current_usage, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.generateId(), userId, quotaType, periodStart.toISOString(), periodEnd.toISOString(), newUsage, now.toISOString(), now.toISOString()]
        );
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

      // Try to update existing record
      const existingResult = await this.db.query(
        `SELECT id, current_usage FROM user_quota_usage 
         WHERE user_id = ? AND quota_type = ? AND period_start = ?`,
        [userId, quotaType, periodStart.toISOString()]
      );

      let newUsage = 0;
      if (existingResult.rows.length > 0) {
        newUsage = Math.max(0, existingResult.rows[0].current_usage - amount);
        await this.db.query(
          `UPDATE user_quota_usage SET current_usage = ?, updated_at = ? 
           WHERE id = ?`,
          [newUsage, now.toISOString(), existingResult.rows[0].id]
        );
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

      const result = await this.db.query(
        `SELECT current_usage FROM user_quota_usage 
         WHERE user_id = ? AND quota_type = ? AND period_start = ?`,
        [userId, quotaType, periodStart.toISOString()]
      );

      return result.rows.length > 0 ? result.rows[0].current_usage : 0;
    } catch (error) {
      logger.error('Failed to get current usage', { error: error.message, userId, quotaType });
      return 0;
    }
  }

  /**
   * Count inboxes for a user (via account)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of inboxes
   */
  async countUserInboxes(userId) {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM inboxes i
         JOIN accounts a ON i.account_id = a.id
         WHERE a.owner_user_id = ?`,
        [userId]
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count user inboxes', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count agents for a user (via account)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of agents
   */
  async countUserAgents(userId) {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM agents ag
         JOIN accounts a ON ag.account_id = a.id
         WHERE a.owner_user_id = ? AND ag.status = 'active'`,
        [userId]
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count user agents', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count teams for a user (via account)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of teams
   */
  async countUserTeams(userId) {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM teams t
         JOIN accounts a ON t.account_id = a.id
         WHERE a.owner_user_id = ?`,
        [userId]
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count user teams', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count webhooks for a user
   * Uses outgoing_webhooks table - checks both userId and userToken
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
      
      const placeholders = identifiers.map(() => '?').join(',');
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM outgoing_webhooks WHERE user_id IN (${placeholders})`,
        identifiers
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count user webhooks', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count campaigns for a user
   * Uses campaigns table - checks both userId and userToken in user_token field
   * @param {string} userId - User ID (hash)
   * @param {string} [userToken=null] - WUZAPI token
   * @returns {Promise<number>} Number of campaigns
   */
  async countUserCampaigns(userId, userToken = null) {
    try {
      // Build list of identifiers to check
      const identifiers = [userId];
      if (userToken && userToken !== userId) {
        identifiers.push(userToken);
      }
      
      const placeholders = identifiers.map(() => '?').join(',');
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM campaigns WHERE user_token IN (${placeholders})`,
        identifiers
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count user campaigns', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count connections for a user
   * Connections are inboxes with wuzapi_connected = 1
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of active connections
   */
  async countUserConnections(userId) {
    try {
      // Count connected inboxes via account
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM inboxes i
         JOIN accounts a ON i.account_id = a.id
         WHERE a.owner_user_id = ? AND i.wuzapi_connected = 1`,
        [userId]
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count user connections', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Count bots for a user
   * Checks both userId and userToken in user_id field
   * @param {string} userId - User ID (hash)
   * @param {string} [userToken=null] - WUZAPI token
   * @returns {Promise<number>} Number of bots
   */
  async countUserBots(userId, userToken = null) {
    try {
      // Build list of identifiers to check
      const identifiers = [userId];
      if (userToken && userToken !== userId) {
        identifiers.push(userToken);
      }
      
      const placeholders = identifiers.map(() => '?').join(',');
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM agent_bots WHERE user_id IN (${placeholders})`,
        identifiers
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count user bots', { error: error.message, userId });
      return 0;
    }
  }

  /**
   * Set a quota override for a user
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
      const existing = await this.db.query(
        'SELECT id FROM user_quota_overrides WHERE user_id = ? AND quota_type = ?',
        [userId, quotaType]
      );

      if (existing.rows.length > 0) {
        await this.db.query(
          `UPDATE user_quota_overrides 
           SET limit_value = ?, reason = ?, set_by = ?, updated_at = ?
           WHERE user_id = ? AND quota_type = ?`,
          [limit, reason, adminId, now, userId, quotaType]
        );
      } else {
        await this.db.query(
          `INSERT INTO user_quota_overrides (id, user_id, quota_type, limit_value, reason, set_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.generateId(), userId, quotaType, limit, reason, adminId, now, now]
        );
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
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @param {string} adminId - Admin removing the override
   * @returns {Promise<void>}
   */
  async removeQuotaOverride(userId, quotaType, adminId) {
    try {
      await this.db.query(
        'DELETE FROM user_quota_overrides WHERE user_id = ? AND quota_type = ?',
        [userId, quotaType]
      );

      logger.info('Quota override removed', { userId, quotaType, adminId });
    } catch (error) {
      logger.error('Failed to remove quota override', { error: error.message, userId, quotaType });
      throw error;
    }
  }

  /**
   * Reset cycle-based quota counters for a user
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async resetCycleCounters(userId) {
    try {
      const now = new Date();
      
      for (const quotaType of CYCLE_QUOTAS) {
        const periodStart = this.getPeriodStart(quotaType, now);
        
        await this.db.query(
          `UPDATE user_quota_usage SET current_usage = 0, updated_at = ?
           WHERE user_id = ? AND quota_type = ? AND period_start = ?`,
          [now.toISOString(), userId, quotaType, periodStart.toISOString()]
        );
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
   * @param {string} userId - User ID
   * @param {string} quotaType - Type of quota
   * @returns {Promise<number>} Effective limit
   */
  async getEffectiveLimit(userId, quotaType) {
    try {
      // Check for override first
      const overrideResult = await this.db.query(
        'SELECT limit_value FROM user_quota_overrides WHERE user_id = ? AND quota_type = ?',
        [userId, quotaType]
      );

      if (overrideResult.rows.length > 0) {
        return overrideResult.rows[0].limit_value;
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
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Plan quotas
   */
  async getPlanQuotas(userId) {
    try {
      const result = await this.db.query(
        `SELECT p.max_agents, p.max_connections, p.max_messages_per_day, p.max_messages_per_month,
                p.max_inboxes, p.max_teams, p.max_webhooks, p.max_campaigns, p.max_storage_mb,
                p.max_bots, p.max_bot_calls_per_day, p.max_bot_calls_per_month,
                p.max_bot_messages_per_day, p.max_bot_messages_per_month,
                p.max_bot_tokens_per_day, p.max_bot_tokens_per_month
         FROM user_subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.user_id = ?`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Return default quotas when user has no subscription
        logger.debug('No subscription found for user, returning default quotas', { userId });
        return {
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
          // Bot usage quotas defaults
          [QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY]: 100,
          [QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH]: 3000,
          [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY]: 50,
          [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH]: 1500,
          [QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY]: 10000,
          [QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH]: 300000
        };
      }

      const row = result.rows[0];
      return {
        [QUOTA_TYPES.MAX_AGENTS]: row.max_agents,
        [QUOTA_TYPES.MAX_CONNECTIONS]: row.max_connections,
        [QUOTA_TYPES.MAX_MESSAGES_PER_DAY]: row.max_messages_per_day,
        [QUOTA_TYPES.MAX_MESSAGES_PER_MONTH]: row.max_messages_per_month,
        [QUOTA_TYPES.MAX_INBOXES]: row.max_inboxes,
        [QUOTA_TYPES.MAX_TEAMS]: row.max_teams,
        [QUOTA_TYPES.MAX_WEBHOOKS]: row.max_webhooks,
        [QUOTA_TYPES.MAX_CAMPAIGNS]: row.max_campaigns,
        [QUOTA_TYPES.MAX_STORAGE_MB]: row.max_storage_mb,
        [QUOTA_TYPES.MAX_BOTS]: row.max_bots || 3,
        // Bot usage quotas
        [QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY]: row.max_bot_calls_per_day || 100,
        [QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH]: row.max_bot_calls_per_month || 3000,
        [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY]: row.max_bot_messages_per_day || 50,
        [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH]: row.max_bot_messages_per_month || 1500,
        [QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY]: row.max_bot_tokens_per_day || 10000,
        [QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH]: row.max_bot_tokens_per_month || 300000
      };
    } catch (error) {
      logger.error('Failed to get plan quotas', { error: error.message, userId });
      // Return default quotas on error
      return {
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
        // Bot usage quotas defaults
        [QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY]: 100,
        [QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH]: 3000,
        [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY]: 50,
        [QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH]: 1500,
        [QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY]: 10000,
        [QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH]: 300000
      };
    }
  }

  /**
   * Get quota overrides for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object[]>} Array of overrides
   */
  async getQuotaOverrides(userId) {
    try {
      const result = await this.db.query(
        'SELECT quota_type, limit_value, reason, set_by FROM user_quota_overrides WHERE user_id = ?',
        [userId]
      );

      return result.rows.map(row => ({
        quotaType: row.quota_type,
        limitValue: row.limit_value,
        reason: row.reason,
        setBy: row.set_by
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
