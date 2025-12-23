/**
 * WebhookAccountRouter Tenant Context Tests
 * Tests for multi-tenant webhook routing
 * 
 * MIGRATED: Now uses SupabaseService mocking instead of MockDatabase
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock SupabaseService before requiring WebhookAccountRouter
const mockSupabaseService = {
  accounts: new Map(),
  tenants: new Map(),
  conversations: new Map(),
  agents: new Map(),

  async queryAsAdmin(table, queryBuilder) {
    if (table === 'accounts') {
      const mockQuery = {
        _filters: {},
        _select: '*',
        select: (fields) => { mockQuery._select = fields; return mockQuery; },
        eq: (field, value) => { mockQuery._filters[field] = value; return mockQuery; },
        limit: () => mockQuery,
        then: async (resolve) => {
          const token = mockQuery._filters?.wuzapi_token;
          const account = mockSupabaseService.accounts.get(token);
          if (!account) return resolve({ data: [], error: null });
          
          const tenant = mockSupabaseService.tenants.get(account.tenant_id);
          if (!tenant) return resolve({ data: [], error: null });

          // Check status filters
          if (mockQuery._filters.status === 'active' && account.status !== 'active') {
            return resolve({ data: [], error: null });
          }
          if (mockQuery._filters['tenants.status'] === 'active' && tenant.status !== 'active') {
            return resolve({ data: [], error: null });
          }

          return resolve({
            data: [{
              id: account.id,
              name: account.name,
              owner_user_id: account.owner_user_id,
              wuzapi_token: account.wuzapi_token,
              status: account.status,
              tenant_id: account.tenant_id,
              tenants: {
                id: tenant.id,
                subdomain: tenant.subdomain,
                name: tenant.name,
                status: tenant.status
              }
            }],
            error: null
          });
        }
      };
      return queryBuilder(mockQuery);
    }

    if (table === 'conversations') {
      const mockQuery = {
        _filters: {},
        select: () => mockQuery,
        eq: (field, value) => { mockQuery._filters[field] = value; return mockQuery; },
        single: () => mockQuery,
        then: async (resolve) => {
          const convId = mockQuery._filters?.id;
          const conv = mockSupabaseService.conversations.get(convId);
          return resolve({ data: conv || null, error: conv ? null : { code: 'PGRST116' } });
        }
      };
      return queryBuilder(mockQuery);
    }

    if (table === 'agents') {
      const mockQuery = {
        _filters: {},
        select: () => mockQuery,
        eq: (field, value) => { mockQuery._filters[field] = value; return mockQuery; },
        then: async (resolve) => {
          const accountId = mockQuery._filters?.account_id;
          const agents = Array.from(mockSupabaseService.agents.values()).filter(a => a.account_id === accountId);
          return resolve({ data: agents, error: null });
        }
      };
      return queryBuilder(mockQuery);
    }

    return { data: [], error: null };
  },

  async getMany(table, filters) { return { data: [], error: null }; },
  async insert(table, data) { return { data, error: null }; },
  async update(table, id, data) { return { data: { id, ...data }, error: null }; },
  async delete(table, id) { return { data: null, error: null }; },

  addTenant(id, data) {
    mockSupabaseService.tenants.set(id, { id, ...data });
  },
  addAccount(token, data) {
    mockSupabaseService.accounts.set(token, { wuzapi_token: token, ...data });
  },
  addConversation(id, data) {
    mockSupabaseService.conversations.set(id, { id, ...data });
  },
  addAgent(id, data) {
    mockSupabaseService.agents.set(id, { id, ...data });
  },
  reset() {
    mockSupabaseService.accounts.clear();
    mockSupabaseService.tenants.clear();
    mockSupabaseService.conversations.clear();
    mockSupabaseService.agents.clear();
  }
};

// Mock the SupabaseService module
require.cache[require.resolve('../../services/SupabaseService')] = {
  exports: mockSupabaseService
};

const WebhookAccountRouter = require('../../services/WebhookAccountRouter');

describe('WebhookAccountRouter - Tenant Context', () => {
  let router;

  beforeEach(() => {
    mockSupabaseService.reset();
    router = new WebhookAccountRouter();
  });

  afterEach(() => {
    mockSupabaseService.reset();
  });

  test('should route webhook to correct account with tenant context', async () => {
    mockSupabaseService.addTenant('tenant-1', {
      subdomain: 'company1',
      name: 'Company 1',
      status: 'active'
    });

    mockSupabaseService.addAccount('token123', {
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
    mockSupabaseService.addTenant('tenant-2', {
      subdomain: 'company2',
      name: 'Company 2',
      status: 'inactive'
    });

    mockSupabaseService.addAccount('token456', {
      id: 'account-2',
      name: 'Test Account 2',
      owner_user_id: 'user-2',
      status: 'active',
      tenant_id: 'tenant-2'
    });

    const event = { type: 'message.received', text: 'Hello' };
    const result = await router.routeWebhook('token456', event);

    assert.strictEqual(result.routed, false);
    assert.strictEqual(result.reason, 'account_not_found');
  });

  test('should validate tenant context correctly', async () => {
    const account = {
      id: 'account-1',
      tenant_id: 'tenant-1',
      tenant: {
        id: 'tenant-1',
        status: 'active'
      }
    };

    assert.strictEqual(router.validateTenantContext(account, 'tenant-1'), true);
    assert.strictEqual(router.validateTenantContext(account, 'tenant-2'), false);
    assert.strictEqual(router.validateTenantContext(account), true);

    account.tenant.status = 'inactive';
    assert.strictEqual(router.validateTenantContext(account), false);
  });

  test('should reject webhook with invalid tenant context', async () => {
    mockSupabaseService.addTenant('tenant-1', {
      subdomain: 'company1',
      name: 'Company 1',
      status: 'active'
    });

    mockSupabaseService.addAccount('token789', {
      id: 'account-3',
      name: 'Test Account 3',
      owner_user_id: 'user-3',
      status: 'active',
      tenant_id: 'tenant-1'
    });

    const event = { type: 'message.received', text: 'Hello' };
    const result = await router.routeWebhook('token789', event, 'tenant-2');

    assert.strictEqual(result.routed, false);
    assert.strictEqual(result.reason, 'invalid_tenant_context');
  });

  test('should handle missing account gracefully', async () => {
    const event = { type: 'message.received', text: 'Hello' };
    const result = await router.routeWebhook('nonexistent-token', event);

    assert.strictEqual(result.routed, false);
    assert.strictEqual(result.reason, 'account_not_found');
  });
});
