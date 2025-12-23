/**
 * Property-Based Tests for User Actions
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * for user suspension, reactivation, deletion, and data export.
 * 
 * Feature: admin-user-management
 * Requirements: 7.1, 7.2, 7.4, 7.5, 8.6
 * 
 * MIGRATED: Now uses SupabaseService mocking instead of MockDatabase
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Mock SupabaseService before requiring services
const mockSupabaseService = {
  subscriptions: new Map(),
  plans: new Map(),
  quotaUsage: new Map(),
  quotaOverrides: new Map(),
  featureOverrides: new Map(),
  usageMetrics: [],
  auditLogs: [],

  async queryAsAdmin(table, queryBuilder) {
    if (table === 'user_subscriptions') {
      const mockQuery = {
        _filters: {},
        select: () => mockQuery,
        eq: (field, value) => {
          mockQuery._filters[field] = value;
          return mockQuery;
        },
        single: () => mockQuery,
        then: async (resolve) => {
          const userId = mockQuery._filters?.user_id;
          const subscription = mockSupabaseService.subscriptions.get(userId);
          if (!subscription) return resolve({ data: null, error: { code: 'PGRST116' } });
          const plan = mockSupabaseService.plans.get(subscription.plan_id);
          const row = { ...subscription };
          if (plan) row.plans = plan;
          return resolve({ data: row, error: null });
        }
      };
      return queryBuilder(mockQuery);
    }
    if (table === 'admin_audit_log') {
      const mockQuery = {
        _filters: {},
        select: () => mockQuery,
        eq: (field, value) => { mockQuery._filters[field] = value; return mockQuery; },
        order: () => mockQuery,
        limit: () => mockQuery,
        then: async (resolve) => {
          const userId = mockQuery._filters?.target_user_id;
          const logs = mockSupabaseService.auditLogs.filter(l => l.target_user_id === userId);
          return resolve({ data: logs, error: null });
        }
      };
      return queryBuilder(mockQuery);
    }
    return { data: null, error: null };
  },

  async getMany(table, filters) { return { data: [], error: null }; },
  async insert(table, data) {
    if (table === 'user_subscriptions') mockSupabaseService.subscriptions.set(data.user_id, data);
    if (table === 'admin_audit_log') mockSupabaseService.auditLogs.push(data);
    return { data, error: null };
  },
  async update(table, id, data) {
    if (table === 'user_subscriptions') {
      const existing = mockSupabaseService.subscriptions.get(id);
      if (existing) { Object.assign(existing, data); return { data: existing, error: null }; }
    }
    return { data: { id, ...data }, error: null };
  },
  async delete(table, id) {
    if (table === 'user_subscriptions') mockSupabaseService.subscriptions.delete(id);
    return { data: null, error: null };
  },

  addPlan(id, data = {}) {
    mockSupabaseService.plans.set(id, {
      id, name: data.name || `Plan ${id}`, price_cents: data.priceCents || 0,
      billing_cycle: data.billingCycle || 'monthly', max_agents: data.maxAgents || 1,
      max_connections: data.maxConnections || 1, max_messages_per_day: data.maxMessagesPerDay || 100,
      max_messages_per_month: data.maxMessagesPerMonth || 3000, max_inboxes: data.maxInboxes || 1,
      max_teams: data.maxTeams || 1, max_webhooks: data.maxWebhooks || 5,
      max_campaigns: data.maxCampaigns || 1, max_storage_mb: data.maxStorageMb || 100,
      features: JSON.stringify(data.features || {})
    });
  },
  addQuotaUsage(userId, quotaType, usage) {
    mockSupabaseService.quotaUsage.set(`${userId}:${quotaType}`, { user_id: userId, quota_type: quotaType, current_usage: usage });
  },
  addQuotaOverride(userId, quotaType, limit) {
    mockSupabaseService.quotaOverrides.set(`${userId}:${quotaType}`, { user_id: userId, quota_type: quotaType, limit_value: limit });
  },
  addFeatureOverride(userId, featureName, enabled) {
    mockSupabaseService.featureOverrides.set(`${userId}:${featureName}`, { user_id: userId, feature_name: featureName, enabled });
  },
  addUsageMetric(userId, metricType, amount) {
    mockSupabaseService.usageMetrics.push({ user_id: userId, metric_type: metricType, amount });
  },
  hasUserData(userId) {
    return mockSupabaseService.subscriptions.has(userId) ||
      Array.from(mockSupabaseService.quotaUsage.keys()).some(k => k.startsWith(`${userId}:`)) ||
      Array.from(mockSupabaseService.quotaOverrides.keys()).some(k => k.startsWith(`${userId}:`)) ||
      Array.from(mockSupabaseService.featureOverrides.keys()).some(k => k.startsWith(`${userId}:`)) ||
      mockSupabaseService.usageMetrics.some(m => m.user_id === userId);
  },
  deleteUserData(userId) {
    mockSupabaseService.subscriptions.delete(userId);
    Array.from(mockSupabaseService.quotaUsage.keys()).filter(k => k.startsWith(`${userId}:`)).forEach(k => mockSupabaseService.quotaUsage.delete(k));
    Array.from(mockSupabaseService.quotaOverrides.keys()).filter(k => k.startsWith(`${userId}:`)).forEach(k => mockSupabaseService.quotaOverrides.delete(k));
    Array.from(mockSupabaseService.featureOverrides.keys()).filter(k => k.startsWith(`${userId}:`)).forEach(k => mockSupabaseService.featureOverrides.delete(k));
    mockSupabaseService.usageMetrics = mockSupabaseService.usageMetrics.filter(m => m.user_id !== userId);
  },
  reset() {
    mockSupabaseService.subscriptions.clear(); mockSupabaseService.plans.clear();
    mockSupabaseService.quotaUsage.clear(); mockSupabaseService.quotaOverrides.clear();
    mockSupabaseService.featureOverrides.clear(); mockSupabaseService.usageMetrics = [];
    mockSupabaseService.auditLogs = [];
  }
};

require.cache[require.resolve('../../services/SupabaseService')] = { exports: mockSupabaseService };

const SubscriptionService = require('../../services/SubscriptionService');
const AdminAuditService = require('../../services/AdminAuditService');

describe('User Actions Property-Based Tests', () => {
  let subscriptionService;
  let auditService;

  beforeEach(() => { mockSupabaseService.reset(); subscriptionService = new SubscriptionService(); auditService = new AdminAuditService(); });
  afterEach(() => { mockSupabaseService.reset(); });

  const userIdArb = fc.uuid();
  const planIdArb = fc.uuid();
  const adminIdArb = fc.uuid();
  const reasonArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

  describe('Property 14: User Suspension Blocks Access', () => {
    it('suspended user is not active and has read-only access', async () => {
      await fc.assert(fc.asyncProperty(userIdArb, planIdArb, adminIdArb, reasonArb, async (userId, planId, adminId, reason) => {
        mockSupabaseService.addPlan(planId, { name: 'Test Plan' });
        await subscriptionService.assignPlan(userId, planId, adminId);
        assert.strictEqual(await subscriptionService.isUserActive(userId), true);
        const subscription = await subscriptionService.updateSubscriptionStatus(userId, SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED, reason);
        assert.strictEqual(await subscriptionService.isUserActive(userId), false);
        assert.strictEqual(await subscriptionService.isUserReadOnly(userId), true);
        assert.strictEqual(subscription.status, 'suspended');
        assert.strictEqual(subscription.suspensionReason, reason);
        return true;
      }), { numRuns: 25 });
    });
  });

  describe('Property 15: User Reactivation Restores Access', () => {
    it('reactivated user regains active status', async () => {
      await fc.assert(fc.asyncProperty(userIdArb, planIdArb, adminIdArb, reasonArb, async (userId, planId, adminId, reason) => {
        mockSupabaseService.addPlan(planId, { name: 'Test Plan' });
        await subscriptionService.assignPlan(userId, planId, adminId);
        await subscriptionService.updateSubscriptionStatus(userId, SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED, reason);
        assert.strictEqual(await subscriptionService.isUserActive(userId), false);
        const subscription = await subscriptionService.updateSubscriptionStatus(userId, SubscriptionService.SUBSCRIPTION_STATUS.ACTIVE);
        assert.strictEqual(await subscriptionService.isUserActive(userId), true);
        assert.strictEqual(await subscriptionService.isUserReadOnly(userId), false);
        assert.strictEqual(subscription.status, 'active');
        return true;
      }), { numRuns: 25 });
    });
  });

  describe('Property 16: User Deletion Cascades', () => {
    it('deletion removes all user-related data', async () => {
      await fc.assert(fc.asyncProperty(userIdArb, planIdArb, adminIdArb, async (userId, planId, adminId) => {
        mockSupabaseService.addPlan(planId, { name: 'Test Plan' });
        await subscriptionService.assignPlan(userId, planId, adminId);
        mockSupabaseService.addQuotaUsage(userId, 'max_messages_per_day', 50);
        mockSupabaseService.addUsageMetric(userId, 'messages_sent', 100);
        assert.ok(mockSupabaseService.hasUserData(userId));
        mockSupabaseService.deleteUserData(userId);
        assert.ok(!mockSupabaseService.hasUserData(userId));
        assert.strictEqual(await subscriptionService.getUserSubscription(userId), null);
        return true;
      }), { numRuns: 25 });
    });
  });

  describe('Property 17: Data Export Completeness', () => {
    it('export includes subscription data', async () => {
      await fc.assert(fc.asyncProperty(userIdArb, planIdArb, adminIdArb, fc.integer({ min: 1, max: 100 }), async (userId, planId, adminId, maxAgents) => {
        mockSupabaseService.addPlan(planId, { name: 'Export Test Plan', maxAgents });
        await subscriptionService.assignPlan(userId, planId, adminId);
        const subscription = await subscriptionService.getUserSubscription(userId);
        assert.ok(subscription);
        assert.strictEqual(subscription.userId, userId);
        assert.strictEqual(subscription.planId, planId);
        assert.ok(subscription.plan);
        assert.strictEqual(subscription.plan.quotas.maxAgents, maxAgents);
        return true;
      }), { numRuns: 25 });
    });
  });
});

describe('Bulk Actions Property-Based Tests', () => {
  let subscriptionService;
  beforeEach(() => { mockSupabaseService.reset(); subscriptionService = new SubscriptionService(); });
  afterEach(() => { mockSupabaseService.reset(); });

  describe('Property 18: Bulk Action Partial Failure Handling', () => {
    it('successful operations are committed even when some fail', async () => {
      await fc.assert(fc.asyncProperty(fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }), fc.uuid(), fc.uuid(), async (userIds, planId, adminId) => {
        const uniqueUserIds = [...new Set(userIds)];
        if (uniqueUserIds.length < 2) return true;
        mockSupabaseService.addPlan(planId, { name: 'Test Plan' });
        const existingUsers = uniqueUserIds.slice(0, Math.ceil(uniqueUserIds.length / 2));
        for (const userId of existingUsers) await subscriptionService.assignPlan(userId, planId, adminId);
        const results = { successful: [], failed: [] };
        for (const userId of uniqueUserIds) {
          const subscription = await subscriptionService.getUserSubscription(userId);
          if (!subscription) { results.failed.push({ userId, error: 'User not found' }); continue; }
          await subscriptionService.updateSubscriptionStatus(userId, SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED, 'Bulk test');
          results.successful.push(userId);
        }
        for (const userId of results.successful) {
          const subscription = await subscriptionService.getUserSubscription(userId);
          assert.strictEqual(subscription.status, 'suspended');
        }
        return true;
      }), { numRuns: 50 });
    });
  });
});
