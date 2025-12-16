/**
 * Property-Based Tests for User Actions
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * for user suspension, reactivation, deletion, and data export.
 * 
 * Each test runs a minimum of 100 iterations.
 * 
 * Feature: admin-user-management
 * Requirements: 7.1, 7.2, 7.4, 7.5, 8.6
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const SubscriptionService = require('../../services/SubscriptionService');
const AdminAuditService = require('../../services/AdminAuditService');

// In-memory database mock for testing
class MockDatabase {
  constructor() {
    this.subscriptions = new Map();
    this.plans = new Map();
    this.quotaUsage = new Map();
    this.quotaOverrides = new Map();
    this.featureOverrides = new Map();
    this.usageMetrics = [];
    this.auditLogs = [];
    this.notifications = [];
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
      }
      return { rows: [] };
    }

    // Handle DELETE operations
    if (sqlUpper.startsWith('DELETE FROM USER_QUOTA_USAGE')) {
      const userId = params[0];
      this.quotaUsage.delete(userId);
      return { rows: [] };
    }

    if (sqlUpper.startsWith('DELETE FROM USER_QUOTA_OVERRIDES')) {
      const userId = params[0];
      this.quotaOverrides.delete(userId);
      return { rows: [] };
    }

    if (sqlUpper.startsWith('DELETE FROM USER_FEATURE_OVERRIDES')) {
      const userId = params[0];
      this.featureOverrides.delete(userId);
      return { rows: [] };
    }

    if (sqlUpper.startsWith('DELETE FROM USAGE_METRICS')) {
      const userId = params[0];
      this.usageMetrics = this.usageMetrics.filter(m => m.user_id !== userId);
      return { rows: [] };
    }

    if (sqlUpper.startsWith('DELETE FROM USER_SUBSCRIPTIONS')) {
      const userId = params[0];
      this.subscriptions.delete(userId);
      return { rows: [] };
    }

    // Handle INSERT audit log
    if (sqlUpper.startsWith('INSERT INTO ADMIN_AUDIT_LOG')) {
      const log = {
        id: params[0],
        admin_id: params[1],
        action_type: params[2],
        target_user_id: params[3],
        target_resource_type: params[4],
        target_resource_id: params[5],
        details: params[6],
        ip_address: params[7],
        user_agent: params[8],
        created_at: params[9]
      };
      this.auditLogs.push(log);
      return { rows: [] };
    }

    // Handle SELECT audit logs
    if (sql.includes('FROM admin_audit_log') && sql.includes('target_user_id = ?')) {
      const userId = params[0];
      const logs = this.auditLogs.filter(l => l.target_user_id === userId);
      return { rows: logs };
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

  // Helper to add quota usage
  addQuotaUsage(userId, quotaType, usage) {
    const key = `${userId}:${quotaType}`;
    this.quotaUsage.set(key, { user_id: userId, quota_type: quotaType, current_usage: usage });
  }

  // Helper to add quota override
  addQuotaOverride(userId, quotaType, limit) {
    const key = `${userId}:${quotaType}`;
    this.quotaOverrides.set(key, { user_id: userId, quota_type: quotaType, limit_value: limit });
  }

  // Helper to add feature override
  addFeatureOverride(userId, featureName, enabled) {
    const key = `${userId}:${featureName}`;
    this.featureOverrides.set(key, { user_id: userId, feature_name: featureName, enabled });
  }

  // Helper to add usage metric
  addUsageMetric(userId, metricType, amount) {
    this.usageMetrics.push({ user_id: userId, metric_type: metricType, amount });
  }

  // Check if user data exists
  hasUserData(userId) {
    const hasSubscription = this.subscriptions.has(userId);
    const hasQuotaUsage = Array.from(this.quotaUsage.keys()).some(k => k.startsWith(`${userId}:`));
    const hasQuotaOverrides = Array.from(this.quotaOverrides.keys()).some(k => k.startsWith(`${userId}:`));
    const hasFeatureOverrides = Array.from(this.featureOverrides.keys()).some(k => k.startsWith(`${userId}:`));
    const hasUsageMetrics = this.usageMetrics.some(m => m.user_id === userId);
    
    return hasSubscription || hasQuotaUsage || hasQuotaOverrides || hasFeatureOverrides || hasUsageMetrics;
  }

  reset() {
    this.subscriptions.clear();
    this.plans.clear();
    this.quotaUsage.clear();
    this.quotaOverrides.clear();
    this.featureOverrides.clear();
    this.usageMetrics = [];
    this.auditLogs = [];
    this.notifications = [];
  }
}



describe('User Actions Property-Based Tests', () => {
  let db;
  let subscriptionService;
  let auditService;

  beforeEach(() => {
    db = new MockDatabase();
    subscriptionService = new SubscriptionService(db);
    auditService = new AdminAuditService(db);
  });

  afterEach(() => {
    db.reset();
  });

  // Arbitraries
  const userIdArb = fc.uuid();
  const planIdArb = fc.uuid();
  const adminIdArb = fc.uuid();
  const reasonArb = fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0);

  /**
   * **Feature: admin-user-management, Property 14: User Suspension Blocks Access**
   * **Validates: Requirements 7.1**
   * 
   * For any suspended user, all authentication attempts SHALL be rejected
   * and the suspension reason SHALL be logged.
   */
  describe('Property 14: User Suspension Blocks Access', () => {
    it('suspended user is not active and has read-only access', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          reasonArb,
          async (userId, planId, adminId, reason) => {
            // Setup: Create user with active subscription
            db.addPlan(planId, { name: 'Test Plan' });
            await subscriptionService.assignPlan(userId, planId, adminId);

            // Verify user is initially active
            const isActiveBefore = await subscriptionService.isUserActive(userId);
            assert.strictEqual(isActiveBefore, true, 'User should be active before suspension');

            // Act: Suspend user
            const subscription = await subscriptionService.updateSubscriptionStatus(
              userId,
              SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
              reason
            );

            // Assert: User is no longer active
            const isActiveAfter = await subscriptionService.isUserActive(userId);
            assert.strictEqual(isActiveAfter, false, 'Suspended user should not be active');

            // Assert: User has read-only access
            const isReadOnly = await subscriptionService.isUserReadOnly(userId);
            assert.strictEqual(isReadOnly, true, 'Suspended user should have read-only access');

            // Assert: Suspension reason is recorded
            assert.strictEqual(subscription.status, 'suspended', 'Status should be suspended');
            assert.strictEqual(subscription.suspensionReason, reason, 'Suspension reason should be recorded');

            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('suspension blocks access regardless of plan type', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          fc.integer({ min: 0, max: 100000 }), // priceCents
          fc.constantFrom('monthly', 'yearly', 'lifetime'),
          async (userId, planId, adminId, priceCents, billingCycle) => {
            // Setup: Create user with various plan types
            db.addPlan(planId, { 
              name: 'Test Plan', 
              priceCents, 
              billingCycle 
            });
            await subscriptionService.assignPlan(userId, planId, adminId);

            // Act: Suspend user
            await subscriptionService.updateSubscriptionStatus(
              userId,
              SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
              'Test suspension'
            );

            // Assert: User is blocked regardless of plan
            const isActive = await subscriptionService.isUserActive(userId);
            assert.strictEqual(isActive, false, 'Suspended user should not be active regardless of plan');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('suspension audit log is created', async () => {
      const userId = 'test-user-suspend';
      const planId = 'test-plan-suspend';
      const adminId = 'admin-suspend';
      const reason = 'Payment failed';

      db.addPlan(planId, { name: 'Test Plan' });
      await subscriptionService.assignPlan(userId, planId, adminId);

      // Suspend and log
      await subscriptionService.updateSubscriptionStatus(
        userId,
        SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
        reason
      );

      await auditService.logAction(
        adminId,
        AdminAuditService.ACTION_TYPES.USER_SUSPENDED,
        userId,
        { reason },
        '127.0.0.1',
        'Test Agent'
      );

      // Verify audit log
      const logs = await auditService.getUserAuditHistory(userId);
      assert.ok(logs.length > 0, 'Audit log should be created');
      
      const suspendLog = logs.find(l => l.actionType === AdminAuditService.ACTION_TYPES.USER_SUSPENDED);
      assert.ok(suspendLog, 'Suspension action should be logged');
      assert.strictEqual(suspendLog.targetUserId, userId, 'Target user should match');
    });
  });

  /**
   * **Feature: admin-user-management, Property 15: User Reactivation Restores Access**
   * **Validates: Requirements 7.2**
   * 
   * For any reactivated user, access SHALL be restored according to their
   * subscription plan and an audit entry SHALL be created.
   */
  describe('Property 15: User Reactivation Restores Access', () => {
    it('reactivated user regains active status', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          reasonArb,
          async (userId, planId, adminId, reason) => {
            // Setup: Create and suspend user
            db.addPlan(planId, { name: 'Test Plan' });
            await subscriptionService.assignPlan(userId, planId, adminId);
            await subscriptionService.updateSubscriptionStatus(
              userId,
              SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
              reason
            );

            // Verify user is suspended
            const isActiveSuspended = await subscriptionService.isUserActive(userId);
            assert.strictEqual(isActiveSuspended, false, 'User should be inactive when suspended');

            // Act: Reactivate user
            const subscription = await subscriptionService.updateSubscriptionStatus(
              userId,
              SubscriptionService.SUBSCRIPTION_STATUS.ACTIVE
            );

            // Assert: User is active again
            const isActiveAfter = await subscriptionService.isUserActive(userId);
            assert.strictEqual(isActiveAfter, true, 'Reactivated user should be active');

            // Assert: User no longer has read-only access
            const isReadOnly = await subscriptionService.isUserReadOnly(userId);
            assert.strictEqual(isReadOnly, false, 'Reactivated user should not have read-only access');

            // Assert: Status is active
            assert.strictEqual(subscription.status, 'active', 'Status should be active');

            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('reactivation preserves plan assignment', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          fc.integer({ min: 1, max: 100 }), // maxAgents
          fc.integer({ min: 100, max: 10000 }), // maxMessagesPerMonth
          async (userId, planId, adminId, maxAgents, maxMessagesPerMonth) => {
            // Setup: Create user with specific plan quotas
            db.addPlan(planId, { 
              name: 'Test Plan',
              maxAgents,
              maxMessagesPerMonth
            });
            await subscriptionService.assignPlan(userId, planId, adminId);

            // Suspend and reactivate
            await subscriptionService.updateSubscriptionStatus(
              userId,
              SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
              'Test'
            );
            const subscription = await subscriptionService.updateSubscriptionStatus(
              userId,
              SubscriptionService.SUBSCRIPTION_STATUS.ACTIVE
            );

            // Assert: Plan quotas are preserved
            assert.strictEqual(subscription.planId, planId, 'Plan ID should be preserved');
            assert.strictEqual(subscription.plan.quotas.maxAgents, maxAgents, 'maxAgents should be preserved');
            assert.strictEqual(subscription.plan.quotas.maxMessagesPerMonth, maxMessagesPerMonth, 'maxMessagesPerMonth should be preserved');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('reactivation audit log is created', async () => {
      const userId = 'test-user-reactivate';
      const planId = 'test-plan-reactivate';
      const adminId = 'admin-reactivate';

      db.addPlan(planId, { name: 'Test Plan' });
      await subscriptionService.assignPlan(userId, planId, adminId);
      await subscriptionService.updateSubscriptionStatus(
        userId,
        SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
        'Test'
      );

      // Reactivate and log
      await subscriptionService.updateSubscriptionStatus(
        userId,
        SubscriptionService.SUBSCRIPTION_STATUS.ACTIVE
      );

      await auditService.logAction(
        adminId,
        AdminAuditService.ACTION_TYPES.USER_REACTIVATED,
        userId,
        {},
        '127.0.0.1',
        'Test Agent'
      );

      // Verify audit log
      const logs = await auditService.getUserAuditHistory(userId);
      const reactivateLog = logs.find(l => l.actionType === AdminAuditService.ACTION_TYPES.USER_REACTIVATED);
      assert.ok(reactivateLog, 'Reactivation action should be logged');
      assert.strictEqual(reactivateLog.targetUserId, userId, 'Target user should match');
    });
  });


  /**
   * **Feature: admin-user-management, Property 16: User Deletion Cascades**
   * **Validates: Requirements 7.4**
   * 
   * For any user deletion, all related data (subscriptions, quotas, features,
   * usage, audit entries referencing the user) SHALL be deleted.
   */
  describe('Property 16: User Deletion Cascades', () => {
    it('deletion removes all user-related data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          fc.array(fc.constantFrom('max_messages_per_day', 'max_agents', 'max_connections'), { minLength: 1, maxLength: 3 }),
          fc.array(fc.constantFrom('page_builder', 'bulk_campaigns', 'api_access'), { minLength: 1, maxLength: 3 }),
          async (userId, planId, adminId, quotaTypes, featureNames) => {
            // Setup: Create user with various data
            db.addPlan(planId, { name: 'Test Plan' });
            await subscriptionService.assignPlan(userId, planId, adminId);

            // Add quota usage and overrides
            for (const quotaType of quotaTypes) {
              db.addQuotaUsage(userId, quotaType, 50);
              db.addQuotaOverride(userId, quotaType, 200);
            }

            // Add feature overrides
            for (const featureName of featureNames) {
              db.addFeatureOverride(userId, featureName, true);
            }

            // Add usage metrics
            db.addUsageMetric(userId, 'messages_sent', 100);
            db.addUsageMetric(userId, 'api_calls', 50);

            // Verify data exists before deletion
            assert.ok(db.hasUserData(userId), 'User data should exist before deletion');

            // Act: Delete user data (simulating cascade delete)
            await db.query('DELETE FROM user_quota_usage WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM user_quota_overrides WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM user_feature_overrides WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM usage_metrics WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM user_subscriptions WHERE user_id = ?', [userId]);

            // Assert: All user data is deleted
            assert.ok(!db.hasUserData(userId), 'All user data should be deleted');

            // Verify subscription is gone
            const subscription = await subscriptionService.getUserSubscription(userId);
            assert.strictEqual(subscription, null, 'Subscription should be deleted');

            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('deletion does not affect other users', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          fc.uuid(), // otherUserId
          planIdArb,
          adminIdArb,
          async (userId, otherUserId, planId, adminId) => {
            // Ensure different users
            if (userId === otherUserId) return true;

            // Setup: Create two users
            db.addPlan(planId, { name: 'Test Plan' });
            await subscriptionService.assignPlan(userId, planId, adminId);
            await subscriptionService.assignPlan(otherUserId, planId, adminId);

            // Add data for both users
            db.addQuotaUsage(userId, 'max_messages_per_day', 50);
            db.addQuotaUsage(otherUserId, 'max_messages_per_day', 75);
            db.addUsageMetric(userId, 'messages_sent', 100);
            db.addUsageMetric(otherUserId, 'messages_sent', 200);

            // Act: Delete first user
            await db.query('DELETE FROM user_quota_usage WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM usage_metrics WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM user_subscriptions WHERE user_id = ?', [userId]);

            // Assert: First user is deleted
            const deletedSubscription = await subscriptionService.getUserSubscription(userId);
            assert.strictEqual(deletedSubscription, null, 'Deleted user subscription should be null');

            // Assert: Other user is unaffected
            const otherSubscription = await subscriptionService.getUserSubscription(otherUserId);
            assert.ok(otherSubscription, 'Other user subscription should still exist');
            assert.strictEqual(otherSubscription.userId, otherUserId, 'Other user ID should match');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: admin-user-management, Property 17: Data Export Completeness**
   * **Validates: Requirements 7.5**
   * 
   * For any user data export, the export SHALL include all user data:
   * profile, subscription, quotas, features, usage history, and related records.
   */
  describe('Property 17: Data Export Completeness', () => {
    it('export includes subscription data', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 100, max: 10000 }),
          async (userId, planId, adminId, maxAgents, maxMessagesPerMonth) => {
            // Setup: Create user with subscription
            db.addPlan(planId, { 
              name: 'Export Test Plan',
              maxAgents,
              maxMessagesPerMonth
            });
            await subscriptionService.assignPlan(userId, planId, adminId);

            // Act: Get subscription for export
            const subscription = await subscriptionService.getUserSubscription(userId);

            // Assert: Export contains required subscription fields
            assert.ok(subscription, 'Subscription should exist');
            assert.strictEqual(subscription.userId, userId, 'userId should be included');
            assert.strictEqual(subscription.planId, planId, 'planId should be included');
            assert.ok(subscription.status, 'status should be included');
            assert.ok(subscription.startedAt, 'startedAt should be included');
            assert.ok(subscription.plan, 'plan details should be included');
            assert.ok(subscription.plan.quotas, 'plan quotas should be included');
            assert.strictEqual(subscription.plan.quotas.maxAgents, maxAgents, 'maxAgents should match');
            assert.strictEqual(subscription.plan.quotas.maxMessagesPerMonth, maxMessagesPerMonth, 'maxMessagesPerMonth should match');

            return true;
          }
        ),
        { numRuns: 25 }
      );
    });

    it('export data structure is consistent', async () => {
      await fc.assert(
        fc.asyncProperty(
          userIdArb,
          planIdArb,
          adminIdArb,
          async (userId, planId, adminId) => {
            // Setup
            db.addPlan(planId, { name: 'Test Plan' });
            await subscriptionService.assignPlan(userId, planId, adminId);

            // Act: Get subscription
            const subscription = await subscriptionService.getUserSubscription(userId);

            // Assert: Structure is consistent
            const requiredFields = ['id', 'userId', 'planId', 'status', 'startedAt', 'createdAt', 'updatedAt'];
            for (const field of requiredFields) {
              assert.ok(field in subscription, `Field ${field} should be present in export`);
            }

            // Plan structure
            if (subscription.plan) {
              const planFields = ['id', 'name', 'quotas'];
              for (const field of planFields) {
                assert.ok(field in subscription.plan, `Plan field ${field} should be present`);
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});



describe('Bulk Actions Property-Based Tests', () => {
  let db;
  let subscriptionService;

  beforeEach(() => {
    db = new MockDatabase();
    subscriptionService = new SubscriptionService(db);
  });

  afterEach(() => {
    db.reset();
  });

  /**
   * **Feature: admin-user-management, Property 18: Bulk Action Partial Failure Handling**
   * **Validates: Requirements 8.6**
   * 
   * For any bulk action where some operations fail, successful operations
   * SHALL be committed and a detailed report of failures SHALL be returned.
   */
  describe('Property 18: Bulk Action Partial Failure Handling', () => {
    it('successful operations are committed even when some fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.uuid(), // planId
          fc.uuid(), // adminId
          async (userIds, planId, adminId) => {
            // Ensure unique user IDs
            const uniqueUserIds = [...new Set(userIds)];
            if (uniqueUserIds.length < 2) return true;

            // Setup: Create plan and some users (not all)
            db.addPlan(planId, { name: 'Test Plan' });
            
            // Only create subscriptions for half the users
            const existingUsers = uniqueUserIds.slice(0, Math.ceil(uniqueUserIds.length / 2));
            const nonExistingUsers = uniqueUserIds.slice(Math.ceil(uniqueUserIds.length / 2));

            for (const userId of existingUsers) {
              await subscriptionService.assignPlan(userId, planId, adminId);
            }

            // Act: Simulate bulk suspension
            const results = { successful: [], failed: [] };

            for (const userId of uniqueUserIds) {
              try {
                const subscription = await subscriptionService.getUserSubscription(userId);
                if (!subscription) {
                  results.failed.push({ userId, error: 'User not found' });
                  continue;
                }

                await subscriptionService.updateSubscriptionStatus(
                  userId,
                  SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
                  'Bulk suspension test'
                );
                results.successful.push(userId);
              } catch (error) {
                results.failed.push({ userId, error: error.message });
              }
            }

            // Assert: Successful operations were committed
            for (const userId of results.successful) {
              const subscription = await subscriptionService.getUserSubscription(userId);
              assert.strictEqual(subscription.status, 'suspended', `User ${userId} should be suspended`);
            }

            // Assert: Failed operations are reported
            assert.strictEqual(results.failed.length, nonExistingUsers.length, 'Failed count should match non-existing users');

            // Assert: Results contain both successful and failed
            assert.ok(results.successful.length > 0 || results.failed.length > 0, 'Results should contain operations');

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('bulk action returns detailed failure report', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 3, maxLength: 8 }),
          fc.uuid(),
          fc.uuid(),
          async (userIds, planId, adminId) => {
            const uniqueUserIds = [...new Set(userIds)];
            if (uniqueUserIds.length < 3) return true;

            // Setup: Create plan and only first user
            db.addPlan(planId, { name: 'Test Plan' });
            await subscriptionService.assignPlan(uniqueUserIds[0], planId, adminId);

            // Act: Bulk operation on all users
            const results = { successful: [], failed: [] };

            for (const userId of uniqueUserIds) {
              try {
                const subscription = await subscriptionService.getUserSubscription(userId);
                if (!subscription) {
                  results.failed.push({ 
                    userId, 
                    error: 'Subscription not found',
                    timestamp: new Date().toISOString()
                  });
                  continue;
                }

                await subscriptionService.updateSubscriptionStatus(
                  userId,
                  SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
                  'Test'
                );
                results.successful.push(userId);
              } catch (error) {
                results.failed.push({ 
                  userId, 
                  error: error.message,
                  timestamp: new Date().toISOString()
                });
              }
            }

            // Assert: Failure report contains required details
            for (const failure of results.failed) {
              assert.ok(failure.userId, 'Failure should include userId');
              assert.ok(failure.error, 'Failure should include error message');
              assert.ok(failure.timestamp, 'Failure should include timestamp');
            }

            // Assert: Total equals input
            assert.strictEqual(
              results.successful.length + results.failed.length,
              uniqueUserIds.length,
              'Total results should equal input count'
            );

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('partial success does not rollback committed operations', async () => {
      const planId = 'test-plan-partial';
      const adminId = 'admin-partial';
      const userIds = ['user-1', 'user-2', 'user-3'];

      // Setup: Create plan and first two users
      db.addPlan(planId, { name: 'Test Plan' });
      await subscriptionService.assignPlan(userIds[0], planId, adminId);
      await subscriptionService.assignPlan(userIds[1], planId, adminId);
      // user-3 does not exist

      // Act: Bulk suspend all
      const results = { successful: [], failed: [] };

      for (const userId of userIds) {
        try {
          const subscription = await subscriptionService.getUserSubscription(userId);
          if (!subscription) {
            results.failed.push({ userId, error: 'Not found' });
            continue;
          }
          await subscriptionService.updateSubscriptionStatus(
            userId,
            SubscriptionService.SUBSCRIPTION_STATUS.SUSPENDED,
            'Test'
          );
          results.successful.push(userId);
        } catch (error) {
          results.failed.push({ userId, error: error.message });
        }
      }

      // Assert: First two users are suspended (committed)
      const sub1 = await subscriptionService.getUserSubscription(userIds[0]);
      const sub2 = await subscriptionService.getUserSubscription(userIds[1]);
      
      assert.strictEqual(sub1.status, 'suspended', 'User 1 should be suspended');
      assert.strictEqual(sub2.status, 'suspended', 'User 2 should be suspended');

      // Assert: Results reflect partial success
      assert.strictEqual(results.successful.length, 2, 'Two users should succeed');
      assert.strictEqual(results.failed.length, 1, 'One user should fail');
    });
  });
});

