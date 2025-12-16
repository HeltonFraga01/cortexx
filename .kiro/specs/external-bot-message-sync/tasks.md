# Implementation Plan

- [x] 1. Enhance ChatService for bot message storage
  - [x] 1.1 Add `storeBotMessage()` method to ChatService
    - Create method that stores message with `sender_type: 'bot'`
    - Ensure `unread_count` is NOT incremented for outgoing messages
    - Update `last_message_preview` on conversation
    - Emit WebSocket event for real-time updates
    - _Requirements: 1.1, 1.3, 1.4, 2.3, 5.1_
  - [ ]* 1.2 Write property test for unread count invariant
    - **Property 2: Unread count invariant for outgoing messages**
    - **Validates: Requirements 1.3**
  - [x] 1.3 Add `messageExists()` method for deduplication
    - Check if message with given `message_id` already exists in conversation
    - Return boolean to allow caller to skip insertion
    - _Requirements: 4.1, 4.2_
  - [ ]* 1.4 Write property test for message deduplication
    - **Property 5: Message deduplication idempotence**
    - **Validates: Requirements 4.1, 4.2**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create Bot Proxy Routes
  - [x] 3.1 Create `server/routes/botProxyRoutes.js`
    - Implement `POST /api/bot/send/text` endpoint
    - Validate token via header (same as existing chat routes)
    - Validate Phone and Body parameters
    - Forward request to WUZAPI `/chat/send/text`
    - Store message locally via `storeBotMessage()`
    - Support `skip_webhook` flag to prevent outgoing webhook dispatch
    - Support `bot_name` and `bot-id` header for tracking
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 Register routes in `server/routes/index.js`
    - Add botProxyRoutes to router
    - Mount at `/api/bot`
    - _Requirements: 2.1_
  - [ ]* 3.3 Write property test for bot proxy message registration
    - **Property 4: Bot proxy message registration**
    - **Validates: Requirements 2.1, 2.3**

- [x] 4. Enhance Webhook Handler for outgoing messages
  - [x] 4.1 Update `chatMessageHandler.js` to identify sender_type
    - Add logic to determine if outgoing message is from system or external bot
    - Messages sent via system have tracking in DB, external don't
    - Set `sender_type: 'bot'` for external outgoing messages
    - Set `sender_type: 'user'` for system-sent outgoing messages
    - _Requirements: 1.1, 3.1_
  - [x] 4.2 Add deduplication check before storing
    - Call `messageExists()` before inserting
    - Skip insertion if message already exists
    - Log duplicate detection for debugging
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 4.3 Write property test for outgoing message direction
    - **Property 1: Outgoing message direction consistency**
    - **Validates: Requirements 1.1**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add sender_type to API responses
  - [x] 6.1 Update `getMessages()` response to include sender_type
    - Ensure `sender_type` and `sender_bot_id` are included in message list
    - Already mapped in existing query, verify it's returned
    - _Requirements: 3.3_
  - [ ]* 6.2 Write property test for sender type validity
    - **Property 6: Sender type validity**
    - **Validates: Requirements 3.1**

- [x] 7. Ensure WebSocket events include sender_type
  - [x] 7.1 Update `broadcastNewMessage()` to include sender_type
    - Verify message object passed to WebSocket includes sender_type
    - Frontend can use this for visual differentiation
    - _Requirements: 5.2_
  - [ ]* 7.2 Write property test for WebSocket event emission
    - **Property 7: WebSocket event emission for outgoing messages**
    - **Validates: Requirements 5.1, 5.2**

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

