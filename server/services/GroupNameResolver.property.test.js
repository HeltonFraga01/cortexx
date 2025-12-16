/**
 * Property-Based Tests for GroupNameResolver
 * 
 * Tests correctness properties for group name resolution.
 * Each test runs a minimum of 100 iterations.
 * 
 * Feature: group-name-webhook-enhancement
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const path = require('path');
const fs = require('fs');
const Database = require('../database');
const GroupNameResolver = require('./GroupNameResolver');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-group-name-resolver.db');

// Mock logger that captures logs for verification
function createMockLogger() {
  const logs = { debug: [], info: [], warn: [], error: [] };
  return {
    debug: (msg, data) => logs.debug.push({ msg, data }),
    info: (msg, data) => logs.info.push({ msg, data }),
    warn: (msg, data) => logs.warn.push({ msg, data }),
    error: (msg, data) => logs.error.push({ msg, data }),
    getLogs: () => logs,
    clear: () => {
      logs.debug = [];
      logs.info = [];
      logs.warn = [];
      logs.error = [];
    }
  };
}

// Helper to create test database
async function createTestDatabase() {
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  await db.init();
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      contact_jid TEXT NOT NULL,
      contact_name TEXT,
      name_source TEXT,
      name_updated_at DATETIME,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, contact_jid)
    )
  `);
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM conversations');
}

// Arbitraries for generating test data
const groupJidArb = fc.stringMatching(/^\d{18,20}@g\.us$/);
const validGroupNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => {
    const trimmed = s.trim();
    return trimmed.length > 0 && 
           !/^\d+$/.test(trimmed) && 
           !trimmed.includes('@g.us') &&
           !/^Grupo \d+/.test(trimmed);
  });
const invalidGroupNameJidArb = fc.stringMatching(/^\d{10,20}@g\.us$/);
const invalidGroupNameDigitsArb = fc.stringMatching(/^\d{5,20}$/);
const invalidGroupNameFallbackArb = fc.stringMatching(/^Grupo \d{5,10}/);
const userIdArb = fc.stringMatching(/^[a-zA-Z0-9]{8,16}$/);
const userTokenArb = fc.stringMatching(/^[a-zA-Z0-9]{16,32}$/);


describe('GroupNameResolver Property Tests', () => {
  let db;
  let mockLogger;
  let resolver;
  
  before(async () => {
    db = await createTestDatabase();
    mockLogger = createMockLogger();
    resolver = new GroupNameResolver(db, mockLogger);
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
    mockLogger.clear();
    resolver.nameCache.clear();
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 1: Webhook field extraction completeness
   * Validates: Requirements 1.1
   * 
   * For any webhook payload containing a valid group name in any of the supported fields
   * (GroupName, Name, Subject, ChatName, GroupSubject, Title), the system SHALL extract
   * and return that name.
   */
  it('Property 1: Webhook field extraction completeness', async () => {
    const webhookFieldArb = fc.constantFrom(
      'GroupName', 'Name', 'Subject', 'ChatName', 'GroupSubject', 'Title'
    );
    
    await fc.assert(
      fc.asyncProperty(
        webhookFieldArb,
        validGroupNameArb,
        async (fieldName, validName) => {
          // Create webhook payload with name in the specified field
          const webhookData = { [fieldName]: validName };
          
          const result = resolver.extractFromWebhook(webhookData);
          
          // Should extract the name
          assert.strictEqual(
            result.name,
            validName,
            `Should extract name from ${fieldName} field`
          );
          assert.strictEqual(
            result.source,
            'webhook',
            'Source should be webhook'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 1b: Webhook extraction with nested structures
   * Validates: Requirements 1.1
   * 
   * For any webhook payload containing a valid group name in nested structures,
   * the system SHALL extract and return that name.
   */
  it('Property 1b: Webhook extraction handles nested structures', async () => {
    await fc.assert(
      fc.asyncProperty(
        validGroupNameArb,
        async (validName) => {
          // Test nested structure: GroupInfo.Name
          const webhookData = {
            GroupInfo: { Name: validName }
          };
          
          const result = resolver.extractFromWebhook(webhookData);
          
          // Should extract the name from nested structure
          assert.strictEqual(
            result.name,
            validName,
            'Should extract name from nested GroupInfo.Name'
          );
          assert.strictEqual(
            result.source,
            'webhook',
            'Source should be webhook'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 2: Name validation consistency
   * Validates: Requirements 1.2
   * 
   * For any string that is a valid group name (not null, not empty, not only digits,
   * not containing @g.us, not starting with "Grupo " followed by digits),
   * the validation SHALL return isValid: true.
   */
  it('Property 2: Valid names are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        validGroupNameArb,
        async (validName) => {
          const result = resolver.validateGroupName(validName);
          
          assert.strictEqual(
            result.isValid,
            true,
            `Valid name "${validName}" should be accepted. Reason: ${result.reason}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 2b: Invalid names are rejected
   * Validates: Requirements 1.2
   * 
   * For any string that is an invalid group name (null, empty, only digits,
   * containing @g.us, or starting with "Grupo " followed by digits),
   * the validation SHALL return isValid: false.
   */
  it('Property 2b: Invalid names (JID format) are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidGroupNameJidArb,
        async (invalidName) => {
          const result = resolver.validateGroupName(invalidName);
          
          assert.strictEqual(
            result.isValid,
            false,
            `Invalid name "${invalidName}" (JID format) should be rejected`
          );
          assert.ok(
            result.reason.includes('@g.us'),
            'Reason should mention @g.us'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2c: Invalid names (digits only) are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidGroupNameDigitsArb,
        async (invalidName) => {
          const result = resolver.validateGroupName(invalidName);
          
          assert.strictEqual(
            result.isValid,
            false,
            `Invalid name "${invalidName}" (digits only) should be rejected`
          );
          assert.ok(
            result.reason.includes('digits'),
            'Reason should mention digits'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2d: Invalid names (fallback format) are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidGroupNameFallbackArb,
        async (invalidName) => {
          const result = resolver.validateGroupName(invalidName);
          
          assert.strictEqual(
            result.isValid,
            false,
            `Invalid name "${invalidName}" (fallback format) should be rejected`
          );
          assert.ok(
            result.reason.includes('fallback'),
            'Reason should mention fallback'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 7: Fallback name format
   * Validates: Requirements 4.3
   * 
   * For any group JID, the fallback name SHALL be formatted as "Grupo " followed
   * by the first 8 digits of the group number, followed by "..." if truncated.
   */
  it('Property 7: Fallback name format is consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        groupJidArb,
        async (groupJid) => {
          const fallbackName = resolver.formatFallbackGroupName(groupJid);
          
          // Should start with "Grupo "
          assert.ok(
            fallbackName.startsWith('Grupo '),
            `Fallback name should start with "Grupo ", got "${fallbackName}"`
          );
          
          // Extract the group number from JID
          const groupNumber = groupJid.split('@')[0];
          
          // If group number is longer than 8 digits, should be truncated with "..."
          if (groupNumber.length > 8) {
            assert.ok(
              fallbackName.endsWith('...'),
              `Fallback name should end with "..." for long numbers, got "${fallbackName}"`
            );
            assert.ok(
              fallbackName.includes(groupNumber.substring(0, 8)),
              `Fallback name should contain first 8 digits of ${groupNumber}`
            );
          } else {
            // Should contain the full number
            assert.ok(
              fallbackName.includes(groupNumber),
              `Fallback name should contain full number ${groupNumber}`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 7b: Fallback name handles null/undefined
   * Validates: Requirements 4.3
   */
  it('Property 7b: Fallback name handles null/undefined JID', () => {
    const nullResult = resolver.formatFallbackGroupName(null);
    const undefinedResult = resolver.formatFallbackGroupName(undefined);
    
    assert.strictEqual(nullResult, 'Grupo desconhecido', 'Should return "Grupo desconhecido" for null');
    assert.strictEqual(undefinedResult, 'Grupo desconhecido', 'Should return "Grupo desconhecido" for undefined');
  });


  /**
   * Feature: group-name-webhook-enhancement, Property 3: Database update idempotency
   * Validates: Requirements 1.3
   * 
   * For any valid group name and conversation, updating the database with the same
   * name multiple times SHALL result in the same final state.
   */
  it('Property 3: Database update is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        groupJidArb,
        validGroupNameArb,
        userIdArb,
        fc.constantFrom('webhook', 'api', 'fallback'),
        async (groupJid, validName, userId, source) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create a conversation
          await db.query(`
            INSERT INTO conversations (user_id, contact_jid, contact_name, status)
            VALUES (?, ?, 'Initial Name', 'open')
          `, [userId, groupJid]);
          
          // Get conversation ID
          const { rows } = await db.query(
            'SELECT id FROM conversations WHERE user_id = ? AND contact_jid = ?',
            [userId, groupJid]
          );
          const conversationId = rows[0].id;
          
          // Update multiple times with the same name
          await resolver.updateConversationName(conversationId, validName, source);
          await resolver.updateConversationName(conversationId, validName, source);
          await resolver.updateConversationName(conversationId, validName, source);
          
          // Verify final state
          const { rows: finalRows } = await db.query(
            'SELECT contact_name, name_source FROM conversations WHERE id = ?',
            [conversationId]
          );
          
          assert.strictEqual(
            finalRows[0].contact_name,
            validName,
            'Name should be the updated value'
          );
          assert.strictEqual(
            finalRows[0].name_source,
            source,
            'Source should be the updated value'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 4: Name source priority
   * Validates: Requirements 1.4, 3.2
   * 
   * For any group, when a valid name is available from webhook, it SHALL be used
   * over database or API sources.
   */
  it('Property 4: Webhook name takes priority over database', async () => {
    await fc.assert(
      fc.asyncProperty(
        groupJidArb,
        validGroupNameArb,
        validGroupNameArb,
        userIdArb,
        userTokenArb,
        async (groupJid, webhookName, dbName, userId, userToken) => {
          // Skip if names are the same
          if (webhookName.trim().toLowerCase() === dbName.trim().toLowerCase()) {
            return;
          }
          
          // Clean up before each iteration
          await cleanupTestData(db);
          resolver.nameCache.clear();
          
          // Create a conversation with existing name
          await db.query(`
            INSERT INTO conversations (user_id, contact_jid, contact_name, name_source, status)
            VALUES (?, ?, ?, 'database', 'open')
          `, [userId, groupJid, dbName]);
          
          // Create webhook data with a different valid name
          const webhookData = { GroupName: webhookName };
          
          // Resolve name - should use webhook name
          const result = await resolver.resolveGroupName(groupJid, webhookData, userToken, userId);
          
          assert.strictEqual(
            result.name,
            webhookName,
            `Should use webhook name "${webhookName}" over database name "${dbName}"`
          );
          assert.strictEqual(
            result.source,
            'webhook',
            'Source should be webhook'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 4b: Database name used when no webhook name
   * Validates: Requirements 5.3, 5.4
   * 
   * For any group, when no valid name is available from webhook but database has
   * a valid name, the database name SHALL be used.
   */
  it('Property 4b: Database name used when no webhook name available', async () => {
    await fc.assert(
      fc.asyncProperty(
        groupJidArb,
        validGroupNameArb,
        userIdArb,
        userTokenArb,
        async (groupJid, dbName, userId, userToken) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          resolver.nameCache.clear();
          
          // Create a conversation with existing valid name
          await db.query(`
            INSERT INTO conversations (user_id, contact_jid, contact_name, name_source, status)
            VALUES (?, ?, ?, 'api', 'open')
          `, [userId, groupJid, dbName]);
          
          // Create webhook data without group name (simulating a message event)
          const webhookData = { Chat: groupJid, Participant: '5511999999999@s.whatsapp.net' };
          
          // Resolve name - should use database name
          const result = await resolver.resolveGroupName(groupJid, webhookData, userToken, userId);
          
          assert.strictEqual(
            result.name,
            dbName,
            `Should use database name "${dbName}" when webhook has no name`
          );
          // Source could be 'api' (from database) or 'database'
          assert.ok(
            ['api', 'database'].includes(result.source),
            `Source should be api or database, got ${result.source}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 5: WebSocket broadcast consistency
   * Validates: Requirements 3.5
   * 
   * This test verifies that the resolver correctly indicates when a name was updated,
   * which is used to trigger WebSocket broadcasts.
   */
  it('Property 5: Updated flag is true when name changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        groupJidArb,
        validGroupNameArb,
        validGroupNameArb,
        userIdArb,
        userTokenArb,
        async (groupJid, oldName, newName, userId, userToken) => {
          // Skip if names are the same
          if (oldName.trim().toLowerCase() === newName.trim().toLowerCase()) {
            return;
          }
          
          // Clean up before each iteration
          await cleanupTestData(db);
          resolver.nameCache.clear();
          
          // Create a conversation with old name
          await db.query(`
            INSERT INTO conversations (user_id, contact_jid, contact_name, name_source, status)
            VALUES (?, ?, ?, 'database', 'open')
          `, [userId, groupJid, oldName]);
          
          // Create webhook data with new name
          const webhookData = { GroupName: newName };
          
          // Resolve name
          const result = await resolver.resolveGroupName(groupJid, webhookData, userToken, userId);
          
          assert.strictEqual(
            result.updated,
            true,
            'Updated flag should be true when name changes'
          );
          assert.strictEqual(
            result.previousName,
            oldName,
            `Previous name should be "${oldName}"`
          );
          assert.strictEqual(
            result.name,
            newName,
            `New name should be "${newName}"`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-name-webhook-enhancement, Property 6: API retry exponential backoff
   * Validates: Requirements 4.4
   * 
   * This test verifies that the fetchFromAPI method returns a fallback name
   * when the API is unavailable (we can't easily test the actual retry timing).
   */
  it('Property 6: API failure returns fallback name', async () => {
    // Test with a few specific cases instead of property-based testing
    // to avoid slow network timeouts
    const testCases = [
      { groupJid: '120363043775639115@g.us', userToken: 'test-token-12345678' },
      { groupJid: '999888777666555444@g.us', userToken: 'another-test-token' },
    ];
    
    for (const { groupJid, userToken } of testCases) {
      // fetchFromAPI will fail because there's no real WUZAPI server
      // It should return a fallback name after retries
      const result = await resolver.fetchFromAPI(groupJid, userToken, {
        maxRetries: 1, // Reduce retries for faster tests
        retryDelay: 10 // Minimal delay
      });
      
      // Should return a fallback name
      assert.ok(
        result.name.startsWith('Grupo '),
        `Should return fallback name starting with "Grupo ", got "${result.name}"`
      );
      assert.strictEqual(
        result.source,
        'fallback',
        'Source should be fallback when API fails'
      );
      assert.strictEqual(
        result.success,
        false,
        'Success should be false when API fails'
      );
    }
  });

  /**
   * Test: Empty webhook data returns no name
   */
  it('Empty webhook data returns no name', () => {
    const result = resolver.extractFromWebhook({});
    assert.strictEqual(result.name, null, 'Should return null for empty webhook');
    assert.strictEqual(result.source, 'none', 'Source should be none');
  });

  /**
   * Test: Null webhook data returns no name
   */
  it('Null webhook data returns no name', () => {
    const result = resolver.extractFromWebhook(null);
    assert.strictEqual(result.name, null, 'Should return null for null webhook');
    assert.strictEqual(result.source, 'none', 'Source should be none');
  });

  /**
   * Test: Webhook with only invalid names returns no name
   */
  it('Webhook with only invalid names returns no name', async () => {
    await fc.assert(
      fc.asyncProperty(
        invalidGroupNameJidArb,
        async (invalidName) => {
          const webhookData = { GroupName: invalidName, Name: invalidName };
          const result = resolver.extractFromWebhook(webhookData);
          
          assert.strictEqual(
            result.name,
            null,
            `Should return null for invalid name "${invalidName}"`
          );
          assert.strictEqual(
            result.source,
            'none',
            'Source should be none for invalid names'
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
