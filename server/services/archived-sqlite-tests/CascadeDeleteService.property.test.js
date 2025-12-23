/**
 * Property-Based Tests for CascadeDeleteService
 * 
 * Tests cascade deletion and orphan prevention.
 * 
 * **Feature: multi-user-inbox-system, Property 4: Account Deletion Cascade**
 * **Validates: Requirements 1.5**
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

jest.mock('../utils/logger', () => ({
  logger: mockLogger
}));

const CascadeDeleteService = require('./CascadeDeleteService');

describe('CascadeDeleteService Property Tests', () => {
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
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        token TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS agent_invitations (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        token TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_roles (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        permissions TEXT DEFAULT '[]'
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        agent_id TEXT NOT NULL
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
        agent_id TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        agent_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        contact_jid TEXT NOT NULL,
        inbox_id TEXT,
        assigned_agent_id TEXT
      )
    `);

    service = new CascadeDeleteService(db);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean up all tables
    await db.query('DELETE FROM conversations');
    await db.query('DELETE FROM audit_log');
    await db.query('DELETE FROM inbox_members');
    await db.query('DELETE FROM team_members');
    await db.query('DELETE FROM inboxes');
    await db.query('DELETE FROM teams');
    await db.query('DELETE FROM custom_roles');
    await db.query('DELETE FROM agent_invitations');
    await db.query('DELETE FROM agent_sessions');
    await db.query('DELETE FROM agents');
    await db.query('DELETE FROM accounts');
  });

  /**
   * **Feature: multi-user-inbox-system, Property 4: Account Deletion Cascade**
   * 
   * For any account deletion, all associated agents, teams, inboxes, and 
   * related records SHALL be deleted, and no orphaned records SHALL remain.
   * 
   * **Validates: Requirements 1.5**
   */
  describe('Property 4: Account Deletion Cascade', () => {
    it('should delete all associated records when account is deleted', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate account data
          fc.record({
            accountId: fc.uuid(),
            accountName: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          // Generate agents
          fc.array(
            fc.record({
              agentId: fc.uuid(),
              email: fc.emailAddress(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          // Generate teams
          fc.array(
            fc.record({
              teamId: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 3 }
          ),
          // Generate inboxes
          fc.array(
            fc.record({
              inboxId: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 0, maxLength: 3 }
          ),
          async (account, agents, teams, inboxes) => {
            // Setup: Create account
            await db.query(
              'INSERT INTO accounts (id, name, owner_user_id, wuzapi_token) VALUES (?, ?, ?, ?)',
              [account.accountId, account.accountName, 'owner', 'token123']
            );

            // Setup: Create agents
            for (const agent of agents) {
              await db.query(
                'INSERT INTO agents (id, account_id, email, name) VALUES (?, ?, ?, ?)',
                [agent.agentId, account.accountId, agent.email, agent.name]
              );

              // Create session for each agent
              await db.query(
                'INSERT INTO agent_sessions (id, agent_id, account_id, token) VALUES (?, ?, ?, ?)',
                [`sess-${agent.agentId}`, agent.agentId, account.accountId, `token-${agent.agentId}`]
              );
            }

            // Setup: Create teams and memberships
            for (const team of teams) {
              await db.query(
                'INSERT INTO teams (id, account_id, name) VALUES (?, ?, ?)',
                [team.teamId, account.accountId, team.name]
              );

              // Add first agent to team if exists
              if (agents.length > 0) {
                await db.query(
                  'INSERT INTO team_members (id, team_id, agent_id) VALUES (?, ?, ?)',
                  [`tm-${team.teamId}`, team.teamId, agents[0].agentId]
                );
              }
            }

            // Setup: Create inboxes and memberships
            for (const inbox of inboxes) {
              await db.query(
                'INSERT INTO inboxes (id, account_id, name) VALUES (?, ?, ?)',
                [inbox.inboxId, account.accountId, inbox.name]
              );

              // Add first agent to inbox if exists
              if (agents.length > 0) {
                await db.query(
                  'INSERT INTO inbox_members (id, inbox_id, agent_id) VALUES (?, ?, ?)',
                  [`im-${inbox.inboxId}`, inbox.inboxId, agents[0].agentId]
                );
              }
            }

            // Setup: Create audit log entries
            await db.query(
              'INSERT INTO audit_log (id, account_id, action, resource_type) VALUES (?, ?, ?, ?)',
              [`audit-${account.accountId}`, account.accountId, 'test', 'test']
            );

            // Verify setup: Records exist
            const { rows: beforeAgents } = await db.query(
              'SELECT COUNT(*) as count FROM agents WHERE account_id = ?',
              [account.accountId]
            );
            assert.strictEqual(beforeAgents[0].count, agents.length, 'Agents should exist before delete');

            // Execute: Delete account
            const result = await service.deleteAccount(account.accountId);

            // Verify: Deletion was successful
            assert.strictEqual(result.success, true, 'Deletion should succeed');

            // Verify: No orphaned records
            const verification = await service.verifyNoOrphans(account.accountId);
            assert.strictEqual(
              verification.hasOrphans, 
              false, 
              `Should have no orphans, but found: ${JSON.stringify(verification.orphanCounts)}`
            );

            // Verify: Account is deleted
            const { rows: accountRows } = await db.query(
              'SELECT COUNT(*) as count FROM accounts WHERE id = ?',
              [account.accountId]
            );
            assert.strictEqual(accountRows[0].count, 0, 'Account should be deleted');

            // Verify: All agents are deleted
            const { rows: agentRows } = await db.query(
              'SELECT COUNT(*) as count FROM agents WHERE account_id = ?',
              [account.accountId]
            );
            assert.strictEqual(agentRows[0].count, 0, 'All agents should be deleted');

            // Verify: All sessions are deleted
            const { rows: sessionRows } = await db.query(
              'SELECT COUNT(*) as count FROM agent_sessions WHERE account_id = ?',
              [account.accountId]
            );
            assert.strictEqual(sessionRows[0].count, 0, 'All sessions should be deleted');

            // Verify: All teams are deleted
            const { rows: teamRows } = await db.query(
              'SELECT COUNT(*) as count FROM teams WHERE account_id = ?',
              [account.accountId]
            );
            assert.strictEqual(teamRows[0].count, 0, 'All teams should be deleted');

            // Verify: All inboxes are deleted
            const { rows: inboxRows } = await db.query(
              'SELECT COUNT(*) as count FROM inboxes WHERE account_id = ?',
              [account.accountId]
            );
            assert.strictEqual(inboxRows[0].count, 0, 'All inboxes should be deleted');

            // Verify: All audit logs are deleted
            const { rows: auditRows } = await db.query(
              'SELECT COUNT(*) as count FROM audit_log WHERE account_id = ?',
              [account.accountId]
            );
            assert.strictEqual(auditRows[0].count, 0, 'All audit logs should be deleted');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not leave orphaned team_members or inbox_members', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // accountId
          fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // agentIds
          fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // teamIds
          fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // inboxIds
          async (accountId, agentIds, teamIds, inboxIds) => {
            // Setup
            await db.query(
              'INSERT INTO accounts (id, name, owner_user_id, wuzapi_token) VALUES (?, ?, ?, ?)',
              [accountId, 'Test Account', 'owner', 'token']
            );

            for (const agentId of agentIds) {
              await db.query(
                'INSERT INTO agents (id, account_id, email, name) VALUES (?, ?, ?, ?)',
                [agentId, accountId, `${agentId}@test.com`, 'Agent']
              );
            }

            for (const teamId of teamIds) {
              await db.query(
                'INSERT INTO teams (id, account_id, name) VALUES (?, ?, ?)',
                [teamId, accountId, 'Team']
              );
              // Add all agents to team
              for (const agentId of agentIds) {
                await db.query(
                  'INSERT INTO team_members (id, team_id, agent_id) VALUES (?, ?, ?)',
                  [`tm-${teamId}-${agentId}`, teamId, agentId]
                );
              }
            }

            for (const inboxId of inboxIds) {
              await db.query(
                'INSERT INTO inboxes (id, account_id, name) VALUES (?, ?, ?)',
                [inboxId, accountId, 'Inbox']
              );
              // Add all agents to inbox
              for (const agentId of agentIds) {
                await db.query(
                  'INSERT INTO inbox_members (id, inbox_id, agent_id) VALUES (?, ?, ?)',
                  [`im-${inboxId}-${agentId}`, inboxId, agentId]
                );
              }
            }

            // Execute
            await service.deleteAccount(accountId);

            // Verify: No orphaned team_members
            const { rows: tmRows } = await db.query(
              `SELECT COUNT(*) as count FROM team_members tm
               LEFT JOIN teams t ON tm.team_id = t.id
               WHERE t.id IS NULL`
            );
            assert.strictEqual(tmRows[0].count, 0, 'No orphaned team_members should exist');

            // Verify: No orphaned inbox_members
            const { rows: imRows } = await db.query(
              `SELECT COUNT(*) as count FROM inbox_members im
               LEFT JOIN inboxes i ON im.inbox_id = i.id
               WHERE i.id IS NULL`
            );
            assert.strictEqual(imRows[0].count, 0, 'No orphaned inbox_members should exist');
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
