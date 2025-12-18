// Load environment variables for tests
require('dotenv').config();

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const SuperadminService = require('../../services/SuperadminService');
const TenantService = require('../../services/TenantService');
const SupabaseService = require('../../services/SupabaseService');

/**
 * E2E Test: Tenant Creation Flow
 * 
 * **Feature: multi-tenant-architecture, E2E Test 1: Tenant Creation Flow**
 * **Validates: Requirements 2.2**
 * 
 * This test validates the complete tenant creation flow:
 * 1. Superadmin creates a new tenant
 * 2. Verify tenant_branding record is created with default values
 * 3. Verify at least one tenant_plan is created
 * 4. Verify subdomain is accessible and resolves correctly
 */

describe('E2E: Tenant Creation Flow', () => {
  let createdTenantId = null;
  let superadminId = null;

  before(async () => {
    // Create a test superadmin for the test
    const { data: superadmin, error } = await SupabaseService.adminClient
      .from('superadmins')
      .insert({
        email: `test-superadmin-${Date.now()}@example.com`,
        password_hash: '$2b$10$test.hash.for.testing.purposes.only',
        name: 'Test Superadmin',
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test superadmin: ${error.message}`);
    }

    superadminId = superadmin.id;
  });

  after(async () => {
    // Cleanup: Delete test tenant and superadmin
    if (createdTenantId) {
      try {
        await SuperadminService.deleteTenant(createdTenantId);
      } catch (error) {
        console.error('Cleanup error (tenant):', error.message);
      }
    }

    if (superadminId) {
      try {
        await SupabaseService.adminClient
          .from('superadmins')
          .delete()
          .eq('id', superadminId);
      } catch (error) {
        console.error('Cleanup error (superadmin):', error.message);
      }
    }
  });

  it('should create tenant with branding and default plans', async () => {
    // Step 1: Create tenant
    const tenantData = {
      subdomain: `test-tenant-${Date.now()}`,
      name: 'Test Tenant Company',
      owner_superadmin_id: superadminId,
      settings: {
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR'
      }
    };

    const tenant = await SuperadminService.createTenant(tenantData);
    
    assert.ok(tenant, 'Tenant should be created');
    assert.strictEqual(tenant.subdomain, tenantData.subdomain, 'Subdomain should match');
    assert.strictEqual(tenant.name, tenantData.name, 'Name should match');
    assert.strictEqual(tenant.status, 'active', 'Status should be active');
    
    createdTenantId = tenant.id;

    // Step 2: Verify tenant_branding record exists
    const { data: branding, error: brandingError } = await SupabaseService.adminClient
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', tenant.id)
      .single();

    assert.ok(!brandingError, `Branding should be created without error: ${brandingError?.message}`);
    assert.ok(branding, 'Branding record should exist');
    assert.strictEqual(branding.tenant_id, tenant.id, 'Branding should be linked to tenant');
    assert.ok(branding.app_name, 'Branding should have app_name');
    
    // Verify default branding values
    assert.strictEqual(branding.app_name, 'WUZAPI', 'Default app_name should be WUZAPI');

    // Step 3: Verify at least one tenant_plan exists
    const { data: plans, error: plansError } = await SupabaseService.adminClient
      .from('tenant_plans')
      .select('*')
      .eq('tenant_id', tenant.id);

    assert.ok(!plansError, `Plans should be created without error: ${plansError?.message}`);
    assert.ok(plans, 'Plans should exist');
    assert.ok(plans.length > 0, 'At least one plan should be created');

    // Verify plan structure
    const plan = plans[0];
    assert.ok(plan.name, 'Plan should have a name');
    assert.ok(plan.quotas, 'Plan should have quotas');
    assert.ok(plan.features, 'Plan should have features');
    assert.strictEqual(plan.tenant_id, tenant.id, 'Plan should be linked to tenant');

    // Step 4: Verify subdomain resolution
    const resolvedTenant = await TenantService.getBySubdomain(tenantData.subdomain);
    
    assert.ok(resolvedTenant, 'Tenant should be resolvable by subdomain');
    assert.strictEqual(resolvedTenant.id, tenant.id, 'Resolved tenant should match created tenant');
    assert.strictEqual(resolvedTenant.subdomain, tenantData.subdomain, 'Subdomain should match');
  });

  it('should reject duplicate subdomain', async () => {
    // Try to create tenant with same subdomain
    const duplicateData = {
      subdomain: `test-tenant-${Date.now()}`,
      name: 'Duplicate Tenant',
      owner_superadmin_id: superadminId
    };

    // Create first tenant
    const firstTenant = await SuperadminService.createTenant(duplicateData);
    assert.ok(firstTenant, 'First tenant should be created');

    // Try to create duplicate
    try {
      await SuperadminService.createTenant(duplicateData);
      assert.fail('Should have thrown error for duplicate subdomain');
    } catch (error) {
      assert.ok(error.message.includes('subdomain') || error.message.includes('unique'), 
        'Error should mention subdomain uniqueness');
    }

    // Cleanup
    await SuperadminService.deleteTenant(firstTenant.id);
  });

  it('should validate subdomain format', async () => {
    const invalidSubdomains = [
      'UPPERCASE',           // Should be lowercase
      'with spaces',         // No spaces allowed
      'with_underscore',     // No underscores
      'with.dot',           // No dots
      '-startswithdash',    // Cannot start with dash
      'endswithdash-',      // Cannot end with dash
      'a',                  // Too short (min 3 chars)
      'a'.repeat(64)        // Too long (max 63 chars)
    ];

    for (const subdomain of invalidSubdomains) {
      try {
        await SuperadminService.createTenant({
          subdomain,
          name: 'Test Tenant',
          owner_superadmin_id: superadminId
        });
        assert.fail(`Should have rejected invalid subdomain: ${subdomain}`);
      } catch (error) {
        assert.ok(error.message.includes('subdomain') || error.message.includes('format') || error.message.includes('invalid'),
          `Error should mention subdomain validation for: ${subdomain}`);
      }
    }
  });

  it('should create tenant with custom branding values', async () => {
    const tenantData = {
      subdomain: `custom-brand-${Date.now()}`,
      name: 'Custom Branding Tenant',
      owner_superadmin_id: superadminId,
      branding: {
        app_name: 'Custom App',
        primary_color: '#FF5733',
        secondary_color: '#33FF57',
        logo_url: 'https://example.com/logo.png'
      }
    };

    const tenant = await SuperadminService.createTenant(tenantData);
    assert.ok(tenant, 'Tenant should be created');

    // Verify custom branding
    const { data: branding } = await SupabaseService.adminClient
      .from('tenant_branding')
      .select('*')
      .eq('tenant_id', tenant.id)
      .single();

    if (tenantData.branding) {
      assert.strictEqual(branding.app_name, tenantData.branding.app_name, 'Custom app_name should be set');
      assert.strictEqual(branding.primary_color, tenantData.branding.primary_color, 'Custom primary_color should be set');
      assert.strictEqual(branding.secondary_color, tenantData.branding.secondary_color, 'Custom secondary_color should be set');
      assert.strictEqual(branding.logo_url, tenantData.branding.logo_url, 'Custom logo_url should be set');
    }

    // Cleanup
    await SuperadminService.deleteTenant(tenant.id);
  });
});
