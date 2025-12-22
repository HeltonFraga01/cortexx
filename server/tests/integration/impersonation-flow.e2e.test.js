// Load environment variables for tests
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const SuperadminService = require('../../services/SuperadminService');
const TenantService = require('../../services/TenantService');
const SupabaseService = require('../../services/SupabaseService');

/**
 * E2E Test: Superadmin Impersonation Flow
 * 
 * **Feature: multi-tenant-architecture, E2E Test 3: Impersonation Flow**
 * **Validates: Requirements 4.1, 4.2, 4.3**
 * 
 * This test validates the complete impersonation flow:
 * 1. Superadmin starts impersonation of a tenant
 * 2. Verify audit log entry is created
 * 3. Verify impersonation session has correct permissions
 * 4. Verify exit impersonation returns to superadmin context
 * 5. Verify audit trail is complete
 */

describe('E2E: Superadmin Impersonation Flow', () => {
  let superadminId = null;
  let tenantId = null;
  let impersonationSessionId = null;

  before(async () => {
    // Create test superadmin
    const { data: superadmin, error } = await SupabaseService.adminClient
      .from('superadmins')
      .insert({
        email: `test-impersonation-${Date.now()}@example.com`,
        password_hash: '$2b$10$test.hash.for.testing.purposes.only',
        name: 'Test Impersonation Superadmin',
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test superadmin: ${error.message}`);
    }

    superadminId = superadmin.id;

    // Create test tenant
    const tenant = await SuperadminService.createTenant({
      subdomain: `impersonation-test-${Date.now()}`,
      name: 'Impersonation Test Tenant',
      owner_superadmin_id: superadminId
    });

    tenantId = tenant.id;
  });

  after(async () => {
    // Cleanup
    try {
      if (impersonationSessionId) {
        await SuperadminService.endImpersonation(impersonationSessionId);
      }
      if (tenantId) {
        await SuperadminService.deleteTenant(tenantId);
      }
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

  it('should start impersonation and create audit log', async () => {
    // Start impersonation
    const impersonationSession = await SuperadminService.impersonateTenant(superadminId, tenantId);
    
    assert.ok(impersonationSession, 'Impersonation session should be created');
    assert.ok(impersonationSession.sessionId, 'Session should have ID');
    assert.strictEqual(impersonationSession.superadminId, superadminId, 'Session should reference superadmin');
    assert.strictEqual(impersonationSession.tenantId, tenantId, 'Session should reference tenant');
    assert.strictEqual(impersonationSession.role, 'tenant_admin', 'Session should have tenant_admin role');
    
    impersonationSessionId = impersonationSession.sessionId;

    // Verify audit log entry was created
    const { data: auditLogs, error } = await SupabaseService.adminClient
      .from('superadmin_audit_log')
      .select('*')
      .eq('superadmin_id', superadminId)
      .eq('tenant_id', tenantId)
      .eq('action', 'impersonate')
      .order('created_at', { ascending: false })
      .limit(1);

    assert.ok(!error, 'Audit log query should succeed');
    assert.ok(auditLogs && auditLogs.length > 0, 'Audit log entry should exist');

    const auditLog = auditLogs[0];
    assert.strictEqual(auditLog.superadmin_id, superadminId, 'Audit log should reference superadmin');
    assert.strictEqual(auditLog.tenant_id, tenantId, 'Audit log should reference tenant');
    assert.strictEqual(auditLog.action, 'impersonate', 'Audit log should record impersonate action');
    assert.strictEqual(auditLog.resource_type, 'tenant', 'Audit log should specify resource type');
    assert.strictEqual(auditLog.resource_id, tenantId, 'Audit log should reference tenant ID');
    assert.ok(auditLog.details, 'Audit log should have details');
    assert.ok(auditLog.created_at, 'Audit log should have timestamp');
  });

  it('should have tenant admin permissions during impersonation', async () => {
    assert.ok(impersonationSessionId, 'Should have active impersonation session');

    // Test tenant admin operations that should work during impersonation
    
    // 1. Update tenant branding
    const updatedBranding = await TenantService.updateBranding(tenantId, {
      app_name: 'Impersonated App Name',
      primary_color: '#123456'
    });

    assert.ok(updatedBranding, 'Should be able to update branding during impersonation');
    assert.strictEqual(updatedBranding.app_name, 'Impersonated App Name', 'Branding should be updated');

    // 2. Create tenant plan
    const newPlan = await TenantService.createPlan(tenantId, {
      name: 'Impersonation Test Plan',
      price_cents: 999,
      quotas: {
        max_agents: 2,
        max_inboxes: 1,
        max_messages_per_day: 50
      },
      features: {
        webhooks: false,
        api_access: false
      }
    });

    assert.ok(newPlan, 'Should be able to create plan during impersonation');
    assert.strictEqual(newPlan.name, 'Impersonation Test Plan', 'Plan should be created correctly');
    assert.strictEqual(newPlan.tenant_id, tenantId, 'Plan should belong to correct tenant');

    // 3. List tenant accounts
    const accounts = await TenantService.listAccounts(tenantId);
    assert.ok(Array.isArray(accounts), 'Should be able to list accounts during impersonation');

    // 4. Get tenant stats
    const stats = await TenantService.getAccountStats(tenantId);
    assert.ok(stats, 'Should be able to get tenant stats during impersonation');
    assert.ok(typeof stats.total_accounts === 'number', 'Stats should include account count');
  });

  it('should be restricted to impersonated tenant only', async () => {
    // Create another tenant to test isolation
    const otherTenant = await SuperadminService.createTenant({
      subdomain: `other-tenant-${Date.now()}`,
      name: 'Other Tenant',
      owner_superadmin_id: superadminId
    });

    try {
      // During impersonation, should NOT be able to access other tenants
      try {
        await TenantService.updateBranding(otherTenant.id, {
          app_name: 'Should Not Work'
        });
        assert.fail('Should not be able to access other tenant during impersonation');
      } catch (error) {
        assert.ok(error.message.includes('access denied') || error.message.includes('not found'),
          'Should get access denied for other tenant');
      }

      // Should NOT be able to perform superadmin operations
      try {
        await SuperadminService.createTenant({
          subdomain: `should-not-work-${Date.now()}`,
          name: 'Should Not Work',
          owner_superadmin_id: superadminId
        });
        assert.fail('Should not be able to create tenant during impersonation');
      } catch (error) {
        assert.ok(error.message.includes('permission') || error.message.includes('access denied'),
          'Should get permission denied for superadmin operations');
      }

    } finally {
      // Cleanup other tenant
      await SuperadminService.deleteTenant(otherTenant.id);
    }
  });

  it('should end impersonation and return to superadmin context', async () => {
    assert.ok(impersonationSessionId, 'Should have active impersonation session');

    // End impersonation
    const result = await SuperadminService.endImpersonation(impersonationSessionId);
    
    assert.ok(result, 'End impersonation should succeed');
    assert.strictEqual(result.success, true, 'End impersonation should return success');

    // Verify audit log entry for end impersonation
    const { data: endAuditLogs, error } = await SupabaseService.adminClient
      .from('superadmin_audit_log')
      .select('*')
      .eq('superadmin_id', superadminId)
      .eq('tenant_id', tenantId)
      .eq('action', 'end_impersonation')
      .order('created_at', { ascending: false })
      .limit(1);

    assert.ok(!error, 'End impersonation audit log query should succeed');
    assert.ok(endAuditLogs && endAuditLogs.length > 0, 'End impersonation audit log should exist');

    const endAuditLog = endAuditLogs[0];
    assert.strictEqual(endAuditLog.action, 'end_impersonation', 'Should log end impersonation action');
    assert.strictEqual(endAuditLog.superadmin_id, superadminId, 'Should reference correct superadmin');
    assert.strictEqual(endAuditLog.tenant_id, tenantId, 'Should reference correct tenant');

    // Clear session ID since it's now invalid
    impersonationSessionId = null;

    // Verify superadmin operations work again
    const dashboardMetrics = await SuperadminService.getDashboardMetrics();
    assert.ok(dashboardMetrics, 'Should be able to access superadmin dashboard after ending impersonation');
    assert.ok(typeof dashboardMetrics.totalTenants === 'number', 'Dashboard should have tenant count');
  });

  it('should maintain complete audit trail', async () => {
    // Get all audit logs for this test session
    const { data: allAuditLogs, error } = await SupabaseService.adminClient
      .from('superadmin_audit_log')
      .select('*')
      .eq('superadmin_id', superadminId)
      .eq('tenant_id', tenantId)
      .in('action', ['impersonate', 'end_impersonation'])
      .order('created_at', { ascending: true });

    assert.ok(!error, 'Audit log query should succeed');
    assert.ok(allAuditLogs && allAuditLogs.length >= 2, 'Should have at least 2 audit entries');

    // Verify sequence of events
    const impersonateLog = allAuditLogs.find(log => log.action === 'impersonate');
    const endImpersonateLog = allAuditLogs.find(log => log.action === 'end_impersonation');

    assert.ok(impersonateLog, 'Should have impersonate audit log');
    assert.ok(endImpersonateLog, 'Should have end_impersonation audit log');

    // Verify chronological order
    const impersonateTime = new Date(impersonateLog.created_at);
    const endImpersonateTime = new Date(endImpersonateLog.created_at);
    
    assert.ok(endImpersonateTime > impersonateTime, 
      'End impersonation should be logged after start impersonation');

    // Verify all required fields are present
    for (const log of [impersonateLog, endImpersonateLog]) {
      assert.ok(log.id, 'Audit log should have ID');
      assert.strictEqual(log.superadmin_id, superadminId, 'Should reference correct superadmin');
      assert.strictEqual(log.tenant_id, tenantId, 'Should reference correct tenant');
      assert.strictEqual(log.resource_type, 'tenant', 'Should specify resource type');
      assert.strictEqual(log.resource_id, tenantId, 'Should reference tenant as resource');
      assert.ok(log.created_at, 'Should have timestamp');
      assert.ok(log.details, 'Should have details object');
    }
  });

  it('should prevent invalid impersonation attempts', async () => {
    // Try to impersonate non-existent tenant
    try {
      await SuperadminService.impersonateTenant(superadminId, 'non-existent-tenant-id');
      assert.fail('Should not be able to impersonate non-existent tenant');
    } catch (error) {
      assert.ok(error.message.includes('not found') || error.message.includes('invalid'),
        'Should get not found error for non-existent tenant');
    }

    // Try to impersonate with invalid superadmin
    try {
      await SuperadminService.impersonateTenant('invalid-superadmin-id', tenantId);
      assert.fail('Should not be able to impersonate with invalid superadmin');
    } catch (error) {
      assert.ok(error.message.includes('not found') || error.message.includes('invalid'),
        'Should get not found error for invalid superadmin');
    }

    // Try to end non-existent impersonation session
    try {
      await SuperadminService.endImpersonation('non-existent-session-id');
      assert.fail('Should not be able to end non-existent session');
    } catch (error) {
      assert.ok(error.message.includes('not found') || error.message.includes('invalid'),
        'Should get not found error for non-existent session');
    }
  });
});