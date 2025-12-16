/**
 * Property-Based Tests for PermissionService
 * 
 * Tests correctness properties defined in the design document using fast-check.
 * Each test runs a minimum of 100 iterations.
 * 
 * Feature: multi-user-inbox-system
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const path = require('path');
const fs = require('fs');
const Database = require('../database');
const PermissionService = require('./PermissionService');
const { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } = require('./PermissionService');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-permission-service.db');

// Helper to create test database with multi-user tables
async function createTestDatabase() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  await db.init();
  
  // Create accounts table
  await db.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      wuzapi_token TEXT NOT NULL,
      timezone TEXT DEFAULT 'America/Sao_Paulo',
      locale TEXT DEFAULT 'pt-BR',
      status TEXT DEFAULT 'active',
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create custom_roles table
  await db.query(`
    CREATE TABLE IF NOT EXISTS custom_roles (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, name)
    )
  `);
  
  // Create agents table
  await db.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'agent' CHECK(role IN ('owner', 'administrator', 'agent', 'viewer')),
      custom_role_id TEXT REFERENCES custom_roles(id),
      availability TEXT DEFAULT 'offline',
      status TEXT DEFAULT 'active',
      last_activity_at DATETIME,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, email)
    )
  `);
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM agents');
  await db.query('DELETE FROM custom_roles');
  await db.query('DELETE FROM accounts');
}

// Helper to create a test account
async function createTestAccount(db) {
  const id = require('crypto').randomUUID();
  await db.query(`
    INSERT INTO accounts (id, name, owner_user_id, wuzapi_token)
    VALUES (?, 'Test Account', ?, 'test-token')
  `, [id, require('crypto').randomUUID()]);
  return id;
}

// Helper to create a test agent
async function createTestAgent(db, accountId, role, customRoleId = null) {
  const id = require('crypto').randomUUID();
  const email = `agent-${id.substring(0, 8)}@test.com`;
  await db.query(`
    INSERT INTO agents (id, account_id, email, password_hash, name, role, custom_role_id)
    VALUES (?, ?, ?, 'hash', 'Test Agent', ?, ?)
  `, [id, accountId, email, role, customRoleId]);
  return id;
}

// Arbitraries
const roleArb = fc.constantFrom('owner', 'administrator', 'agent', 'viewer');
const permissionArb = fc.constantFrom(...ALL_PERMISSIONS);
const permissionsSubsetArb = fc.subarray(ALL_PERMISSIONS, { minLength: 1, maxLength: 10 });
const roleNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

describe('PermissionService Property Tests', () => {
  let db;
  let permissionService;
  
  before(async () => {
    db = await createTestDatabase();
    permissionService = new PermissionService(db);
  });
  
  after(async () => {
    if (db && db.db) {
      db.db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });
  
  beforeEach(async () => {
    await cleanupTestData(db);
  });


  /**
   * Feature: multi-user-inbox-system, Property 10: Permission Check Enforcement
   * Validates: Requirements 3.3, 3.5
   * 
   * For any action requiring a specific permission, agents without that permission 
   * SHALL receive a denial (false), and agents with the permission SHALL be allowed (true).
   */
  it('Property 10: Permission check enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleArb,
        permissionArb,
        async (role, permission) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId, role);
          
          const hasPermission = await permissionService.checkPermission(agentId, permission);
          const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role];
          
          // Owner has wildcard permission
          if (rolePermissions.includes('*')) {
            assert.strictEqual(
              hasPermission,
              true,
              `Owner should have all permissions, including ${permission}`
            );
          } else {
            const expectedHasPermission = rolePermissions.includes(permission);
            assert.strictEqual(
              hasPermission,
              expectedHasPermission,
              `Agent with role '${role}' ${expectedHasPermission ? 'should' : 'should not'} have permission '${permission}'`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 10b: Custom role permission enforcement
   * Validates: Requirements 3.3, 3.5
   * 
   * For agents with custom roles, permission checks should use the custom role's permissions.
   */
  it('Property 10b: Custom role permission enforcement', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionsSubsetArb,
        permissionArb,
        async (customPermissions, permissionToCheck) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          
          // Create custom role with specific permissions
          const customRole = await permissionService.createCustomRole(accountId, {
            name: `custom-role-${Date.now()}`,
            permissions: customPermissions
          });
          
          // Create agent with custom role
          const agentId = await createTestAgent(db, accountId, 'agent', customRole.id);
          
          const hasPermission = await permissionService.checkPermission(agentId, permissionToCheck);
          const expectedHasPermission = customPermissions.includes(permissionToCheck);
          
          assert.strictEqual(
            hasPermission,
            expectedHasPermission,
            `Agent with custom role ${expectedHasPermission ? 'should' : 'should not'} have permission '${permissionToCheck}'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 7: Permission Propagation Consistency
   * Validates: Requirements 2.7, 3.4, 3.6
   * 
   * For any role change (direct assignment or custom role modification), all affected 
   * agents SHALL immediately have their effective permissions updated.
   */
  it('Property 7: Permission propagation consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        permissionsSubsetArb,
        permissionsSubsetArb,
        permissionArb,
        async (initialPermissions, updatedPermissions, permissionToCheck) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          
          // Create custom role with initial permissions
          const customRole = await permissionService.createCustomRole(accountId, {
            name: `custom-role-${Date.now()}`,
            permissions: initialPermissions
          });
          
          // Create agent with custom role
          const agentId = await createTestAgent(db, accountId, 'agent', customRole.id);
          
          // Verify initial permission state
          const initialHasPermission = await permissionService.checkPermission(agentId, permissionToCheck);
          assert.strictEqual(
            initialHasPermission,
            initialPermissions.includes(permissionToCheck),
            'Initial permission check should match custom role permissions'
          );
          
          // Update custom role permissions
          await permissionService.updateCustomRole(customRole.id, {
            permissions: updatedPermissions
          });
          
          // Verify permission is immediately updated (no re-authentication needed)
          const updatedHasPermission = await permissionService.checkPermission(agentId, permissionToCheck);
          assert.strictEqual(
            updatedHasPermission,
            updatedPermissions.includes(permissionToCheck),
            'Permission should be immediately updated after role modification'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 7b: Role assignment propagation
   * Validates: Requirements 2.7, 3.4
   * 
   * When an agent's role is changed, permissions should immediately reflect the new role.
   */
  it('Property 7b: Role assignment propagation', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleArb,
        roleArb,
        permissionArb,
        async (initialRole, newRole, permissionToCheck) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId, initialRole);
          
          // Verify initial permission state
          const initialPermissions = DEFAULT_ROLE_PERMISSIONS[initialRole];
          const initialHasPermission = await permissionService.checkPermission(agentId, permissionToCheck);
          
          if (initialPermissions.includes('*')) {
            assert.strictEqual(initialHasPermission, true);
          } else {
            assert.strictEqual(initialHasPermission, initialPermissions.includes(permissionToCheck));
          }
          
          // Change role
          await permissionService.assignRole(agentId, newRole);
          
          // Verify permission is immediately updated
          const newPermissions = DEFAULT_ROLE_PERMISSIONS[newRole];
          const newHasPermission = await permissionService.checkPermission(agentId, permissionToCheck);
          
          if (newPermissions.includes('*')) {
            assert.strictEqual(
              newHasPermission,
              true,
              `After role change to '${newRole}', agent should have all permissions`
            );
          } else {
            assert.strictEqual(
              newHasPermission,
              newPermissions.includes(permissionToCheck),
              `After role change to '${newRole}', permission '${permissionToCheck}' should be ${newPermissions.includes(permissionToCheck)}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Custom role CRUD consistency
   * Validates: Requirements 3.2, 3.6
   * 
   * Custom roles should maintain data integrity through create, read, update operations.
   */
  it('Property: Custom role CRUD consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleNameArb,
        permissionsSubsetArb,
        async (roleName, permissions) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          
          // Create custom role
          const created = await permissionService.createCustomRole(accountId, {
            name: roleName,
            permissions
          });
          
          assert(created.id, 'Created role should have an ID');
          assert.strictEqual(created.name, roleName);
          assert.deepStrictEqual(created.permissions, permissions);
          
          // Read custom role
          const retrieved = await permissionService.getCustomRoleById(created.id);
          assert.strictEqual(retrieved.id, created.id);
          assert.strictEqual(retrieved.name, roleName);
          assert.deepStrictEqual(retrieved.permissions, permissions);
          
          // List custom roles
          const roles = await permissionService.listCustomRoles(accountId);
          assert(roles.some(r => r.id === created.id), 'Role should appear in list');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Permission validation
   * Validates: Requirements 3.2
   * 
   * Creating a custom role with invalid permissions should fail.
   */
  it('Property: Invalid permissions are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
        async (invalidPermissions) => {
          // Filter to only include permissions that are NOT valid
          const actuallyInvalid = invalidPermissions.filter(p => !ALL_PERMISSIONS.includes(p));
          
          if (actuallyInvalid.length === 0) {
            return; // Skip if all generated permissions happen to be valid
          }
          
          await cleanupTestData(db);
          const accountId = await createTestAccount(db);
          
          try {
            await permissionService.createCustomRole(accountId, {
              name: 'invalid-role',
              permissions: actuallyInvalid
            });
            assert.fail('Should have thrown error for invalid permissions');
          } catch (error) {
            assert(
              error.message.includes('Invalid permissions'),
              `Error should mention invalid permissions: ${error.message}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Check any/all permissions
   * Validates: Requirements 3.3
   * 
   * checkAnyPermission and checkAllPermissions should work correctly.
   */
  it('Property: Check any/all permissions work correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        roleArb,
        fc.array(permissionArb, { minLength: 1, maxLength: 5 }),
        async (role, permissionsToCheck) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId, role);
          
          const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role];
          const isOwner = rolePermissions.includes('*');
          
          // Test checkAnyPermission
          const hasAny = await permissionService.checkAnyPermission(agentId, permissionsToCheck);
          const expectedHasAny = isOwner || permissionsToCheck.some(p => rolePermissions.includes(p));
          assert.strictEqual(
            hasAny,
            expectedHasAny,
            `checkAnyPermission should return ${expectedHasAny} for role '${role}'`
          );
          
          // Test checkAllPermissions
          const hasAll = await permissionService.checkAllPermissions(agentId, permissionsToCheck);
          const expectedHasAll = isOwner || permissionsToCheck.every(p => rolePermissions.includes(p));
          assert.strictEqual(
            hasAll,
            expectedHasAll,
            `checkAllPermissions should return ${expectedHasAll} for role '${role}'`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
