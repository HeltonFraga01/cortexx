/**
 * Property-Based Tests for MultiUserAuditService
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
const MultiUserAuditService = require('./MultiUserAuditService');
const { ACTION_TYPES, RESOURCE_TYPES } = require('./MultiUserAuditService');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-audit-service.db');

// Helper to create test database
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
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      role TEXT DEFAULT 'agent',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, email)
    )
  `);
  
  // Create audit_log table
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create indexes
  await db.query('CREATE INDEX IF NOT EXISTS idx_audit_log_account_id ON audit_log(account_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_audit_log_agent_id ON audit_log(agent_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)');
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM audit_log');
  await db.query('DELETE FROM agents');
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
async function createTestAgent(db, accountId) {
  const id = require('crypto').randomUUID();
  const email = `agent-${id.substring(0, 8)}@test.com`;
  await db.query(`
    INSERT INTO agents (id, account_id, email, password_hash, name)
    VALUES (?, ?, ?, 'hash', 'Test Agent')
  `, [id, accountId, email]);
  return id;
}

// Arbitraries
const actionArb = fc.constantFrom(...Object.values(ACTION_TYPES));
const resourceTypeArb = fc.constantFrom(...Object.values(RESOURCE_TYPES));
const resourceIdArb = fc.uuid();
const ipAddressArb = fc.ipV4();
const userAgentArb = fc.string({ minLength: 10, maxLength: 100 });
const detailsArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean())
);

describe('MultiUserAuditService Property Tests', () => {
  let db;
  let auditService;
  
  before(async () => {
    db = await createTestDatabase();
    auditService = new MultiUserAuditService(db);
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
   * Feature: multi-user-inbox-system, Property 13: Audit Log Completeness
   * Validates: Requirements 6.2
   * 
   * For any action performed by an agent, an audit log entry SHALL be created 
   * containing the agent ID, timestamp, action type, and relevant details.
   */
  it('Property 13: Audit log completeness - all required fields are captured', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArb,
        resourceTypeArb,
        resourceIdArb,
        detailsArb,
        ipAddressArb,
        async (action, resourceType, resourceId, details, ipAddress) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId);
          
          // Log an action
          const logEntry = await auditService.logAction({
            accountId,
            agentId,
            action,
            resourceType,
            resourceId,
            details,
            ipAddress
          });
          
          // Verify log entry was created with all required fields
          assert(logEntry, 'Log entry should be created');
          assert(logEntry.id, 'Log entry should have an ID');
          assert.strictEqual(logEntry.accountId, accountId, 'Account ID should match');
          assert.strictEqual(logEntry.agentId, agentId, 'Agent ID should match');
          assert.strictEqual(logEntry.action, action, 'Action should match');
          assert.strictEqual(logEntry.resourceType, resourceType, 'Resource type should match');
          assert.strictEqual(logEntry.resourceId, resourceId, 'Resource ID should match');
          assert(logEntry.createdAt, 'Timestamp should be set');
          
          // Verify details are preserved
          for (const [key, value] of Object.entries(details)) {
            assert.strictEqual(
              logEntry.details[key],
              value,
              `Detail ${key} should be preserved`
            );
          }
          
          // Verify log can be retrieved
          const retrieved = await auditService.getLogById(logEntry.id);
          assert(retrieved, 'Log should be retrievable');
          assert.strictEqual(retrieved.id, logEntry.id);
          assert.strictEqual(retrieved.agentId, agentId);
          assert.strictEqual(retrieved.action, action);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 17: Message Sender Attribution
   * Validates: Requirements 7.4
   * 
   * For any message sent by an agent, the audit log SHALL record the agent ID as the sender.
   */
  it('Property 17: Message sender attribution - agent ID is recorded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 11, maxLength: 15 }),
        async (messageId, messageText, phoneNumber) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId);
          
          // Log message sent action
          const logEntry = await auditService.logMessageSent(accountId, agentId, messageId, {
            text: messageText,
            phoneNumber
          });
          
          // Verify agent ID is recorded
          assert(logEntry, 'Log entry should be created');
          assert.strictEqual(logEntry.agentId, agentId, 'Agent ID should be recorded');
          assert.strictEqual(logEntry.action, ACTION_TYPES.MESSAGE_SENT, 'Action should be MESSAGE_SENT');
          assert.strictEqual(logEntry.resourceType, RESOURCE_TYPES.MESSAGE, 'Resource type should be MESSAGE');
          assert.strictEqual(logEntry.resourceId, messageId, 'Message ID should be recorded');
          
          // Verify details contain message info
          assert.strictEqual(logEntry.details.text, messageText, 'Message text should be in details');
          assert.strictEqual(logEntry.details.phoneNumber, phoneNumber, 'Phone number should be in details');
          
          // Verify can query by agent
          const agentActivity = await auditService.getAgentActivity(agentId);
          assert(agentActivity.length > 0, 'Agent should have activity');
          assert(
            agentActivity.some(log => log.id === logEntry.id),
            'Message log should appear in agent activity'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Audit log query filtering
   * Validates: Requirements 6.4
   */
  it('Property: Audit log query filtering works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (logCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId);
          
          // Create multiple log entries with different actions
          const actions = Object.values(ACTION_TYPES).slice(0, logCount);
          for (const action of actions) {
            await auditService.logAction({
              accountId,
              agentId,
              action,
              resourceType: RESOURCE_TYPES.AGENT
            });
          }
          
          // Query all logs
          const allLogs = await auditService.queryLogs(accountId);
          assert.strictEqual(
            allLogs.logs.length,
            logCount,
            `Should have ${logCount} logs`
          );
          
          // Query by specific action
          const specificAction = actions[0];
          const filteredLogs = await auditService.queryLogs(accountId, {
            action: specificAction
          });
          assert(
            filteredLogs.logs.every(log => log.action === specificAction),
            'All filtered logs should have the specified action'
          );
          
          // Query by agent
          const agentLogs = await auditService.queryLogs(accountId, {
            agentId
          });
          assert(
            agentLogs.logs.every(log => log.agentId === agentId),
            'All filtered logs should be from the specified agent'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Login/logout audit
   * Validates: Requirements 6.2
   */
  it('Property: Login and logout are properly audited', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArb,
        userAgentArb,
        fc.boolean(),
        async (ipAddress, userAgent, loginSuccess) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId);
          
          // Log login
          const loginLog = await auditService.logLogin(
            accountId, 
            agentId, 
            ipAddress, 
            userAgent, 
            loginSuccess
          );
          
          assert(loginLog, 'Login log should be created');
          assert.strictEqual(
            loginLog.action,
            loginSuccess ? ACTION_TYPES.AGENT_LOGIN : ACTION_TYPES.AGENT_LOGIN_FAILED,
            'Action should match login success status'
          );
          assert.strictEqual(loginLog.ipAddress, ipAddress, 'IP address should be recorded');
          assert.strictEqual(loginLog.userAgent, userAgent, 'User agent should be recorded');
          
          // Log logout
          const logoutLog = await auditService.logLogout(accountId, agentId, ipAddress);
          
          assert(logoutLog, 'Logout log should be created');
          assert.strictEqual(logoutLog.action, ACTION_TYPES.AGENT_LOGOUT, 'Action should be AGENT_LOGOUT');
          assert.strictEqual(logoutLog.agentId, agentId, 'Agent ID should be recorded');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Resource activity tracking
   * Validates: Requirements 6.2
   */
  it('Property: Resource activity can be tracked', async () => {
    await fc.assert(
      fc.asyncProperty(
        resourceTypeArb,
        resourceIdArb,
        fc.integer({ min: 1, max: 5 }),
        async (resourceType, resourceId, actionCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const agentId = await createTestAgent(db, accountId);
          
          // Create multiple actions on the same resource
          for (let i = 0; i < actionCount; i++) {
            await auditService.logAction({
              accountId,
              agentId,
              action: ACTION_TYPES.AGENT_UPDATED,
              resourceType,
              resourceId
            });
          }
          
          // Get resource activity
          const activity = await auditService.getResourceActivity(resourceType, resourceId);
          
          assert.strictEqual(
            activity.length,
            actionCount,
            `Should have ${actionCount} activity entries for resource`
          );
          
          // Verify all entries are for the correct resource
          for (const log of activity) {
            assert.strictEqual(log.resourceType, resourceType);
            assert.strictEqual(log.resourceId, resourceId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
