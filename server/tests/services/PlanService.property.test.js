/**
 * Property-Based Tests for PlanService
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * that should hold across all valid inputs.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 * 
 * MIGRATED: Now uses SupabaseService mocking instead of MockDatabase
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Mock SupabaseService before requiring PlanService
const mockSupabaseService = {
  plans: new Map(),
  subscriptions: new Map(),

  async queryAsAdmin(table, queryBuilder) {
    if (table === 'plans') {
      const mockQuery = {
        _filters: {},
        _single: false,
        select: () => mockQuery,
        eq: (field, value) => {
          mockQuery._filters[field] = value;
          return mockQuery;
        },
        single: () => {
          mockQuery._single = true;
          return mockQuery;
        },
        order: () => mockQuery,
        then: async (resolve) => {
          if (mockQuery._single && mockQuery._filters.id) {
            const plan = mockSupabaseService.plans.get(mockQuery._filters.id);
            if (!plan) return resolve({ data: null, error: { code: 'PGRST116' } });
            return resolve({ data: plan, error: null });
          }
          if (mockQuery._filters.name) {
            const plan = Array.from(mockSupabaseService.plans.values()).find(p => p.name === mockQuery._filters.name);
            return resolve({ data: plan || null, error: plan ? null : { code: 'PGRST116' } });
          }
          let plans = Array.from(mockSupabaseService.plans.values());
          if (mockQuery._filters.status) {
            plans = plans.filter(p => p.status === mockQuery._filters.status);
          }
          return resolve({ data: plans, error: null });
        }
      };
      return queryBuilder(mockQuery);
    }
    if (table === 'user_subscriptions') {
      const mockQuery = {
        _filters: {},
        select: () => mockQuery,
        eq: (field, value) => {
          mockQuery._filters[field] = value;
          return mockQuery;
        },
        in: (field, values) => {
          mockQuery._filters[field] = values;
          return mockQuery;
        },
        then: async (resolve) => {
          const planId = mockQuery._filters?.plan_id;
          const statuses = mockQuery._filters?.status;
          let subs = Array.from(mockSupabaseService.subscriptions.values());
          if (planId) subs = subs.filter(s => s.plan_id === planId);
          if (statuses) subs = subs.filter(s => statuses.includes(s.status));
          return resolve({ data: subs, error: null });
        }
      };
      return queryBuilder(mockQuery);
    }
    return { data: null, error: null };
  },

  async getById(table, id) {
    if (table === 'plans') {
      const plan = mockSupabaseService.plans.get(id);
      return { data: plan || null, error: plan ? null : { code: 'PGRST116' } };
    }
    return { data: null, error: null };
  },

  async getMany(table, filters, options) {
    if (table === 'plans') {
      let plans = Array.from(mockSupabaseService.plans.values());
      if (filters.status) plans = plans.filter(p => p.status === filters.status);
      return { data: plans, error: null };
    }
    return { data: [], error: null };
  },

  async count(table, filters) {
    if (table === 'user_subscriptions') {
      const planId = filters.plan_id;
      const count = Array.from(mockSupabaseService.subscriptions.values())
        .filter(s => s.plan_id === planId && ['trial', 'active'].includes(s.status))
        .length;
      return { count, error: null };
    }
    return { count: 0, error: null };
  },

  async insert(table, data) {
    if (table === 'plans') {
      mockSupabaseService.plans.set(data.id, data);
    }
    return { data, error: null };
  },

  async update(table, id, data) {
    if (table === 'plans') {
      const existing = mockSupabaseService.plans.get(id);
      if (existing) {
        Object.assign(existing, data);
        return { data: existing, error: null };
      }
    }
    if (table === 'user_subscriptions') {
      mockSupabaseService.subscriptions.forEach((sub) => {
        if (data.plan_id && sub.plan_id === id) {
          sub.plan_id = data.plan_id;
        }
      });
    }
    return { data: { id, ...data }, error: null };
  },

  async delete(table, id) {
    if (table === 'plans') {
      mockSupabaseService.plans.delete(id);
    }
    return { data: null, error: null };
  },

  addSubscription(id, planId, status = 'active') {
    mockSupabaseService.subscriptions.set(id, { id, plan_id: planId, status });
  },

  reset() {
    mockSupabaseService.plans.clear();
    mockSupabaseService.subscriptions.clear();
  }
};

// Mock the SupabaseService module
require.cache[require.resolve('../../services/SupabaseService')] = {
  exports: mockSupabaseService
};

const PlanService = require('../../services/PlanService');

describe('PlanService Property-Based Tests', () => {
  let planService;

  beforeEach(() => {
    mockSupabaseService.reset();
    planService = new PlanService();
  });

  afterEach(() => {
    mockSupabaseService.reset();
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
   */
  describe('Property 1: Plan Creation Stores All Required Fields', () => {
    it('stores all required fields when creating a plan', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPlanDataArb,
          async (planData) => {
            const createdPlan = await planService.createPlan(planData);

            assert.ok(createdPlan.id, 'Plan should have an ID');
            assert.strictEqual(typeof createdPlan.id, 'string', 'ID should be a string');
            assert.ok(createdPlan.id.length > 0, 'ID should not be empty');
            assert.strictEqual(createdPlan.name, planData.name, 'Name should match');
            assert.strictEqual(createdPlan.priceCents, planData.priceCents, 'Price should match');
            assert.strictEqual(createdPlan.billingCycle, planData.billingCycle, 'Billing cycle should match');
            assert.strictEqual(createdPlan.status, planData.status, 'Status should match');
            assert.deepStrictEqual(
              JSON.parse(JSON.stringify(createdPlan.quotas)), 
              JSON.parse(JSON.stringify(planData.quotas)), 
              'Quotas should match'
            );
            assert.deepStrictEqual(
              JSON.parse(JSON.stringify(createdPlan.features)), 
              JSON.parse(JSON.stringify(planData.features)), 
              'Features should match'
            );
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
            const uniquePlanData = { ...planData, name: `${planData.name}_${Date.now()}_${Math.random()}` };
            const createdPlan = await planService.createPlan(uniquePlanData);
            
            const isUnique = !ids.has(createdPlan.id);
            ids.add(createdPlan.id);
            
            return isUnique;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('applies default values when optional fields are omitted', async () => {
      const minimalPlan = await planService.createPlan({ name: 'Minimal Plan' });

      assert.strictEqual(minimalPlan.priceCents, 0, 'Default price should be 0');
      assert.strictEqual(minimalPlan.billingCycle, 'monthly', 'Default billing cycle should be monthly');
      assert.strictEqual(minimalPlan.status, 'active', 'Default status should be active');
      assert.strictEqual(minimalPlan.isDefault, false, 'Default isDefault should be false');
      assert.strictEqual(minimalPlan.trialDays, 0, 'Default trial days should be 0');
      assert.ok(minimalPlan.quotas.maxAgents >= 1, 'Should have default maxAgents');
      assert.ok(minimalPlan.quotas.maxConnections >= 1, 'Should have default maxConnections');
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
  let planService;

  beforeEach(() => {
    mockSupabaseService.reset();
    planService = new PlanService();
  });

  afterEach(() => {
    mockSupabaseService.reset();
  });

  /**
   * **Feature: admin-user-management, Property 2: Plan Subscriber Count Accuracy**
   * **Validates: Requirements 1.4**
   */
  describe('Property 2: Plan Subscriber Count Accuracy', () => {
    it('returns accurate subscriber count for plans with active subscriptions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 10 }),
          async (activeCount, inactiveCount) => {
            const plan = await planService.createPlan({ 
              name: `Test Plan ${Date.now()}_${Math.random()}` 
            });

            for (let i = 0; i < activeCount; i++) {
              const status = i % 2 === 0 ? 'active' : 'trial';
              mockSupabaseService.addSubscription(`sub_active_${i}_${Date.now()}`, plan.id, status);
            }

            const inactiveStatuses = ['canceled', 'expired', 'suspended', 'past_due'];
            for (let i = 0; i < inactiveCount; i++) {
              const status = inactiveStatuses[i % inactiveStatuses.length];
              mockSupabaseService.addSubscription(`sub_inactive_${i}_${Date.now()}`, plan.id, status);
            }

            const fetchedPlan = await planService.getPlanById(plan.id);

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

    it('does not count subscriptions from other plans', async () => {
      const plan1 = await planService.createPlan({ name: `Plan 1 ${Date.now()}` });
      const plan2 = await planService.createPlan({ name: `Plan 2 ${Date.now()}` });

      mockSupabaseService.addSubscription('sub1', plan1.id, 'active');
      mockSupabaseService.addSubscription('sub2', plan1.id, 'active');
      mockSupabaseService.addSubscription('sub3', plan1.id, 'trial');

      const fetchedPlan1 = await planService.getPlanById(plan1.id);
      assert.strictEqual(fetchedPlan1.subscriberCount, 3, 'Plan 1 should have 3 subscribers');

      const fetchedPlan2 = await planService.getPlanById(plan2.id);
      assert.strictEqual(fetchedPlan2.subscriberCount, 0, 'Plan 2 should have 0 subscribers');
    });
  });
});

describe('PlanService Property-Based Tests - Plan Deletion', () => {
  let planService;

  beforeEach(() => {
    mockSupabaseService.reset();
    planService = new PlanService();
  });

  afterEach(() => {
    mockSupabaseService.reset();
  });

  /**
   * **Feature: admin-user-management, Property 4: Plan Deletion Constraint**
   * **Validates: Requirements 1.6**
   */
  describe('Property 4: Plan Deletion Constraint', () => {
    it('rejects deletion of plans with active subscribers when no migration target provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (subscriberCount) => {
            const plan = await planService.createPlan({ 
              name: `Plan to Delete ${Date.now()}_${Math.random()}` 
            });

            for (let i = 0; i < subscriberCount; i++) {
              mockSupabaseService.addSubscription(`sub_${i}_${Date.now()}`, plan.id, 'active');
            }

            try {
              await planService.deletePlan(plan.id);
              return false;
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
            const plan = await planService.createPlan({ 
              name: `${planName}_${Date.now()}_${Math.random()}` 
            });

            await planService.deletePlan(plan.id);

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
          fc.integer({ min: 1, max: 10 }),
          async (subscriberCount) => {
            const sourcePlan = await planService.createPlan({ 
              name: `Source Plan ${Date.now()}_${Math.random()}` 
            });
            const targetPlan = await planService.createPlan({ 
              name: `Target Plan ${Date.now()}_${Math.random()}` 
            });

            for (let i = 0; i < subscriberCount; i++) {
              mockSupabaseService.addSubscription(`sub_${i}_${Date.now()}`, sourcePlan.id, 'active');
            }

            await planService.deletePlan(sourcePlan.id, targetPlan.id);

            const deletedPlan = await planService.getPlanById(sourcePlan.id);
            if (deletedPlan !== null) return false;

            const targetPlanUpdated = await planService.getPlanById(targetPlan.id);
            return targetPlanUpdated.subscriberCount === subscriberCount;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('allows deletion of plans with only inactive subscribers', async () => {
      const plan = await planService.createPlan({ 
        name: `Plan with Inactive ${Date.now()}` 
      });

      mockSupabaseService.addSubscription('sub1', plan.id, 'canceled');
      mockSupabaseService.addSubscription('sub2', plan.id, 'expired');
      mockSupabaseService.addSubscription('sub3', plan.id, 'suspended');

      await planService.deletePlan(plan.id);

      const deletedPlan = await planService.getPlanById(plan.id);
      assert.strictEqual(deletedPlan, null, 'Plan should be deleted');
    });
  });
});
