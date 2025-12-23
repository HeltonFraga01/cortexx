/**
 * Property-Based Tests for SubscriptionService
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * that should hold across all valid inputs.
 * 
 * Requirements: 2.1, 2.5
 * 
 * MIGRATED: Now uses SupabaseService mocking instead of MockDatabase
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Mock SupabaseService before requiring SubscriptionService
const mockSupabaseService = {
  subscriptions: new Map(),
  plans: new Map(),

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
          if (plan) {
            row.plans = plan;
          }
          return resolve({ data: row, error: null });
        }
      };
      return queryBuilder(mockQuery);
    }
    return { data: null, error: null };
  },

  async getMany(table, filters) {
    return { data: [], error: null };
  },

  async insert(table, data) {
    if (table === 'user_subscriptions') {
      mockSupabaseService.subscriptions.set(data.user_id, data);
    }
    return { data, error: null };
  },

  async update(table, id, data) {
    if (table === 'user_subscriptions') {
      // Find subscription by user_id (id is actually user_id in this context)
      const existing = mockSupabaseService.subscriptions.get(id);
      if (existing) {
        Object.assign(existing, data);
        return { data: existing, error: null };
      }
    }
    return { data: { id, ...data }, error: null };
  },

  async delete(table, id) {
    return { data: null, error: null };
  },

  addPlan(id, data = {}) {
    mockSupabaseService.plans.set(id, {
      id,
      name: data.name || `Plan ${id}`,
      price_cents: data.priceCents || 0,
      billing_cycle: data.billingCycle || 'monthly',
      max_agents: data.maxAgents || 1,
      max_connections: data.maxConnections || 1,
      max_messages_per_day: data.maxMessagesPerDay || 100,
      max_messages_per_month: data.maxMessagesPerMonth || 3000,
      max_inboxes: data.maxInboxes || 1,
      max_teams: data.maxTeams || 1,
      max_webhooks: data.maxWebhooks || 5,
      max_campaigns: data.maxCampaigns || 1,
      max_storage_mb: data.maxStorageMb || 100,
      features: JSON.stringify(data.features || {})
    });
  },

  reset() {
    mockSupabaseService.subscriptions.clear();
    mockSupabaseService.plans.clear();
  }
};

// Mock the SupabaseService module
require.cache[require.resolve('../../services/SupabaseService')] = {
  exports: mockSupabaseService
};

const SubscriptionService = require('../../services/SubscriptionService');

describe('SubscriptionService Property-Based Tests', () => {
  let subscriptionService;

  beforeEach(() => {
    mockSupabaseService.reset();
    subscriptionService = new SubscriptionService();
  });

  afterEach(() => {
    mockSupabaseService.reset();
  });

  // Arbitraries
  const userIdArb = fc.uuid();
  const planIdArb = fc.uuid();
  const adminIdArb = fc.uuid();

  /**
   * **Feature: admin-user-management, Property 5: Plan Assignment Updates User Quotas**
   * **Validates: Requirements 2.1**
   */
  describe('Property 5: Plan Assignment Updates User Quotas', () => {
    it('assigns plan and reflects plan quotas in subscription', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          fc.integer({ min: 1, max: 100 }), // maxAgents
          fc.integer({ min: 1, max: 50 }),  // maxConnections
          fc.integer({ min: 100, max: 10000 }), // maxMessagesPerMonth
          async (userId, planId, adminId, maxAgents, maxConnections, maxMessagesPerMonth) => {
            // Setup: Create a plan with specific quotas
            mockSupabaseService.addPlan(planId, {
              name: `Test Plan ${planId}`,
              priceCents: 1000,
              maxAgents,
              maxConnections,
              maxMessagesPerMonth
            });

            // Act: Assign plan to user
            const subscription = await subscriptionService.assignPlan(userId, planId, adminId);

            // Assert: Subscription reflects plan quotas
            assert.strictEqual(subscription.planId, planId, 'Plan ID should match');
            assert.strictEqual(subscription.status, 'active', 'Status should be active');
            assert.ok(subscription.plan, 'Plan details should be included');
            assert.strictEqual(subscription.plan.quotas.maxAgents, maxAgents, 'maxAgents should match');
            assert.strictEqual(subscription.plan.quotas.maxConnections, maxConnections, 'maxConnections should match');
            assert.strictEqual(subscription.plan.quotas.maxMessagesPerMonth, maxMessagesPerMonth, 'maxMessagesPerMonth should match');

            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('updates existing subscription when reassigning plan', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          fc.uuid(), // newPlanId
          adminIdArb,
          async (userId, oldPlanId, newPlanId, adminId) => {
            // Setup: Create two plans
            mockSupabaseService.addPlan(oldPlanId, { name: 'Old Plan', priceCents: 500, maxAgents: 1 });
            mockSupabaseService.addPlan(newPlanId, { name: 'New Plan', priceCents: 1000, maxAgents: 5 });

            // Assign initial plan
            await subscriptionService.assignPlan(userId, oldPlanId, adminId);

            // Act: Reassign to new plan
            const subscription = await subscriptionService.assignPlan(userId, newPlanId, adminId);

            // Assert: Subscription now reflects new plan
            assert.strictEqual(subscription.planId, newPlanId, 'Plan ID should be updated');
            assert.strictEqual(subscription.plan.quotas.maxAgents, 5, 'Quotas should reflect new plan');

            return true;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('sets subscription to active status on plan assignment', async () => {
      const userId = 'test-user-1';
      const planId = 'test-plan-1';
      const adminId = 'admin-1';

      mockSupabaseService.addPlan(planId, { name: 'Test Plan' });

      const subscription = await subscriptionService.assignPlan(userId, planId, adminId);

      assert.strictEqual(subscription.status, 'active', 'Status should be active');
      assert.ok(subscription.startedAt, 'startedAt should be set');
      assert.ok(subscription.currentPeriodStart, 'currentPeriodStart should be set');
      assert.ok(subscription.currentPeriodEnd, 'currentPeriodEnd should be set');
    });
  });

  /**
   * **Feature: admin-user-management, Property 6: Subscription Status Restricts Access**
   * **Validates: Requirements 2.5**
   */
  describe('Property 6: Subscription Status Restricts Access', () => {
    it('isUserActive returns true only for active and trial statuses', async () => {
      const activeStatuses = ['trial', 'active'];
      const inactiveStatuses = ['past_due', 'canceled', 'expired', 'suspended'];

      for (const status of activeStatuses) {
        const userId = `user-${status}`;
        const planId = `plan-${status}`;
        
        mockSupabaseService.addPlan(planId, { name: `Plan ${status}` });
        await subscriptionService.assignPlan(userId, planId, 'admin');
        await subscriptionService.updateSubscriptionStatus(userId, status);

        const isActive = await subscriptionService.isUserActive(userId);
        assert.strictEqual(isActive, true, `Status ${status} should be active`);
      }

      for (const status of inactiveStatuses) {
        const userId = `user-${status}`;
        const planId = `plan-${status}`;
        
        mockSupabaseService.addPlan(planId, { name: `Plan ${status}` });
        await subscriptionService.assignPlan(userId, planId, 'admin');
        await subscriptionService.updateSubscriptionStatus(userId, status);

        const isActive = await subscriptionService.isUserActive(userId);
        assert.strictEqual(isActive, false, `Status ${status} should not be active`);
      }
    });

    it('isUserReadOnly returns true only for expired and suspended statuses', async () => {
      const readOnlyStatuses = ['expired', 'suspended'];
      const notReadOnlyStatuses = ['trial', 'active', 'past_due', 'canceled'];

      for (const status of readOnlyStatuses) {
        const userId = `user-ro-${status}`;
        const planId = `plan-ro-${status}`;
        
        mockSupabaseService.addPlan(planId, { name: `Plan ${status}` });
        await subscriptionService.assignPlan(userId, planId, 'admin');
        await subscriptionService.updateSubscriptionStatus(userId, status);

        const isReadOnly = await subscriptionService.isUserReadOnly(userId);
        assert.strictEqual(isReadOnly, true, `Status ${status} should be read-only`);
      }

      for (const status of notReadOnlyStatuses) {
        const userId = `user-nro-${status}`;
        const planId = `plan-nro-${status}`;
        
        mockSupabaseService.addPlan(planId, { name: `Plan ${status}` });
        await subscriptionService.assignPlan(userId, planId, 'admin');
        await subscriptionService.updateSubscriptionStatus(userId, status);

        const isReadOnly = await subscriptionService.isUserReadOnly(userId);
        assert.strictEqual(isReadOnly, false, `Status ${status} should not be read-only`);
      }
    });

    it('status transitions are properly recorded', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          fc.constantFrom('trial', 'active', 'past_due', 'canceled', 'expired', 'suspended'),
          async (userId, planId, targetStatus) => {
            mockSupabaseService.addPlan(planId, { name: 'Test Plan' });
            await subscriptionService.assignPlan(userId, planId, 'admin');

            // Update status
            const subscription = await subscriptionService.updateSubscriptionStatus(userId, targetStatus);

            // Verify status was updated
            assert.strictEqual(subscription.status, targetStatus, 'Status should be updated');

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('suspension reason is recorded when suspending', async () => {
      const userId = 'suspend-test-user';
      const planId = 'suspend-test-plan';
      const reason = 'Payment failed';

      mockSupabaseService.addPlan(planId, { name: 'Test Plan' });
      await subscriptionService.assignPlan(userId, planId, 'admin');

      const subscription = await subscriptionService.updateSubscriptionStatus(userId, 'suspended', reason);

      assert.strictEqual(subscription.status, 'suspended', 'Status should be suspended');
      assert.strictEqual(subscription.suspensionReason, reason, 'Suspension reason should be recorded');
    });

    it('canceled_at is set when canceling', async () => {
      const userId = 'cancel-test-user';
      const planId = 'cancel-test-plan';

      mockSupabaseService.addPlan(planId, { name: 'Test Plan' });
      await subscriptionService.assignPlan(userId, planId, 'admin');

      const subscription = await subscriptionService.updateSubscriptionStatus(userId, 'canceled');

      assert.strictEqual(subscription.status, 'canceled', 'Status should be canceled');
      assert.ok(subscription.canceledAt, 'canceledAt should be set');
    });
  });
});
