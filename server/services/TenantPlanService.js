/**
 * TenantPlanService - Service for managing tenant-specific subscription plans
 * 
 * This service ensures all plan operations are scoped to a specific tenant,
 * preventing cross-tenant access to plan data.
 * 
 * Requirements: REQ-1 (Multi-Tenant Isolation Audit)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

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
  max_agents: 1,
  max_connections: 1,
  max_messages_per_day: 100,
  max_messages_per_month: 3000,
  max_inboxes: 1,
  max_teams: 1,
  max_webhooks: 5,
  max_campaigns: 1,
  max_storage_mb: 100,
  max_bots: 3,
  max_bot_calls_per_day: 100,
  max_bot_calls_per_month: 3000,
  max_bot_messages_per_day: 50,
  max_bot_messages_per_month: 1500,
  max_bot_tokens_per_day: 10000,
  max_bot_tokens_per_month: 300000
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

class TenantPlanService {
  /**
   * Create a new plan for a specific tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - Plan data
   * @returns {Promise<Object>} Created plan
   */
  async createPlan(tenantId, data) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

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
        max_agents: data.quotas?.maxAgents ?? DEFAULT_QUOTAS.max_agents,
        max_connections: data.quotas?.maxConnections ?? DEFAULT_QUOTAS.max_connections,
        max_messages_per_day: data.quotas?.maxMessagesPerDay ?? DEFAULT_QUOTAS.max_messages_per_day,
        max_messages_per_month: data.quotas?.maxMessagesPerMonth ?? DEFAULT_QUOTAS.max_messages_per_month,
        max_inboxes: data.quotas?.maxInboxes ?? DEFAULT_QUOTAS.max_inboxes,
        max_teams: data.quotas?.maxTeams ?? DEFAULT_QUOTAS.max_teams,
        max_webhooks: data.quotas?.maxWebhooks ?? DEFAULT_QUOTAS.max_webhooks,
        max_campaigns: data.quotas?.maxCampaigns ?? DEFAULT_QUOTAS.max_campaigns,
        max_storage_mb: data.quotas?.maxStorageMb ?? DEFAULT_QUOTAS.max_storage_mb,
        max_bots: data.quotas?.maxBots ?? DEFAULT_QUOTAS.max_bots,
        max_bot_calls_per_day: data.quotas?.maxBotCallsPerDay ?? DEFAULT_QUOTAS.max_bot_calls_per_day,
        max_bot_calls_per_month: data.quotas?.maxBotCallsPerMonth ?? DEFAULT_QUOTAS.max_bot_calls_per_month,
        max_bot_messages_per_day: data.quotas?.maxBotMessagesPerDay ?? DEFAULT_QUOTAS.max_bot_messages_per_day,
        max_bot_messages_per_month: data.quotas?.maxBotMessagesPerMonth ?? DEFAULT_QUOTAS.max_bot_messages_per_month,
        max_bot_tokens_per_day: data.quotas?.maxBotTokensPerDay ?? DEFAULT_QUOTAS.max_bot_tokens_per_day,
        max_bot_tokens_per_month: data.quotas?.maxBotTokensPerMonth ?? DEFAULT_QUOTAS.max_bot_tokens_per_month
      };

      // If this plan should be default, unset other defaults first
      if (data.isDefault) {
        await SupabaseService.adminClient
          .from('tenant_plans')
          .update({ is_default: false })
          .eq('tenant_id', tenantId)
          .eq('is_default', true);
      }

      const planData = {
        tenant_id: tenantId,
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

      const { data: plan, error } = await SupabaseService.adminClient
        .from('tenant_plans')
        .insert(planData)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A plan with this name already exists for this tenant');
        }
        throw error;
      }

      logger.info('Tenant plan created', { 
        tenantId, 
        planId: plan.id, 
        name: data.name 
      });

      return this.formatPlan(plan);
    } catch (error) {
      logger.error('Failed to create tenant plan', { 
        error: error.message, 
        tenantId,
        data: { name: data.name } 
      });
      throw error;
    }
  }

  /**
   * Get plan by ID with tenant validation
   * @param {string} planId - Plan UUID
   * @param {string} tenantId - Tenant UUID for validation
   * @returns {Promise<Object|null>} Plan or null if not found
   */
  async getPlanById(planId, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required for plan access');
      }

      const { data: plan, error } = await SupabaseService.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!plan) {
        return null;
      }

      // CRITICAL: Validate tenant ownership
      if (plan.tenant_id !== tenantId) {
        logger.warn('Cross-tenant plan access attempt blocked', {
          tenantId,
          planTenantId: plan.tenant_id,
          planId
        });
        return null; // Return null instead of throwing to avoid information leakage
      }

      const formatted = this.formatPlan(plan);
      formatted.subscriberCount = await this.getSubscriberCount(planId, tenantId);

      return formatted;
    } catch (error) {
      logger.error('Failed to get tenant plan', { 
        error: error.message, 
        planId,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Get plan by name within a tenant
   * @param {string} name - Plan name
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object|null>} Plan or null if not found
   */
  async getPlanByName(name, tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { data: plan, error } = await SupabaseService.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('name', name)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!plan) {
        return null;
      }

      const formatted = this.formatPlan(plan);
      formatted.subscriberCount = await this.getSubscriberCount(plan.id, tenantId);

      return formatted;
    } catch (error) {
      logger.error('Failed to get tenant plan by name', { 
        error: error.message, 
        name,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Get default plan for a tenant
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object|null>} Default plan or null
   */
  async getDefaultPlan(tenantId) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { data: plan, error } = await SupabaseService.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return plan ? this.formatPlan(plan) : null;
    } catch (error) {
      logger.error('Failed to get default tenant plan', { 
        error: error.message,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * List all plans for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<Object[]>} List of plans
   */
  async listPlans(tenantId, filters = {}) {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      let query = SupabaseService.adminClient
        .from('tenant_plans')
        .select('*')
        .eq('tenant_id', tenantId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      query = query
        .order('price_cents', { ascending: true })
        .order('name', { ascending: true });

      const { data: plans, error } = await query;

      if (error) {
        throw error;
      }

      const formattedPlans = [];
      for (const plan of (plans || [])) {
        const formatted = this.formatPlan(plan);
        formatted.subscriberCount = await this.getSubscriberCount(plan.id, tenantId);
        formattedPlans.push(formatted);
      }

      return formattedPlans;
    } catch (error) {
      logger.error('Failed to list tenant plans', { 
        error: error.message,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Update plan with tenant validation
   * @param {string} planId - Plan UUID
   * @param {string} tenantId - Tenant UUID for validation
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated plan
   */
  async updatePlan(planId, tenantId, data) {
    try {
      // Validate tenant access first
      const existingPlan = await this.getPlanById(planId, tenantId);
      if (!existingPlan) {
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
          // Clear other default plans for this tenant
          await SupabaseService.adminClient
            .from('tenant_plans')
            .update({ is_default: false })
            .eq('tenant_id', tenantId)
            .eq('is_default', true);
        }
        updates.is_default = data.isDefault;
      }

      if (data.trialDays !== undefined) {
        updates.trial_days = data.trialDays;
      }

      if (data.quotas) {
        // Merge with existing quotas
        const existingQuotas = existingPlan.quotas || {};
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
        updates.features = { ...filterValidFeatures(existingPlan.features), ...filteredFeatures };
      }

      if (Object.keys(updates).length === 0) {
        return existingPlan;
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedPlan, error } = await SupabaseService.adminClient
        .from('tenant_plans')
        .update(updates)
        .eq('id', planId)
        .eq('tenant_id', tenantId) // Double-check tenant ownership
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Tenant plan updated', { planId, tenantId });

      return this.formatPlan(updatedPlan);
    } catch (error) {
      logger.error('Failed to update tenant plan', { 
        error: error.message, 
        planId,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Delete plan with tenant validation
   * @param {string} planId - Plan UUID
   * @param {string} tenantId - Tenant UUID for validation
   * @param {string} [migrateToPlanId] - Plan to migrate subscribers to
   * @returns {Promise<void>}
   */
  async deletePlan(planId, tenantId, migrateToPlanId = null) {
    try {
      // Validate tenant access first
      const existingPlan = await this.getPlanById(planId, tenantId);
      if (!existingPlan) {
        throw new Error('Plan not found');
      }

      const subscriberCount = existingPlan.subscriberCount || 0;

      if (subscriberCount > 0) {
        if (!migrateToPlanId) {
          throw new Error(`Cannot delete plan with ${subscriberCount} active subscribers. Provide migrateToPlanId.`);
        }

        // Validate migration target belongs to same tenant
        const targetPlan = await this.getPlanById(migrateToPlanId, tenantId);
        if (!targetPlan) {
          throw new Error('Migration target plan not found or does not belong to this tenant');
        }

        // Migrate subscribers to new plan
        const { error: migrateError } = await SupabaseService.adminClient
          .from('user_subscriptions')
          .update({ 
            plan_id: migrateToPlanId, 
            updated_at: new Date().toISOString() 
          })
          .eq('plan_id', planId);

        if (migrateError) {
          throw migrateError;
        }

        logger.info('Users migrated to new plan', {
          fromPlanId: planId,
          toPlanId: migrateToPlanId,
          count: subscriberCount,
          tenantId
        });
      }

      const { error } = await SupabaseService.adminClient
        .from('tenant_plans')
        .delete()
        .eq('id', planId)
        .eq('tenant_id', tenantId); // Double-check tenant ownership

      if (error) {
        throw error;
      }

      logger.info('Tenant plan deleted', { planId, tenantId });
    } catch (error) {
      logger.error('Failed to delete tenant plan', { 
        error: error.message, 
        planId,
        tenantId 
      });
      throw error;
    }
  }

  /**
   * Get subscriber count for a plan within a tenant
   * @param {string} planId - Plan UUID
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<number>} Subscriber count
   */
  async getSubscriberCount(planId, tenantId) {
    try {
      // Count subscriptions for this plan where the account belongs to the tenant
      const { count, error } = await SupabaseService.adminClient
        .from('user_subscriptions')
        .select(`
          *,
          accounts!inner(tenant_id)
        `, { count: 'exact', head: true })
        .eq('plan_id', planId)
        .eq('accounts.tenant_id', tenantId)
        .in('status', ['trial', 'active']);

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
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      priceCents: row.price_cents,
      billingCycle: row.billing_cycle,
      status: row.status,
      isDefault: row.is_default,
      trialDays: row.trial_days,
      stripeProductId: row.stripe_product_id,
      stripePriceId: row.stripe_price_id,
      quotas: {
        maxAgents: quotas.max_agents ?? DEFAULT_QUOTAS.max_agents,
        maxConnections: quotas.max_connections ?? DEFAULT_QUOTAS.max_connections,
        maxMessagesPerDay: quotas.max_messages_per_day ?? DEFAULT_QUOTAS.max_messages_per_day,
        maxMessagesPerMonth: quotas.max_messages_per_month ?? DEFAULT_QUOTAS.max_messages_per_month,
        maxInboxes: quotas.max_inboxes ?? DEFAULT_QUOTAS.max_inboxes,
        maxTeams: quotas.max_teams ?? DEFAULT_QUOTAS.max_teams,
        maxWebhooks: quotas.max_webhooks ?? DEFAULT_QUOTAS.max_webhooks,
        maxCampaigns: quotas.max_campaigns ?? DEFAULT_QUOTAS.max_campaigns,
        maxStorageMb: quotas.max_storage_mb ?? DEFAULT_QUOTAS.max_storage_mb,
        maxBots: quotas.max_bots ?? DEFAULT_QUOTAS.max_bots,
        maxBotCallsPerDay: quotas.max_bot_calls_per_day ?? DEFAULT_QUOTAS.max_bot_calls_per_day,
        maxBotCallsPerMonth: quotas.max_bot_calls_per_month ?? DEFAULT_QUOTAS.max_bot_calls_per_month,
        maxBotMessagesPerDay: quotas.max_bot_messages_per_day ?? DEFAULT_QUOTAS.max_bot_messages_per_day,
        maxBotMessagesPerMonth: quotas.max_bot_messages_per_month ?? DEFAULT_QUOTAS.max_bot_messages_per_month,
        maxBotTokensPerDay: quotas.max_bot_tokens_per_day ?? DEFAULT_QUOTAS.max_bot_tokens_per_day,
        maxBotTokensPerMonth: quotas.max_bot_tokens_per_month ?? DEFAULT_QUOTAS.max_bot_tokens_per_month
      },
      features,
      subscriberCount: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Export constants and helpers
TenantPlanService.DEFAULT_FEATURES = DEFAULT_FEATURES;
TenantPlanService.DEFAULT_QUOTAS = DEFAULT_QUOTAS;
TenantPlanService.VALID_USER_FEATURES = VALID_USER_FEATURES;
TenantPlanService.validatePlanFeatures = validatePlanFeatures;
TenantPlanService.filterValidFeatures = filterValidFeatures;

module.exports = new TenantPlanService();
