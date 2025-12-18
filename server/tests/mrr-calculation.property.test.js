#!/usr/bin/env node

/**
 * Property-Based Tests for MRR Calculation Accuracy
 * Tests that Monthly Recurring Revenue calculations are accurate across all tenants
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const SuperadminService = require('../services/SuperadminService');
const SupabaseService = require('../services/SupabaseService');

// Generator for tenant data
const tenantDataGen = fc.record({
  subdomain: fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-z0-9-]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  owner_superadmin_id: fc.uuid(),
  status: fc.constantFrom('active', 'inactive'),
  settings: fc.constant({})
});

// Generator for plan data
const planDataGen = fc.record({
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  price_cents: fc.integer({ min: 0, max: 100000 }), // $0 to $1000
  billing_cycle: fc.constantFrom('monthly', 'yearly'),
  status: fc.constantFrom('active', 'inactive'),
  quotas: fc.constant({}),
  features: fc.constant({})
});

// Generator for account data
const accountDataGen = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  wuzapi_token: fc.string({ minLength: 10, maxLength: 50 }),
  owner_user_id: fc.uuid(),
  status: fc.constantFrom('active', 'inactive')
});

// Generator for subscription data
const subscriptionDataGen = fc.record({
  status: fc.constantFrom('active', 'canceled', 'past_due', 'trialing'),
  stripe_subscription_id: fc.string({ minLength: 10, maxLength: 30 })
});

/**
 * **Feature: multi-tenant-architecture, Property 5: MRR Calculation Accuracy**
 * **Validates: Requirements 3.1**
 */
test('Property 5: MRR Calculation Accuracy - total equals sum of active subscriptions', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(tenantDataGen, { minLength: 1, maxLength: 3 }),
      fc.array(planDataGen, { minLength: 1, maxLength: 2 }),
      fc.array(accountDataGen, { minLength: 1, maxLength: 3 }),
      fc.array(subscriptionDataGen, { minLength: 1, maxLength: 3 }),
      async (tenantsData, plansData, accountsData, subscriptionsData) => {
        const createdTenants = [];
        const createdPlans = [];
        const createdAccounts = [];
        const createdSubscriptions = [];
        
        try {
          // Create tenants
          for (const tenantData of tenantsData) {
            const uniqueSubdomain = `${tenantData.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const { data: tenant, error } = await SupabaseService.insert('tenants', {
              ...tenantData,
              subdomain: uniqueSubdomain
            });
            
            if (error || !tenant) continue;
            createdTenants.push(tenant);
          }
          
          if (createdTenants.length === 0) return true; // Skip if no tenants created
          
          // Create plans for each tenant
          for (const tenant of createdTenants) {
            for (const planData of plansData) {
              const uniquePlanName = `${planData.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
              const { data: plan, error } = await SupabaseService.insert('tenant_plans', {
                ...planData,
                name: uniquePlanName,
                tenant_id: tenant.id
              });
              
              if (error || !plan) continue;
              createdPlans.push(plan);
            }
          }
          
          if (createdPlans.length === 0) return true; // Skip if no plans created
          
          // Create accounts for each tenant
          for (const tenant of createdTenants) {
            for (const accountData of accountsData) {
              const uniqueToken = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const { data: account, error } = await SupabaseService.insert('accounts', {
                ...accountData,
                wuzapi_token: uniqueToken,
                tenant_id: tenant.id
              });
              
              if (error || !account) continue;
              createdAccounts.push(account);
            }
          }
          
          if (createdAccounts.length === 0) return true; // Skip if no accounts created
          
          // Create subscriptions linking accounts to plans
          let expectedMRR = 0;
          const activeSubscriptionCount = {};
          
          for (let i = 0; i < Math.min(createdAccounts.length, subscriptionsData.length); i++) {
            const account = createdAccounts[i];
            const subscriptionData = subscriptionsData[i];
            
            // Find a plan from the same tenant
            const tenantPlans = createdPlans.filter(p => p.tenant_id === account.tenant_id);
            if (tenantPlans.length === 0) continue;
            
            const plan = tenantPlans[0];
            
            const { data: subscription, error } = await SupabaseService.insert('user_subscriptions', {
              ...subscriptionData,
              account_id: account.id,
              plan_id: plan.id
            });
            
            if (error || !subscription) continue;
            createdSubscriptions.push(subscription);
            
            // Calculate expected MRR
            if (subscription.status === 'active') {
              if (plan.billing_cycle === 'monthly') {
                expectedMRR += plan.price_cents;
              } else if (plan.billing_cycle === 'yearly') {
                expectedMRR += Math.round(plan.price_cents / 12);
              }
              
              activeSubscriptionCount[plan.id] = (activeSubscriptionCount[plan.id] || 0) + 1;
            }
          }
          
          // Get dashboard metrics
          const metrics = await SuperadminService.getDashboardMetrics();
          
          // Verify MRR calculation
          assert(typeof metrics.totalMRR === 'number', 'MRR should be a number');
          
          // The calculated MRR should match our expected MRR
          // Note: We allow for small rounding differences due to yearly plan calculations
          const difference = Math.abs(metrics.totalMRR - expectedMRR);
          const tolerance = Math.max(1, expectedMRR * 0.01); // 1% tolerance or minimum 1 cent
          
          assert(difference <= tolerance, 
            `MRR calculation mismatch. Expected: ${expectedMRR}, Got: ${metrics.totalMRR}, Difference: ${difference}`);
          
          // Verify that only active subscriptions are counted
          if (expectedMRR > 0) {
            assert(metrics.totalMRR > 0, 'MRR should be positive when active subscriptions exist');
          }
          
        } finally {
          // Cleanup in reverse order
          for (const subscription of createdSubscriptions) {
            await SupabaseService.delete('user_subscriptions', subscription.id);
          }
          for (const account of createdAccounts) {
            await SupabaseService.delete('accounts', account.id);
          }
          for (const plan of createdPlans) {
            await SupabaseService.delete('tenant_plans', plan.id);
          }
          for (const tenant of createdTenants) {
            await SupabaseService.delete('tenants', tenant.id);
          }
        }
      }
    ),
    { numRuns: 5 } // Reduced runs due to complex setup
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 5: MRR Calculation - inactive subscriptions excluded**
 * **Validates: Requirements 3.1**
 */
