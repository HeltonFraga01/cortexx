/**
 * PlanServiceSupabase - Service for managing subscription plans using Supabase
 * Task 12.5: Refactor PlanService.js to use SupabaseService
 * 
 * Handles CRUD operations for plans including creation, retrieval,
 * update, and deletion with subscriber count tracking.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.1, 6.2
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

// Valid user features for plans
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

// Default features for new plans
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
  maxBotCallsPerDay: 100,
  maxBotCallsPerMonth: 3000,
  maxBotMessagesPerDay: 50,
  maxBotMessagesPerMonth: 1500,
  maxBotTokensPerDay: 10000,
  maxBotTokensPerMonth: 300000
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

class PlanService {
  /**
   * Create a new plan
   * @param {Object} data - Plan data
   * @returns {Promise<Object>} Created plan
   */
  async createPlan(data) {
    try {
      // Validate features before creating plan
      if (data.features) {
        validatePlanFeatures(data.features);
      }

      // Merge with defaults, filtering to only valid features
      const features = {
        ...DEFAULT_FEATURES,
        ...filterValidFeatures(data.features || {})
      };

      // Build quotas object for JSONB column
      const quotas = {
        max_agents: data.quotas?.maxAgents ?? DEFAULT_QUOTAS.maxAgents,
        max_connections: data.quotas?.maxConnections ?? DEFAULT_QUOTAS.maxConnections,
        max_messages_per_day: data.quotas?.maxMessagesPerDay ?? DEFAULT_QUOTAS.maxMessagesPerDay,
        max_messages_per_month: data.quotas?.maxMessagesPerMonth ?? DEFAULT_QUOTAS.maxMessagesPerMonth,
        max_inboxes: data.quotas?.maxInboxes ?? DEFAULT_QUOTAS.maxInboxes,
        max_teams: data.quotas?.maxTeams ?? DEFAULT_QUOTAS.maxTeams,
        max_webhooks: data.quotas?.maxWebhooks ?? DEFAULT_QUOTAS.maxWebhooks,
        max_campaigns: data.quotas?.maxCampaigns ?? DEFAULT_QUOTAS.maxCampaigns,
        max_storage_mb: data.quotas?.maxStorageMb ?? DEFAULT_QUOTAS.maxStorageMb,
        max_bots: data.quotas?.maxBots ?? DEFAULT_QUOTAS.maxBots,
        max_bot_calls_per_day: data.quotas?.maxBotCallsPerDay ?? DEFAULT_QUOTAS.maxBotCallsPerDay,
        max_bot_calls_per_month: data.quotas?.maxBotCallsPerMonth ?? DEFAULT_QUOTAS.maxBotCallsPerMonth,
        max_bot_messages_per_day: data.quotas?.maxBotMessagesPerDay ?? DEFAULT_QUOTAS.maxBotMessagesPerDay,
        max_bot_messages_per_month: data.quotas?.maxBotMessagesPerMonth ?? DEFAULT_QUOTAS.maxBotMessagesPerMonth,
        max_bot_tokens_per_day: data.quotas?.maxBotTokensPerDay ?? DEFAULT_QUOTAS.maxBotTokensPerDay,
        max_bot_tokens_per_month: data.quotas?.maxBotTokensPerMonth ?? DEFAULT_QUOTAS.maxBotTokensPerMonth
      };

      const planData = {
        name: data.name,
        description: data.description || null,
        price_cents: data.priceCents || 0,
        billing_cycle: data.billingCycle || 'monthly',
        status: data.status || 'active',
        is_default: data.isDefault || false,
        trial_days: data.trialDays || 0,
        quotas,
        features
      };

      const { data: plan, error } = await supabaseService.insert('plans', planData);

      if (error) {
        throw error;
      }

      logger.info('Plan created', { planId: plan.id, name: data.name });

      return this.formatPlan(plan);
    } catch (error) {
      logger.error('Failed to create plan', { error: error.message, data: { name: data.name } });
      throw error;
    }
  }

  /**
   * Get plan by ID
   * @param {string} planId - Plan ID (UUID)
   * @returns {Promise<Object|null>} Plan or null if not found
   */
  async getPlanById(planId) {
    try {
      const { data: plan, error } = await supabaseService.getById('plans', planId);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      if (!plan) {
        return null;
      }

      const formatted = this.formatPlan(plan);
      formatted.subscriberCount = await this.getSubscriberCount(planId);

      return formatted;
    } catch (error) {
      logger.error('Failed to get plan', { error: error.message, planId });
      throw error;
    }
  }

  /**
   * Get plan by name
   * @param {string} name - Plan name
   * @returns {Promise<Object|null>} Plan or null if not found
   */
  async getPlanByName(name) {
    try {
      const { data: plans, error } = await supabaseService.getMany('plans', { name }, { limit: 1 });

      if (error) {
        throw error;
      }

      if (!plans || plans.length === 0) {
        return null;
      }

      const formatted = this.formatPlan(plans[0]);
      formatted.subscriberCount = await this.getSubscriberCount(formatted.id);

      return formatted;
    } catch (error) {
      logger.error('Failed to get plan by name', { error: error.message, name });
      throw error;
    }
  }

  /**
   * Get default plan
   * @returns {Promise<Object|null>} Default plan or null
   */
  async getDefaultPlan() {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('is_default', true)
        .eq('status', 'active')
        .limit(1)
        .single();

      const { data: plan, error } = await supabaseService.queryAsAdmin('plans', queryFn);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      return plan ? this.formatPlan(plan) : null;
    } catch (error) {
      logger.error('Failed to get default plan', { error: error.message });
      throw error;
    }
  }

  /**
   * List all plans
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Object[]>} List of plans
   */
  async listPlans(filters = {}) {
    try {
      const queryFn = (query) => {
        let q = query.select('*');

        if (filters.status) {
          q = q.eq('status', filters.status);
        }

        q = q.order('price_cents', { ascending: true });
        q = q.order('name', { ascending: true });

        return q;
      };

      const { data: plans, error } = await supabaseService.queryAsAdmin('plans', queryFn);

      if (error) {
        throw error;
      }

      const formattedPlans = [];
      for (const plan of (plans || [])) {
        const formatted = this.formatPlan(plan);
        formatted.subscriberCount = await this.getSubscriberCount(plan.id);
        formattedPlans.push(formatted);
      }

      return formattedPlans;
    } catch (error) {
      logger.error('Failed to list plans', { error: error.message });
      throw error;
    }
  }

  /**
   * Update plan
   * @param {string} planId - Plan ID (UUID)
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated plan
   */
  async updatePlan(planId, data) {
    try {
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plan not found');
      }

      const updates = {};

      if (data.name !== undefined) {
        updates.name = data.name;
      }

      if (data.description !== undefined) {
        updates.description = data.description;
      }

      if (data.priceCents !== undefined) {
        updates.price_cents = data.priceCents;
      }

      if (data.billingCycle !== undefined) {
        updates.billing_cycle = data.billingCycle;
      }

      if (data.status !== undefined) {
        updates.status = data.status;
      }

      if (data.isDefault !== undefined) {
        if (data.isDefault) {
          // Clear other default plans
          const clearQueryFn = (query) => query
            .update({ is_default: false })
            .eq('is_default', true);
          await supabaseService.queryAsAdmin('plans', clearQueryFn);
        }
        updates.is_default = data.isDefault;
      }

      if (data.trialDays !== undefined) {
        updates.trial_days = data.trialDays;
      }

      if (data.quotas) {
        // Merge with existing quotas
        const existingQuotas = plan.quotas || {};
        updates.quotas = {
          max_agents: data.quotas.maxAgents ?? existingQuotas.maxAgents,
          max_connections: data.quotas.maxConnections ?? existingQuotas.maxConnections,
          max_messages_per_day: data.quotas.maxMessagesPerDay ?? existingQuotas.maxMessagesPerDay,
          max_messages_per_month: data.quotas.maxMessagesPerMonth ?? existingQuotas.maxMessagesPerMonth,
          max_inboxes: data.quotas.maxInboxes ?? existingQuotas.maxInboxes,
          max_teams: data.quotas.maxTeams ?? existingQuotas.maxTeams,
          max_webhooks: data.quotas.maxWebhooks ?? existingQuotas.maxWebhooks,
          max_campaigns: data.quotas.maxCampaigns ?? existingQuotas.maxCampaigns,
          max_storage_mb: data.quotas.maxStorageMb ?? existingQuotas.maxStorageMb,
          max_bots: data.quotas.maxBots ?? existingQuotas.maxBots,
          max_bot_calls_per_day: data.quotas.maxBotCallsPerDay ?? existingQuotas.maxBotCallsPerDay,
          max_bot_calls_per_month: data.quotas.maxBotCallsPerMonth ?? existingQuotas.maxBotCallsPerMonth,
          max_bot_messages_per_day: data.quotas.maxBotMessagesPerDay ?? existingQuotas.maxBotMessagesPerDay,
          max_bot_messages_per_month: data.quotas.maxBotMessagesPerMonth ?? existingQuotas.maxBotMessagesPerMonth,
          max_bot_tokens_per_day: data.quotas.maxBotTokensPerDay ?? existingQuotas.maxBotTokensPerDay,
          max_bot_tokens_per_month: data.quotas.maxBotTokensPerMonth ?? existingQuotas.maxBotTokensPerMonth
        };
      }

      if (data.features !== undefined) {
        validatePlanFeatures(data.features);
        const filteredFeatures = filterValidFeatures(data.features);
        updates.features = { ...filterValidFeatures(plan.features), ...filteredFeatures };
      }

      if (Object.keys(updates).length === 0) {
        return plan;
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedPlan, error } = await supabaseService.update('plans', planId, updates);

      if (error) {
        throw error;
      }

      logger.info('Plan updated', { planId });

      return this.formatPlan(updatedPlan);
    } catch (error) {
      logger.error('Failed to update plan', { error: error.message, planId });
      throw error;
    }
  }

  /**
   * Delete plan
   * @param {string} planId - Plan ID (UUID)
   * @param {string} [migrateToPlanId] - Plan to migrate subscribers to
   * @returns {Promise<void>}
   */
  async deletePlan(planId, migrateToPlanId = null) {
    try {
      const subscriberCount = await this.getSubscriberCount(planId);

      if (subscriberCount > 0) {
        if (!migrateToPlanId) {
          throw new Error(`Cannot delete plan with ${subscriberCount} active subscribers. Provide migrateToPlanId.`);
        }

        // Migrate subscribers to new plan
        const migrateQueryFn = (query) => query
          .update({ plan_id: migrateToPlanId, updated_at: new Date().toISOString() })
          .eq('plan_id', planId);

        await supabaseService.queryAsAdmin('user_subscriptions', migrateQueryFn);

        logger.info('Users migrated to new plan', {
          fromPlanId: planId,
          toPlanId: migrateToPlanId,
          count: subscriberCount
        });
      }

      const { error } = await supabaseService.delete('plans', planId);

      if (error) {
        throw error;
      }

      logger.info('Plan deleted', { planId });
    } catch (error) {
      logger.error('Failed to delete plan', { error: error.message, planId });
      throw error;
    }
  }

  /**
   * Get subscriber count for a plan
   * @param {string} planId - Plan ID (UUID)
   * @returns {Promise<number>} Subscriber count
   */
  async getSubscriberCount(planId) {
    try {
      const queryFn = (query) => query
        .select('*', { count: 'exact', head: true })
        .eq('plan_id', planId)
        .in('status', ['trial', 'active']);

      const { count, error } = await supabaseService.queryAsAdmin('user_subscriptions', queryFn);

      if (error) {
        return 0;
      }

      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format plan from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted plan
   */
  formatPlan(row) {
    const quotas = row.quotas || {};
    const features = row.features || DEFAULT_FEATURES;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      billingCycle: row.billing_cycle,
      status: row.status,
      isDefault: row.is_default,
      trialDays: row.trial_days,
      quotas: {
        maxAgents: quotas.max_agents ?? DEFAULT_QUOTAS.maxAgents,
        maxConnections: quotas.max_connections ?? DEFAULT_QUOTAS.maxConnections,
        maxMessagesPerDay: quotas.max_messages_per_day ?? DEFAULT_QUOTAS.maxMessagesPerDay,
        maxMessagesPerMonth: quotas.max_messages_per_month ?? DEFAULT_QUOTAS.maxMessagesPerMonth,
        maxInboxes: quotas.max_inboxes ?? DEFAULT_QUOTAS.maxInboxes,
        maxTeams: quotas.max_teams ?? DEFAULT_QUOTAS.maxTeams,
        maxWebhooks: quotas.max_webhooks ?? DEFAULT_QUOTAS.maxWebhooks,
        maxCampaigns: quotas.max_campaigns ?? DEFAULT_QUOTAS.maxCampaigns,
        maxStorageMb: quotas.max_storage_mb ?? DEFAULT_QUOTAS.maxStorageMb,
        maxBots: quotas.max_bots ?? DEFAULT_QUOTAS.maxBots,
        maxBotCallsPerDay: quotas.max_bot_calls_per_day ?? DEFAULT_QUOTAS.maxBotCallsPerDay,
        maxBotCallsPerMonth: quotas.max_bot_calls_per_month ?? DEFAULT_QUOTAS.maxBotCallsPerMonth,
        maxBotMessagesPerDay: quotas.max_bot_messages_per_day ?? DEFAULT_QUOTAS.maxBotMessagesPerDay,
        maxBotMessagesPerMonth: quotas.max_bot_messages_per_month ?? DEFAULT_QUOTAS.maxBotMessagesPerMonth,
        maxBotTokensPerDay: quotas.max_bot_tokens_per_day ?? DEFAULT_QUOTAS.maxBotTokensPerDay,
        maxBotTokensPerMonth: quotas.max_bot_tokens_per_month ?? DEFAULT_QUOTAS.maxBotTokensPerMonth
      },
      features,
      subscriberCount: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export constants and helpers
PlanService.DEFAULT_FEATURES = DEFAULT_FEATURES;
PlanService.DEFAULT_QUOTAS = DEFAULT_QUOTAS;
PlanService.VALID_USER_FEATURES = VALID_USER_FEATURES;
PlanService.validatePlanFeatures = validatePlanFeatures;
PlanService.filterValidFeatures = filterValidFeatures;

module.exports = PlanService;
