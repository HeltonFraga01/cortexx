/**
 * WebhookAccountRouter Tenant Context Tests
 * Tests for multi-tenant webhook routing
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const WebhookAccountRouter = require('../../services/WebhookAccountRouter');

describe('WebhookAccountRouter - Tenant Context', () => {
  let router;
  let mockDb;

  // Mock database
  class MockDatabase {
    constructor() {
      this.accounts = new Map();
      this.tenants = new Map();
      this.conversations = new Map();
      this.agents = new Map();
    }

    async query(sql, params = []) {
      // Mock account lookup with tenant join
      if (sql.includes('FROM accounts a') && sql.includes('JOIN tenants t')) {
        const token = params[0];
        const account = this.accounts.get(token);
        if (!account) return { rows: [] };
        
        const tenant = this.tenants.get(account.tenant_id);
        if (!tenant) return { rows: [] };

        // Implement the SQL filtering: WHERE a.status = 'active' AND t.status = 'active'
        if (sql.includes("a.status = 'active' AND t.status = 'active'")) {
          if (account.status !== 'active' || tenant.status !== 'active') {
            return { rows: [] };
          }
        }

        return {
          rows: [{
            id: account.id,
            name: account.name,
            owner_user_id: account.owner_user_id,
            wuzapi_token: account.wuzapi_token,
            status: account.status,
            tenant_id: account.tenant_id,
            tenant_subdomain: tenant.subdomain,
            tenant_name: tenant.name,
            tenant_status: tenant.status
          }]
        };
      }

      // Mock conversation lookup
      if (sql.includes('FROM conversations')) {
        const convId = params[0];
        const conv = this.conversations.get(convId);
        return { rows: conv ? [conv] : [] };
      }

      // Mock agents lookup
      if (sql.includes('FROM agents')) {
        const accountId = params[0];
        const agents = Array.from(this.agents.values()).filter(a => a.account_id === accountId);
        return { rows: agents };
      }

      // Mock inbox members lookup
      if (sql.includes('FROM inbox_members')) {
        return { rows: [] }; // Simplified for test
      }

      // Mock audit log insert
      if (sql.includes('INSERT INTO audit_log')) {
        return { rows: [] };
      }

      return { rows: [] };
    }

    addTenant(id, data) {
      this.tenants.set(id, { id, ...data });
    }

    addAccount(token, data) {
      this.accounts.set(token, { wuzapi_token: token, ...data });
    }

    addConversation(id, data) {
      this.conversations.set(id, { id, ...data });
    }

    addAgent(id, data) {
      this.agents.set(id, { id, ...data });
    }

    reset() {
      this.accounts.clear();
      this.tenants.clear();
      this.conversations.clear();
      this.agents.clear();
    }
  }

  test('should route webhook to correct account with tenant context', async () => {
    mockDb = new MockDatabase();
    router = new WebhookAccountRouter(mockDb);

    // Setup test data
    mockDb.addTenant('tenant-1', {
      subdomain: 'company1',
      name: 'Company 1',
      status: 'active'
    });

    mockDb.addAccount('token123', {
      id: 'account-1',
      name: 'Test Account',
      owner_user_id: 'user-1',
      status: 'active',
      tenant_id: 'tenant-1'
    });

    const event = { type: 'message.received', text: 'Hello' };
    const result = await router.routeWebhook('token123', event);

    assert.strictEqual(result.routed, true);
    assert.strictEqual(result.account.id, 'account-1');
    assert.strictEqual(result.account.tenant_id, 'tenant-1');
    assert.strictEqual(result.tenant.subdomain, 'company1');
    assert.strictEqual(result.tenant.status, 'active');
  });

  test('should reject webhook when tenant is inactive', async () => {
    mockDb = new MockDatabase();
    router = new WebhookAccountRouter(mockDb);

    // Setup test data with inactive tenant
    mockDb.addTenant('tenant-2', {
      subdomain: 'company2',
      name: 'Company 2',
      status: 'inactive'
    });

    mockDb.addAccount('token456', {
      id: 'account-2',
      name: 'Test Account 2',
      owner_user_id: 'user-2',
      status: 'active',
      tenant_id: 'tenant-2'
    });

    const event = { type: 'message.received', text: 'Hello' };
    const result = await router.routeWebhook('token456', event);

    assert.strictEqual(result.routed, false);
    assert.strictEqual(result.reason, 'account_not_found'); // Because tenant is inactive
  });

  test('should validate tenant context correctly', async () => {
    mockDb = new MockDatabase();
    router = new WebhookAccountRouter(mockDb);

    const account = {
      id: 'account-1',
      tenant_id: 'tenant-1',
      tenant: {
        id: 'tenant-1',
        status: 'active'
      }
    };

    // Should pass with matching tenant
    assert.strictEqual(router.validateTenantContext(account, 'tenant-1'), true);

    // Should fail with different tenant
    assert.strictEqual(router.validateTenantContext(account, 'tenant-2'), false);

    // Should pass with no expected tenant (just check active)
    assert.strictEqual(router.validateTenantContext(account), true);

    // Should fail with inactive tenant
    account.tenant.status = 'inactive';
    assert.strictEqual(router.validateTenantContext(account), false);
  });

  test('should reject webhook with invalid tenant context', async () => {
    mockDb = new MockDatabase();
    router = new WebhookAccountRouter(mockDb);

    // Setup test data
    mockDb.addTenant('tenant-1', {
      subdomain: 'company1',
      name: 'Company 1',
      status: 'active'
    });

    mockDb.addAccount('token789', {
      id: 'account-3',
      name: 'Test Account 3',
      owner_user_id: 'user-3',
      status: 'active',
      tenant_id: 'tenant-1'
    });

    const event = { type: 'message.received', text: 'Hello' };
    
    // Try to route with different expected tenant
    const result = await router.routeWebhook('token789', event, 'tenant-2');

    assert.strictEqual(result.routed, false);
    assert.strictEqual(result.reason, 'invalid_tenant_context');
  });

  test('should handle missing account gracefully', async () => {
    mockDb = new MockDatabase();
    router = new WebhookAccountRouter(mockDb);

    const event = { type: 'message.received', text: 'Hello' };
    const result = await router.routeWebhook('nonexistent-token', event);

    assert.strictEqual(result.routed, false);
    assert.strictEqual(result.reason, 'account_not_found');
  });
});