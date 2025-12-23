/**
 * InboxService Tests - Tenant Validation
 * Tests for multi-tenant inbox operations
 * 
 * MIGRATED: Uses SupabaseService mocking pattern
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Mock SupabaseService before requiring InboxService
const mockSupabaseService = {
  getById: async (table, id) => {
    if (table === 'accounts' && id === 'account-1') {
      return { data: { id: 'account-1', tenant_id: 'tenant-1' }, error: null };
    }
    if (table === 'accounts' && id === 'account-2') {
      return { data: { id: 'account-2', tenant_id: 'tenant-2' }, error: null };
    }
    if (table === 'inboxes' && id === 'inbox-1') {
      return { 
        data: { 
          id: 'inbox-1', 
          account_id: 'account-1',
          name: 'Test Inbox',
          channel_type: 'whatsapp',
          enable_auto_assignment: true,
          auto_assignment_config: {},
          greeting_enabled: false,
          wuzapi_connected: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 
        error: null 
      };
    }
    return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
  },
  queryAsAdmin: async (table, queryFn) => {
    if (table === 'inboxes') {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  },
  count: async () => ({ count: 0, error: null }),
  insert: async (table, data) => ({ data: { id: 'new-id', ...data }, error: null }),
  update: async (table, id, data) => ({ data: { id, ...data }, error: null }),
  delete: async (table, id) => ({ data: null, error: null })
};

// Mock the SupabaseService module
require.cache[require.resolve('../../services/SupabaseService')] = {
  exports: mockSupabaseService
};

// Mock logger
const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

require.cache[require.resolve('../../utils/logger')] = {
  exports: { logger: mockLogger }
};

const InboxService = require('../../services/InboxService');

describe('InboxService - Tenant Validation', () => {
  let inboxService;

  beforeEach(() => {
    inboxService = new InboxService();
  });

  test('should allow access when account belongs to tenant', async () => {
    const result = await inboxService.validateAccountTenant('account-1', 'tenant-1');
    
    assert.strictEqual(result.id, 'account-1');
    assert.strictEqual(result.tenant_id, 'tenant-1');
  });

  test('should deny access when account belongs to different tenant', async () => {
    const result = await inboxService.validateAccountTenant('account-1', 'tenant-2');
    
    assert.strictEqual(result, null);
  });

  test('should get inbox with tenant validation', async () => {
    // Should succeed when tenant matches
    const inbox = await inboxService.getInboxById('inbox-1', 'tenant-1');
    assert.strictEqual(inbox.id, 'inbox-1');
    assert.strictEqual(inbox.name, 'Test Inbox');

    // Should return null when tenant doesn't match
    const deniedInbox = await inboxService.getInboxById('inbox-1', 'tenant-2');
    assert.strictEqual(deniedInbox, null);
  });

  test('should create inbox with tenant validation', async () => {
    // Mock audit service
    inboxService.auditService = {
      logAction: async () => {}
    };

    // Mock WUZAPI client to avoid token issues
    inboxService.createWuzapiUser = async () => ({ id: 'mock-wuzapi-id' });

    // Should succeed when account belongs to tenant (non-WhatsApp channel to avoid WUZAPI)
    try {
      await inboxService.createInbox('account-1', { 
        name: 'New Inbox', 
        channelType: 'email'
      }, 'tenant-1');
      assert.ok(true);
    } catch (error) {
      assert.fail(`Should not throw error for valid tenant: ${error.message}`);
    }

    // Should throw error when account belongs to different tenant
    try {
      await inboxService.createInbox('account-1', { 
        name: 'New Inbox',
        channelType: 'email'
      }, 'tenant-2');
      assert.fail('Should throw error for invalid tenant');
    } catch (error) {
      assert.strictEqual(error.code, 'CROSS_TENANT_ACCESS');
    }
  });
});
