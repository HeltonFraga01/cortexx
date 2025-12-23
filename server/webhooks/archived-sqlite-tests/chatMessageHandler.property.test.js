/**
 * Property-Based Tests for ChatMessageHandler
 * 
 * Tests correctness properties for group message sender identification.
 * Each test runs a minimum of 100 iterations.
 * 
 * Feature: group-message-sender-identification
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const path = require('path');
const fs = require('fs');
const Database = require('../database');
const ChatMessageHandler = require('./chatMessageHandler');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-chat-message-handler.db');

// Helper to create test database
async function createTestDatabase() {
  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  await db.init();
  
  // Create required tables
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      contact_jid TEXT NOT NULL,
      contact_name TEXT,
      contact_avatar_url TEXT,
      last_message_at DATETIME,
      last_message_preview TEXT,
      unread_count INTEGER DEFAULT 0,
      assigned_bot_id INTEGER,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, contact_jid)
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      message_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_type TEXT NOT NULL,
      content TEXT,
      media_url TEXT,
      media_mime_type TEXT,
      media_filename TEXT,
      media_metadata TEXT,
      reply_to_message_id TEXT,
      status TEXT DEFAULT 'pending',
      is_private_note INTEGER DEFAULT 0,
      sender_type TEXT,
      sender_bot_id INTEGER,
      participant_jid TEXT,
      participant_name TEXT,
      timestamp DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      reactor_jid TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, reactor_jid)
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, name)
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversation_labels (
      conversation_id INTEGER NOT NULL,
      label_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (conversation_id, label_id)
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      avatar_url TEXT,
      outgoing_url TEXT NOT NULL,
      access_token TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS outgoing_webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  return db;
}

// Helper to clean up test data
async function cleanupTestData(db) {
  await db.query('DELETE FROM message_reactions');
  await db.query('DELETE FROM conversation_labels');
  await db.query('DELETE FROM chat_messages');
  await db.query('DELETE FROM conversations');
  await db.query('DELETE FROM labels');
  await db.query('DELETE FROM agent_bots');
  await db.query('DELETE FROM outgoing_webhooks');
}

// Arbitraries for generating test data
const brazilianPhoneArb = fc.stringMatching(/^55\d{10,11}$/);
const participantJidArb = brazilianPhoneArb.map(phone => `${phone}@s.whatsapp.net`);
const groupJidArb = fc.stringMatching(/^\d{18}@g\.us$/);
const pushNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const messageIdArb = fc.stringMatching(/^[A-Z0-9]{20,32}$/);
const messageContentArb = fc.string({ minLength: 1, maxLength: 500 });

// Generate a valid group message webhook payload
const groupMessagePayloadArb = fc.record({
  groupJid: groupJidArb,
  participantJid: participantJidArb,
  pushName: fc.option(pushNameArb, { nil: undefined }),
  messageId: messageIdArb,
  content: messageContentArb,
  fromMe: fc.boolean()
}).map(data => ({
  Info: {
    Id: data.messageId,
    Chat: data.groupJid,
    Participant: data.participantJid,
    PushName: data.pushName,
    FromMe: data.fromMe
  },
  Message: {
    Conversation: data.content
  },
  _testData: data // Keep original data for assertions
}));

// Generate an individual chat message payload (not a group)
const individualMessagePayloadArb = fc.record({
  contactJid: participantJidArb,
  pushName: fc.option(pushNameArb, { nil: undefined }),
  messageId: messageIdArb,
  content: messageContentArb,
  fromMe: fc.boolean()
}).map(data => ({
  Info: {
    Id: data.messageId,
    Chat: data.contactJid,
    PushName: data.pushName,
    FromMe: data.fromMe
  },
  Message: {
    Conversation: data.content
  },
  _testData: data
}));

describe('ChatMessageHandler Property Tests - Group Message Sender Identification', () => {
  let db;
  let handler;
  
  before(async () => {
    db = await createTestDatabase();
    handler = new ChatMessageHandler(db);
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
   * Feature: group-message-sender-identification, Property 1: Participant extraction from group messages
   * Validates: Requirements 1.1, 3.1, 3.2
   * 
   * For any webhook payload where the Chat JID ends in @g.us, the system SHALL 
   * extract and store the Participant field as participant_jid in the database.
   */
  it('Property 1: Participant extraction from group messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        groupMessagePayloadArb,
        async (payload) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          const testData = payload._testData;
          const userToken = 'test-user-token';
          
          // Process the message event
          const result = await handler.handleMessageEvent(userToken, payload, new Date().toISOString());
          
          // Verify the message was handled
          assert.strictEqual(result.handled, true, 'Message should be handled');
          
          // Query the stored message
          const { rows } = await db.query(
            'SELECT participant_jid, participant_name FROM chat_messages WHERE id = ?',
            [result.messageId]
          );
          
          assert.strictEqual(rows.length, 1, 'Message should be stored');
          
          // Verify participant_jid was extracted and stored
          assert.strictEqual(
            rows[0].participant_jid,
            testData.participantJid,
            `participant_jid should be ${testData.participantJid}, got ${rows[0].participant_jid}`
          );
          
          // Verify participant_name is not null (either pushName or formatted phone)
          assert.ok(
            rows[0].participant_name !== null && rows[0].participant_name.length > 0,
            'participant_name should not be null or empty'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-message-sender-identification, Property 2: Participant display name resolution
   * Validates: Requirements 1.2, 1.3, 1.4, 3.3, 3.4
   * 
   * For any group message, if the participant has a PushName, the system SHALL use it 
   * as the display name; otherwise, the system SHALL extract and format the phone number 
   * from the participant JID.
   */
  it('Property 2: Participant display name resolution', async () => {
    await fc.assert(
      fc.asyncProperty(
        groupMessagePayloadArb,
        async (payload) => {
          const testData = payload._testData;
          
          // Test the formatParticipantDisplay method directly
          const displayName = handler.formatParticipantDisplay(
            testData.participantJid,
            testData.pushName
          );
          
          if (testData.pushName && testData.pushName.trim().length > 0) {
            // If PushName exists, it should be used (Requirement 1.3)
            assert.strictEqual(
              displayName,
              testData.pushName.trim(),
              `Display name should be PushName "${testData.pushName}"`
            );
          } else {
            // If no PushName, should be formatted phone number (Requirement 1.4)
            // Should start with + and contain the phone number
            assert.ok(
              displayName.startsWith('+'),
              `Display name should start with + when no PushName, got "${displayName}"`
            );
            
            // Extract phone from JID and verify it's in the display name
            const phoneFromJid = testData.participantJid.replace('@s.whatsapp.net', '');
            const displayNameDigits = displayName.replace(/\D/g, '');
            assert.strictEqual(
              displayNameDigits,
              phoneFromJid,
              `Display name digits should match phone from JID`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Individual messages should NOT have participant data
   * 
   * For any webhook payload where the Chat JID does NOT end in @g.us, 
   * the system SHALL NOT store participant data.
   */
  it('Individual messages should not have participant data', async () => {
    await fc.assert(
      fc.asyncProperty(
        individualMessagePayloadArb,
        async (payload) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          const userToken = 'test-user-token';
          
          // Process the message event
          const result = await handler.handleMessageEvent(userToken, payload, new Date().toISOString());
          
          // Verify the message was handled
          assert.strictEqual(result.handled, true, 'Message should be handled');
          
          // Query the stored message
          const { rows } = await db.query(
            'SELECT participant_jid, participant_name FROM chat_messages WHERE id = ?',
            [result.messageId]
          );
          
          assert.strictEqual(rows.length, 1, 'Message should be stored');
          
          // Verify participant fields are null for individual chats
          assert.strictEqual(
            rows[0].participant_jid,
            null,
            'participant_jid should be null for individual chats'
          );
          assert.strictEqual(
            rows[0].participant_name,
            null,
            'participant_name should be null for individual chats'
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test formatParticipantDisplay with missing participant (edge case)
   * Validates: Requirement 1.5
   */
  it('formatParticipantDisplay returns "Participante desconhecido" for missing participant', () => {
    const displayName = handler.formatParticipantDisplay(null, null);
    assert.strictEqual(
      displayName,
      'Participante desconhecido',
      'Should return "Participante desconhecido" when participant is missing'
    );
  });

  /**
   * Test formatParticipantDisplay with invalid JID format
   */
  it('formatParticipantDisplay handles invalid JID format', () => {
    const displayName = handler.formatParticipantDisplay('invalid-jid', null);
    assert.strictEqual(
      displayName,
      'Participante desconhecido',
      'Should return "Participante desconhecido" for invalid JID format'
    );
  });
});