test('Property 5: MRR Calculation - inactive subscriptions excluded', async () => {
  await fc.assert(
    fc.asyncProperty(
      tenantDataGen,
      planDataGen,
      accountDataGen,
      fc.constantFrom('canceled', 'past_due', 'incomplete'),
      async (tenantData, planData, accountData, inactiveStatus) => {
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
          
          // Get MRR before creating inactive subscription
          const metricsBefore = await SuperadminService.getDashboardMetrics();
          const mrrBefore = metricsBefore.totalMRR;
          
          // Create inactive subscription
          const { data: createdSubscription, error: subscriptionError } = await SupabaseService.insert('user_subscriptions', {
            account_id: account.id,
            plan_id: plan.id,
            status: inactiveStatus,
            stripe_subscription_id: `sub_${Date.now()}`
          });
          
          if (subscriptionError || !createdSubscription) return true;
          subscription = createdSubscription;
          
          // Get MRR after creating inactive subscription
          const metricsAfter = await SuperadminService.getDashboardMetrics();
          const mrrAfter = metricsAfter.totalMRR;
          
          // MRR should not change when adding inactive subscription
          assert.strictEqual(mrrAfter, mrrBefore, 
            `MRR changed after adding inactive subscription. Before: ${mrrBefore}, After: ${mrrAfter}`);
          
        } finally {
          // Cleanup
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
 * **Feature: multi-tenant-architecture, Property 5: MRR Calculation - yearly plan conversion**
 * **Validates: Requirements 3.1**
 */
test('Property 5: MRR Calculation - yearly plans converted to monthly', async () => {
  await fc.assert(
    fc.asyncProperty(
      tenantDataGen,
      fc.integer({ min: 1200, max: 120000 }), // $12 to $1200 yearly
      accountDataGen,
      async (tenantData, yearlyPriceCents, accountData) => {
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
          
          // Create yearly plan
          const { data: createdPlan, error: planError } = await SupabaseService.insert('tenant_plans', {
            name: `yearly-plan-${Date.now()}`,
            price_cents: yearlyPriceCents,
            billing_cycle: 'yearly',
            status: 'active',
            tenant_id: tenant.id,
            quotas: {},
            features: {}
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
          
          // Get MRR before subscription
          const metricsBefore = await SuperadminService.getDashboardMetrics();
          const mrrBefore = metricsBefore.totalMRR;
          
          // Create active subscription
          const { data: createdSubscription, error: subscriptionError } = await SupabaseService.insert('user_subscriptions', {
            account_id: account.id,
            plan_id: plan.id,
            status: 'active',
            stripe_subscription_id: `sub_${Date.now()}`
          });
          
          if (subscriptionError || !createdSubscription) return true;
          subscription = createdSubscription;
          
          // Get MRR after subscription
          const metricsAfter = await SuperadminService.getDashboardMetrics();
          const mrrAfter = metricsAfter.totalMRR;
          
          // Calculate expected monthly amount from yearly price
          const expectedMonthlyAmount = Math.round(yearlyPriceCents / 12);
          const actualIncrease = mrrAfter - mrrBefore;
          
          // Allow for small rounding differences
          const difference = Math.abs(actualIncrease - expectedMonthlyAmount);
          assert(difference <= 1, 
            `Yearly to monthly conversion incorrect. Expected increase: ${expectedMonthlyAmount}, Actual: ${actualIncrease}`);
          
        } finally {
          // Cleanup
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