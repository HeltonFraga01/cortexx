/**
 * Property-Based Tests for SubscriptionService
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * that should hold across all valid inputs.
 * 
 * Requirements: 2.1, 2.5
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const SubscriptionService = require('../../services/SubscriptionService');

// In-memory database mock for testing
class MockDatabase {
  constructor() {
    this.subscriptions = new Map();
    this.plans = new Map();
  }

  async query(sql, params = []) {
    const sqlUpper = sql.trim().toUpperCase();

    // Handle INSERT subscription
    if (sqlUpper.startsWith('INSERT INTO USER_SUBSCRIPTIONS')) {
      const subscription = {
        id: params[0],
        user_id: params[1],
        plan_id: params[2],
        status: params[3],
        started_at: params[4],
        current_period_start: params[5],
        current_period_end: params[6],
        created_at: params[7],
        updated_at: params[8],
        trial_ends_at: null,
        canceled_at: null,
        suspension_reason: null
      };
      this.subscriptions.set(subscription.user_id, subscription);
      return { rows: [] };
    }

    // Handle SELECT subscription with plan join
    if (sql.includes('FROM user_subscriptions s') && sql.includes('LEFT JOIN plans p')) {
      const userId = params[0];
      const subscription = this.subscriptions.get(userId);
      if (!subscription) return { rows: [] };
      
      const plan = this.plans.get(subscription.plan_id);
      const row = { ...subscription };
      if (plan) {
        row.plan_name = plan.name;
        row.price_cents = plan.price_cents;
        row.billing_cycle = plan.billing_cycle;
        row.max_agents = plan.max_agents;
        row.max_connections = plan.max_connections;
        row.max_messages_per_day = plan.max_messages_per_day;
        row.max_messages_per_month = plan.max_messages_per_month;
        row.max_inboxes = plan.max_inboxes;
        row.max_teams = plan.max_teams;
        row.max_webhooks = plan.max_webhooks;
        row.max_campaigns = plan.max_campaigns;
        row.max_storage_mb = plan.max_storage_mb;
        row.features = plan.features;
      }
      return { rows: [row] };
    }

    // Handle UPDATE subscription
    if (sqlUpper.startsWith('UPDATE USER_SUBSCRIPTIONS')) {
      if (sql.includes('plan_id = ?')) {
        // Plan assignment update
        const planId = params[0];
        const status = params[1];
        const userId = params[params.length - 1];
        const subscription = this.subscriptions.get(userId);
        if (subscription) {
          subscription.plan_id = planId;
          subscription.status = status;
          subscription.updated_at = params[2];
        }
      } else if (sql.includes('status = ?')) {
        // Status update
        const status = params[0];
        const userId = params[params.length - 1];
        const subscription = this.subscriptions.get(userId);
        if (subscription) {
          subscription.status = status;
          subscription.updated_at = params[1];
          if (sql.includes('canceled_at')) {
            subscription.canceled_at = params[2];
          }
          if (sql.includes('suspension_reason')) {
            const reasonIndex = sql.includes('canceled_at') ? 3 : 2;
            subscription.suspension_reason = params[reasonIndex];
          }
        }
      } else if (sql.includes('current_period_start')) {
        // Billing cycle update
        const userId = params[params.length - 1];
        const subscription = this.subscriptions.get(userId);
        if (subscription) {
          subscription.current_period_start = params[0];
          subscription.current_period_end = params[1];
          subscription.updated_at = params[2];
        }
      }
      return { rows: [] };
    }

    // Handle SELECT plan price
    if (sql.includes('SELECT price_cents FROM plans')) {
      const planId = params[0];
      const plan = this.plans.get(planId);
      return { rows: plan ? [{ price_cents: plan.price_cents }] : [] };
    }

    return { rows: [] };
  }

  // Helper to add test plans
  addPlan(id, data = {}) {
    this.plans.set(id, {
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
  }

  reset() {
    this.subscriptions.clear();
    this.plans.clear();
  }
}


describe('SubscriptionService Property-Based Tests', () => {
  let db;
  let subscriptionService;

  beforeEach(() => {
    db = new MockDatabase();
    subscriptionService = new SubscriptionService(db);
  });

  afterEach(() => {
    db.reset();
  });

  // Arbitraries
  const userIdArb = fc.uuid();
  const planIdArb = fc.uuid();
  const adminIdArb = fc.uuid();

  /**
   * **Feature: admin-user-management, Property 5: Plan Assignment Updates User Quotas**
   * **Validates: Requirements 2.1**
   * 
   * For any plan assignment to a user, the user's effective quotas and features
   * SHALL immediately reflect the new plan's values (unless overridden).
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
            db.addPlan(planId, {
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
            db.addPlan(oldPlanId, { name: 'Old Plan', priceCents: 500, maxAgents: 1 });
            db.addPlan(newPlanId, { name: 'New Plan', priceCents: 1000, maxAgents: 5 });

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

      db.addPlan(planId, { name: 'Test Plan' });

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
   * 
   * For any user with subscription status 'expired' or 'suspended', write operations
   * SHALL be rejected while read operations remain available.
   */
  describe('Property 6: Subscription Status Restricts Access', () => {
    it('isUserActive returns true only for active and trial statuses', async () => {
      const activeStatuses = ['trial', 'active'];
      const inactiveStatuses = ['past_due', 'canceled', 'expired', 'suspended'];

      for (const status of activeStatuses) {
        const userId = `user-${status}`;
        const planId = `plan-${status}`;
        
        db.addPlan(planId, { name: `Plan ${status}` });
        await subscriptionService.assignPlan(userId, planId, 'admin');
        await subscriptionService.updateSubscriptionStatus(userId, status);

        const isActive = await subscriptionService.isUserActive(userId);
        assert.strictEqual(isActive, true, `Status ${status} should be active`);
      }

      for (const status of inactiveStatuses) {
        const userId = `user-${status}`;
        const planId = `plan-${status}`;
        
        db.addPlan(planId, { name: `Plan ${status}` });
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
        
        db.addPlan(planId, { name: `Plan ${status}` });
        await subscriptionService.assignPlan(userId, planId, 'admin');
        await subscriptionService.updateSubscriptionStatus(userId, status);

        const isReadOnly = await subscriptionService.isUserReadOnly(userId);
        assert.strictEqual(isReadOnly, true, `Status ${status} should be read-only`);
      }

      for (const status of notReadOnlyStatuses) {
        const userId = `user-nro-${status}`;
        const planId = `plan-nro-${status}`;
        
        db.addPlan(planId, { name: `Plan ${status}` });
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
            db.addPlan(planId, { name: 'Test Plan' });
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

      db.addPlan(planId, { name: 'Test Plan' });
      await subscriptionService.assignPlan(userId, planId, 'admin');

      const subscription = await subscriptionService.updateSubscriptionStatus(userId, 'suspended', reason);

      assert.strictEqual(subscription.status, 'suspended', 'Status should be suspended');
      assert.strictEqual(subscription.suspensionReason, reason, 'Suspension reason should be recorded');
    });

    it('canceled_at is set when canceling', async () => {
      const userId = 'cancel-test-user';
      const planId = 'cancel-test-plan';

      db.addPlan(planId, { name: 'Test Plan' });
      await subscriptionService.assignPlan(userId, planId, 'admin');

      const subscription = await subscriptionService.updateSubscriptionStatus(userId, 'canceled');

      assert.strictEqual(subscription.status, 'canceled', 'Status should be canceled');
      assert.ok(subscription.canceledAt, 'canceledAt should be set');
    });
  });
});
