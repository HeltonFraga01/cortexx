# Implementation Plan

- [x] 1. Add helper function for invalid group name detection
  - [x] 1.1 Create `isInvalidGroupName()` function in chatMessageHandler.js
    - Check if name is null or empty
    - Check if name is only digits (JID without @g.us)
    - Check if name contains @g.us
    - Check if name starts with "Grupo " followed by digits (previous fallback)
    - _Requirements: 1.5, 3.3, 3.4_
  - [ ]* 1.2 Write property test for invalid name detection
    - **Property 2: Invalid name detection and correction**
    - **Validates: Requirements 1.3, 1.5, 3.3, 3.4**

- [x] 2. Fix fetchGroupName fallback format
  - [x] 2.1 Modify `fetchGroupName()` to return formatted fallback
    - Change fallback from raw JID to "Grupo XXXXXXXX..." format
    - Truncate JID to 8 characters for readability
    - _Requirements: 1.4_
  - [ ]* 2.2 Write property test for fallback format
    - **Property 4: Fallback format consistency**
    - **Validates: Requirements 1.4**

- [x] 3. Fix group name extraction in handleMessageEvent
  - [x] 3.1 Modify group name logic to not use participant PushName
    - Remove assignment of `participantName` to `contactName` for groups
    - Always fetch group name from WUZAPI for group messages
    - Use `isInvalidGroupName()` to detect when re-fetch is needed
    - _Requirements: 1.1, 1.2, 3.1, 3.2_
  - [ ]* 3.2 Write property test for group name storage
    - **Property 1: Group name stored correctly**
    - **Validates: Requirements 1.1, 1.2, 3.1, 3.2**

- [x] 4. Add group name update on subsequent messages
  - [x] 4.1 Implement name comparison and update logic
    - Compare fetched name with stored name
    - Update if different and new name is valid
    - Log name changes for debugging
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 4.2 Write property test for name update persistence
    - **Property 3: Group name update persistence**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Fix existing conversations with wrong names (migration/cleanup)
  - [x] 6.1 Create utility to fix existing group conversations
    - Query conversations where contact_jid ends with @g.us
    - Check if contact_name is invalid using `isInvalidGroupName()`
    - Fetch correct name from WUZAPI and update
    - _Requirements: 1.5, 3.3, 3.4_

- [x] 7. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

