/**
 * Property-Based Tests for AgentService
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
const AccountService = require('./AccountService');
const AgentService = require('./AgentService');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-agent-service.db');

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

  // Create agents table
  await db.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'agent',
      custom_role_id TEXT,
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
  
  // Create agent_invitations table
  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_invitations (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email TEXT,
      token TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'agent',
      custom_role_id TEXT,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create agent_sessions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  
  // Create indexes
  await db.query('CREATE INDEX IF NOT EXISTS idx_agents_account ON agents(account_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_invitations_token ON agent_invitations(token)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON agent_sessions(token)');
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM agent_sessions');
  await db.query('DELETE FROM agent_invitations');
  await db.query('DELETE FROM agents');
  await db.query('DELETE FROM custom_roles');
  await db.query('DELETE FROM accounts');
}

// Arbitraries for generating test data
const emailArb = fc.emailAddress();
const passwordArb = fc.string({ minLength: 8, maxLength: 50 }).filter(s => s.trim().length >= 8);
const nameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
const roleArb = fc.constantFrom('owner', 'administrator', 'agent', 'viewer');

describe('AgentService Property Tests', () => {
  let db;
  let accountService;
  let agentService;
  let testAccount;
  let ownerAgentId;
  
  before(async () => {
    db = await createTestDatabase();
    accountService = new AccountService(db);
    agentService = new AgentService(db);
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
    // Create a test account for each test
    testAccount = await accountService.createAccount({
      name: 'Test Account',
      ownerUserId: 'owner-user-123',
      wuzapiToken: 'test-wuzapi-token'
    });
    // Create owner agent for invitation creation
    const ownerAgent = await agentService.createAgentDirect(testAccount.id, {
      email: 'owner@test.com',
      password: 'ownerpassword123',
      name: 'Owner Agent',
      role: 'owner'
    });
    ownerAgentId = ownerAgent.id;
  });

  /**
   * Feature: multi-user-inbox-system, Property 5: Invitation Link Uniqueness and Expiration
   * Validates: Requirements 2.1
   * 
   * For any invitation created, the token SHALL be unique across all invitations 
   * and the expiration time SHALL be exactly 48 hours from creation.
   */
  it('Property 5: Invitation tokens are unique and expire in 48 hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            email: fc.option(emailArb, { nil: undefined }),
            role: roleArb
          }),
          { minLength: 2, maxLength: 20 }
        ),
        async (invitationsData) => {
          const createdTokens = new Set();
          const now = Date.now();
          const expectedExpiryMs = 48 * 60 * 60 * 1000; // 48 hours
          const toleranceMs = 5000; // 5 second tolerance for test execution time
          
          for (const data of invitationsData) {
            const invitation = await agentService.createInvitation(
              testAccount.id,
              data,
              ownerAgentId
            );
            
            // Verify token is a valid UUID format
            assert(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invitation.token),
              `Invitation token should be a valid UUID, got: ${invitation.token}`
            );
            
            // Verify token is unique
            assert(
              !createdTokens.has(invitation.token),
              `Invitation token ${invitation.token} should be unique`
            );
            createdTokens.add(invitation.token);
            
            // Verify expiration is approximately 48 hours from now
            const expiresAt = new Date(invitation.expiresAt).getTime();
            const expectedExpiry = now + expectedExpiryMs;
            const diff = Math.abs(expiresAt - expectedExpiry);
            
            assert(
              diff < toleranceMs,
              `Expiration should be ~48 hours from now. Expected ~${expectedExpiry}, got ${expiresAt}, diff: ${diff}ms`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Feature: multi-user-inbox-system, Property 6: Agent Registration Association
   * Validates: Requirements 2.4, 2.5
   * 
   * For any successful registration via invitation link, the created agent SHALL be 
   * associated with the correct account and have the role specified in the invitation.
   */
  it('Property 6: Agent registration associates with correct account and role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          invitationRole: roleArb,
          agentEmail: emailArb,
          agentPassword: passwordArb,
          agentName: nameArb
        }),
        async (data) => {
          // Create invitation with specific role
          const invitation = await agentService.createInvitation(
            testAccount.id,
            { role: data.invitationRole },
            ownerAgentId
          );
          
          // Complete registration
          const agent = await agentService.completeRegistration(invitation.token, {
            email: data.agentEmail,
            password: data.agentPassword,
            name: data.agentName
          });
          
          // Verify agent is associated with correct account
          assert.strictEqual(
            agent.accountId,
            testAccount.id,
            `Agent should be associated with account ${testAccount.id}, got ${agent.accountId}`
          );
          
          // Verify agent has the role from invitation
          assert.strictEqual(
            agent.role,
            data.invitationRole,
            `Agent role should be ${data.invitationRole}, got ${agent.role}`
          );
          
          // Verify agent status is active
          assert.strictEqual(
            agent.status,
            'active',
            `Agent status should be 'active', got ${agent.status}`
          );
          
          // Verify invitation is marked as used
          const usedInvitation = await agentService.getInvitationByToken(invitation.token);
          assert(
            usedInvitation.usedAt,
            'Invitation should be marked as used'
          );
          
          // Verify agent can be retrieved by email
          const retrievedAgent = await agentService.getAgentByEmail(testAccount.id, data.agentEmail);
          assert(retrievedAgent, 'Agent should be retrievable by email');
          assert.strictEqual(retrievedAgent.id, agent.id);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Invitation validation
   * Validates: Requirements 2.1, 2.3
   * 
   * Expired or used invitations should be rejected.
   */
  it('Property: Expired and used invitations are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          agentEmail: emailArb,
          agentPassword: passwordArb,
          agentName: nameArb
        }),
        async (data) => {
          // Create and use an invitation
          const invitation = await agentService.createInvitation(
            testAccount.id,
            { role: 'agent' },
            ownerAgentId
          );
          
          // Use the invitation
          await agentService.completeRegistration(invitation.token, {
            email: data.agentEmail,
            password: data.agentPassword,
            name: data.agentName
          });
          
          // Try to use the same invitation again
          try {
            await agentService.completeRegistration(invitation.token, {
              email: 'another@test.com',
              password: 'anotherpassword123',
              name: 'Another Agent'
            });
            assert.fail('Should have thrown error for used invitation');
          } catch (error) {
            assert.strictEqual(
              error.message,
              'INVITATION_ALREADY_USED',
              `Expected INVITATION_ALREADY_USED error, got: ${error.message}`
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });


  /**
   * Feature: multi-user-inbox-system, Property: Email uniqueness within account
   * Validates: Requirements 2.5
   * 
   * Each email should be unique within an account.
   */
  it('Property: Email uniqueness within account', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: emailArb,
          password: passwordArb,
          name: nameArb
        }),
        async (data) => {
          // Create first agent
          await agentService.createAgentDirect(testAccount.id, {
            email: data.email,
            password: data.password,
            name: data.name,
            role: 'agent'
          });
          
          // Try to create another agent with same email
          try {
            await agentService.createAgentDirect(testAccount.id, {
              email: data.email,
              password: 'differentpassword123',
              name: 'Different Name',
              role: 'agent'
            });
            assert.fail('Should have thrown error for duplicate email');
          } catch (error) {
            assert.strictEqual(
              error.message,
              'EMAIL_ALREADY_EXISTS',
              `Expected EMAIL_ALREADY_EXISTS error, got: ${error.message}`
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 8: Agent Deactivation Session Invalidation
   * Validates: Requirements 2.8, 2.9
   * 
   * For any agent deactivation, all active sessions for that agent SHALL be invalidated.
   */
  it('Property 8: Agent deactivation invalidates all sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: emailArb,
          password: passwordArb,
          name: nameArb
        }),
        fc.integer({ min: 1, max: 5 }),
        async (agentData, sessionCount) => {
          // Create agent
          const agent = await agentService.createAgentDirect(testAccount.id, {
            email: agentData.email,
            password: agentData.password,
            name: agentData.name,
            role: 'agent'
          });
          
          // Create multiple sessions for the agent
          const sessionIds = [];
          for (let i = 0; i < sessionCount; i++) {
            const sessionId = agentService.generateId();
            const token = agentService.generateId();
            await db.query(`
              INSERT INTO agent_sessions (id, agent_id, account_id, token, expires_at)
              VALUES (?, ?, ?, ?, datetime('now', '+1 day'))
            `, [sessionId, agent.id, testAccount.id, token]);
            sessionIds.push(sessionId);
          }
          
          // Verify sessions exist
          const beforeResult = await db.query(
            'SELECT COUNT(*) as count FROM agent_sessions WHERE agent_id = ?',
            [agent.id]
          );
          assert.strictEqual(
            beforeResult.rows[0].count,
            sessionCount,
            `Should have ${sessionCount} sessions before deactivation`
          );
          
          // Deactivate agent
          await agentService.deactivateAgent(agent.id);
          
          // Verify all sessions are invalidated
          const afterResult = await db.query(
            'SELECT COUNT(*) as count FROM agent_sessions WHERE agent_id = ?',
            [agent.id]
          );
          assert.strictEqual(
            afterResult.rows[0].count,
            0,
            'All sessions should be invalidated after deactivation'
          );
          
          // Verify agent status is inactive
          const deactivatedAgent = await agentService.getAgentById(agent.id);
          assert.strictEqual(deactivatedAgent.status, 'inactive');
          assert.strictEqual(deactivatedAgent.availability, 'offline');
        }
      ),
      { numRuns: 50 }
    );
  });


  /**
   * Feature: multi-user-inbox-system, Property 15: Failed Login Lockout
   * Validates: Requirements 6.5
   * 
   * For any agent with 5 or more consecutive failed login attempts, 
   * the account SHALL be locked for 15 minutes.
   */
  it('Property 15: Failed login lockout after 5 attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: emailArb,
          password: passwordArb,
          name: nameArb
        }),
        async (agentData) => {
          // Create agent
          const agent = await agentService.createAgentDirect(testAccount.id, {
            email: agentData.email,
            password: agentData.password,
            name: agentData.name,
            role: 'agent'
          });
          
          // Record 4 failed attempts - should not be locked
          for (let i = 0; i < 4; i++) {
            await agentService.recordFailedLogin(agent.id);
          }
          
          let isLocked = await agentService.isAgentLocked(agent.id);
          assert.strictEqual(isLocked, false, 'Agent should not be locked after 4 attempts');
          
          // Record 5th failed attempt - should be locked
          const result = await agentService.recordFailedLogin(agent.id);
          
          assert.strictEqual(result.attempts, 5, 'Should have 5 failed attempts');
          assert(result.lockedUntil, 'Should have lockedUntil set');
          
          // Verify lock duration is approximately 15 minutes
          const lockDuration = new Date(result.lockedUntil).getTime() - Date.now();
          const expectedDuration = 15 * 60 * 1000; // 15 minutes
          const tolerance = 5000; // 5 second tolerance
          
          assert(
            Math.abs(lockDuration - expectedDuration) < tolerance,
            `Lock duration should be ~15 minutes, got ${lockDuration}ms`
          );
          
          isLocked = await agentService.isAgentLocked(agent.id);
          assert.strictEqual(isLocked, true, 'Agent should be locked after 5 attempts');
          
          // Reset and verify unlock
          await agentService.resetFailedLogins(agent.id);
          isLocked = await agentService.isAgentLocked(agent.id);
          assert.strictEqual(isLocked, false, 'Agent should be unlocked after reset');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Password verification
   * Validates: Requirements 6.1
   * 
   * Password hashing and verification should work correctly.
   */
  it('Property: Password hashing and verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        passwordArb,
        async (password) => {
          // Hash the password
          const hash = await agentService.hashPassword(password);
          
          // Verify hash format (salt:key)
          assert(hash.includes(':'), 'Hash should contain salt separator');
          const [salt, key] = hash.split(':');
          assert(salt.length === 32, 'Salt should be 32 hex characters');
          assert(key.length === 128, 'Key should be 128 hex characters');
          
          // Verify correct password
          const isValid = await agentService.verifyPassword(password, hash);
          assert.strictEqual(isValid, true, 'Correct password should verify');
          
          // Verify wrong password
          const isInvalid = await agentService.verifyPassword(password + 'wrong', hash);
          assert.strictEqual(isInvalid, false, 'Wrong password should not verify');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Agent availability update
   * Validates: Requirements 8.1, 8.2
   * 
   * Availability updates should be persisted correctly.
   */
  it('Property: Agent availability updates correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: emailArb,
          password: passwordArb,
          name: nameArb
        }),
        fc.constantFrom('online', 'busy', 'offline'),
        async (agentData, newAvailability) => {
          // Create agent
          const agent = await agentService.createAgentDirect(testAccount.id, {
            email: agentData.email,
            password: agentData.password,
            name: agentData.name,
            role: 'agent'
          });
          
          // Initial availability should be offline
          assert.strictEqual(agent.availability, 'offline');
          
          // Update availability
          const updated = await agentService.updateAvailability(agent.id, newAvailability);
          
          assert.strictEqual(
            updated.availability,
            newAvailability,
            `Availability should be ${newAvailability}, got ${updated.availability}`
          );
          
          // Verify last_activity_at is updated
          assert(updated.lastActivityAt, 'lastActivityAt should be set');
        }
      ),
      { numRuns: 50 }
    );
  });
});
