/**
 * Property-Based Tests for TeamService
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
const TeamService = require('./TeamService');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-team-service.db');

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
  
  // Create teams table
  await db.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      allow_auto_assign INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, name)
    )
  `);
  
  // Create team_members table
  await db.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(team_id, agent_id)
    )
  `);
  
  // Create audit_log table (required by TeamService audit integration)
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
  await db.query('DELETE FROM team_members');
  await db.query('DELETE FROM teams');
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
const teamNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const descriptionArb = fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined });

describe('TeamService Property Tests', () => {
  let db;
  let teamService;
  
  before(async () => {
    db = await createTestDatabase();
    teamService = new TeamService(db);
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
   * Feature: multi-user-inbox-system, Property 12: Team Visibility
   * Validates: Requirements 5.3
   * 
   * For any conversation assigned to a team, all team members SHALL be able to view that conversation.
   * This test validates that team membership is correctly tracked.
   */
  it('Property 12: Team visibility - all members can access team', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamNameArb,
        fc.integer({ min: 1, max: 5 }),
        async (teamName, memberCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          
          // Create team
          const team = await teamService.createTeam(accountId, { name: teamName });
          assert(team.id, 'Team should have an ID');
          
          // Create agents and add them to team
          const agentIds = [];
          for (let i = 0; i < memberCount; i++) {
            const agentId = await createTestAgent(db, accountId);
            agentIds.push(agentId);
            await teamService.addMember(team.id, agentId);
          }
          
          // Verify all agents are members
          for (const agentId of agentIds) {
            const isMember = await teamService.isMember(team.id, agentId);
            assert.strictEqual(
              isMember,
              true,
              `Agent ${agentId} should be a member of team ${team.id}`
            );
          }
          
          // Verify team members list contains all agents
          const members = await teamService.getTeamMembers(team.id);
          assert.strictEqual(
            members.length,
            memberCount,
            `Team should have ${memberCount} members, got ${members.length}`
          );
          
          // Verify each agent can see the team in their teams list
          for (const agentId of agentIds) {
            const agentTeams = await teamService.getAgentTeams(agentId);
            const hasTeam = agentTeams.some(t => t.id === team.id);
            assert.strictEqual(
              hasTeam,
              true,
              `Agent ${agentId} should see team ${team.id} in their teams list`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Team member removal
   * Validates: Requirements 5.5
   * 
   * When an agent is removed from a team, they should no longer have access.
   */
  it('Property: Team member removal revokes access', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamNameArb,
        fc.integer({ min: 2, max: 5 }),
        async (teamName, memberCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const team = await teamService.createTeam(accountId, { name: teamName });
          
          // Create agents and add them to team
          const agentIds = [];
          for (let i = 0; i < memberCount; i++) {
            const agentId = await createTestAgent(db, accountId);
            agentIds.push(agentId);
            await teamService.addMember(team.id, agentId);
          }
          
          // Remove first agent
          const removedAgentId = agentIds[0];
          await teamService.removeMember(team.id, removedAgentId);
          
          // Verify removed agent is no longer a member
          const isMember = await teamService.isMember(team.id, removedAgentId);
          assert.strictEqual(
            isMember,
            false,
            'Removed agent should not be a member'
          );
          
          // Verify other agents are still members
          for (let i = 1; i < agentIds.length; i++) {
            const stillMember = await teamService.isMember(team.id, agentIds[i]);
            assert.strictEqual(
              stillMember,
              true,
              `Agent ${agentIds[i]} should still be a member`
            );
          }
          
          // Verify member count decreased
          const members = await teamService.getTeamMembers(team.id);
          assert.strictEqual(
            members.length,
            memberCount - 1,
            `Team should have ${memberCount - 1} members after removal`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Team CRUD consistency
   * Validates: Requirements 5.1, 5.4
   */
  it('Property: Team CRUD operations maintain consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamNameArb,
        descriptionArb,
        fc.boolean(),
        async (name, description, allowAutoAssign) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          
          // Create team
          const team = await teamService.createTeam(accountId, {
            name,
            description,
            allowAutoAssign
          });
          
          assert(team.id, 'Team should have an ID');
          assert.strictEqual(team.name, name);
          assert.strictEqual(team.allowAutoAssign, allowAutoAssign);
          
          // Retrieve team
          const retrieved = await teamService.getTeamById(team.id);
          assert.strictEqual(retrieved.id, team.id);
          assert.strictEqual(retrieved.name, name);
          
          // List teams
          const teams = await teamService.listTeams(accountId);
          assert(teams.some(t => t.id === team.id), 'Team should appear in list');
          
          // Update team
          const newName = `updated-${name}`;
          const updated = await teamService.updateTeam(team.id, { name: newName });
          assert.strictEqual(updated.name, newName);
          
          // Delete team
          await teamService.deleteTeam(team.id);
          const deleted = await teamService.getTeamById(team.id);
          assert.strictEqual(deleted, null, 'Deleted team should not be found');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Team statistics accuracy
   * Validates: Requirements 5.4
   */
  it('Property: Team statistics are accurate', async () => {
    await fc.assert(
      fc.asyncProperty(
        teamNameArb,
        fc.integer({ min: 0, max: 5 }),
        async (teamName, memberCount) => {
          await cleanupTestData(db);
          
          const accountId = await createTestAccount(db);
          const team = await teamService.createTeam(accountId, { name: teamName });
          
          // Add members
          for (let i = 0; i < memberCount; i++) {
            const agentId = await createTestAgent(db, accountId);
            await teamService.addMember(team.id, agentId);
          }
          
          // Get stats
          const stats = await teamService.getTeamStats(team.id);
          assert.strictEqual(
            stats.totalMembers,
            memberCount,
            `Total members should be ${memberCount}, got ${stats.totalMembers}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
