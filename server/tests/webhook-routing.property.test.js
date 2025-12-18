#!/usr/bin/env node

/**
 * Property-Based Tests for Webhook Routing Accuracy
 * Tests that webhooks are routed to the correct accounts based on wuzapi_token
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const WebhookAccountRouter = require('../services/WebhookAccountRouter');
const SupabaseService = require('../services/SupabaseService');

// Generator for tenant data
const tenantDataGen = fc.record({
  subdomain: fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-z0-9-]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  owner_superadmin_id: fc.uuid(),
  status: fc.constantFrom('active', 'inactive'),
  settings: fc.constant({})
});

// Generator for account data
const accountDataGen = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  owner_user_id: fc.uuid(),
  status: fc.constantFrom('active', 'inactive')
});

// Generator for inbox data
const inboxDataGen = fc.record({
  phone_number: fc.string({ minLength: 10, maxLength: 15 }).filter(s => /^\d+$/.test(s)),
  wuzapi_connected: fc.boolean()
});

// Generator for webhook event data
const webhookEventGen = fc.record({
  event: fc.constantFrom('message.received', 'message.sent', 'qr.code', 'connection.status'),
  data: fc.record({
    message: fc.string({ minLength: 1, maxLength: 100 }),
    from: fc.string({ minLength: 10, maxLength: 15 }),
    timestamp: fc.integer({ min: 1600000000, max: 2000000000 })
  })
});

/**
 * **Feature: multi-tenant-architecture, Property 17: Webhook Routing Accuracy**
 * **Validates: Requirements 12.3**
 */
