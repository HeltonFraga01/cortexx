/**
 * Property-Based Tests for InboxService
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
const InboxService = require('./InboxService');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-inbox-service.db');

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
      availability TEXT DEFAULT 'offline',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, email)
    )
  `);
  
  // Create inboxes table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inboxes (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      channel_type TEXT DEFAULT 'whatsapp',
      enable_auto_assignment INTEGER DEFAULT 1,
      auto_assignment_config TEXT DEFAULT '{}',
      greeting_enabled INTEGER DEFAULT 0,
      greeting_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, name)
    )
  `);
  
  // Create inbox_members table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inbox_members (
      id TEXT PRIMARY KEY,
      inbox_id TEXT NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(inbox_id, agent_id)
    )
  `);
  
  // Create audit_log table (required by InboxService audit integration)
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      agent_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM audit_log');
  await db.query('DELETE FROM inbox_members');
  await db.query('DELETE FROM inboxes');
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
async function createTestAgent(db, accountId, availability = 'offline') {
  const id = require('crypto').randomUUID();
  const email = `agent-${id.substring(0, 8)}@test.com`;
  await db.query(`
    INSERT INTO agents (id, account_id, email, password_hash, name, availability)
    VALUES (?, ?, ?, 'hash', 'Test Agent', ?)
  `, [id, accountId, email, availability]);
  return id;
}

// Arbitraries
const inboxNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const descriptionArb = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined });

describe('InboxService Property Tests', () => {
  let db;
  let inboxService;
  
  before(async () => {
    db = await createTestDatabase();
    inboxService = new InboxService(db);
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
   * Feature: multi-user-inbox-system, Property 11: Inbox Access Control
   * Validates: Requirements 4.4, 4.5, 7.1, 7.3
   * 
   * For any conversation access request, the system SHALL return only conversations 
   * from inboxes where the requesting agent is a member, and SHALL reject access 
   * to conversations from other inboxes.
   */
  it('Property 11: Inbox access control - members have access, non-members do not', async () => {
    await fc.assert(
      fc.asyncProperty(
        inboxNameArb,
        fc.integer({ min: 1, max: 5 }),
        async (inboxName, memberCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          
          // Create inbox
          const inbox = await inboxService.createInbox(accountId, { name: inboxName });
          assert(inbox.id, 'Inbox should have an ID');
          
          // Create member agents
          const memberIds = [];
          for (let i = 0; i < memberCount; i++) {
            const agentId = await createTestAgent(db, accountId);
            memberIds.push(agentId);
            await inboxService.assignAgent(inbox.id, agentId);
          }
          
          // Create non-member agent
          const nonMemberId = await createTestAgent(db, accountId);
          
          // Verify members have access
          for (const memberId of memberIds) {
            const hasAccess = await inboxService.checkAccess(memberId, inbox.id);
            assert.strictEqual(
              hasAccess,
              true,
              `Member ${memberId} should have access to inbox ${inbox.id}`
            );
          }
          
          // Verify non-member does NOT have access
          const nonMemberAccess = await inboxService.checkAccess(nonMemberId, inbox.id);
          assert.strictEqual(
            nonMemberAccess,
            false,
            `Non-member ${nonMemberId} should NOT have access to inbox ${inbox.id}`
          );
          
          // Verify members see inbox in their list
          for (const memberId of memberIds) {
            const agentInboxes = await inboxService.listAgentInboxes(memberId);
            const hasInbox = agentInboxes.some(i => i.id === inbox.id);
            assert.strictEqual(
              hasInbox,
              true,
              `Member ${memberId} should see inbox in their list`
            );
          }
          
          // Verify non-member does NOT see inbox
          const nonMemberInboxes = await inboxService.listAgentInboxes(nonMemberId);
          const nonMemberHasInbox = nonMemberInboxes.some(i => i.id === inbox.id);
          assert.strictEqual(
            nonMemberHasInbox,
            false,
            'Non-member should NOT see inbox in their list'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Agent removal revokes access
   * Validates: Requirements 4.5
   */
  it('Property: Agent removal from inbox revokes access', async () => {
    await fc.assert(
      fc.asyncProperty(
        inboxNameArb,
        fc.integer({ min: 2, max: 5 }),
        async (inboxName, memberCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const inbox = await inboxService.createInbox(accountId, { name: inboxName });
          
          // Create and assign agents
          const agentIds = [];
          for (let i = 0; i < memberCount; i++) {
            const agentId = await createTestAgent(db, accountId);
            agentIds.push(agentId);
            await inboxService.assignAgent(inbox.id, agentId);
          }
          
          // Remove first agent
          const removedAgentId = agentIds[0];
          await inboxService.removeAgent(inbox.id, removedAgentId);
          
          // Verify removed agent no longer has access
          const hasAccess = await inboxService.checkAccess(removedAgentId, inbox.id);
          assert.strictEqual(
            hasAccess,
            false,
            'Removed agent should not have access'
          );
          
          // Verify other agents still have access
          for (let i = 1; i < agentIds.length; i++) {
            const stillHasAccess = await inboxService.checkAccess(agentIds[i], inbox.id);
            assert.strictEqual(
              stillHasAccess,
              true,
              `Agent ${agentIds[i]} should still have access`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Inbox CRUD consistency
   * Validates: Requirements 4.1, 4.2
   */
  it('Property: Inbox CRUD operations maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        inboxNameArb,
        descriptionArb,
        fc.boolean(),
        async (name, description, enableAutoAssignment) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          
          // Create inbox
          const inbox = await inboxService.createInbox(accountId, {
            name,
            description,
            enableAutoAssignment
          });
          
          assert(inbox.id, 'Inbox should have an ID');
          assert.strictEqual(inbox.name, name);
          assert.strictEqual(inbox.enableAutoAssignment, enableAutoAssignment);
          
          // Retrieve inbox
          const retrieved = await inboxService.getInboxById(inbox.id);
          assert.strictEqual(retrieved.id, inbox.id);
          assert.strictEqual(retrieved.name, name);
          
          // List inboxes
          const inboxes = await inboxService.listInboxes(accountId);
          assert(inboxes.some(i => i.id === inbox.id), 'Inbox should appear in list');
          
          // Update inbox
          const newName = `updated-${name}`;
          const updated = await inboxService.updateInbox(inbox.id, { name: newName });
          assert.strictEqual(updated.name, newName);
          
          // Delete inbox
          await inboxService.deleteInbox(inbox.id);
          const deleted = await inboxService.getInboxById(inbox.id);
          assert.strictEqual(deleted, null, 'Deleted inbox should not be found');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 18: Availability-Based Routing
   * Validates: Requirements 8.1, 8.2, 8.3
   * 
   * For any auto-assignment, only agents with 'online' availability status 
   * SHALL be considered for new assignments.
   */
  it('Property 18: Availability-based routing only considers online agents', async () => {
    await fc.assert(
      fc.asyncProperty(
        inboxNameArb,
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 0, max: 2 }),
        async (inboxName, onlineCount, busyCount, offlineCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const inbox = await inboxService.createInbox(accountId, { 
            name: inboxName,
            enableAutoAssignment: true
          });
          
          // Create agents with different availability statuses
          const onlineAgents = [];
          const busyAgents = [];
          const offlineAgents = [];
          
          for (let i = 0; i < onlineCount; i++) {
            const agentId = await createTestAgent(db, accountId, 'online');
            onlineAgents.push(agentId);
            await inboxService.assignAgent(inbox.id, agentId);
          }
          
          for (let i = 0; i < busyCount; i++) {
            const agentId = await createTestAgent(db, accountId, 'busy');
            busyAgents.push(agentId);
            await inboxService.assignAgent(inbox.id, agentId);
          }
          
          for (let i = 0; i < offlineCount; i++) {
            const agentId = await createTestAgent(db, accountId, 'offline');
            offlineAgents.push(agentId);
            await inboxService.assignAgent(inbox.id, agentId);
          }
          
          // Get available agents for assignment
          const availableAgents = await inboxService.getAvailableAgentsForAssignment(inbox.id);
          
          // Verify only online agents are returned
          assert.strictEqual(
            availableAgents.length,
            onlineCount,
            `Should have ${onlineCount} available agents, got ${availableAgents.length}`
          );
          
          // Verify all returned agents are online
          for (const agent of availableAgents) {
            assert.strictEqual(
              agent.availability,
              'online',
              `Available agent should be online, got ${agent.availability}`
            );
          }
          
          // Verify busy and offline agents are NOT in the list
          const availableIds = availableAgents.map(a => a.id);
          for (const busyId of busyAgents) {
            assert(
              !availableIds.includes(busyId),
              'Busy agent should not be in available list'
            );
          }
          for (const offlineId of offlineAgents) {
            assert(
              !availableIds.includes(offlineId),
              'Offline agent should not be in available list'
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
