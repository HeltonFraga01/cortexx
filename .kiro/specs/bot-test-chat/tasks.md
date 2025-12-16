# Implementation Plan: Bot Test Chat

## Overview
This plan implements a test chat interface for bots, allowing users to test their bot configurations directly from the settings page without sending real WhatsApp messages.

## Status: ✅ COMPLETE (December 16, 2025)

All core implementation tasks have been completed. The bot test chat feature is fully functional.

### Bug Fixes Applied:
1. **TestConversationService.addTestMessage** - Fixed missing required columns (`direction`, `message_type`, `timestamp`) when inserting into `chat_messages` table
2. **userBotTestRoutes.js** - Fixed incorrect service usage (`quotaService` → `botService`) for `incrementBotCallUsage()` and `incrementBotMessageUsage()` methods

### Verified Working:
- Test session creation with simulated JID
- Message sending to webhook with exact payload structure matching real messages
- Bot response handling (multiple formats supported)
- Quota tracking and enforcement
- Error handling for webhook failures (404, timeout, etc.)

---

- [x] 1. Database Schema Updates
  - [x] 1.1 Create migration 081_add_conversation_is_test_column.js
    - Add `is_test` INTEGER column to conversations table with DEFAULT 0
    - Create index `idx_conversations_is_test` for filtering
    - _Requirements: 1.3, 4.4_

- [x] 2. Backend Service: TestConversationService
  - [x] 2.1 Create TestConversationService.js
    - Implement `generateSimulatedJid(userId)` method returning format `test_<userId>_<timestamp>@s.whatsapp.net`
    - Implement `createTestConversation(userId, botId)` method creating conversation with `is_test = 1`
    - Implement `archiveTestConversation(conversationId)` method setting status to 'archived'
    - Implement `getTestMessages(conversationId, limit)` method returning up to 10 messages
    - Implement `clearTestHistory(conversationId)` method deleting all messages
    - Implement `addTestMessage(conversationId, text, senderType)` with all required columns
    - _Requirements: 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4_
  - [ ]* 2.2 Write property test for simulated JID format
    - **Property 2: Simulated JID format**
    - **Validates: Requirements 1.4**
  - [ ]* 2.3 Write property test for test conversation creation
    - **Property 3: Test conversation creation**
    - **Validates: Requirements 1.3**
  - [ ]* 2.4 Write property test for test conversation archival
    - **Property 4: Test conversation archival**
    - **Validates: Requirements 1.5**
  - [ ]* 2.5 Write property test for history limit enforcement
    - **Property 11: History limit enforcement**
    - **Validates: Requirements 6.2**

- [x] 3. Backend Routes: Bot Test API
  - [x] 3.1 Create userBotTestRoutes.js with test endpoints
    - POST `/:botId/test/start` - Start test session, check quota, create test conversation
    - POST `/:botId/test/message` - Send test message, forward to webhook, track usage
    - POST `/:botId/test/end` - End test session, archive conversation
    - DELETE `/:botId/test/history` - Clear test conversation history
    - GET `/:botId/test/messages` - Get messages from test conversation
    - _Requirements: 1.2, 1.3, 1.5, 2.1, 2.2, 3.1, 6.4_
  - [x] 3.2 Register routes in server/routes/index.js
    - Mount at `/api/user/bots` path
    - _Requirements: 1.1_
  - [ ]* 3.3 Write property test for webhook payload completeness
    - **Property 5: Webhook payload completeness**
    - **Validates: Requirements 2.2**
  - [ ]* 3.4 Write property test for bot call quota enforcement
    - **Property 6: Bot call quota enforcement**
    - **Validates: Requirements 3.1**
  - [ ]* 3.5 Write property test for bot message counter increment
    - **Property 7: Bot message counter increment**
    - **Validates: Requirements 3.3**
  - [ ]* 3.6 Write property test for bot message quota enforcement
    - **Property 8: Bot message quota enforcement**
    - **Validates: Requirements 3.4**