test('Property 17: Webhook Routing Accuracy - routes to correct account by token', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(tenantDataGen, { minLength: 1, maxLength: 3 }),
      fc.array(accountDataGen, { minLength: 2, maxLength: 4 }),
      fc.array(inboxDataGen, { minLength: 2, maxLength: 4 }),
      webhookEventGen,
      async (tenantsData, accountsData, inboxesData, webhookEvent) => {
        const createdTenants = [];
        const createdAccounts = [];
        const createdInboxes = [];
        
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
          
          if (createdTenants.length === 0) return true;
          
          // Create accounts across tenants
          for (let i = 0; i < accountsData.length && i < createdTenants.length; i++) {
            const accountData = accountsData[i];
            const tenant = createdTenants[i % createdTenants.length];
            
            const uniqueToken = `token-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
            const { data: account, error } = await SupabaseService.insert('accounts', {
              ...accountData,
              wuzapi_token: uniqueToken,
              tenant_id: tenant.id
            });
            
            if (error || !account) continue;
            createdAccounts.push(account);
          }
          
          if (createdAccounts.length === 0) return true;
          
          // Create inboxes for accounts
          for (let i = 0; i < inboxesData.length && i < createdAccounts.length; i++) {
            const inboxData = inboxesData[i];
            const account = createdAccounts[i];
            
            const uniqueInboxToken = `inbox-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
            const { data: inbox, error } = await SupabaseService.insert('inboxes', {
              ...inboxData,
              account_id: account.id,
              wuzapi_token: uniqueInboxToken
            });
            
            if (error || !inbox) continue;
            createdInboxes.push({ ...inbox, account });
          }
          
          if (createdInboxes.length === 0) return true;
          
          // Test webhook routing for each inbox
          for (const inbox of createdInboxes) {
            const routingResult = await WebhookAccountRouter.routeWebhook(
              inbox.wuzapi_token,
              webhookEvent,
              inbox.account.tenant_id // Expected tenant context
            );
            
            // Should successfully route to the correct account
            assert(routingResult.success, `Webhook routing failed for token ${inbox.wuzapi_token}`);
            assert.strictEqual(routingResult.accountId, inbox.account.id, 
              'Webhook routed to wrong account');
            assert.strictEqual(routingResult.tenantId, inbox.account.tenant_id, 
              'Webhook routed to wrong tenant');
          }
          
          // Test routing with wrong tenant context
          if (createdInboxes.length > 0 && createdTenants.length > 1) {
            const inbox = createdInboxes[0];
            const wrongTenant = createdTenants.find(t => t.id !== inbox.account.tenant_id);
            
            if (wrongTenant) {
              const wrongContextResult = await WebhookAccountRouter.routeWebhook(
                inbox.wuzapi_token,
                webhookEvent,
                wrongTenant.id // Wrong tenant context
              );
              
              // Should fail due to tenant context mismatch
              assert.strictEqual(wrongContextResult.success, false, 
                'Webhook should fail with wrong tenant context');
              assert.strictEqual(wrongContextResult.error, 'invalid_tenant_context', 
                'Should return invalid_tenant_context error');
            }
          }
          
          // Test routing with nonexistent token
          const nonexistentToken = `nonexistent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const nonexistentResult = await WebhookAccountRouter.routeWebhook(
            nonexistentToken,
            webhookEvent
          );
          
          // Should fail for nonexistent token
          assert.strictEqual(nonexistentResult.success, false, 
            'Webhook should fail for nonexistent token');
          assert.strictEqual(nonexistentResult.error, 'account_not_found', 
            'Should return account_not_found error');
          
        } finally {
          // Cleanup
          for (const inbox of createdInboxes) {
            await SupabaseService.delete('inboxes', inbox.id);
          }
          for (const account of createdAccounts) {
            await SupabaseService.delete('accounts', account.id);
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
 * **Feature: multi-tenant-architecture, Property 17: Webhook Routing - inactive tenant handling**
 * **Validates: Requirements 12.3**
 */
test('Property 17: Webhook Routing - rejects webhooks for inactive tenants', async () => {
  await fc.assert(
    fc.asyncProperty(
      tenantDataGen,
      accountDataGen,
      inboxDataGen,
      webhookEventGen,
      async (tenantData, accountData, inboxData, webhookEvent) => {
        let tenant = null;
        let account = null;
        let inbox = null;
        
        try {
          // Create inactive tenant
          const uniqueSubdomain = `${tenantData.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdTenant, error: tenantError } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain: uniqueSubdomain,
            status: 'inactive' // Force inactive status
          });
          
          if (tenantError || !createdTenant) return true;
          tenant = createdTenant;
          
          // Create account in inactive tenant
          const uniqueToken = `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdAccount, error: accountError } = await SupabaseService.insert('accounts', {
            ...accountData,
            wuzapi_token: uniqueToken,
            tenant_id: tenant.id
          });
          
          if (accountError || !createdAccount) return true;
          account = createdAccount;
          
          // Create inbox
          const uniqueInboxToken = `inbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdInbox, error: inboxError } = await SupabaseService.insert('inboxes', {
            ...inboxData,
            account_id: account.id,
            wuzapi_token: uniqueInboxToken
          });
          
          if (inboxError || !createdInbox) return true;
          inbox = createdInbox;
          
          // Try to route webhook for inactive tenant
          const routingResult = await WebhookAccountRouter.routeWebhook(
            inbox.wuzapi_token,
            webhookEvent,
            tenant.id
          );
          
          // Should fail due to inactive tenant
          assert.strictEqual(routingResult.success, false, 
            'Webhook should fail for inactive tenant');
          assert(routingResult.error === 'invalid_tenant_context' || routingResult.error === 'tenant_inactive', 
            'Should return appropriate error for inactive tenant');
          
        } finally {
          // Cleanup
          if (inbox) await SupabaseService.delete('inboxes', inbox.id);
          if (account) await SupabaseService.delete('accounts', account.id);
          if (tenant) await SupabaseService.delete('tenants', tenant.id);
        }
      }
    ),
    { numRuns: 10 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 17: Webhook Routing - token uniqueness**
 * **Validates: Requirements 12.3**
 */
test('Property 17: Webhook Routing - wuzapi_token uniqueness across tenants', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(tenantDataGen, tenantDataGen).filter(([t1, t2]) => t1.subdomain !== t2.subdomain),
      accountDataGen,
      accountDataGen,
      inboxDataGen,
      webhookEventGen,
      async ([tenant1Data, tenant2Data], account1Data, account2Data, inboxData, webhookEvent) => {
        let tenant1 = null;
        let tenant2 = null;
        let account1 = null;
        let account2 = null;
        let inbox1 = null;
        let inbox2 = null;
        
        try {
          // Create two tenants
          const uniqueSubdomain1 = `${tenant1Data.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdTenant1, error: tenant1Error } = await SupabaseService.insert('tenants', {
            ...tenant1Data,
            subdomain: uniqueSubdomain1,
            status: 'active'
          });
          
          if (tenant1Error || !createdTenant1) return true;
          tenant1 = createdTenant1;
          
          const uniqueSubdomain2 = `${tenant2Data.subdomain}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdTenant2, error: tenant2Error } = await SupabaseService.insert('tenants', {
            ...tenant2Data,
            subdomain: uniqueSubdomain2,
            status: 'active'
          });
          
          if (tenant2Error || !createdTenant2) return true;
          tenant2 = createdTenant2;
          
          // Create accounts in different tenants
          const uniqueToken1 = `token-${Date.now()}-1-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdAccount1, error: account1Error } = await SupabaseService.insert('accounts', {
            ...account1Data,
            wuzapi_token: uniqueToken1,
            tenant_id: tenant1.id
          });
          
          if (account1Error || !createdAccount1) return true;
          account1 = createdAccount1;
          
          const uniqueToken2 = `token-${Date.now()}-2-${Math.random().toString(36).substr(2, 9)}`;
          const { data: createdAccount2, error: account2Error } = await SupabaseService.insert('accounts', {
            ...account2Data,
            wuzapi_token: uniqueToken2,
            tenant_id: tenant2.id
          });
          
          if (account2Error || !createdAccount2) return true;
          account2 = createdAccount2;
          
          // Use the same wuzapi_token for inboxes in different tenants (should be allowed)
          const sharedInboxToken = `shared-inbox-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const { data: createdInbox1, error: inbox1Error } = await SupabaseService.insert('inboxes', {
            ...inboxData,
            account_id: account1.id,
            wuzapi_token: sharedInboxToken
          });
          
          if (inbox1Error || !createdInbox1) return true;
          inbox1 = createdInbox1;
          
          const { data: createdInbox2, error: inbox2Error } = await SupabaseService.insert('inboxes', {
            ...inboxData,
            account_id: account2.id,
            wuzapi_token: sharedInboxToken
          });
          
          // This might fail due to unique constraint, which is expected
          if (inbox2Error) {
            // If unique constraint prevents duplicate tokens, that's correct behavior
            assert(inbox2Error.message.includes('unique') || inbox2Error.message.includes('duplicate'), 
              'Error should be related to uniqueness constraint');
            return true; // Skip rest of test
          }
          
          if (!createdInbox2) return true;
          inbox2 = createdInbox2;
          
          // If duplicate tokens are allowed, routing should be deterministic
          // Route webhook with tenant1 context
          const routing1 = await WebhookAccountRouter.routeWebhook(
            sharedInboxToken,
            webhookEvent,
            tenant1.id
          );
          
          // Route webhook with tenant2 context
          const routing2 = await WebhookAccountRouter.routeWebhook(
            sharedInboxToken,
            webhookEvent,
            tenant2.id
          );
          
          // Both should succeed and route to their respective accounts
          assert(routing1.success, 'Routing should succeed for tenant1 context');
          assert(routing2.success, 'Routing should succeed for tenant2 context');
          
          assert.strictEqual(routing1.accountId, account1.id, 
            'Should route to account1 with tenant1 context');
          assert.strictEqual(routing2.accountId, account2.id, 
            'Should route to account2 with tenant2 context');
          
        } finally {
          // Cleanup
          if (inbox1) await SupabaseService.delete('inboxes', inbox1.id);
          if (inbox2) await SupabaseService.delete('inboxes', inbox2.id);
          if (account1) await SupabaseService.delete('accounts', account1.id);
          if (account2) await SupabaseService.delete('accounts', account2.id);
          if (tenant1) await SupabaseService.delete('tenants', tenant1.id);
          if (tenant2) await SupabaseService.delete('tenants', tenant2.id);
        }
      }
    ),
    { numRuns: 5 }
  );
});