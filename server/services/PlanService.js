/**
 * PlanService - Service for managing subscription plans
 * 
 * Handles CRUD operations for plans including creation, retrieval,
 * update, and deletion with subscriber count tracking.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Valid user features for plans (excludes admin-only and removed features)
const VALID_USER_FEATURES = [
  'bulk_campaigns',
  'nocodb_integration',
  'bot_automation',
  'advanced_reports',
  'api_access',
  'webhooks',
  'scheduled_messages',
  'media_storage'
];

// Default features for new plans (only user features)
const DEFAULT_FEATURES = {
  bulk_campaigns: false,
  nocodb_integration: false,
  bot_automation: false,
  advanced_reports: false,
  api_access: true,
  webhooks: true,
  scheduled_messages: false,
  media_storage: true
};

/**
 * Validate that plan features only contain valid user features
 * @param {Object} features - Features object to validate
 * @throws {Error} If invalid features are found
 */
function validatePlanFeatures(features) {
  if (!features || typeof features !== 'object') {
    return;
  }
  
  const invalidFeatures = Object.keys(features).filter(
    f => !VALID_USER_FEATURES.includes(f)
  );
  
  if (invalidFeatures.length > 0) {
    throw new Error(`Invalid features for plan: ${invalidFeatures.join(', ')}. Valid features are: ${VALID_USER_FEATURES.join(', ')}`);
  }
}

/**
 * Filter features to only include valid user features
 * @param {Object} features - Features object to filter
 * @returns {Object} Filtered features
 */
function filterValidFeatures(features) {
  if (!features || typeof features !== 'object') {
    return {};
  }
  
  const filtered = {};
  for (const key of VALID_USER_FEATURES) {
    if (key in features) {
      filtered[key] = features[key];
    }
  }
  return filtered;
}

// Default quotas for new plans
const DEFAULT_QUOTAS = {
  maxAgents: 1,
  maxConnections: 1,
  maxMessagesPerDay: 100,
  maxMessagesPerMonth: 3000,
  maxInboxes: 1,
  maxTeams: 1,
  maxWebhooks: 5,
  maxCampaigns: 1,
  maxStorageMb: 100,
  maxBots: 3,
  // Bot usage quotas (Requirements: 8.2-8.7)
  maxBotCallsPerDay: 100,
  maxBotCallsPerMonth: 3000,
  maxBotMessagesPerDay: 50,
  maxBotMessagesPerMonth: 1500,
  maxBotTokensPerDay: 10000,
  maxBotTokensPerMonth: 300000
};

