# Implementation Plan

- [x] 1. Fix ChatWebSocketHandler broadcastMessageUpdate
  - [x] 1.1 Update broadcastMessageUpdate to transform data to camelCase
    - Import `toBoolean` from responseTransformer
    - Transform `is_edited` to `isEdited` using toBoolean
    - Transform `is_deleted` to `isDeleted` using toBoolean
    - Update logger to use camelCase field names
    - _Requirements: 1.1, 1.2_

  - [ ]* 1.2 Write property test for message update transformation
    - **Property 1: WebSocket message update key transformation**
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Fix ChatWebSocketHandler broadcastConversationUpdate
  - [x] 2.1 Update broadcastConversationUpdate to use transformConversation
    - Import `transformConversation` from responseTransformer
    - Apply transformation before emitting event
    - Ensure all fields are in camelCase with proper boolean conversion
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 2.2 Write property test for conversation update transformation
    - **Property 3: WebSocket event format consistency**
    - **Validates: Requirements 2.1, 2.3**

- [x] 3. Fix chatMessageHandler boolean conversion
  - [x] 3.1 Update isMuted check to use toBoolean
    - Import `toBoolean` from responseTransformer
    - Replace `conversation.is_muted === 1 || conversation.is_muted === true` with `toBoolean(conversation.is_muted)`
    - _Requirements: 3.1_

- [x] 4. Fix OutgoingWebhookService boolean conversion
  - [x] 4.1 Update getWebhookStats to use toBoolean for success field
    - Replace `d.success === 1` with `toBoolean(d.success)`
    - Ensure consistent boolean conversion in delivery records mapping
    - _Requirements: 4.1_

  - [ ]* 4.2 Write property test for webhook stats boolean conversion
    - **Property 2: Boolean field conversion consistency**
    - **Validates: Requirements 4.1**

- [x] 5. Checkpoint - Ensure backend changes work correctly
  - All backend files modified without syntax errors

- [x] 6. Fix frontend useChatSocket event handling
  - [x] 6.1 Update message_update event handler to apply transformKeys
    - Apply `transformKeys` to rawData before processing
    - Update TypeScript types to reflect camelCase fields
    - _Requirements: 5.1_

  - [x] 6.2 Update conversation_update event handler to apply transformKeys
    - Apply `transformKeys` to rawData before processing
    - Ensure conversation object is properly transformed
    - _Requirements: 5.2_

- [x] 7. Final Checkpoint - Ensure all tests pass
  - All files pass diagnostics check (no syntax/type errors)
