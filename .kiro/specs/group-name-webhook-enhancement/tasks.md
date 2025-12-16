# Implementation Plan

- [x] 1. Create database migration for new fields
  - Create migration file `038_enhance_group_names.js`
  - Add `name_source` column to conversations table
  - Add `name_updated_at` column to conversations table
  - Test migration on development database
  - _Requirements: 1.3, 3.1_

- [ ] 2. Implement GroupNameResolver service
- [x] 2.1 Create service file and basic structure
  - Create `server/services/GroupNameResolver.js`
  - Implement constructor with db and logger dependencies
  - Add JSDoc comments for all methods
  - _Requirements: 5.1, 5.2_

- [x] 2.2 Implement webhook field extraction
  - Implement `extractFromWebhook()` method
  - Check all fields: GroupName, Name, Subject, ChatName
  - Return name, source, and all available fields
  - _Requirements: 1.1_

- [ ]* 2.3 Write property test for webhook extraction
  - **Property 1: Webhook field extraction completeness**
  - **Validates: Requirements 1.1**

- [x] 2.4 Implement name validation
  - Implement `validateGroupName()` method
  - Check for null/empty, pure digits, @g.us, generic placeholders
  - Return validation result with reason
  - _Requirements: 1.2_

- [ ]* 2.5 Write property test for name validation
  - **Property 2: Name validation consistency**
  - **Validates: Requirements 1.2**

- [x] 2.6 Implement fallback name formatting
  - Implement `formatFallbackGroupName()` method
  - Extract group number from JID
  - Format as "Grupo [first 8 digits]..."
  - _Requirements: 4.3_

- [ ]* 2.7 Write property test for fallback formatting
  - **Property 7: Fallback name format**
  - **Validates: Requirements 4.3**

- [x] 2.8 Implement API fetch with retry logic
  - Implement `fetchFromAPI()` method
  - Add exponential backoff retry logic (1s, 2s, 4s)
  - Handle API errors gracefully
  - Return name with source and success status
  - _Requirements: 4.1, 4.2, 4.4_

- [ ]* 2.9 Write property test for API retry
  - **Property 6: API retry exponential backoff**
  - **Validates: Requirements 4.4**

- [x] 2.10 Implement database update method
  - Implement `updateConversationName()` method
  - Update contact_name, name_source, name_updated_at
  - Handle database errors
  - _Requirements: 1.3_

- [ ]* 2.11 Write property test for database updates
  - **Property 3: Database update idempotency**
  - **Validates: Requirements 1.3**

- [x] 2.12 Implement main resolution method
  - Implement `resolveGroupName()` method
  - Implement priority logic: webhook > database > API > fallback
  - Check database for existing valid name
  - Call appropriate methods based on availability
  - Return resolution result with all metadata
  - _Requirements: 1.4, 3.2, 5.3, 5.4, 5.5_

- [ ]* 2.13 Write property test for name source priority
  - **Property 4: Name source priority**
  - **Validates: Requirements 1.4, 3.2**

- [ ]* 2.14 Write unit tests for GroupNameResolver
  - Test extractFromWebhook with various webhook formats
  - Test validateGroupName with valid and invalid names
  - Test formatFallbackGroupName with different JID lengths
  - Test fetchFromAPI with mocked API responses
  - Test updateConversationName with database mocks
  - _Requirements: All from Requirement 5_

- [ ] 3. Checkpoint - Ensure GroupNameResolver tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Enhance ChatMessageHandler with logging
- [x] 4.1 Add GroupNameResolver dependency
  - Import GroupNameResolver in chatMessageHandler.js
  - Add to constructor initialization
  - _Requirements: 5.1_

- [x] 4.2 Add detailed logging for webhook processing
  - Log all available webhook fields at DEBUG level
  - Log group message detection at INFO level
  - Log all name fields from webhook
  - _Requirements: 2.1_

- [x] 4.3 Replace inline name resolution logic
  - Remove existing inline group name extraction
  - Call `groupNameResolver.resolveGroupName()`
  - Use returned name and source
  - _Requirements: 5.1, 5.2_

- [x] 4.4 Add logging for name resolution steps
  - Log validation results at INFO level
  - Log API calls at INFO level
  - Log fallback usage at WARN level
  - Log errors at ERROR level with full context
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 4.5 Implement WebSocket broadcast for name updates
  - Check if name was updated in resolution result
  - Broadcast conversation update via chatHandler
  - Include new name, source, and timestamp
  - _Requirements: 3.5_

- [ ]* 4.6 Write property test for WebSocket broadcasts
  - **Property 5: WebSocket broadcast consistency**
  - **Validates: Requirements 3.5**

- [ ]* 4.7 Write integration tests for enhanced handler
  - Test message handling with valid webhook name
  - Test message handling with invalid webhook name
  - Test message handling with API fallback
  - Test WebSocket broadcast on name update
  - _Requirements: 1.1, 1.2, 1.3, 3.5_

- [ ] 5. Checkpoint - Ensure ChatMessageHandler tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add automatic name refresh on conversation open
- [x] 6.1 Update conversation GET endpoint
  - Modify `GET /api/chat/inbox/conversations/:id` in chatInboxRoutes.js
  - Check if conversation has invalid group name
  - Trigger automatic refresh if needed
  - _Requirements: 3.4_

- [x] 6.2 Add logging for automatic refresh
  - Log when automatic refresh is triggered
  - Log refresh results
  - _Requirements: 2.3_

- [ ]* 6.3 Write unit tests for automatic refresh
  - Test refresh trigger on invalid name
  - Test no refresh on valid name
  - Test refresh for individual chats (should skip)
  - _Requirements: 3.4_

- [ ] 7. Update existing refresh endpoint
- [x] 7.1 Refactor refresh-group-name endpoint
  - Modify `POST /api/chat/inbox/conversations/:id/refresh-group-name`
  - Use GroupNameResolver instead of inline logic
  - Add enhanced logging
  - _Requirements: 5.1_

- [ ]* 7.2 Write unit tests for refresh endpoint
  - Test successful refresh
  - Test refresh with API failure
  - Test refresh for non-group conversation
  - _Requirements: 5.1_

- [ ] 8. Add caching for performance
- [x] 8.1 Implement in-memory cache in GroupNameResolver
  - Add Map-based cache with TTL (5 minutes)
  - Check cache before resolution
  - Update cache after successful resolution
  - _Requirements: Performance optimization_

- [ ]* 8.2 Write unit tests for caching
  - Test cache hit returns cached value
  - Test cache miss triggers resolution
  - Test cache expiration after TTL
  - _Requirements: Performance optimization_

- [ ] 9. Add API rate limiting
- [x] 9.1 Implement concurrent call limiting
  - Add queue for API calls
  - Limit to 5 concurrent calls
  - Add waiting logic when limit reached
  - _Requirements: Performance optimization_

- [ ]* 9.2 Write unit tests for rate limiting
  - Test concurrent call limit enforcement
  - Test queue processing
  - _Requirements: Performance optimization_

- [ ] 10. Final checkpoint - Integration testing
  - Run full test suite
  - Test with real WUZAPI webhooks in development
  - Verify logging output
  - Verify WebSocket broadcasts
  - Verify database updates
  - Ensure all tests pass, ask the user if questions arise.
