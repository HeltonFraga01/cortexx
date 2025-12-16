/**
 * Property-Based Tests for ChatService
 * 
 * Tests correctness properties defined in the design document using fast-check.
 * Each test runs a minimum of 100 iterations.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const path = require('path');
const fs = require('fs');
const Database = require('../database');
const ChatService = require('./ChatService');

// Test database path
const TEST_DB_PATH = path.join(__dirname, '../test-chat-service.db');

// Helper to create test database
async function createTestDatabase() {
  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  await db.init();
  
  // Run chat migrations manually for test database
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS agent_bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
  
  // Create index for participant_jid
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_participant 
    ON chat_messages(participant_jid)
  `);
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
    CREATE TABLE IF NOT EXISTS message_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      reactor_jid TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, reactor_jid)
    )
  `);
  
  // Create test user
  await db.query("INSERT INTO users (id, token) VALUES (1, 'test-token')");
  
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
}

// Arbitraries for generating test data
const phoneNumberArb = fc.stringMatching(/^55\d{10,11}$/);
const contactJidArb = phoneNumberArb.map(phone => `${phone}@s.whatsapp.net`);
const contactNameArb = fc.string({ minLength: 1, maxLength: 50 });
const messageContentArb = fc.string({ minLength: 1, maxLength: 1000 });
const whitespaceOnlyArb = fc.array(fc.constantFrom(' ', '\t', '\n', '\r', '\f'), { minLength: 0, maxLength: 20 }).map(arr => arr.join(''));
const timestampArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') });

describe('ChatService Property Tests', () => {
  let db;
  let chatService;
  
  before(async () => {
    db = await createTestDatabase();
    chatService = new ChatService(db);
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
   * Feature: chat-interface, Property 1: Conversation ordering by activity
   * Validates: Requirements 1.1, 1.2
   * 
   * For any list of conversations, the conversations SHALL always be ordered 
   * by lastMessageAt in descending order (most recent first).
   */
  it('Property 1: Conversations are always ordered by lastMessageAt descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            contactJid: contactJidArb,
            contactName: fc.option(contactNameArb),
            lastMessageAt: timestampArb
          }),
          { minLength: 2, maxLength: 20 }
        ),
        async (conversationData) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Insert conversations with different timestamps
          for (let i = 0; i < conversationData.length; i++) {
            const conv = conversationData[i];
            const jid = `${i}_${conv.contactJid}`; // Make unique
            await db.query(`
              INSERT INTO conversations (user_id, contact_jid, contact_name, last_message_at, status)
              VALUES (1, ?, ?, ?, 'open')
            `, [jid, conv.contactName || null, conv.lastMessageAt.toISOString()]);
          }
          
          // Get conversations
          const result = await chatService.getConversations(1, { limit: 100 });
          
          // Verify ordering: each conversation should have lastMessageAt >= next one
          for (let i = 1; i < result.conversations.length; i++) {
            const prev = result.conversations[i - 1].last_message_at;
            const curr = result.conversations[i].last_message_at;
            
            if (prev && curr) {
              assert(
                new Date(prev) >= new Date(curr),
                `Conversations not ordered correctly: ${prev} should be >= ${curr}`
              );
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: chat-interface, Property 4: Empty message rejection
   * Validates: Requirements 2.4
   * 
   * For any string composed entirely of whitespace characters (including empty string),
   * attempting to send it as a message SHALL be rejected.
   */
  it('Property 4: Whitespace-only messages are rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        whitespaceOnlyArb,
        async (whitespaceContent) => {
          const isValid = chatService.validateMessageContent(whitespaceContent);
          assert.strictEqual(
            isValid, 
            false, 
            `Whitespace-only message "${whitespaceContent}" should be invalid`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: chat-interface, Property 4 (continued): Valid messages are accepted
   * Validates: Requirements 2.4
   * 
   * For any non-empty string with at least one non-whitespace character,
   * the message SHALL be accepted.
   */
  it('Property 4: Non-empty messages with content are accepted', async () => {
    await fc.assert(
      fc.asyncProperty(
        messageContentArb.filter(s => s.trim().length > 0),
        async (validContent) => {
          const isValid = chatService.validateMessageContent(validContent);
          assert.strictEqual(
            isValid, 
            true, 
            `Valid message "${validContent}" should be accepted`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: chat-interface, Property 6: Conversation search filtering
   * Validates: Requirements 7.1
   * 
   * For any search query and list of conversations, the filtered results SHALL only 
   * contain conversations where the contact name OR phone number contains the search 
   * query (case-insensitive).
   */
  it('Property 6: Search results only contain matching conversations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            contactJid: contactJidArb,
            contactName: contactNameArb
          }),
          { minLength: 5, maxLength: 20 }
        ),
        fc.string({ minLength: 2, maxLength: 5 }),
        async (conversationData, searchQuery) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Insert conversations
          for (let i = 0; i < conversationData.length; i++) {
            const conv = conversationData[i];
            const jid = `${i}_${conv.contactJid}`;
            await db.query(`
              INSERT INTO conversations (user_id, contact_jid, contact_name, status)
              VALUES (1, ?, ?, 'open')
            `, [jid, conv.contactName]);
          }
          
          // Search
          const results = await chatService.searchConversations(1, searchQuery);
          const lowerQuery = searchQuery.toLowerCase();
          
          // Verify all results match the query
          for (const conv of results) {
            const nameMatch = conv.contact_name?.toLowerCase().includes(lowerQuery);
            const jidMatch = conv.contact_jid.toLowerCase().includes(lowerQuery);
            
            assert(
              nameMatch || jidMatch,
              `Result "${conv.contact_name}" / "${conv.contact_jid}" should match query "${searchQuery}"`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: chat-interface, Property 7: Message search within conversation
   * Validates: Requirements 7.2
   * 
   * For any search query within a conversation, the results SHALL only contain 
   * messages where the content contains the search query (case-insensitive).
   */
  it('Property 7: Message search results only contain matching messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(messageContentArb, { minLength: 5, maxLength: 20 }),
        fc.string({ minLength: 2, maxLength: 5 }),
        async (messageContents, searchQuery) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create a conversation
          await db.query(`
            INSERT INTO conversations (id, user_id, contact_jid, status)
            VALUES (1, 1, 'test@s.whatsapp.net', 'open')
          `);
          
          // Insert messages
          for (let i = 0; i < messageContents.length; i++) {
            await db.query(`
              INSERT INTO chat_messages (
                conversation_id, message_id, direction, message_type, content, 
                is_private_note, timestamp
              )
              VALUES (1, ?, 'incoming', 'text', ?, 0, datetime('now'))
            `, [`msg_${i}`, messageContents[i]]);
          }
          
          // Search
          const results = await chatService.searchMessages(1, 1, searchQuery);
          const lowerQuery = searchQuery.toLowerCase();
          
          // Verify all results match the query
          for (const msg of results) {
            assert(
              msg.content.toLowerCase().includes(lowerQuery),
              `Message "${msg.content}" should contain query "${searchQuery}"`
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: chat-interface, Property 8: Unread count consistency
   * Validates: Requirements 8.1, 8.2, 8.3
   * 
   * For any conversation, the unread count SHALL equal the number of incoming 
   * messages with status not equal to 'read'.
   */
  it('Property 8: Unread count equals count of unread incoming messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            direction: fc.constantFrom('incoming', 'outgoing'),
            status: fc.constantFrom('pending', 'sent', 'delivered', 'read')
          }),
          { minLength: 1, maxLength: 30 }
        ),
        async (messageData) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create a conversation
          await db.query(`
            INSERT INTO conversations (id, user_id, contact_jid, unread_count, status)
            VALUES (1, 1, 'test@s.whatsapp.net', 0, 'open')
          `);
          
          // Insert messages and track expected unread count
          let expectedUnread = 0;
          for (let i = 0; i < messageData.length; i++) {
            const msg = messageData[i];
            await db.query(`
              INSERT INTO chat_messages (
                conversation_id, message_id, direction, message_type, content, 
                status, is_private_note, timestamp
              )
              VALUES (1, ?, ?, 'text', 'test', ?, 0, datetime('now'))
            `, [`msg_${i}`, msg.direction, msg.status]);
            
            if (msg.direction === 'incoming' && msg.status !== 'read') {
              expectedUnread++;
            }
          }
          
          // Calculate actual unread count
          const actualUnread = await chatService.calculateUnreadCount(1);
          
          assert.strictEqual(
            actualUnread,
            expectedUnread,
            `Unread count ${actualUnread} should equal ${expectedUnread}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: chat-interface, Property 20: Conversation-contact uniqueness
   * Validates: Requirements 1.1 (implicit)
   * 
   * For any user, there SHALL be at most one conversation per contact JID.
   * Creating a conversation for an existing contact SHALL return the existing conversation.
   */
  it('Property 20: Only one conversation per contact JID per user', async () => {
    await fc.assert(
      fc.asyncProperty(
        contactJidArb,
        fc.array(contactNameArb, { minLength: 2, maxLength: 5 }),
        async (contactJid, names) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          let firstConversationId = null;
          
          // Try to create multiple conversations for the same contact
          for (const name of names) {
            const conversation = await chatService.getOrCreateConversation(1, contactJid, { name });
            
            if (firstConversationId === null) {
              firstConversationId = conversation.id;
            } else {
              // All subsequent calls should return the same conversation
              assert.strictEqual(
                conversation.id,
                firstConversationId,
                `Should return same conversation ID for same contact JID`
              );
            }
          }
          
          // Verify only one conversation exists
          const { rows } = await db.query(
            'SELECT COUNT(*) as count FROM conversations WHERE user_id = 1 AND contact_jid = ?',
            [contactJid]
          );
          
          assert.strictEqual(
            rows[0].count,
            1,
            `Should have exactly one conversation for contact ${contactJid}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: group-message-sender-identification, Property 3: Participant data round-trip
   * Validates: Requirements 3.2, 3.3, 3.5
   * 
   * For any group message stored in the database, querying that message SHALL return 
   * the same participant_jid and participant_name that were extracted from the original 
   * webhook payload.
   */
  it('Property 3: Participant data round-trip - stored data equals retrieved data', async () => {
    // Arbitraries for participant data
    const participantJidArb = fc.stringMatching(/^55\d{10,11}@s\.whatsapp\.net$/);
    const participantNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
    const messageTypeArb = fc.constantFrom('text', 'audio', 'image', 'video', 'document');
    // Use non-empty content to avoid edge cases with whitespace-only content
    const validContentArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          participantJid: fc.option(participantJidArb, { nil: null }),
          participantName: fc.option(participantNameArb, { nil: null }),
          messageType: messageTypeArb,
          content: validContentArb
        }),
        async (testData) => {
          // Clean up before each iteration
          await cleanupTestData(db);
          
          // Create a group conversation (JID ends with @g.us)
          await db.query(`
            INSERT INTO conversations (id, user_id, contact_jid, status)
            VALUES (1, 1, '120363023605733675@g.us', 'open')
          `);
          
          // Generate unique message ID
          const messageId = `test_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          
          // Store message using storeIncomingMessage
          const messageData = {
            messageId,
            type: testData.messageType,
            content: testData.content,
            timestamp: new Date().toISOString(),
            participantJid: testData.participantJid,
            participantName: testData.participantName
          };
          
          const storedMessage = await chatService.storeIncomingMessage(1, messageData);
          
          // Verify the message was stored correctly
          assert(
            storedMessage && storedMessage.id,
            `Message should be stored and have an ID`
          );
          
          // Retrieve messages using getMessages
          const result = await chatService.getMessages(1, 1, { limit: 10 });
          
          // Find the stored message in results
          const retrievedMessage = result.messages.find(m => m.message_id === messageId);
          
          assert(
            retrievedMessage,
            `Message with ID ${messageId} should be found in retrieved messages. Got ${result.messages.length} messages.`
          );
          
          // Verify participant_jid round-trip
          assert.strictEqual(
            retrievedMessage.participant_jid,
            testData.participantJid,
            `participant_jid should be ${testData.participantJid}, got ${retrievedMessage.participant_jid}`
          );
          
          // Verify participant_name round-trip
          assert.strictEqual(
            retrievedMessage.participant_name,
            testData.participantName,
            `participant_name should be ${testData.participantName}, got ${retrievedMessage.participant_name}`
          );
          
          // Also verify via getMessageById for completeness
          const messageById = await chatService.getMessageById(storedMessage.id);
          
          assert.strictEqual(
            messageById.participantJid,
            testData.participantJid,
            `getMessageById: participantJid should be ${testData.participantJid}, got ${messageById.participantJid}`
          );
          
          assert.strictEqual(
            messageById.participantName,
            testData.participantName,
            `getMessageById: participantName should be ${testData.participantName}, got ${messageById.participantName}`
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
