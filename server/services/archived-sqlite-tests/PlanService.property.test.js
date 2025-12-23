/**
 * Property-Based Tests for PlanService
 * 
 * Tests correctness properties defined in the design document using fast-check.
 * Each test runs a minimum of 100 iterations.
 * 
 * Feature: admin-user-management
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const path = require('path');
const fs = require('fs');
const Database = require('../database');
const PlanService = require('./PlanService');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-plan-service.db');

// Helper to create test database with plan tables
async function createTestDatabase() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  await db.init();
  
  // Create plans table
  await db.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      price_cents INTEGER NOT NULL DEFAULT 0,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly', 'lifetime')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'deprecated')),
      is_default INTEGER DEFAULT 0,
      trial_days INTEGER DEFAULT 0,
      max_agents INTEGER DEFAULT 1,
      max_connections INTEGER DEFAULT 1,
      max_messages_per_day INTEGER DEFAULT 100,
      max_messages_per_month INTEGER DEFAULT 3000,
      max_inboxes INTEGER DEFAULT 1,
      max_teams INTEGER DEFAULT 1,
      max_webhooks INTEGER DEFAULT 5,
      max_campaigns INTEGER DEFAULT 1,
      max_storage_mb INTEGER DEFAULT 100,
      features TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create user_subscriptions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('trial', 'active', 'past_due', 'canceled', 'expired', 'suspended')),
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      trial_ends_at DATETIME,
      current_period_start DATETIME,
      current_period_end DATETIME,
      canceled_at DATETIME,
      suspension_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    )
  `);
  
  // Create indexes
  await db.query('CREATE INDEX IF NOT EXISTS idx_plans_name ON plans(name)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan_id ON user_subscriptions(plan_id)');
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM user_subscriptions');
  await db.query('DELETE FROM plans');
}

// Arbitraries for generating test data
const planNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0)
  .map(s => s.trim().substring(0, 50));

const descriptionArb = fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null });
const priceCentsArb = fc.integer({ min: 0, max: 1000000 });
const billingCycleArb = fc.constantFrom('monthly', 'yearly', 'lifetime');
const statusArb = fc.constantFrom('active', 'inactive', 'deprecated');
const trialDaysArb = fc.integer({ min: 0, max: 365 });

const quotasArb = fc.record({
  maxAgents: fc.integer({ min: 1, max: 1000 }),
  maxConnections: fc.integer({ min: 1, max: 100 }),
  maxMessagesPerDay: fc.integer({ min: 1, max: 100000 }),
  maxMessagesPerMonth: fc.integer({ min: 1, max: 1000000 }),
  maxInboxes: fc.integer({ min: 1, max: 100 }),
  maxTeams: fc.integer({ min: 0, max: 50 }),
  maxWebhooks: fc.integer({ min: 1, max: 200 }),
  maxCampaigns: fc.integer({ min: 0, max: 100 }),
  maxStorageMb: fc.integer({ min: 1, max: 100000 })
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

describe('PlanService Property Tests', () => {
  let db;
  let planService;
  let planCounter = 0;
  
  before(async () => {
    db = await createTestDatabase();
    planService = new PlanService(db);
  });
  
  after(async () => {
    if (db && db.db) {
      db.db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });
  
  beforeEach(async () => {
    await cleanupTestData(db);
    planCounter = 0;
  });

  // Helper to generate unique plan names
  function uniquePlanName(baseName) {
    planCounter++;
    return `${baseName}_${planCounter}_${Date.now()}`;
  }

  /**
   * **Feature: admin-user-management, Property 1: Plan Creation Stores All Required Fields**
   * Validates: Requirements 1.1, 1.2, 1.3
   * 
   * For any valid plan creation request, the system SHALL store the plan with all 
   * required fields (name, price_cents, billing_cycle, quotas, features) and generate a unique ID.
   */
  it('Property 1: Plan creation stores all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: planNameArb,
          description: descriptionArb,
          priceCents: priceCentsArb,
          billingCycle: billingCycleArb,
          trialDays: trialDaysArb,
          quotas: quotasArb,
          features: featuresArb
        }),
        async (data) => {
          await cleanupTestData(db);
          
          // Use unique name to avoid conflicts
          const planData = { ...data, name: uniquePlanName(data.name) };
          
          const plan = await planService.createPlan(planData);
          
          // Verify ID is a valid UUID
          assert(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(plan.id),
            `Plan ID should be a valid UUID, got: ${plan.id}`
          );
          
          // Verify all required fields are stored
          assert.strictEqual(plan.name, planData.name, 'Name should match');
          assert.strictEqual(plan.priceCents, planData.priceCents, 'Price should match');
          assert.strictEqual(plan.billingCycle, planData.billingCycle, 'Billing cycle should match');
          assert.strictEqual(plan.trialDays, planData.trialDays, 'Trial days should match');
          
          // Verify quotas are stored
          assert.strictEqual(plan.quotas.maxAgents, planData.quotas.maxAgents);
          assert.strictEqual(plan.quotas.maxConnections, planData.quotas.maxConnections);
          assert.strictEqual(plan.quotas.maxMessagesPerDay, planData.quotas.maxMessagesPerDay);
          assert.strictEqual(plan.quotas.maxMessagesPerMonth, planData.quotas.maxMessagesPerMonth);
          assert.strictEqual(plan.quotas.maxInboxes, planData.quotas.maxInboxes);
          assert.strictEqual(plan.quotas.maxTeams, planData.quotas.maxTeams);
          assert.strictEqual(plan.quotas.maxWebhooks, planData.quotas.maxWebhooks);
          assert.strictEqual(plan.quotas.maxCampaigns, planData.quotas.maxCampaigns);
          assert.strictEqual(plan.quotas.maxStorageMb, planData.quotas.maxStorageMb);
          
          // Verify features are stored (only user features)
          assert.strictEqual(plan.features.bulk_campaigns, planData.features.bulk_campaigns);
          assert.strictEqual(plan.features.api_access, planData.features.api_access);
          assert.strictEqual(plan.features.webhooks, planData.features.webhooks);
          
          // Verify plan can be retrieved
          const retrieved = await planService.getPlanById(plan.id);
          assert(retrieved, 'Plan should be retrievable');
          assert.strictEqual(retrieved.id, plan.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: admin-user-management, Property 2: Plan Subscriber Count Accuracy**
   * Validates: Requirements 1.4
   * 
   * For any plan, the subscriber count returned SHALL equal the actual count of 
   * users with active subscriptions to that plan.
   */
  it('Property 2: Plan subscriber count accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 20 }),
        async (subscriberCount) => {
          await cleanupTestData(db);
          
          // Create a plan
          const plan = await planService.createPlan({
            name: uniquePlanName('TestPlan'),
            priceCents: 1000,
            billingCycle: 'monthly'
          });
          
          // Create subscriptions
          for (let i = 0; i < subscriberCount; i++) {
            const userId = `user_${i}_${Date.now()}`;
            const subId = `sub_${i}_${Date.now()}`;
            await db.query(`
              INSERT INTO user_subscriptions (id, user_id, plan_id, status)
              VALUES (?, ?, ?, 'active')
            `, [subId, userId, plan.id]);
          }
          
          // Get plan with subscriber count
          const retrieved = await planService.getPlanById(plan.id);
          
          assert.strictEqual(
            retrieved.subscriberCount,
            subscriberCount,
            `Subscriber count should be ${subscriberCount}, got ${retrieved.subscriberCount}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: admin-user-management, Property 4: Plan Deletion Constraint**
   * Validates: Requirements 1.6
   * 
   * For any plan with active subscribers, deletion attempts SHALL be rejected 
   * until all users are migrated to another plan.
   */
  it('Property 4: Plan deletion constraint', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (subscriberCount) => {
          await cleanupTestData(db);
          
          // Create two plans
          const planToDelete = await planService.createPlan({
            name: uniquePlanName('PlanToDelete'),
            priceCents: 1000,
            billingCycle: 'monthly'
          });
          
          const migrationPlan = await planService.createPlan({
            name: uniquePlanName('MigrationPlan'),
            priceCents: 2000,
            billingCycle: 'monthly'
          });
          
          // Create subscriptions to the plan to delete
          for (let i = 0; i < subscriberCount; i++) {
            const userId = `user_${i}_${Date.now()}`;
            const subId = `sub_${i}_${Date.now()}`;
            await db.query(`
              INSERT INTO user_subscriptions (id, user_id, plan_id, status)
              VALUES (?, ?, ?, 'active')
            `, [subId, userId, planToDelete.id]);
          }
          
          // Attempt to delete without migration should fail
          let deleteError = null;
          try {
            await planService.deletePlan(planToDelete.id);
          } catch (error) {
            deleteError = error;
          }
          
          assert(
            deleteError !== null,
            'Deleting plan with subscribers without migration should throw error'
          );
          assert(
            deleteError.message.includes('active subscribers'),
            `Error should mention active subscribers: ${deleteError.message}`
          );
          
          // Plan should still exist
          const stillExists = await planService.getPlanById(planToDelete.id);
          assert(stillExists, 'Plan should still exist after failed deletion');
          
          // Delete with migration should succeed
          await planService.deletePlan(planToDelete.id, migrationPlan.id);
          
          // Plan should be deleted
          const deleted = await planService.getPlanById(planToDelete.id);
          assert.strictEqual(deleted, null, 'Plan should be deleted');
          
          // Subscribers should be migrated
          const migratedPlan = await planService.getPlanById(migrationPlan.id);
          assert.strictEqual(
            migratedPlan.subscriberCount,
            subscriberCount,
            'All subscribers should be migrated'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: admin-user-management, Property: Plan update preserves unmodified fields**
   * Validates: Requirements 1.5
   * 
   * For any plan update, fields not included in the update should remain unchanged.
   */
  it('Property: Plan update preserves unmodified fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: planNameArb,
          priceCents: priceCentsArb,
          billingCycle: billingCycleArb,
          quotas: quotasArb,
          features: featuresArb
        }),
        fc.record({
          priceCents: fc.option(priceCentsArb, { nil: undefined }),
          trialDays: fc.option(trialDaysArb, { nil: undefined })
        }),
        async (createData, updateData) => {
          await cleanupTestData(db);
          
          const planData = { ...createData, name: uniquePlanName(createData.name) };
          const plan = await planService.createPlan(planData);
          
          // Store original values
          const originalBillingCycle = plan.billingCycle;
          const originalQuotas = { ...plan.quotas };
          const originalFeatures = { ...plan.features };
          
          // Update with partial data
          const updated = await planService.updatePlan(plan.id, updateData);
          
          // Verify updated fields changed (if provided)
          if (updateData.priceCents !== undefined) {
            assert.strictEqual(updated.priceCents, updateData.priceCents);
          } else {
            assert.strictEqual(updated.priceCents, planData.priceCents);
          }
          
          // Verify unmodified fields remain unchanged
          assert.strictEqual(updated.billingCycle, originalBillingCycle);
          assert.deepStrictEqual(updated.quotas, originalQuotas);
          assert.deepStrictEqual(updated.features, originalFeatures);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: admin-user-management, Property: Default plan uniqueness**
   * Validates: Requirements 1.1
   * 
   * Only one plan can be marked as default at any time.
   */
  it('Property: Default plan uniqueness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (planCount) => {
          await cleanupTestData(db);
          
          // Create multiple plans
          const plans = [];
          for (let i = 0; i < planCount; i++) {
            const plan = await planService.createPlan({
              name: uniquePlanName(`Plan${i}`),
              priceCents: i * 1000,
              billingCycle: 'monthly'
            });
            plans.push(plan);
          }
          
          // Set each plan as default in sequence
          for (const plan of plans) {
            await planService.updatePlan(plan.id, { isDefault: true });
            
            // Verify only this plan is default
            const allPlans = await planService.listPlans();
            const defaultPlans = allPlans.filter(p => p.isDefault);
            
            assert.strictEqual(
              defaultPlans.length,
              1,
              `Should have exactly 1 default plan, got ${defaultPlans.length}`
            );
            assert.strictEqual(
              defaultPlans[0].id,
              plan.id,
              'The current plan should be the default'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: admin-user-management, Property: Plan list ordering**
   * Validates: Requirements 1.4
   * 
   * Plans should be listed in order by price (ascending).
   */
  it('Property: Plan list ordering by price', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(priceCentsArb, { minLength: 2, maxLength: 10 }),
        async (prices) => {
          await cleanupTestData(db);
          
          // Create plans with different prices
          for (let i = 0; i < prices.length; i++) {
            await planService.createPlan({
              name: uniquePlanName(`Plan${i}`),
              priceCents: prices[i],
              billingCycle: 'monthly'
            });
          }
          
          // Get all plans
          const plans = await planService.listPlans();
          
          // Verify ordering by price
          for (let i = 1; i < plans.length; i++) {
            assert(
              plans[i].priceCents >= plans[i - 1].priceCents,
              `Plans should be ordered by price: ${plans[i - 1].priceCents} should be <= ${plans[i].priceCents}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
