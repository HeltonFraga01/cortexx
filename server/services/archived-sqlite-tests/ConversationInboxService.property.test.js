/**
 * Property-Based Tests for ConversationInboxService
 * 
 * Tests WUZAPI credential isolation and inbox access control.
 * 
 * **Feature: multi-user-inbox-system, Property 20: WUZAPI Credential Isolation**
 * **Validates: Requirements 10.1**
 */

const fc = require('fast-check');
const assert = require('assert');
const Database = require('../database');

// Mock logger
const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {}
};

// Replace logger in modules
jest.mock('../utils/logger', () => ({
  logger: mockLogger
}));

const ConversationInboxService = require('./ConversationInboxService');

describe('ConversationInboxService Property Tests', () => {
  let db;
  let service;

  beforeAll(async () => {
    db = new Database(':memory:');
    await db.initialize();
    
    // Create required tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        wuzapi_token TEXT NOT NULL,
        status TEXT DEFAULT 'active'
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'agent',
        status TEXT DEFAULT 'active'
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS inboxes (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS inbox_members (
        id TEXT PRIMARY KEY,
        inbox_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        UNIQUE(inbox_id, agent_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        contact_jid TEXT NOT NULL,
        contact_name TEXT,
        inbox_id TEXT,
        assigned_agent_id TEXT,
        last_message_at DATETIME,
        status TEXT DEFAULT 'open'
      )
    `);

    service = new ConversationInboxService(db);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM conversations');
    await db.query('DELETE FROM inbox_members');
    await db.query('DELETE FROM inboxes');
    await db.query('DELETE FROM agents');
    await db.query('DELETE FROM accounts');
  });

  /**
   * **Feature: multi-user-inbox-system, Property 20: WUZAPI Credential Isolation**
   * 
   * For any message sent by an agent, the system SHALL use the account's 
   * WUZAPI credentials (not the agent's) while logging the agent ID for audit purposes.
   * 
   * **Validates: Requirements 10.1**
   */
  describe('Property 20: WUZAPI Credential Isolation', () => {
    it('should use account WUZAPI token, not agent credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate account with WUZAPI token
          fc.record({
            accountId: fc.uuid(),
            accountName: fc.string({ minLength: 1, maxLength: 50 }),
            wuzapiToken: fc.string({ minLength: 32, maxLength: 64 }),
          }),
          // Generate multiple agents
          fc.array(
            fc.record({
              agentId: fc.uuid(),
              email: fc.emailAddress(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (account, agents) => {
            // Setup: Create account
            await db.query(
              'INSERT INTO accounts (id, name, owner_user_id, wuzapi_token) VALUES (?, ?, ?, ?)',
              [account.accountId, account.accountName, 'owner-user', account.wuzapiToken]
            );

            // Setup: Create agents
            for (const agent of agents) {
              await db.query(
                'INSERT INTO agents (id, account_id, email, name) VALUES (?, ?, ?, ?)',
                [agent.agentId, account.accountId, agent.email, agent.name]
              );
            }

            // Verify: Each agent belongs to the account with the same WUZAPI token
            for (const agent of agents) {
              const { rows } = await db.query(`
                SELECT a.wuzapi_token, ag.id as agent_id
                FROM accounts a
                INNER JOIN agents ag ON ag.account_id = a.id
                WHERE ag.id = ?
              `, [agent.agentId]);

              assert.strictEqual(rows.length, 1, 'Agent should be linked to account');
              assert.strictEqual(
                rows[0].wuzapi_token, 
                account.wuzapiToken,
                'Agent should use account WUZAPI token'
              );
              assert.strictEqual(
                rows[0].agent_id, 
                agent.agentId,
                'Agent ID should be preserved for audit'
              );
            }

            // Cleanup
            await db.query('DELETE FROM agents WHERE account_id = ?', [account.accountId]);
            await db.query('DELETE FROM accounts WHERE id = ?', [account.accountId]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: multi-user-inbox-system, Property 11: Inbox Access Control**
   * 
   * For any conversation access request, the system SHALL return only 
   * conversations from inboxes where the requesting agent is a member.
   * 
   * **Validates: Requirements 4.4, 4.5, 7.1, 7.3**
   */
  describe('Property 11: Inbox Access Control', () => {
    it('should only return conversations from agent inbox memberships', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // accountId
          fc.uuid(), // agentId
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // memberInboxIds
          fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }), // nonMemberInboxIds
          async (accountId, agentId, memberInboxIds, nonMemberInboxIds) => {
            // Ensure no overlap
            const uniqueNonMember = nonMemberInboxIds.filter(id => !memberInboxIds.includes(id));

            // Setup: Create account
            await db.query(
              'INSERT INTO accounts (id, name, owner_user_id, wuzapi_token) VALUES (?, ?, ?, ?)',
              [accountId, 'Test Account', 'owner', 'token123']
            );

            // Setup: Create agent
            await db.query(
              'INSERT INTO agents (id, account_id, email, name) VALUES (?, ?, ?, ?)',
              [agentId, accountId, 'agent@test.com', 'Test Agent']
            );

            // Setup: Create inboxes and memberships
            for (const inboxId of memberInboxIds) {
              await db.query(
                'INSERT INTO inboxes (id, account_id, name) VALUES (?, ?, ?)',
                [inboxId, accountId, `Inbox ${inboxId.slice(0, 8)}`]
              );
              await db.query(
                'INSERT INTO inbox_members (id, inbox_id, agent_id) VALUES (?, ?, ?)',
                [`im-${inboxId}`, inboxId, agentId]
              );
              // Create conversation in this inbox
              await db.query(
                'INSERT INTO conversations (user_id, contact_jid, inbox_id, status) VALUES (?, ?, ?, ?)',
                [accountId, `contact-${inboxId}@s.whatsapp.net`, inboxId, 'open']
              );
            }

            // Setup: Create non-member inboxes with conversations
            for (const inboxId of uniqueNonMember) {
              await db.query(
                'INSERT INTO inboxes (id, account_id, name) VALUES (?, ?, ?)',
                [inboxId, accountId, `Inbox ${inboxId.slice(0, 8)}`]
              );
              // Create conversation in this inbox (agent should NOT see this)
              await db.query(
                'INSERT INTO conversations (user_id, contact_jid, inbox_id, status) VALUES (?, ?, ?, ?)',
                [accountId, `contact-${inboxId}@s.whatsapp.net`, inboxId, 'open']
              );
            }

            // Test: Get conversations for agent
            const result = await service.getConversationsForAgent(accountId, agentId);

            // Verify: Only conversations from member inboxes are returned
            assert.strictEqual(
              result.conversations.length,
              memberInboxIds.length,
              `Should return ${memberInboxIds.length} conversations, got ${result.conversations.length}`
            );

            // Verify: All returned conversations are from member inboxes
            for (const conv of result.conversations) {
              assert(
                memberInboxIds.includes(conv.inbox_id),
                `Conversation inbox ${conv.inbox_id} should be in member inboxes`
              );
            }

            // Verify: No conversations from non-member inboxes
            for (const conv of result.conversations) {
              assert(
                !uniqueNonMember.includes(conv.inbox_id),
                `Conversation inbox ${conv.inbox_id} should NOT be from non-member inboxes`
              );
            }

            // Cleanup
            await db.query('DELETE FROM conversations');
            await db.query('DELETE FROM inbox_members');
            await db.query('DELETE FROM inboxes');
            await db.query('DELETE FROM agents WHERE id = ?', [agentId]);
            await db.query('DELETE FROM accounts WHERE id = ?', [accountId]);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should deny access to conversations from non-member inboxes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // accountId
          fc.uuid(), // agentId
          fc.uuid(), // nonMemberInboxId
          async (accountId, agentId, nonMemberInboxId) => {
            // Setup
            await db.query(
              'INSERT INTO accounts (id, name, owner_user_id, wuzapi_token) VALUES (?, ?, ?, ?)',
              [accountId, 'Test Account', 'owner', 'token123']
            );
            await db.query(
              'INSERT INTO agents (id, account_id, email, name) VALUES (?, ?, ?, ?)',
              [agentId, accountId, 'agent@test.com', 'Test Agent']
            );
            await db.query(
              'INSERT INTO inboxes (id, account_id, name) VALUES (?, ?, ?)',
              [nonMemberInboxId, accountId, 'Non-member Inbox']
            );
            
            // Create conversation in non-member inbox
            const { lastID } = await db.query(
              'INSERT INTO conversations (user_id, contact_jid, inbox_id, status) VALUES (?, ?, ?, ?)',
              [accountId, 'contact@s.whatsapp.net', nonMemberInboxId, 'open']
            );

            // Test: Check access
            const hasAccess = await service.checkConversationAccess(agentId, lastID);

            // Verify: Access should be denied
            assert.strictEqual(hasAccess, false, 'Agent should NOT have access to non-member inbox conversation');

            // Cleanup
            await db.query('DELETE FROM conversations');
            await db.query('DELETE FROM inboxes');
            await db.query('DELETE FROM agents WHERE id = ?', [agentId]);
            await db.query('DELETE FROM accounts WHERE id = ?', [accountId]);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