- [x] 4. Checkpoint - Backend Tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Conversation Queries
  - [x] 5.1 Update ChatService to exclude test conversations from list queries
    - Add `WHERE is_test = 0` filter to conversation list methods
    - _Requirements: 4.4_
  - [ ]* 5.2 Write property test for test conversation exclusion
    - **Property 9: Test conversation exclusion**
    - **Validates: Requirements 4.4**

- [x] 6. Frontend Service: Bot Test API Client
  - [x] 6.1 Add bot test functions to src/services/chat.ts
    - `startBotTest(botId)` - Start test session
    - `sendBotTestMessage(botId, conversationId, message)` - Send test message
    - `endBotTest(botId, conversationId)` - End test session
    - `clearBotTestHistory(botId, conversationId)` - Clear history
    - _Requirements: 1.2, 2.1, 6.4_

- [x] 7. Frontend Types
  - [x] 7.1 Add bot test types to src/types/chat.ts
    - `BotTestSession` interface with conversationId, botId, simulatedJid
    - `BotTestMessage` interface with id, text, timestamp, fromMe
    - `BotTestPayload` interface for webhook payload structure
    - _Requirements: 2.2_

- [x] 8. Frontend Component: BotTestChatDialog
  - [x] 8.1 Create BotTestChatDialog.tsx component (implemented as BotTestChat.tsx)
    - Modal dialog with chat interface
    - Message list with timestamps
    - Input field for sending messages
    - Clear history button
    - Quota usage display (calls, messages, tokens)
    - Visual distinction with test badge and warning banner
    - _Requirements: 1.2, 2.3, 3.5, 4.1, 4.2, 4.3, 7.1, 7.2, 7.4_
  - [ ]* 8.2 Write property test for message timestamp presence
    - **Property 13: Message timestamp presence**
    - **Validates: Requirements 7.4**

- [x] 9. Update Bot Cards with Test Button
  - [x] 9.1 Add "Testar Bot" button to user bot cards in BotSettings.tsx
    - Add test button to each bot card
    - Open BotTestChatDialog on click
    - _Requirements: 1.1_
  - [x] 9.2 Add "Testar Bot" button to AdminBotCard.tsx
    - Add test button for admin-assigned bots
    - Open BotTestChatDialog on click
    - _Requirements: 5.1, 5.2_
  - [ ]* 9.3 Write property test for test button presence
    - **Property 1: Test button presence**
    - **Validates: Requirements 1.1, 5.1**

- [x] 10. Webhook Integration
  - [x] 10.1 Implement webhook forwarding in test routes
    - Build payload with EXACT same structure as real messages (BotService.forwardToBot)
    - Include HTTP headers: X-Bot-Token, X-Bot-Id, X-Conversation-Id, X-Contact-Phone, X-Test-Message
    - Include history if bot.includeHistory is enabled
    - Handle webhook response and display in chat
    - Support multiple response formats: reply, message, text, content, response, action
    - Track token usage from webhook response
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 6.1, 6.2_
  - [ ]* 10.2 Write property test for history inclusion
    - **Property 10: History inclusion**
    - **Validates: Requirements 6.1, 6.2**
  - [ ]* 10.3 Write property test for new session empty history
    - **Property 12: New session empty history**
    - **Validates: Requirements 6.3**
  - [ ]* 10.4 Write property test for token tracking accuracy
    - **Property 14: Token tracking accuracy**
    - **Validates: Requirements 2.4**

- [x] 11. Error Handling
  - [x] 11.1 Implement error handling for webhook failures
    - Display error message in chat UI when webhook fails
    - Handle timeout (30 seconds)
    - Display quota exceeded messages
    - Return webhookError in response for UI display
    - _Requirements: 2.5, 3.2, 3.4_

- [x] 12. Final Checkpoint - All Tests
  - All implementation tasks completed successfully
  - Optional property tests (marked with `*`) can be added later for additional coverage
  - Feature ready for production use
