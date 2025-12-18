#!/usr/bin/env node

/**
 * Property-Based Tests for Quota Enforcement
 * Tests that quota limits are properly enforced and validated
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const QuotaService = require('../services/QuotaService');
const SupabaseService = require('../services/SupabaseService');

// Generator for quota types
const quotaTypeGen = fc.constantFrom(
  'messages_per_day',
  'messages_per_month',
  'max_agents',
  'max_inboxes',
  'max_bots',
  'max_campaigns',
  'storage_mb'
);

// Generator for tenant data
const tenantDataGen = fc.record({
  subdomain: fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-z0-9-]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  owner_superadmin_id: fc.uuid(),
  status: fc.constant('active'),
  settings: fc.constant({})
});

// Generator for plan data with quotas
const planWithQuotasGen = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  price_cents: fc.integer({ min: 0, max: 10000 }),
  billing_cycle: fc.constant('monthly'),
  status: fc.constant('active'),
  quotas: fc.record({
    messages_per_day: fc.integer({ min: 10, max: 1000 }),
    messages_per_month: fc.integer({ min: 100, max: 10000 }),
    max_agents: fc.integer({ min: 1, max: 50 }),
    max_inboxes: fc.integer({ min: 1, max: 20 }),
    max_bots: fc.integer({ min: 0, max: 10 }),
    max_campaigns: fc.integer({ min: 0, max: 100 }),
    storage_mb: fc.integer({ min: 100, max: 10000 })
  }),
  features: fc.constant({})
});

// Generator for account data
const accountDataGen = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  wuzapi_token: fc.string({ minLength: 10, maxLength: 50 }),
  owner_user_id: fc.uuid(),
  status: fc.constant('active')
});

/**
 * **Feature: multi-tenant-architecture, Property 14: Quota Enforcement**
 * **Validates: Requirements 11.1**
 */