class PlanService {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomUUID();
  }

  async createPlan(data) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();
      
      // Validate features before creating plan
      if (data.features) {
        validatePlanFeatures(data.features);
      }
      
      // Merge with defaults, filtering to only valid features
      const features = {
        ...DEFAULT_FEATURES,
        ...filterValidFeatures(data.features || {})
      };

      const sql = `
        INSERT INTO plans (
          id, name, description, price_cents, billing_cycle, status, is_default, trial_days,
          max_agents, max_connections, max_messages_per_day, max_messages_per_month,
          max_inboxes, max_teams, max_webhooks, max_campaigns, max_storage_mb, max_bots,
          max_bot_calls_per_day, max_bot_calls_per_month, max_bot_messages_per_day,
          max_bot_messages_per_month, max_bot_tokens_per_day, max_bot_tokens_per_month,
          features, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id,
        data.name,
        data.description || null,
        data.priceCents || 0,
        data.billingCycle || 'monthly',
        data.status || 'active',
        data.isDefault ? 1 : 0,
        data.trialDays || 0,
        data.quotas?.maxAgents ?? DEFAULT_QUOTAS.maxAgents,
        data.quotas?.maxConnections ?? DEFAULT_QUOTAS.maxConnections,
        data.quotas?.maxMessagesPerDay ?? DEFAULT_QUOTAS.maxMessagesPerDay,
        data.quotas?.maxMessagesPerMonth ?? DEFAULT_QUOTAS.maxMessagesPerMonth,
        data.quotas?.maxInboxes ?? DEFAULT_QUOTAS.maxInboxes,
        data.quotas?.maxTeams ?? DEFAULT_QUOTAS.maxTeams,
        data.quotas?.maxWebhooks ?? DEFAULT_QUOTAS.maxWebhooks,
        data.quotas?.maxCampaigns ?? DEFAULT_QUOTAS.maxCampaigns,
        data.quotas?.maxStorageMb ?? DEFAULT_QUOTAS.maxStorageMb,
        data.quotas?.maxBots ?? DEFAULT_QUOTAS.maxBots,
        data.quotas?.maxBotCallsPerDay ?? DEFAULT_QUOTAS.maxBotCallsPerDay,
        data.quotas?.maxBotCallsPerMonth ?? DEFAULT_QUOTAS.maxBotCallsPerMonth,
        data.quotas?.maxBotMessagesPerDay ?? DEFAULT_QUOTAS.maxBotMessagesPerDay,
        data.quotas?.maxBotMessagesPerMonth ?? DEFAULT_QUOTAS.maxBotMessagesPerMonth,
        data.quotas?.maxBotTokensPerDay ?? DEFAULT_QUOTAS.maxBotTokensPerDay,
        data.quotas?.maxBotTokensPerMonth ?? DEFAULT_QUOTAS.maxBotTokensPerMonth,
        JSON.stringify(features),
        now,
        now
      ]);

      logger.info('Plan created', { planId: id, name: data.name });

      return this.getPlanById(id);
    } catch (error) {
      logger.error('Failed to create plan', { error: error.message, data: { name: data.name } });
      throw error;
    }
  }

  async getPlanById(planId) {
    try {
      const { rows } = await this.db.query('SELECT * FROM plans WHERE id = ?', [planId]);

      if (!rows || rows.length === 0) {
        return null;
      }

      const plan = this.formatPlan(rows[0]);
      plan.subscriberCount = await this.getSubscriberCount(planId);
      
      return plan;
    } catch (error) {
      logger.error('Failed to get plan', { error: error.message, planId });
      throw error;
    }
  }

  async getPlanByName(name) {
    try {
      const { rows } = await this.db.query('SELECT * FROM plans WHERE name = ?', [name]);

      if (!rows || rows.length === 0) {
        return null;
      }

      const plan = this.formatPlan(rows[0]);
      plan.subscriberCount = await this.getSubscriberCount(plan.id);
      
      return plan;
    } catch (error) {
      logger.error('Failed to get plan by name', { error: error.message, name });
      throw error;
    }
  }

  async getDefaultPlan() {
    try {
      const { rows } = await this.db.query(
        'SELECT * FROM plans WHERE is_default = 1 AND status = ? LIMIT 1',
        ['active']
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      return this.formatPlan(rows[0]);
    } catch (error) {
      logger.error('Failed to get default plan', { error: error.message });
      throw error;
    }
  }

  async listPlans(filters = {}) {
    try {
      let sql = 'SELECT * FROM plans';
      const params = [];

      if (filters.status) {
        sql += ' WHERE status = ?';
        params.push(filters.status);
      }

      sql += ' ORDER BY price_cents ASC, name ASC';

      const { rows } = await this.db.query(sql, params);
      
      const plans = [];
      for (const row of (rows || [])) {
        const plan = this.formatPlan(row);
        plan.subscriberCount = await this.getSubscriberCount(plan.id);
        plans.push(plan);
      }

      return plans;
    } catch (error) {
      logger.error('Failed to list plans', { error: error.message });
      throw error;
    }
  }

  async updatePlan(planId, data, effectiveDate = null) {
    try {
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      const updates = [];
      const params = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.priceCents !== undefined) {
        updates.push('price_cents = ?');
        params.push(data.priceCents);
      }

      if (data.billingCycle !== undefined) {
        updates.push('billing_cycle = ?');
        params.push(data.billingCycle);
      }

      if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
      }

      if (data.isDefault !== undefined) {
        if (data.isDefault) {
          await this.db.query('UPDATE plans SET is_default = 0', []);
        }
        updates.push('is_default = ?');
        params.push(data.isDefault ? 1 : 0);
      }

      if (data.trialDays !== undefined) {
        updates.push('trial_days = ?');
        params.push(data.trialDays);
      }

      if (data.quotas) {
        if (data.quotas.maxAgents !== undefined) {
          updates.push('max_agents = ?');
          params.push(data.quotas.maxAgents);
        }
        if (data.quotas.maxConnections !== undefined) {
          updates.push('max_connections = ?');
          params.push(data.quotas.maxConnections);
        }
        if (data.quotas.maxMessagesPerDay !== undefined) {
          updates.push('max_messages_per_day = ?');
          params.push(data.quotas.maxMessagesPerDay);
        }
        if (data.quotas.maxMessagesPerMonth !== undefined) {
          updates.push('max_messages_per_month = ?');
          params.push(data.quotas.maxMessagesPerMonth);
        }
        if (data.quotas.maxInboxes !== undefined) {
          updates.push('max_inboxes = ?');
          params.push(data.quotas.maxInboxes);
        }
        if (data.quotas.maxTeams !== undefined) {
          updates.push('max_teams = ?');
          params.push(data.quotas.maxTeams);
        }
        if (data.quotas.maxWebhooks !== undefined) {
          updates.push('max_webhooks = ?');
          params.push(data.quotas.maxWebhooks);
        }
        if (data.quotas.maxCampaigns !== undefined) {
          updates.push('max_campaigns = ?');
          params.push(data.quotas.maxCampaigns);
        }
        if (data.quotas.maxStorageMb !== undefined) {
          updates.push('max_storage_mb = ?');
          params.push(data.quotas.maxStorageMb);
        }
        if (data.quotas.maxBots !== undefined) {
          updates.push('max_bots = ?');
          params.push(data.quotas.maxBots);
        }
        // Bot usage quotas
        if (data.quotas.maxBotCallsPerDay !== undefined) {
          updates.push('max_bot_calls_per_day = ?');
          params.push(data.quotas.maxBotCallsPerDay);
        }
        if (data.quotas.maxBotCallsPerMonth !== undefined) {
          updates.push('max_bot_calls_per_month = ?');
          params.push(data.quotas.maxBotCallsPerMonth);
        }
        if (data.quotas.maxBotMessagesPerDay !== undefined) {
          updates.push('max_bot_messages_per_day = ?');
          params.push(data.quotas.maxBotMessagesPerDay);
        }
        if (data.quotas.maxBotMessagesPerMonth !== undefined) {
          updates.push('max_bot_messages_per_month = ?');
          params.push(data.quotas.maxBotMessagesPerMonth);
        }
        if (data.quotas.maxBotTokensPerDay !== undefined) {
          updates.push('max_bot_tokens_per_day = ?');
          params.push(data.quotas.maxBotTokensPerDay);
        }
        if (data.quotas.maxBotTokensPerMonth !== undefined) {
          updates.push('max_bot_tokens_per_month = ?');
          params.push(data.quotas.maxBotTokensPerMonth);
        }
      }

      if (data.features !== undefined) {
        // Validate features before updating
        validatePlanFeatures(data.features);
        
        // Filter to only valid features and merge
        const filteredFeatures = filterValidFeatures(data.features);
        const mergedFeatures = { ...filterValidFeatures(plan.features), ...filteredFeatures };
        updates.push('features = ?');
        params.push(JSON.stringify(mergedFeatures));
      }

      if (updates.length === 0) {
        return plan;
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(planId);

      const sql = `UPDATE plans SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(sql, params);

      logger.info('Plan updated', { planId, effectiveDate });

      return this.getPlanById(planId);
    } catch (error) {
      logger.error('Failed to update plan', { error: error.message, planId });
      throw error;
    }
  }

  async deletePlan(planId, migrateToPlanId = null) {
    try {
      const subscriberCount = await this.getSubscriberCount(planId);
      
      if (subscriberCount > 0) {
        if (!migrateToPlanId) {
          throw new Error(`Cannot delete plan with ${subscriberCount} active subscribers. Provide migrateToPlanId.`);
        }
        
        await this.db.query(
          'UPDATE user_subscriptions SET plan_id = ?, updated_at = ? WHERE plan_id = ?',
          [migrateToPlanId, new Date().toISOString(), planId]
        );
        
        logger.info('Users migrated to new plan', { fromPlanId: planId, toPlanId: migrateToPlanId, count: subscriberCount });
      }

      await this.db.query('DELETE FROM plans WHERE id = ?', [planId]);

      logger.info('Plan deleted', { planId });
    } catch (error) {
      logger.error('Failed to delete plan', { error: error.message, planId });
      throw error;
    }
  }

  async getSubscriberCount(planId) {
    try {
      const { rows } = await this.db.query(
        "SELECT COUNT(*) as count FROM user_subscriptions WHERE plan_id = ? AND status IN ('trial', 'active')",
        [planId]
      );
      return rows?.[0]?.count || 0;
    } catch (error) {
      return 0;
    }
  }

  formatPlan(row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      billingCycle: row.billing_cycle,
      status: row.status,
      isDefault: row.is_default === 1,
      trialDays: row.trial_days,
      quotas: {
        maxAgents: row.max_agents,
        maxConnections: row.max_connections,
        maxMessagesPerDay: row.max_messages_per_day,
        maxMessagesPerMonth: row.max_messages_per_month,
        maxInboxes: row.max_inboxes,
        maxTeams: row.max_teams,
        maxWebhooks: row.max_webhooks,
        maxCampaigns: row.max_campaigns,
        maxStorageMb: row.max_storage_mb,
        maxBots: row.max_bots || 3,
        // Bot usage quotas
        maxBotCallsPerDay: row.max_bot_calls_per_day ?? DEFAULT_QUOTAS.maxBotCallsPerDay,
        maxBotCallsPerMonth: row.max_bot_calls_per_month ?? DEFAULT_QUOTAS.maxBotCallsPerMonth,
        maxBotMessagesPerDay: row.max_bot_messages_per_day ?? DEFAULT_QUOTAS.maxBotMessagesPerDay,
        maxBotMessagesPerMonth: row.max_bot_messages_per_month ?? DEFAULT_QUOTAS.maxBotMessagesPerMonth,
        maxBotTokensPerDay: row.max_bot_tokens_per_day ?? DEFAULT_QUOTAS.maxBotTokensPerDay,
        maxBotTokensPerMonth: row.max_bot_tokens_per_month ?? DEFAULT_QUOTAS.maxBotTokensPerMonth
      },
      features: this.parseJSON(row.features, DEFAULT_FEATURES),
      subscriberCount: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  parseJSON(jsonString, defaultValue = {}) {
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString || defaultValue;
    } catch {
      return defaultValue;
    }
  }
}

// Export constants and helpers
PlanService.DEFAULT_FEATURES = DEFAULT_FEATURES;
PlanService.VALID_USER_FEATURES = VALID_USER_FEATURES;
PlanService.validatePlanFeatures = validatePlanFeatures;
PlanService.filterValidFeatures = filterValidFeatures;

module.exports = PlanService;
