/**
 * Property-Based Tests for PlanService
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * that should hold across all valid inputs.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const PlanService = require('../../services/PlanService');

// In-memory database mock for testing
class MockDatabase {
  constructor() {
    this.plans = new Map();
    this.subscriptions = new Map();
  }

  async query(sql, params = []) {
    // Handle INSERT
    if (sql.trim().toUpperCase().startsWith('INSERT INTO PLANS')) {
      const plan = {
        id: params[0],
        name: params[1],
        description: params[2],
        price_cents: params[3],
        billing_cycle: params[4],
        status: params[5],
        is_default: params[6],
        trial_days: params[7],
        max_agents: params[8],
        max_connections: params[9],
        max_messages_per_day: params[10],
        max_messages_per_month: params[11],
        max_inboxes: params[12],
        max_teams: params[13],
        max_webhooks: params[14],
        max_campaigns: params[15],
        max_storage_mb: params[16],
        features: params[17],
        created_at: params[18],
        updated_at: params[19]
      };
      this.plans.set(plan.id, plan);
      return { rows: [] };
    }

    // Handle SELECT by ID
    if (sql.includes('SELECT * FROM plans WHERE id = ?')) {
      const plan = this.plans.get(params[0]);
      return { rows: plan ? [plan] : [] };
    }

    // Handle SELECT by name
    if (sql.includes('SELECT * FROM plans WHERE name = ?')) {
      const plan = Array.from(this.plans.values()).find(p => p.name === params[0]);
      return { rows: plan ? [plan] : [] };
    }

    // Handle SELECT all plans
    if (sql.includes('SELECT * FROM plans')) {
      let plans = Array.from(this.plans.values());
      
      // Apply status filter if present
      if (sql.includes('status = ?')) {
        plans = plans.filter(p => p.status === params[0]);
      }
      
      return { rows: plans };
    }

    // Handle subscriber count
    if (sql.includes('SELECT COUNT(*) as count FROM user_subscriptions')) {
      const planId = params[0];
      const count = Array.from(this.subscriptions.values())
        .filter(s => s.plan_id === planId && ['trial', 'active'].includes(s.status))
        .length;
      return { rows: [{ count }] };
    }

    // Handle UPDATE plans
    if (sql.trim().toUpperCase().startsWith('UPDATE PLANS SET')) {
      // Handle is_default reset
      if (sql.includes('is_default = 0') && !sql.includes('WHERE')) {
        this.plans.forEach(plan => { plan.is_default = 0; });
        return { rows: [] };
      }
      
      // Handle specific plan update
      const planId = params[params.length - 1];
      const plan = this.plans.get(planId);
      if (plan) {
        // Parse the SET clause to update fields
        // This is simplified - in real tests we'd parse more carefully
        this.plans.set(planId, { ...plan, updated_at: new Date().toISOString() });
      }
      return { rows: [] };
    }

    // Handle DELETE
    if (sql.trim().toUpperCase().startsWith('DELETE FROM PLANS')) {
      const planId = params[0];
      this.plans.delete(planId);
      return { rows: [] };
    }

    // Handle subscription migration
    if (sql.includes('UPDATE user_subscriptions SET plan_id')) {
      const newPlanId = params[0];
      const oldPlanId = params[2];
      this.subscriptions.forEach((sub, id) => {
        if (sub.plan_id === oldPlanId) {
          sub.plan_id = newPlanId;
        }
      });
      return { rows: [] };
    }

    return { rows: [] };
  }

  // Helper to add test subscriptions
  addSubscription(id, planId, status = 'active') {
    this.subscriptions.set(id, { id, plan_id: planId, status });
  }

  reset() {
    this.plans.clear();
    this.subscriptions.clear();
  }
}

describe('PlanService Property-Based Tests', () => {
  let db;
  let planService;

  beforeEach(() => {
    db = new MockDatabase();
    planService = new PlanService(db);
  });

  afterEach(() => {
    db.reset();
  });

  // Arbitraries for generating valid plan data
  const planNameArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim().replace(/['"]/g, ''));

  const planDescriptionArb = fc.option(
    fc.string({ minLength: 0, maxLength: 200 }),
    { nil: null }
  );

  const priceCentsArb = fc.integer({ min: 0, max: 1000000 });

  const billingCycleArb = fc.constantFrom('monthly', 'yearly', 'lifetime');

  const statusArb = fc.constantFrom('active', 'inactive', 'deprecated');

  const quotasArb = fc.record({
    maxAgents: fc.integer({ min: 1, max: 100 }),
    maxConnections: fc.integer({ min: 1, max: 50 }),
    maxMessagesPerDay: fc.integer({ min: 10, max: 10000 }),
    maxMessagesPerMonth: fc.integer({ min: 100, max: 100000 }),
    maxInboxes: fc.integer({ min: 1, max: 20 }),
    maxTeams: fc.integer({ min: 1, max: 10 }),
    maxWebhooks: fc.integer({ min: 1, max: 50 }),
    maxCampaigns: fc.integer({ min: 1, max: 100 }),
    maxStorageMb: fc.integer({ min: 10, max: 10000 })
  });

  // Only user features - admin features and removed features are excluded
  const featuresArb = fc.record({
    bulk_campaigns: fc.boolean(),
    nocodb_integration: fc.boolean(),
    bot_automation: fc.boolean(),
    advanced_reports: fc.boolean(),
    api_access: fc.boolean(),
    webhooks: fc.boolean(),
    scheduled_messages: fc.boolean(),
    media_storage: fc.boolean()
  });

  const validPlanDataArb = fc.record({
    name: planNameArb,
    description: planDescriptionArb,
    priceCents: priceCentsArb,
    billingCycle: billingCycleArb,
    status: statusArb,
    isDefault: fc.boolean(),
    trialDays: fc.integer({ min: 0, max: 90 }),
    quotas: quotasArb,
    features: featuresArb
  });


  /**
   * **Feature: admin-user-management, Property 1: Plan Creation Stores All Required Fields**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   * 
   * For any valid plan creation request, the system SHALL store the plan with all
   * required fields (name, price_cents, billing_cycle, quotas, features) and generate a unique ID.
   */
  describe('Property 1: Plan Creation Stores All Required Fields', () => {
    it('stores all required fields when creating a plan', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPlanDataArb,
          async (planData) => {
            // Act: Create the plan
            const createdPlan = await planService.createPlan(planData);

            // Assert: Plan has a unique ID
            assert.ok(createdPlan.id, 'Plan should have an ID');
            assert.strictEqual(typeof createdPlan.id, 'string', 'ID should be a string');
            assert.ok(createdPlan.id.length > 0, 'ID should not be empty');

            // Assert: Name is stored correctly
            assert.strictEqual(createdPlan.name, planData.name, 'Name should match');

            // Assert: Price is stored correctly
            assert.strictEqual(createdPlan.priceCents, planData.priceCents, 'Price should match');

            // Assert: Billing cycle is stored correctly
            assert.strictEqual(createdPlan.billingCycle, planData.billingCycle, 'Billing cycle should match');

            // Assert: Status is stored correctly
            assert.strictEqual(createdPlan.status, planData.status, 'Status should match');

            // Assert: Quotas are stored correctly (compare as JSON to handle prototype differences)
            assert.deepStrictEqual(
              JSON.parse(JSON.stringify(createdPlan.quotas)), 
              JSON.parse(JSON.stringify(planData.quotas)), 
              'Quotas should match'
            );

            // Assert: Features are stored correctly (compare as JSON to handle prototype differences)
            assert.deepStrictEqual(
              JSON.parse(JSON.stringify(createdPlan.features)), 
              JSON.parse(JSON.stringify(planData.features)), 
              'Features should match'
            );

            // Assert: Timestamps are set
            assert.ok(createdPlan.createdAt, 'createdAt should be set');
            assert.ok(createdPlan.updatedAt, 'updatedAt should be set');

            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('generates unique IDs for each plan', async () => {
      const ids = new Set();
      
      await fc.assert(
        fc.asyncProperty(
          validPlanDataArb,
          async (planData) => {
            // Make name unique to avoid conflicts
            const uniquePlanData = { ...planData, name: `${planData.name}_${Date.now()}_${Math.random()}` };
            const createdPlan = await planService.createPlan(uniquePlanData);
            
            // Check ID is unique
            const isUnique = !ids.has(createdPlan.id);
            ids.add(createdPlan.id);
            
            return isUnique;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('applies default values when optional fields are omitted', async () => {
      // Create plan with minimal data
      const minimalPlan = await planService.createPlan({ name: 'Minimal Plan' });

      // Assert defaults are applied
      assert.strictEqual(minimalPlan.priceCents, 0, 'Default price should be 0');
      assert.strictEqual(minimalPlan.billingCycle, 'monthly', 'Default billing cycle should be monthly');
      assert.strictEqual(minimalPlan.status, 'active', 'Default status should be active');
      assert.strictEqual(minimalPlan.isDefault, false, 'Default isDefault should be false');
      assert.strictEqual(minimalPlan.trialDays, 0, 'Default trial days should be 0');

      // Assert default quotas
      assert.ok(minimalPlan.quotas.maxAgents >= 1, 'Should have default maxAgents');
      assert.ok(minimalPlan.quotas.maxConnections >= 1, 'Should have default maxConnections');

      // Assert default features
      assert.strictEqual(typeof minimalPlan.features.api_access, 'boolean', 'Should have api_access feature');
    });

    it('stores description when provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          planNameArb,
          fc.string({ minLength: 1, maxLength: 200 }),
          async (name, description) => {
            const uniqueName = `${name}_${Date.now()}`;
            const plan = await planService.createPlan({ name: uniqueName, description });
            
            return plan.description === description;
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});


describe('PlanService Property-Based Tests - Subscriber Count', () => {
  let db;
  let planService;

  beforeEach(() => {
    db = new MockDatabase();
    planService = new PlanService(db);
  });

  afterEach(() => {
    db.reset();
  });

  /**
   * **Feature: admin-user-management, Property 2: Plan Subscriber Count Accuracy**
   * **Validates: Requirements 1.4**
   * 
   * For any plan, the subscriber count returned SHALL equal the actual count of users
   * with active subscriptions to that plan.
   */
  describe('Property 2: Plan Subscriber Count Accuracy', () => {
    it('returns accurate subscriber count for plans with active subscriptions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of active subscribers (0-20)
          fc.integer({ min: 0, max: 20 }),
          // Generate number of inactive subscribers (0-10)
          fc.integer({ min: 0, max: 10 }),
          async (activeCount, inactiveCount) => {
            // Create a plan
            const plan = await planService.createPlan({ 
              name: `Test Plan ${Date.now()}_${Math.random()}` 
            });

            // Add active subscriptions (trial and active status)
            for (let i = 0; i < activeCount; i++) {
              const status = i % 2 === 0 ? 'active' : 'trial';
              db.addSubscription(`sub_active_${i}_${Date.now()}`, plan.id, status);
            }

            // Add inactive subscriptions (canceled, expired, suspended, past_due)
            const inactiveStatuses = ['canceled', 'expired', 'suspended', 'past_due'];
            for (let i = 0; i < inactiveCount; i++) {
              const status = inactiveStatuses[i % inactiveStatuses.length];
              db.addSubscription(`sub_inactive_${i}_${Date.now()}`, plan.id, status);
            }

            // Get the plan with subscriber count
            const fetchedPlan = await planService.getPlanById(plan.id);

            // Subscriber count should only include active and trial subscriptions
            return fetchedPlan.subscriberCount === activeCount;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('returns zero subscriber count for plans with no subscriptions', async () => {
      const plan = await planService.createPlan({ 
        name: `Empty Plan ${Date.now()}` 
      });

      const fetchedPlan = await planService.getPlanById(plan.id);
      
      assert.strictEqual(fetchedPlan.subscriberCount, 0, 'Should have zero subscribers');
    });

    it('returns accurate count when listing all plans', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of plans (1-5)
          fc.integer({ min: 1, max: 5 }),
          // Generate subscribers per plan (array of counts)
          fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 1, maxLength: 5 }),
          async (planCount, subscriberCounts) => {
            const plans = [];
            const expectedCounts = [];

            // Create plans and add subscriptions
            for (let i = 0; i < planCount; i++) {
              const plan = await planService.createPlan({ 
                name: `Plan ${i}_${Date.now()}_${Math.random()}` 
              });
              plans.push(plan);

              const subCount = subscriberCounts[i % subscriberCounts.length];
              expectedCounts.push(subCount);

              for (let j = 0; j < subCount; j++) {
                db.addSubscription(`sub_${i}_${j}_${Date.now()}`, plan.id, 'active');
              }
            }

            // List all plans
            const listedPlans = await planService.listPlans();

            // Verify each plan has correct subscriber count
            for (let i = 0; i < plans.length; i++) {
              const listedPlan = listedPlans.find(p => p.id === plans[i].id);
              if (listedPlan.subscriberCount !== expectedCounts[i]) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('does not count subscriptions from other plans', async () => {
      // Create two plans
      const plan1 = await planService.createPlan({ name: `Plan 1 ${Date.now()}` });
      const plan2 = await planService.createPlan({ name: `Plan 2 ${Date.now()}` });

      // Add subscriptions to plan1 only
      db.addSubscription('sub1', plan1.id, 'active');
      db.addSubscription('sub2', plan1.id, 'active');
      db.addSubscription('sub3', plan1.id, 'trial');

      // Plan1 should have 3 subscribers
      const fetchedPlan1 = await planService.getPlanById(plan1.id);
      assert.strictEqual(fetchedPlan1.subscriberCount, 3, 'Plan 1 should have 3 subscribers');

      // Plan2 should have 0 subscribers
      const fetchedPlan2 = await planService.getPlanById(plan2.id);
      assert.strictEqual(fetchedPlan2.subscriberCount, 0, 'Plan 2 should have 0 subscribers');
    });
  });
});


describe('PlanService Property-Based Tests - Plan Deletion', () => {
  let db;
  let planService;

  beforeEach(() => {
    db = new MockDatabase();
    planService = new PlanService(db);
  });

  afterEach(() => {
    db.reset();
  });

  /**
   * **Feature: admin-user-management, Property 4: Plan Deletion Constraint**
   * **Validates: Requirements 1.6**
   * 
   * For any plan with active subscribers, deletion attempts SHALL be rejected
   * until all users are migrated to another plan.
   */
  describe('Property 4: Plan Deletion Constraint', () => {
    it('rejects deletion of plans with active subscribers when no migration target provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of active subscribers (1-10)
          fc.integer({ min: 1, max: 10 }),
          async (subscriberCount) => {
            // Create a plan
            const plan = await planService.createPlan({ 
              name: `Plan to Delete ${Date.now()}_${Math.random()}` 
            });

            // Add active subscriptions
            for (let i = 0; i < subscriberCount; i++) {
              db.addSubscription(`sub_${i}_${Date.now()}`, plan.id, 'active');
            }

            // Attempt to delete without migration target should throw
            try {
              await planService.deletePlan(plan.id);
              return false; // Should have thrown
            } catch (error) {
              return error.message.includes('active subscribers') && 
                     error.message.includes('migrateToPlanId');
            }
          }
        ),
        { numRuns: 15 }
      );
    });

    it('allows deletion of plans with no subscribers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          async (planName) => {
            // Create a plan with no subscribers
            const plan = await planService.createPlan({ 
              name: `${planName}_${Date.now()}_${Math.random()}` 
            });

            // Delete should succeed
            await planService.deletePlan(plan.id);

            // Plan should no longer exist
            const deletedPlan = await planService.getPlanById(plan.id);
            return deletedPlan === null;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('allows deletion with migration target and migrates users', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate number of subscribers to migrate (1-10)
          fc.integer({ min: 1, max: 10 }),
          async (subscriberCount) => {
            // Create source and target plans
            const sourcePlan = await planService.createPlan({ 
              name: `Source Plan ${Date.now()}_${Math.random()}` 
            });
            const targetPlan = await planService.createPlan({ 
              name: `Target Plan ${Date.now()}_${Math.random()}` 
            });

            // Add subscriptions to source plan
            const subscriptionIds = [];
            for (let i = 0; i < subscriberCount; i++) {
              const subId = `sub_${i}_${Date.now()}`;
              subscriptionIds.push(subId);
              db.addSubscription(subId, sourcePlan.id, 'active');
            }

            // Delete with migration target
            await planService.deletePlan(sourcePlan.id, targetPlan.id);

            // Source plan should be deleted
            const deletedPlan = await planService.getPlanById(sourcePlan.id);
            if (deletedPlan !== null) return false;

            // All subscriptions should now be on target plan
            const targetPlanUpdated = await planService.getPlanById(targetPlan.id);
            return targetPlanUpdated.subscriberCount === subscriberCount;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('allows deletion of plans with only inactive subscribers', async () => {
      // Create a plan
      const plan = await planService.createPlan({ 
        name: `Plan with Inactive ${Date.now()}` 
      });

      // Add only inactive subscriptions
      db.addSubscription('sub1', plan.id, 'canceled');
      db.addSubscription('sub2', plan.id, 'expired');
      db.addSubscription('sub3', plan.id, 'suspended');

      // Delete should succeed (no active subscribers)
      await planService.deletePlan(plan.id);

      // Plan should be deleted
      const deletedPlan = await planService.getPlanById(plan.id);
      assert.strictEqual(deletedPlan, null, 'Plan should be deleted');
    });
  });
});