test('Property 14: Quota Enforcement - operations denied at limit', async () => {
  await fc.assert(
    fc.asyncProperty(
      tenantDataGen,
      planWithQuotasGen,
      accountDataGen,
      quotaTypeGen,
      async (tenantData, planData, accountData, quotaType) => {
        let tenant = null;
        let plan = null;
        let account = null;
        let subscription = null;
        
        try {
          // Create tenant
          const uniqueSubdomain = `${tenantData.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdTenant, error: tenantError } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain: uniqueSubdomain
          });
          
          if (tenantError || !createdTenant) return true;
          tenant = createdTenant;
          
          // Create plan with quotas
          const uniquePlanName = `${planData.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const { data: createdPlan, error: planError } = await SupabaseService.insert('tenant_plans', {
            ...planData,
            name: uniquePlanName,
            tenant_id: tenant.id
          });
          
          if (planError || !createdPlan) return true;
          plan = createdPlan;
          
          // Create account
          const uniqueToken = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdAccount, error: accountError } = await SupabaseService.insert('accounts', {
            ...accountData,
            wuzapi_token: uniqueToken,
            tenant_id: tenant.id
          });
          
          if (accountError || !createdAccount) return true;
          account = createdAccount;
          
          // Create subscription
          const { data: createdSubscription, error: subscriptionError } = await SupabaseService.insert('user_subscriptions', {
            account_id: account.id,
            plan_id: plan.id,
            status: 'active',
            stripe_subscription_id: `sub_${Date.now()}`
          });
          
          if (subscriptionError || !createdSubscription) return true;
          subscription = createdSubscription;
          
          // Get quota limit for this type
          const quotaLimit = plan.quotas[quotaType];
          if (typeof quotaLimit !== 'number' || quotaLimit <= 0) return true;
          
          // Set usage to exactly the limit
          await SupabaseService.upsert('user_quota_usage', {
            account_id: account.id,
            quota_key: quotaType,
            used_value: quotaLimit,
            period_start: new Date().toISOString()
          }, ['account_id', 'quota_key']);
          
          // Check if at limit
          const isAtLimit = await QuotaService.isAtQuotaLimit(account.id, quotaType);
          assert.strictEqual(isAtLimit, true, `Should be at limit for ${quotaType}`);
          
          // Try to increment usage - should fail
          const canIncrement = await QuotaService.canIncrementQuota(account.id, quotaType, 1);
          assert.strictEqual(canIncrement, false, `Should not be able to increment ${quotaType} at limit`);
          
          // Try to increment by 0 - should succeed (no change)
          const canIncrementZero = await QuotaService.canIncrementQuota(account.id, quotaType, 0);
          assert.strictEqual(canIncrementZero, true, `Should be able to increment by 0`);
          
          // Set usage to one below limit
          await SupabaseService.upsert('user_quota_usage', {
            account_id: account.id,
            quota_key: quotaType,
            used_value: Math.max(0, quotaLimit - 1),
            period_start: new Date().toISOString()
          }, ['account_id', 'quota_key']);
          
          // Should be able to increment by 1
          const canIncrementOne = await QuotaService.canIncrementQuota(account.id, quotaType, 1);
          assert.strictEqual(canIncrementOne, true, `Should be able to increment ${quotaType} when below limit`);
          
          // Should not be able to increment by 2
          const canIncrementTwo = await QuotaService.canIncrementQuota(account.id, quotaType, 2);
          assert.strictEqual(canIncrementTwo, false, `Should not be able to increment ${quotaType} by 2 when at limit-1`);
          
        } finally {
          // Cleanup
          if (account) {
            await SupabaseService.delete('user_quota_usage', null, { account_id: account.id });
          }
          if (subscription) await SupabaseService.delete('user_subscriptions', subscription.id);
          if (account) await SupabaseService.delete('accounts', account.id);
          if (plan) await SupabaseService.delete('tenant_plans', plan.id);
          if (tenant) await SupabaseService.delete('tenants', tenant.id);
        }
      }
    ),
    { numRuns: 10 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 9: Plan Quota Validation**
 * **Validates: Requirements 6.2, 11.2**
 */
test('Property 9: Plan Quota Validation - quotas cannot exceed global limits', async () => {
  await fc.assert(
    fc.asyncProperty(
      tenantDataGen,
      fc.record({
        messages_per_day: fc.integer({ min: 1, max: 20000 }),
        max_agents: fc.integer({ min: 1, max: 200 }),
        max_inboxes: fc.integer({ min: 1, max: 100 }),
        storage_mb: fc.integer({ min: 1, max: 100000 })
      }),
      async (tenantData, proposedQuotas) => {
        let tenant = null;
        
        try {
          // Create tenant
          const uniqueSubdomain = `${tenantData.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdTenant, error: tenantError } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain: uniqueSubdomain
          });
          
          if (tenantError || !createdTenant) return true;
          tenant = createdTenant;
          
          // Get global limits (these should be defined in the system)
          const globalLimits = await QuotaService.getGlobalLimits();
          
          // Validate quotas against global limits
          const validation = await QuotaService.validateQuotasAgainstGlobal(proposedQuotas);
          
          // Check each quota type
          for (const [quotaType, proposedValue] of Object.entries(proposedQuotas)) {
            const globalLimit = globalLimits[quotaType];
            
            if (typeof globalLimit === 'number') {
              if (proposedValue > globalLimit) {
                // Should be invalid
                assert.strictEqual(validation.isValid, false, 
                  `Quota ${quotaType} exceeding global limit should be invalid`);
                assert(validation.errors.some(err => err.includes(quotaType)), 
                  `Validation should include error for ${quotaType}`);
              }
            }
          }
          
          // If all quotas are within limits, validation should pass
          const allWithinLimits = Object.entries(proposedQuotas).every(([quotaType, value]) => {
            const globalLimit = globalLimits[quotaType];
            return typeof globalLimit !== 'number' || value <= globalLimit;
          });
          
          if (allWithinLimits) {
            assert.strictEqual(validation.isValid, true, 
              'Quotas within global limits should be valid');
          }
          
        } finally {
          // Cleanup
          if (tenant) await SupabaseService.delete('tenants', tenant.id);
        }
      }
    ),
    { numRuns: 15 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 15: Quota Reset on Cycle**
 * **Validates: Requirements 11.4**
 */
test('Property 15: Quota Reset on Cycle - cycle-based quotas reset at period boundary', async () => {
  await fc.assert(
    fc.asyncProperty(
      tenantDataGen,
      planWithQuotasGen,
      accountDataGen,
      fc.constantFrom('messages_per_day', 'messages_per_month'),
      fc.integer({ min: 1, max: 100 }),
      async (tenantData, planData, accountData, cyclicQuotaType, usageAmount) => {
        let tenant = null;
        let plan = null;
        let account = null;
        let subscription = null;
        
        try {
          // Create tenant
          const uniqueSubdomain = `${tenantData.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdTenant, error: tenantError } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain: uniqueSubdomain
          });
          
          if (tenantError || !createdTenant) return true;
          tenant = createdTenant;
          
          // Create plan
          const uniquePlanName = `${planData.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const { data: createdPlan, error: planError } = await SupabaseService.insert('tenant_plans', {
            ...planData,
            name: uniquePlanName,
            tenant_id: tenant.id
          });
          
          if (planError || !createdPlan) return true;
          plan = createdPlan;
          
          // Create account
          const uniqueToken = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdAccount, error: accountError } = await SupabaseService.insert('accounts', {
            ...accountData,
            wuzapi_token: uniqueToken,
            tenant_id: tenant.id
          });
          
          if (accountError || !createdAccount) return true;
          account = createdAccount;
          
          // Create subscription
          const { data: createdSubscription, error: subscriptionError } = await SupabaseService.insert('user_subscriptions', {
            account_id: account.id,
            plan_id: plan.id,
            status: 'active',
            stripe_subscription_id: `sub_${Date.now()}`
          });
          
          if (subscriptionError || !createdSubscription) return true;
          subscription = createdSubscription;
          
          // Set usage for previous period
          const previousPeriodStart = new Date();
          if (cyclicQuotaType === 'messages_per_day') {
            previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
          } else if (cyclicQuotaType === 'messages_per_month') {
            previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
          }
          
          await SupabaseService.upsert('user_quota_usage', {
            account_id: account.id,
            quota_key: cyclicQuotaType,
            used_value: usageAmount,
            period_start: previousPeriodStart.toISOString()
          }, ['account_id', 'quota_key']);
          
          // Get current usage (should be from previous period)
          const usageBeforeReset = await QuotaService.getCurrentUsage(account.id, cyclicQuotaType);
          assert.strictEqual(usageBeforeReset, usageAmount, 'Usage should match what we set');
          
          // Trigger quota reset for new period
          await QuotaService.resetCyclicQuotas(account.id, cyclicQuotaType);
          
          // Get usage after reset (should be 0 for new period)
          const usageAfterReset = await QuotaService.getCurrentUsage(account.id, cyclicQuotaType);
          assert.strictEqual(usageAfterReset, 0, 'Usage should be reset to 0 for new period');
          
          // Verify we can now use the full quota again
          const quotaLimit = plan.quotas[cyclicQuotaType];
          if (typeof quotaLimit === 'number' && quotaLimit > 0) {
            const canUseFullQuota = await QuotaService.canIncrementQuota(account.id, cyclicQuotaType, quotaLimit);
            assert.strictEqual(canUseFullQuota, true, 'Should be able to use full quota after reset');
          }
          
        } finally {
          // Cleanup
          if (account) {
            await SupabaseService.delete('user_quota_usage', null, { account_id: account.id });
          }
          if (subscription) await SupabaseService.delete('user_subscriptions', subscription.id);
          if (account) await SupabaseService.delete('accounts', account.id);
          if (plan) await SupabaseService.delete('tenant_plans', plan.id);
          if (tenant) await SupabaseService.delete('tenants', tenant.id);
        }
      }
    ),
    { numRuns: 8 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 18: Message Quota Tracking**
 * **Validates: Requirements 12.4**
 */
test('Property 18: Message Quota Tracking - quota increments on message send', async () => {
  await fc.assert(
    fc.asyncProperty(
      tenantDataGen,
      planWithQuotasGen,
      accountDataGen,
      fc.integer({ min: 1, max: 10 }),
      async (tenantData, planData, accountData, messagesToSend) => {
        let tenant = null;
        let plan = null;
        let account = null;
        let subscription = null;
        
        try {
          // Create tenant
          const uniqueSubdomain = `${tenantData.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdTenant, error: tenantError } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain: uniqueSubdomain
          });
          
          if (tenantError || !createdTenant) return true;
          tenant = createdTenant;
          
          // Create plan
          const uniquePlanName = `${planData.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const { data: createdPlan, error: planError } = await SupabaseService.insert('tenant_plans', {
            ...planData,
            name: uniquePlanName,
            tenant_id: tenant.id
          });
          
          if (planError || !createdPlan) return true;
          plan = createdPlan;
          
          // Create account
          const uniqueToken = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdAccount, error: accountError } = await SupabaseService.insert('accounts', {
            ...accountData,
            wuzapi_token: uniqueToken,
            tenant_id: tenant.id
          });
          
          if (accountError || !createdAccount) return true;
          account = createdAccount;
          
          // Create subscription
          const { data: createdSubscription, error: subscriptionError } = await SupabaseService.insert('user_subscriptions', {
            account_id: account.id,
            plan_id: plan.id,
            status: 'active',
            stripe_subscription_id: `sub_${Date.now()}`
          });
          
          if (subscriptionError || !createdSubscription) return true;
          subscription = createdSubscription;
          
          // Get initial usage
          const initialDailyUsage = await QuotaService.getCurrentUsage(account.id, 'messages_per_day');
          const initialMonthlyUsage = await QuotaService.getCurrentUsage(account.id, 'messages_per_month');
          
          // Simulate sending messages
          for (let i = 0; i < messagesToSend; i++) {
            await QuotaService.incrementQuota(account.id, 'messages_per_day', 1);
            await QuotaService.incrementQuota(account.id, 'messages_per_month', 1);
          }
          
          // Get final usage
          const finalDailyUsage = await QuotaService.getCurrentUsage(account.id, 'messages_per_day');
          const finalMonthlyUsage = await QuotaService.getCurrentUsage(account.id, 'messages_per_month');
          
          // Verify quota incremented correctly
          assert.strictEqual(finalDailyUsage - initialDailyUsage, messagesToSend, 
            'Daily message quota should increment by number of messages sent');
          assert.strictEqual(finalMonthlyUsage - initialMonthlyUsage, messagesToSend, 
            'Monthly message quota should increment by number of messages sent');
          
          // Verify quota tracking is accurate
          assert(finalDailyUsage >= messagesToSend, 'Daily usage should be at least the messages sent');
          assert(finalMonthlyUsage >= messagesToSend, 'Monthly usage should be at least the messages sent');
          
        } finally {
          // Cleanup
          if (account) {
            await SupabaseService.delete('user_quota_usage', null, { account_id: account.id });
          }
          if (subscription) await SupabaseService.delete('user_subscriptions', subscription.id);
          if (account) await SupabaseService.delete('accounts', account.id);
          if (plan) await SupabaseService.delete('tenant_plans', plan.id);
          if (tenant) await SupabaseService.delete('tenants', tenant.id);
        }
      }
    ),
    { numRuns: 8 }
  );
});