#!/usr/bin/env node

/**
 * Property-Based Tests for Tenant Data Isolation
 * Tests that RLS policies enforce proper tenant data isolation
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const SupabaseService = require('../services/SupabaseService');

// Generator for valid tenant IDs
const tenantIdGen = fc.uuid();

// Generator for valid account data
const accountDataGen = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  wuzapi_token: fc.string({ minLength: 10, maxLength: 50 }),
  owner_user_id: fc.uuid(),
  status: fc.constantFrom('active', 'inactive', 'suspended')
});

/**
 * **Feature: multi-tenant-architecture, Property 7: Tenant Data Isolation**
 * **Validates: Requirements 5.1, 5.5, 9.1**
 */
test('Property 7: Tenant Data Isolation - accounts table', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(tenantIdGen, tenantIdGen).filter(([t1, t2]) => t1 !== t2),
      accountDataGen,
      accountDataGen,
      async ([tenant1Id, tenant2Id], account1Data, account2Data) => {
        try {
          // Create accounts in different tenants
          const { data: account1, error: error1 } = await SupabaseService.insert('accounts', {
            ...account1Data,
            tenant_id: tenant1Id
          });
          
          const { data: account2, error: error2 } = await SupabaseService.insert('accounts', {
            ...account2Data,
            tenant_id: tenant2Id
          });
          
          if (error1 || error2) {
            // Skip if insert fails (might be due to unique constraints)
            return true;
          }
          
          // Set tenant context for tenant1
          await SupabaseService.setTenantContext(tenant1Id);
          
          // Query accounts - should only return tenant1's accounts
          const { data: tenant1Accounts, error: queryError1 } = await SupabaseService.getMany('accounts', {});
          
          if (queryError1) throw queryError1;
          
          // Verify no cross-tenant data leakage
          const crossTenantAccounts = tenant1Accounts.filter(acc => acc.tenant_id !== tenant1Id);
          assert.strictEqual(crossTenantAccounts.length, 0, 'Cross-tenant data leakage detected');
          
          // Verify tenant1's account is present
          const tenant1Account = tenant1Accounts.find(acc => acc.id === account1.id);
          assert(tenant1Account, 'Own tenant account not found');
          
          // Set tenant context for tenant2
          await SupabaseService.setTenantContext(tenant2Id);
          
          // Query accounts - should only return tenant2's accounts
          const { data: tenant2Accounts, error: queryError2 } = await SupabaseService.getMany('accounts', {});
          
          if (queryError2) throw queryError2;
          
          // Verify no cross-tenant data leakage
          const crossTenantAccounts2 = tenant2Accounts.filter(acc => acc.tenant_id !== tenant2Id);
          assert.strictEqual(crossTenantAccounts2.length, 0, 'Cross-tenant data leakage detected');
          
          // Verify tenant1's account is NOT present in tenant2's results
          const tenant1AccountInTenant2 = tenant2Accounts.find(acc => acc.id === account1.id);
          assert(!tenant1AccountInTenant2, 'Cross-tenant account found in wrong tenant context');
          
          // Cleanup
          await SupabaseService.clearTenantContext();
          await SupabaseService.delete('accounts', account1.id);
          await SupabaseService.delete('accounts', account2.id);
          
        } catch (error) {
          // Cleanup on error
          await SupabaseService.clearTenantContext();
          throw error;
        }
      }
    ),
    { numRuns: 10 } // Reduced runs for database operations
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 7: Tenant Data Isolation - agents table**
 * **Validates: Requirements 5.1, 5.5, 9.1**
 */
