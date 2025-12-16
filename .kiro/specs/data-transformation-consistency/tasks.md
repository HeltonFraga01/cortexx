# Implementation Plan

- [x] 1. Create backend response transformer utility
  - [x] 1.1 Create `server/utils/responseTransformer.js` with core functions
    - Implement `toBoolean(value)` function for SQLite boolean conversion
    - Implement `snakeToCamel(str)` function for key transformation
    - Implement `transformKeys(obj, booleanFields)` function for object transformation
    - Export all functions
    - _Requirements: 1.1, 1.2, 3.4, 3.5_

  - [ ]* 1.2 Write property test for toBoolean function
    - **Property 2: SQLite boolean to JavaScript boolean conversion**
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 1.3 Write property test for snakeToCamel function
    - **Property 1: Snake to camelCase transformation**
    - **Validates: Requirements 1.1**

  - [ ]* 1.4 Write property test for null/undefined handling
    - **Property 3: Null/undefined graceful handling**
    - **Validates: Requirements 3.4**

  - [ ]* 1.5 Write property test for boolean edge cases
    - **Property 4: Boolean edge case handling**
    - **Validates: Requirements 3.5**

- [x] 2. Add entity-specific transformer functions
  - [x] 2.1 Add `transformConversation(conv)` function
    - Transform conversation object with isMuted boolean conversion
    - Handle nested objects (labels, assignedBot)
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Add `transformBot(bot)` function
    - Transform bot object with isDefault and includeHistory boolean conversion
    - _Requirements: 1.3_

  - [x] 2.3 Add `transformWebhook(webhook)` function
    - Transform webhook object with isActive boolean conversion
    - Parse events JSON string to array
    - _Requirements: 1.4_

  - [ ]* 2.4 Write property test for output format consistency
    - **Property 5: Output format consistency**
    - **Validates: Requirements 4.2, 4.3, 5.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Consolidate ChatService.getConversations
  - [x] 4.1 Remove duplicate getConversations implementation
    - Identify the prototype override at line ~2520
    - Merge filter options (assignedBotId, labelId) into the original method
    - Ensure consistent camelCase output format
    - Use `toBoolean` for is_muted conversion
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Update getConversationById to use transformer
    - Apply consistent transformation to single conversation retrieval
    - _Requirements: 1.1, 1.2_

  - [x] 4.3 Update updateConversation to use transformer
    - Apply consistent transformation to update response
    - _Requirements: 1.1, 1.2_

- [x] 5. Update BotService to use transformer
  - [x] 5.1 Update formatBot method to use toBoolean
    - Replace manual `=== 1` checks with `toBoolean` function
    - Ensure isDefault and includeHistory are proper booleans
    - _Requirements: 1.3_

- [x] 6. Update OutgoingWebhookService to use transformer
  - [x] 6.1 Update webhook formatting to use toBoolean
    - Replace manual `=== 1` checks with `toBoolean` function
    - Ensure isActive is a proper boolean
    - _Requirements: 1.4_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update frontend chat service
  - [x] 8.1 Replace extractData with extractAndTransform where needed
    - Update `searchConversations` to use extractAndTransform
    - Update `assignBot` to use extractAndTransform
    - Update `getLabels` to use extractAndTransform
    - Update `getBots` and related functions to use extractAndTransform
    - Update `getOutgoingWebhooks` and related functions to use extractAndTransform
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 8.2 Audit all extractData usages
    - Review each extractData call
    - Determine if transformation is needed based on endpoint response format
    - Document which endpoints return camelCase vs snake_case
    - _Requirements: 2.5_

- [x] 9. Verify TypeScript types match transformed data
  - [x] 9.1 Verify Conversation type has boolean isMuted
    - Check `src/types/chat.ts` for Conversation interface
    - Ensure isMuted is typed as `boolean`, not `number`
    - _Requirements: 5.1_

  - [x] 9.2 Verify AgentBot type has boolean fields
    - Check AgentBot interface for isDefault and includeHistory
    - Ensure both are typed as `boolean`
    - _Requirements: 5.2_

  - [x] 9.3 Verify OutgoingWebhook type has boolean isActive
    - Check OutgoingWebhook interface
    - Ensure isActive is typed as `boolean`
    - _Requirements: 5.3_

- [ ]* 10. Write property test for round-trip consistency
  - **Property 6: Transformation round-trip consistency**
  - **Validates: Requirements 6.1**

- [x] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
