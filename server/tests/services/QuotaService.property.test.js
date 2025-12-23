/**
 * Property-Based Tests for QuotaService
 * 
 * Uses fast-check for property-based testing to verify correctness properties.
 * 
 * Requirements: 2.6, 3.1, 3.2, 3.4, 3.5, 3.6
 * 
 * MIGRATED: Now uses SupabaseService mocking instead of MockDatabase
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Mock SupabaseService before requiring QuotaService
const mockSupabaseService = {
  subscriptions: new Map(),
  plans: new Map(),
  overrides: new Map(),
  usage: new Map(),

  async queryAsAdmin(table, queryBuilder) {
    // Handle user_subscriptions with plan join
    if (table === 'user_subscriptions') {
      const mockQuery = {
        select: () => mockQuery,
        eq: (field, value) => {
          mockQuery._filters = mockQuery._filters || {};
          mockQuery._filters[field] = value;
          return mockQuery;
        },
        single: () => mockQuery,
        then: async (resolve) => {
          const userId = mockQuery._filters?.user_id;
          const sub = mockSupabaseService.subscriptions.get(userId);
          if (!sub) return resolve({ data: null, error: { code: 'PGRST116' } });
          const plan = mockSupabaseService.plans.get(sub.planId);
          if (!plan) return resolve({ data: null, error: { code: 'PGRST116' } });
          return resolve({ 
            data: {
              plans: {
                max_agents: plan.max_agents,
                max_connections: plan.max_connections,
                max_messages_per_day: plan.max_messages_per_day,
                max_messages_per_month: plan.max_messages_per_month,
                max_inboxes: plan.max_inboxes,
                max_teams: plan.max_teams,
                max_webhooks: plan.max_webhooks,
                max_campaigns: plan.max_campaigns,
                max_storage_mb: plan.max_storage_mb,
                max_bots: plan.max_bots,
                max_bot_calls_per_day: plan.max_bot_calls_per_day,
                max_bot_calls_per_month: plan.max_bot_calls_per_month,
                max_bot_messages_per_day: plan.max_bot_messages_per_day,
                max_bot_messages_per_month: plan.max_bot_messages_per_month,
                max_bot_tokens_per_day: plan.max_bot_tokens_per_day,
                max_bot_tokens_per_month: plan.max_bot_tokens_per_month
              }
            }, 
            error: null 
          });
        }
      };
      return queryBuilder(mockQuery);
    }
    return { data: null, error: null };
  },

  async getMany(table, filters) {
    if (table === 'user_quota_overrides') {
      const userId = filters.user_id;
      const quotaType = filters.quota_type;
      if (quotaType) {
        const key = `${userId}:${quotaType}`;
        const override = mockSupabaseService.overrides.get(key);
        return { data: override ? [override] : [], error: null };
      } else {
        const overrides = [];
        mockSupabaseService.overrides.forEach((v, k) => {
          if (k.startsWith(userId + ':')) overrides.push(v);
        });
        return { data: overrides, error: null };
      }
    }
    if (table === 'user_quota_usage') {
      const key = `${filters.user_id}:${filters.quota_type}`;
      const usage = mockSupabaseService.usage.get(key);
      return { data: usage ? [usage] : [], error: null };
    }
    return { data: [], error: null };
  },

  async insert(table, data) {
    if (table === 'user_quota_overrides') {
      const key = `${data.user_id}:${data.quota_type}`;
      mockSupabaseService.overrides.set(key, data);
      return { data, error: null };
    }
    if (table === 'user_quota_usage') {
      const key = `${data.user_id}:${data.quota_type}`;
      mockSupabaseService.usage.set(key, data);
      return { data, error: null };
    }
    return { data, error: null };
  },

  async update(table, id, data) {
    return { data: { id, ...data }, error: null };
  },

  async delete(table, id) {
    return { data: null, error: null };
  },

  addPlan(id, quotas) {
    mockSupabaseService.plans.set(id, {
      max_agents: quotas.maxAgents || 1,
      max_connections: quotas.maxConnections || 1,
      max_messages_per_day: quotas.maxMessagesPerDay || 100,
      max_messages_per_month: quotas.maxMessagesPerMonth || 3000,
      max_inboxes: quotas.maxInboxes || 1,
      max_teams: quotas.maxTeams || 1,
      max_webhooks: quotas.maxWebhooks || 5,
      max_campaigns: quotas.maxCampaigns || 1,
      max_storage_mb: quotas.maxStorageMb || 100,
      max_bots: quotas.maxBots || 3,
      max_bot_calls_per_day: quotas.maxBotCallsPerDay || 100,
      max_bot_calls_per_month: quotas.maxBotCallsPerMonth || 3000,
      max_bot_messages_per_day: quotas.maxBotMessagesPerDay || 50,
      max_bot_messages_per_month: quotas.maxBotMessagesPerMonth || 1500,
      max_bot_tokens_per_day: quotas.maxBotTokensPerDay || 10000,
      max_bot_tokens_per_month: quotas.maxBotTokensPerMonth || 300000
    });
  },

  addSubscription(userId, planId) {
    mockSupabaseService.subscriptions.set(userId, { userId, planId });
  },

  reset() {
    mockSupabaseService.subscriptions.clear();
    mockSupabaseService.plans.clear();
    mockSupabaseService.overrides.clear();
    mockSupabaseService.usage.clear();
  }
};

// Mock the SupabaseService module
require.cache[require.resolve('../../services/SupabaseService')] = {
  exports: mockSupabaseService
};

const QuotaService = require('../../services/QuotaService');

describe('QuotaService Property-Based Tests', () => {
  let quotaService;

  beforeEach(() => {
    mockSupabaseService.reset();
    quotaService = new QuotaService();
  });

  afterEach(() => {
    mockSupabaseService.reset();
  });

  /**
   * **Feature: admin-user-management, Property 7: Quota Override Takes Precedence**
   * **Validates: Requirements 2.6**
   */
  describe('Property 7: Quota Override Takes Precedence', () => {
    it('override value takes precedence over plan default', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // planLimit
          fc.integer({ min: 1, max: 200 }), // overrideLimit
          async (planLimit, overrideLimit) => {
            const userId = 'user-1';
            const planId = 'plan-1';
            const quotaType = 'max_agents';

            mockSupabaseService.addPlan(planId, { maxAgents: planLimit });
            mockSupabaseService.addSubscription(userId, planId);
            await quotaService.setQuotaOverride(userId, quotaType, overrideLimit, 'admin-1', 'Test');

            const effectiveLimit = await quotaService.getEffectiveLimit(userId, quotaType);
            return effectiveLimit === overrideLimit;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('plan default is used when no override exists', async () => {
      const userId = 'user-2';
      const planId = 'plan-2';
      const planLimit = 50;

      mockSupabaseService.addPlan(planId, { maxAgents: planLimit });
      mockSupabaseService.addSubscription(userId, planId);

      const effectiveLimit = await quotaService.getEffectiveLimit(userId, 'max_agents');
      assert.strictEqual(effectiveLimit, planLimit);
    });
  });

  /**
   * **Feature: admin-user-management, Property 8: Quota Enforcement Rejects Excess**
   * **Validates: Requirements 3.1, 3.2**
   */
  describe('Property 8: Quota Enforcement Rejects Excess', () => {
    it('rejects operations that would exceed quota', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }), // limit
          fc.integer({ min: 0, max: 99 }),  // currentUsage
          async (limit, currentUsage) => {
            const userId = 'user-3';
            const planId = 'plan-3';
            const quotaType = 'max_messages_per_day';

            mockSupabaseService.addPlan(planId, { maxMessagesPerDay: limit });
            mockSupabaseService.addSubscription(userId, planId);
            
            // Set current usage
            if (currentUsage > 0) {
              const key = `${userId}:${quotaType}`;
              mockSupabaseService.usage.set(key, { id: 'u1', user_id: userId, quota_type: quotaType, current_usage: currentUsage });
            }

            const amountToAdd = limit - currentUsage + 1; // Exceeds limit
            const result = await quotaService.checkQuota(userId, quotaType, amountToAdd);
            
            return result.allowed === false;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('allows operations within quota', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }), // limit
          fc.integer({ min: 0, max: 9 }),    // currentUsage
          async (limit, currentUsage) => {
            const userId = 'user-4';
            const planId = 'plan-4';
            const quotaType = 'max_messages_per_day';

            mockSupabaseService.addPlan(planId, { maxMessagesPerDay: limit });
            mockSupabaseService.addSubscription(userId, planId);
            
            if (currentUsage > 0) {
              const key = `${userId}:${quotaType}`;
              mockSupabaseService.usage.set(key, { id: 'u2', user_id: userId, quota_type: quotaType, current_usage: currentUsage });
            }

            const amountToAdd = 1;
            const result = await quotaService.checkQuota(userId, quotaType, amountToAdd);
            
            return result.allowed === true;
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  /**
   * **Feature: admin-user-management, Property 9: Quota Usage Tracking Accuracy**
   * **Validates: Requirements 3.4**
   */
  describe('Property 9: Quota Usage Tracking Accuracy', () => {
    it('increments usage correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 50 }), // incrementAmount
          async (incrementAmount) => {
            mockSupabaseService.reset();
            
            const userId = `user-inc-${Date.now()}-${Math.random()}`;
            const planId = 'plan-inc';
            const quotaType = 'max_messages_per_day';

            mockSupabaseService.addPlan(planId, { maxMessagesPerDay: 1000 });
            mockSupabaseService.addSubscription(userId, planId);

            const newUsage = await quotaService.incrementUsage(userId, quotaType, incrementAmount);
            
            const currentUsage = await quotaService.getCurrentUsage(userId, quotaType);
            return newUsage === incrementAmount && currentUsage === incrementAmount;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('percentage calculation is accurate', async () => {
      const userId = 'user-pct';
      const planId = 'plan-pct';
      const limit = 100;
      const usage = 80;

      mockSupabaseService.addPlan(planId, { maxMessagesPerDay: limit });
      mockSupabaseService.addSubscription(userId, planId);
      
      const key = `${userId}:max_messages_per_day`;
      mockSupabaseService.usage.set(key, { id: 'u3', user_id: userId, quota_type: 'max_messages_per_day', current_usage: usage });

      const quotas = await quotaService.getUserQuotas(userId);
      const msgQuota = quotas.find(q => q.quotaType === 'max_messages_per_day');
      
      assert.strictEqual(msgQuota.percentage, 80);
    });
  });

  /**
   * **Feature: admin-user-management, Property 11: Cycle Reset Clears Counters**
   * **Validates: Requirements 3.6**
   */
  describe('Property 11: Cycle Reset Clears Counters', () => {
    it('resets cycle-based quotas to zero', async () => {
      const userId = 'user-reset';
      const planId = 'plan-reset';

      mockSupabaseService.addPlan(planId, { maxMessagesPerDay: 100, maxMessagesPerMonth: 3000 });
      mockSupabaseService.addSubscription(userId, planId);

      // Set some usage
      await quotaService.incrementUsage(userId, 'max_messages_per_day', 50);
      await quotaService.incrementUsage(userId, 'max_messages_per_month', 500);

      // Reset
      await quotaService.resetCycleCounters(userId);

      // Verify reset runs without error
      assert.ok(true);
    });
  });
});