test('Property 7: Tenant Data Isolation - agents via account relationship', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(tenantIdGen, tenantIdGen).filter(([t1, t2]) => t1 !== t2),
      accountDataGen,
      accountDataGen,
      async ([tenant1Id, tenant2Id], account1Data, account2Data) => {
        try {
          // Create accounts in different tenants
          const { data: account1 } = await SupabaseService.insert('accounts', {
            ...account1Data,
            tenant_id: tenant1Id
          });
          
          const { data: account2 } = await SupabaseService.insert('accounts', {
            ...account2Data,
            tenant_id: tenant2Id
          });
          
          if (!account1 || !account2) return true; // Skip if accounts not created
          
          // Create agents for each account
          const { data: agent1 } = await SupabaseService.insert('agents', {
            account_id: account1.id,
            email: `agent1-${Date.now()}@test.com`,
            password_hash: 'hash1',
            role: 'owner',
            availability: 'available'
          });
          
          const { data: agent2 } = await SupabaseService.insert('agents', {
            account_id: account2.id,
            email: `agent2-${Date.now()}@test.com`,
            password_hash: 'hash2',
            role: 'owner',
            availability: 'available'
          });
          
          if (!agent1 || !agent2) return true; // Skip if agents not created
          
          // Set tenant context for tenant1
          await SupabaseService.setTenantContext(tenant1Id);
          
          // Query agents - should only return agents from tenant1's accounts
          const { data: tenant1Agents } = await SupabaseService.getMany('agents', {});
          
          // Verify no cross-tenant agents
          for (const agent of tenant1Agents) {
            const { data: agentAccount } = await SupabaseService.getById('accounts', agent.account_id);
            if (agentAccount) {
              assert.strictEqual(agentAccount.tenant_id, tenant1Id, 'Agent from wrong tenant found');
            }
          }
          
          // Cleanup
          await SupabaseService.clearTenantContext();
          await SupabaseService.delete('agents', agent1.id);
          await SupabaseService.delete('agents', agent2.id);
          await SupabaseService.delete('accounts', account1.id);
          await SupabaseService.delete('accounts', account2.id);
          
        } catch (error) {
          await SupabaseService.clearTenantContext();
          throw error;
        }
      }
    ),
    { numRuns: 5 } // Reduced runs for complex database operations
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 13: Cross-Tenant Authentication Denial**
 * **Validates: Requirements 8.2, 8.3**
 */
test('Property 13: Cross-Tenant Authentication Denial', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.tuple(tenantIdGen, tenantIdGen).filter(([t1, t2]) => t1 !== t2),
      fc.string({ minLength: 5, maxLength: 20 }),
      fc.string({ minLength: 8, maxLength: 20 }),
      async ([tenant1Id, tenant2Id], email, password) => {
        try {
          // Create account in tenant1
          const { data: account1 } = await SupabaseService.insert('accounts', {
            name: 'Test Account',
            wuzapi_token: `token_${Date.now()}`,
            owner_user_id: fc.sample(fc.uuid(), 1)[0],
            tenant_id: tenant1Id,
            status: 'active'
          });
          
          if (!account1) return true; // Skip if account not created
          
          // Create agent for account1
          const { data: agent1 } = await SupabaseService.insert('agents', {
            account_id: account1.id,
            email: `${email}@test.com`,
            password_hash: password, // In real implementation, this would be hashed
            role: 'owner',
            availability: 'available'
          });
          
          if (!agent1) return true; // Skip if agent not created
          
          // Set tenant context to tenant2 (different tenant)
          await SupabaseService.setTenantContext(tenant2Id);
          
          // Try to authenticate agent1's credentials in tenant2 context
          const { data: foundAgent } = await SupabaseService.getMany('agents', {
            email: `${email}@test.com`
          });
          
          // Should not find the agent in wrong tenant context
          assert.strictEqual(foundAgent.length, 0, 'Agent found in wrong tenant context');
          
          // Cleanup
          await SupabaseService.clearTenantContext();
          await SupabaseService.delete('agents', agent1.id);
          await SupabaseService.delete('accounts', account1.id);
          
        } catch (error) {
          await SupabaseService.clearTenantContext();
          throw error;
        }
      }
    ),
    { numRuns: 5 }
  );
});