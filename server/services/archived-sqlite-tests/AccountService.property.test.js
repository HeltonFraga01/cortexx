/**
 * Property-Based Tests for AccountService
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

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-account-service.db');

// Helper to create test database with multi-user tables
async function createTestDatabase() {
  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  await db.init();
  
  // Create accounts table (from migration 050)
  await db.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      wuzapi_token TEXT NOT NULL,
      timezone TEXT DEFAULT 'America/Sao_Paulo',
      locale TEXT DEFAULT 'pt-BR',
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create agents table (from migration 051)
  await db.query(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'agent' CHECK(role IN ('owner', 'administrator', 'agent', 'viewer')),
      custom_role_id TEXT,
      availability TEXT DEFAULT 'offline' CHECK(availability IN ('online', 'busy', 'offline')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending')),
      last_activity_at DATETIME,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, email)
    )
  `);
  
  // Create teams table (from migration 055)
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
  
  // Create inboxes table (from migration 056)
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
  
  // Create audit_log table (from migration 057)
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
  
  // Create indexes
  await db.query('CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_user_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_agents_account ON agents(account_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_audit_log_account ON audit_log(account_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_audit_log_agent ON audit_log(agent_id)');
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM audit_log');
  await db.query('DELETE FROM agents');
  await db.query('DELETE FROM teams');
  await db.query('DELETE FROM inboxes');
  await db.query('DELETE FROM accounts');
}

// Arbitraries for generating test data
const accountNameArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
const ownerUserIdArb = fc.uuid();
const wuzapiTokenArb = fc.string({ minLength: 10, maxLength: 100 });
const timezoneArb = fc.constantFrom(
  'America/Sao_Paulo',
  'America/New_York',
  'Europe/London',
  'Asia/Tokyo',
  'UTC'
);
const localeArb = fc.constantFrom('pt-BR', 'en-US', 'es-ES', 'fr-FR');

describe('AccountService Property Tests', () => {
  let db;
  let accountService;
  
  before(async () => {
    db = await createTestDatabase();
    accountService = new AccountService(db);
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
   * Feature: multi-user-inbox-system, Property 1: Account Creation Generates Unique Identifiers
   * Validates: Requirements 1.1
   * 
   * For any account creation request with valid owner data, the system SHALL generate 
   * a unique account ID that does not exist in the database and correctly associate the owner.
   */
  it('Property 1: Account creation generates unique identifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: accountNameArb,
            ownerUserId: ownerUserIdArb,
            wuzapiToken: wuzapiTokenArb
          }),
          { minLength: 2, maxLength: 20 }
        ),
        async (accountsData) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          const createdIds = new Set();
          
          // Create multiple accounts
          for (const data of accountsData) {
            const account = await accountService.createAccount(data);
            
            // Verify ID is a valid UUID format
            assert(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account.id),
              `Account ID should be a valid UUID, got: ${account.id}`
            );
            
            // Verify ID is unique
            assert(
              !createdIds.has(account.id),
              `Account ID ${account.id} should be unique`
            );
            createdIds.add(account.id);
            
            // Verify owner association
            assert.strictEqual(
              account.ownerUserId,
              data.ownerUserId,
              `Owner user ID should match: expected ${data.ownerUserId}, got ${account.ownerUserId}`
            );
            
            // Verify account can be retrieved
            const retrieved = await accountService.getAccountById(account.id);
            assert(retrieved, `Account ${account.id} should be retrievable`);
            assert.strictEqual(retrieved.id, account.id);
          }
          
          // Verify total count matches
          const allAccounts = await accountService.listAccounts();
          assert.strictEqual(
            allAccounts.length,
            accountsData.length,
            `Should have ${accountsData.length} accounts, got ${allAccounts.length}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 2: Account Default Settings Initialization
   * Validates: Requirements 1.2
   * 
   * For any newly created account, the system SHALL initialize all required default 
   * settings (timezone, locale, feature flags) with valid values.
   */
  it('Property 2: Account default settings initialization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: accountNameArb,
          ownerUserId: ownerUserIdArb,
          wuzapiToken: wuzapiTokenArb,
          // Optionally provide some settings
          timezone: fc.option(timezoneArb, { nil: undefined }),
          locale: fc.option(localeArb, { nil: undefined })
        }),
        async (data) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          const account = await accountService.createAccount(data);
          
          // Verify timezone has a valid value
          assert(
            account.timezone && typeof account.timezone === 'string',
            `Timezone should be a non-empty string, got: ${account.timezone}`
          );
          
          // If timezone was provided, it should match; otherwise default
          if (data.timezone) {
            assert.strictEqual(account.timezone, data.timezone);
          } else {
            assert.strictEqual(account.timezone, 'America/Sao_Paulo');
          }
          
          // Verify locale has a valid value
          assert(
            account.locale && typeof account.locale === 'string',
            `Locale should be a non-empty string, got: ${account.locale}`
          );
          
          // If locale was provided, it should match; otherwise default
          if (data.locale) {
            assert.strictEqual(account.locale, data.locale);
          } else {
            assert.strictEqual(account.locale, 'pt-BR');
          }
          
          // Verify status is active by default
          assert.strictEqual(
            account.status,
            'active',
            `New account status should be 'active', got: ${account.status}`
          );
          
          // Verify settings object exists with required defaults
          assert(
            account.settings && typeof account.settings === 'object',
            `Settings should be an object, got: ${typeof account.settings}`
          );
          
          // Verify default settings values
          assert(
            typeof account.settings.maxAgents === 'number' && account.settings.maxAgents > 0,
            `maxAgents should be a positive number, got: ${account.settings.maxAgents}`
          );
          
          assert(
            typeof account.settings.maxInboxes === 'number' && account.settings.maxInboxes > 0,
            `maxInboxes should be a positive number, got: ${account.settings.maxInboxes}`
          );
          
          assert(
            typeof account.settings.maxTeams === 'number' && account.settings.maxTeams > 0,
            `maxTeams should be a positive number, got: ${account.settings.maxTeams}`
          );
          
          assert(
            Array.isArray(account.settings.features) && account.settings.features.length > 0,
            `features should be a non-empty array, got: ${JSON.stringify(account.settings.features)}`
          );
          
          // Verify timestamps are set
          assert(account.createdAt, 'createdAt should be set');
          assert(account.updatedAt, 'updatedAt should be set');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 3: Inactive Account Access Denial
   * Validates: Requirements 1.4
   * 
   * For any account with status 'inactive', the account data should remain intact
   * but the status should correctly reflect the inactive state.
   */
  it('Property 3: Inactive account data remains intact', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: accountNameArb,
          ownerUserId: ownerUserIdArb,
          wuzapiToken: wuzapiTokenArb
        }),
        async (data) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create account
          const account = await accountService.createAccount(data);
          
          // Store original data
          const originalName = account.name;
          const originalOwner = account.ownerUserId;
          const originalToken = account.wuzapiToken;
          
          // Deactivate account
          await accountService.deactivateAccount(account.id);
          
          // Retrieve account
          const deactivated = await accountService.getAccountById(account.id);
          
          // Verify status is inactive
          assert.strictEqual(
            deactivated.status,
            'inactive',
            `Account status should be 'inactive', got: ${deactivated.status}`
          );
          
          // Verify all other data remains intact
          assert.strictEqual(deactivated.name, originalName);
          assert.strictEqual(deactivated.ownerUserId, originalOwner);
          assert.strictEqual(deactivated.wuzapiToken, originalToken);
          
          // Verify account can be reactivated
          await accountService.activateAccount(account.id);
          const reactivated = await accountService.getAccountById(account.id);
          
          assert.strictEqual(
            reactivated.status,
            'active',
            `Account status should be 'active' after reactivation, got: ${reactivated.status}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Account update preserves unmodified fields
   * Validates: Requirements 1.2
   * 
   * For any account update, fields not included in the update should remain unchanged.
   */
  it('Property: Account update preserves unmodified fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: accountNameArb,
          ownerUserId: ownerUserIdArb,
          wuzapiToken: wuzapiTokenArb,
          timezone: timezoneArb,
          locale: localeArb
        }),
        fc.record({
          name: fc.option(accountNameArb, { nil: undefined }),
          timezone: fc.option(timezoneArb, { nil: undefined })
        }),
        async (createData, updateData) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create account
          const account = await accountService.createAccount(createData);
          
          // Store original values
          const originalLocale = account.locale;
          const originalOwner = account.ownerUserId;
          
          // Update account with partial data
          const updated = await accountService.updateAccount(account.id, updateData);
          
          // Verify updated fields changed (if provided)
          if (updateData.name !== undefined) {
            assert.strictEqual(updated.name, updateData.name);
          } else {
            assert.strictEqual(updated.name, createData.name);
          }
          
          if (updateData.timezone !== undefined) {
            assert.strictEqual(updated.timezone, updateData.timezone);
          } else {
            assert.strictEqual(updated.timezone, createData.timezone);
          }
          
          // Verify unmodified fields remain unchanged
          assert.strictEqual(updated.locale, originalLocale);
          assert.strictEqual(updated.ownerUserId, originalOwner);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Account retrieval by owner
   * Validates: Requirements 1.1
   * 
   * For any account, retrieving by owner user ID should return the correct account.
   */
  it('Property: Account retrieval by owner user ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: accountNameArb,
          ownerUserId: ownerUserIdArb,
          wuzapiToken: wuzapiTokenArb
        }),
        async (data) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create account
          const account = await accountService.createAccount(data);
          
          // Retrieve by owner
          const retrieved = await accountService.getAccountByOwnerUserId(data.ownerUserId);
          
          assert(retrieved, 'Account should be retrievable by owner user ID');
          assert.strictEqual(retrieved.id, account.id);
          assert.strictEqual(retrieved.ownerUserId, data.ownerUserId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Settings merge on update
   * Validates: Requirements 1.2
   * 
   * When updating account settings, new settings should be merged with existing ones,
   * not replace them entirely.
   */
  it('Property: Settings merge on update', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: accountNameArb,
          ownerUserId: ownerUserIdArb,
          wuzapiToken: wuzapiTokenArb
        }),
        fc.record({
          customSetting: fc.string({ minLength: 1, maxLength: 50 }),
          maxAgents: fc.integer({ min: 1, max: 100 })
        }),
        async (createData, newSettings) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create account
          const account = await accountService.createAccount(createData);
          
          // Store original settings
          const originalFeatures = account.settings.features;
          const originalMaxInboxes = account.settings.maxInboxes;
          
          // Update with new settings
          const updated = await accountService.updateAccount(account.id, {
            settings: newSettings
          });
          
          // Verify new settings are applied
          assert.strictEqual(updated.settings.customSetting, newSettings.customSetting);
          assert.strictEqual(updated.settings.maxAgents, newSettings.maxAgents);
          
          // Verify original settings are preserved
          assert.deepStrictEqual(updated.settings.features, originalFeatures);
          assert.strictEqual(updated.settings.maxInboxes, originalMaxInboxes);
        }
      ),
      { numRuns: 100 }
    );
  });
});
