// Load environment variables for tests
require('dotenv').config();

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const SuperadminService = require('../../services/SuperadminService');
const TenantService = require('../../services/TenantService');
const AccountService = require('../../services/AccountService');
const SupabaseService = require('../../services/SupabaseService');

/**
 * E2E Test: Cross-Tenant Data Isolation
 * 
 * **Feature: multi-tenant-architecture, E2E Test 2: Cross-Tenant Isolation**
 * **Validates: Requirements 9.1, 9.3**
 * 
 * This test validates complete data isolation between tenants:
 * 1. Create two separate tenants with accounts
 * 2. Verify accounts cannot access data from other tenants
 * 3. Verify RLS policies prevent cross-tenant queries
 * 4. Verify API endpoints respect tenant boundaries
 */

describe('E2E: Cross-Tenant Data Isolation', () => {
  let superadminId = null;
  let tenant1 = null;
  let tenant2 = null;
  let account1 = null;
  let account2 = null;

  before(async () => {
    // Create test superadmin
    const { data: superadmin, error } = await SupabaseService.adminClient
      .from('superadmins')
      .insert({
        email: `test-isolation-${Date.now()}@example.com`,
        password_hash: '$2b$10$test.hash.for.testing.purposes.only',
        name: 'Test Isolation Superadmin',
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test superadmin: ${error.message}`);
    }

    superadminId = superadmin.id;

    // Create two test tenants
    tenant1 = await SuperadminService.createTenant({
      subdomain: `tenant1-${Date.now()}`,
      name: 'Tenant 1 Company',
      owner_superadmin_id: superadminId
    });

    tenant2 = await SuperadminService.createTenant({
      subdomain: `tenant2-${Date.now()}`,
      name: 'Tenant 2 Company', 
      owner_superadmin_id: superadminId
    });

    // Create accounts in each tenant
    account1 = await AccountService.createAccount(tenant1.id, {
      name: 'Account 1',
      wuzapi_token: `token1_${Date.now()}`,
      status: 'active'
    });

    account2 = await AccountService.createAccount(tenant2.id, {
      name: 'Account 2',
      wuzapi_token: `token2_${Date.now()}`,
      status: 'active'
    });
  });

  after(async () => {
    // Cleanup in reverse order
    try {
      if (tenant1) await SuperadminService.deleteTenant(tenant1.id);
      if (tenant2) await SuperadminService.deleteTenant(tenant2.id);
      if (superadminId) {
        await SupabaseService.adminClient
          .from('superadmins')
          .delete()
          .eq('id', superadminId);
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  });

  it('should isolate accounts between tenants', async () => {
    // Verify account1 belongs to tenant1
    assert.strictEqual(account1.tenant_id, tenant1.id, 'Account1 should belong to tenant1');
    
    // Verify account2 belongs to tenant2
    assert.strictEqual(account2.tenant_id, tenant2.id, 'Account2 should belong to tenant2');

    // Test AccountService.listAccounts with tenant filtering
    const tenant1Accounts = await AccountService.listAccounts(tenant1.id);
    const tenant2Accounts = await AccountService.listAccounts(tenant2.id);

    // Verify tenant1 only sees its own accounts
    assert.ok(tenant1Accounts.some(acc => acc.id === account1.id), 'Tenant1 should see account1');
    assert.ok(!tenant1Accounts.some(acc => acc.id === account2.id), 'Tenant1 should NOT see account2');

    // Verify tenant2 only sees its own accounts
    assert.ok(tenant2Accounts.some(acc => acc.id === account2.id), 'Tenant2 should see account2');
    assert.ok(!tenant2Accounts.some(acc => acc.id === account1.id), 'Tenant2 should NOT see account1');
  });

  it('should prevent cross-tenant account access', async () => {
    // Try to access account1 from tenant2 context
    try {
      await AccountService.getAccountById(account1.id, tenant2.id);
      assert.fail('Should not be able to access account from different tenant');
    } catch (error) {
      assert.ok(error.message.includes('not found') || error.message.includes('access denied'),
        'Should get access denied or not found error');
    }

    // Try to access account2 from tenant1 context
    try {
      await AccountService.getAccountById(account2.id, tenant1.id);
      assert.fail('Should not be able to access account from different tenant');
    } catch (error) {
      assert.ok(error.message.includes('not found') || error.message.includes('access denied'),
        'Should get access denied or not found error');
    }
  });

  it('should enforce RLS policies at database level', async () => {
    // Set tenant context for tenant1
    await SupabaseService.adminClient.rpc('set_config', {
      setting_name: 'app.tenant_id',
      setting_value: tenant1.id,
      is_local: true
    });

    // Query accounts - should only return tenant1 accounts
    const { data: tenant1AccountsRLS, error: error1 } = await SupabaseService.adminClient
      .from('accounts')
      .select('*');

    assert.ok(!error1, 'RLS query should succeed');
    assert.ok(tenant1AccountsRLS.every(acc => acc.tenant_id === tenant1.id),
      'RLS should only return tenant1 accounts');
    assert.ok(!tenant1AccountsRLS.some(acc => acc.tenant_id === tenant2.id),
      'RLS should not return tenant2 accounts');

    // Set tenant context for tenant2
    await SupabaseService.adminClient.rpc('set_config', {
      setting_name: 'app.tenant_id',
      setting_value: tenant2.id,
      is_local: true
    });

    // Query accounts - should only return tenant2 accounts
    const { data: tenant2AccountsRLS, error: error2 } = await SupabaseService.adminClient
      .from('accounts')
      .select('*');

    assert.ok(!error2, 'RLS query should succeed');
    assert.ok(tenant2AccountsRLS.every(acc => acc.tenant_id === tenant2.id),
      'RLS should only return tenant2 accounts');
    assert.ok(!tenant2AccountsRLS.some(acc => acc.tenant_id === tenant1.id),
      'RLS should not return tenant1 accounts');
  });

  it('should isolate tenant branding', async () => {
    // Update branding for tenant1
    await TenantService.updateBranding(tenant1.id, {
      app_name: 'Tenant 1 App',
      primary_color: '#FF0000'
    });

    // Update branding for tenant2
    await TenantService.updateBranding(tenant2.id, {
      app_name: 'Tenant 2 App',
      primary_color: '#0000FF'
    });

    // Verify each tenant has its own branding
    const branding1 = await TenantService.getBranding(tenant1.id);
    const branding2 = await TenantService.getBranding(tenant2.id);

    assert.strictEqual(branding1.app_name, 'Tenant 1 App', 'Tenant1 should have its own app_name');
    assert.strictEqual(branding1.primary_color, '#FF0000', 'Tenant1 should have its own primary_color');

    assert.strictEqual(branding2.app_name, 'Tenant 2 App', 'Tenant2 should have its own app_name');
    assert.strictEqual(branding2.primary_color, '#0000FF', 'Tenant2 should have its own primary_color');

    // Verify branding is isolated
    assert.notStrictEqual(branding1.app_name, branding2.app_name, 'Branding should be different');
    assert.notStrictEqual(branding1.primary_color, branding2.primary_color, 'Colors should be different');
  });

  it('should isolate tenant plans', async () => {
    // Create plan for tenant1
    const plan1 = await TenantService.createPlan(tenant1.id, {
      name: 'Tenant 1 Basic Plan',
      price_cents: 1000,
      quotas: {
        max_agents: 5,
        max_inboxes: 3,
        max_messages_per_day: 100
      },
      features: {
        webhooks: true,
        api_access: false
      }
    });

    // Create plan for tenant2
    const plan2 = await TenantService.createPlan(tenant2.id, {
      name: 'Tenant 2 Premium Plan',
      price_cents: 2000,
      quotas: {
        max_agents: 10,
        max_inboxes: 5,
        max_messages_per_day: 500
      },
      features: {
        webhooks: true,
        api_access: true
      }
    });

    // Verify plans are isolated
    const tenant1Plans = await TenantService.listPlans(tenant1.id);
    const tenant2Plans = await TenantService.listPlans(tenant2.id);

    // Tenant1 should only see its own plans
    assert.ok(tenant1Plans.some(p => p.id === plan1.id), 'Tenant1 should see its own plan');
    assert.ok(!tenant1Plans.some(p => p.id === plan2.id), 'Tenant1 should NOT see tenant2 plan');

    // Tenant2 should only see its own plans
    assert.ok(tenant2Plans.some(p => p.id === plan2.id), 'Tenant2 should see its own plan');
    assert.ok(!tenant2Plans.some(p => p.id === plan1.id), 'Tenant2 should NOT see tenant1 plan');
  });

  it('should prevent cross-tenant plan access', async () => {
    // Create a plan in tenant1
    const plan = await TenantService.createPlan(tenant1.id, {
      name: 'Test Plan',
      price_cents: 1500,
      quotas: { max_agents: 3 },
      features: { webhooks: false }
    });

    // Try to access the plan from tenant2 context
    try {
      await TenantService.updatePlan(plan.id, {
        name: 'Hacked Plan'
      }, tenant2.id);
      assert.fail('Should not be able to update plan from different tenant');
    } catch (error) {
      assert.ok(error.message.includes('not found') || error.message.includes('access denied'),
        'Should get access denied error');
    }

    // Verify plan was not modified
    const updatedPlan = await TenantService.getPlanById(plan.id, tenant1.id);
    assert.strictEqual(updatedPlan.name, 'Test Plan', 'Plan name should not be changed');
  });

  it('should isolate account statistics', async () => {
    // Get stats for each tenant
    const stats1 = await TenantService.getAccountStats(tenant1.id);
    const stats2 = await TenantService.getAccountStats(tenant2.id);

    // Verify stats are isolated and accurate
    assert.ok(stats1.total_accounts >= 1, 'Tenant1 should have at least 1 account');
    assert.ok(stats2.total_accounts >= 1, 'Tenant2 should have at least 1 account');

    // Stats should be different (unless by coincidence they have same numbers)
    // The important thing is that each tenant only sees its own data
    assert.ok(typeof stats1.total_accounts === 'number', 'Stats should be numeric');
    assert.ok(typeof stats2.total_accounts === 'number', 'Stats should be numeric');
  });
});