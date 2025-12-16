# Implementation Plan

- [x] 1. Create conversation cache utility functions
  - Create `src/lib/conversation-cache.ts` with helper functions for updating conversation state in cache
  - Implement `updateConversationInCache` function that updates a single conversation in the cache
  - Implement `updateConversationLabels` function for label operations
  - _Requirements: 5.1, 5.5_

- [ ]* 1.1 Write property test for cache update functions
  - **Property 1: Mute indicator consistency**
  - Test that updating isMuted in cache produces correct state
  - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 2. Implement optimistic update for mute mutation in ConversationView
  - Modify `muteMutation` to use `onMutate` for optimistic updates
  - Save previous state in `onMutate` context
  - Update cache immediately with new muted state
  - Implement rollback in `onError`
  - Show success/error toast appropriately
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ]* 2.1 Write property test for mute optimistic update
  - **Property 5: Optimistic update rollback**
  - Test that failed mutations revert to previous state
  - **Validates: Requirements 1.5**

- [ ]* 2.2 Write property test for dropdown menu state
  - **Property 8: Dropdown menu state synchronization**
  - Test that dropdown shows correct option based on isMuted
  - **Validates: Requirements 1.1**

- [x] 3. Implement optimistic update for status mutation in ConversationView
  - Modify `updateStatusMutation` to use `onMutate` for optimistic updates
  - Save previous state in `onMutate` context
  - Update cache immediately with new status
  - Implement rollback in `onError`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

- [ ]* 3.1 Write property test for status badge rendering
  - **Property 2: Status badge rendering**
  - Test that status badge renders with correct color based on status value
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement optimistic update for bot assignment
  - Locate bot assignment mutation (likely in ContactPanel or ConversationView)
  - Modify mutation to use `onMutate` for optimistic updates
  - Update cache with new assignedBotId and assignedBot object
  - Implement rollback in `onError`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 5.1 Write property test for bot indicator consistency
  - **Property 3: Bot indicator consistency**
  - Test that bot indicator renders when assignedBotId is not null
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 6. Implement optimistic update for label operations
  - Locate label assignment/removal mutations (likely in ContactPanel)
  - Modify `assignLabelMutation` to use optimistic updates
  - Modify `removeLabelMutation` to use optimistic updates
  - Update cache with new labels array
  - Implement rollback in `onError`
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 6.1 Write property test for label rendering consistency
  - **Property 4: Label rendering consistency**
  - Test that labels array is rendered correctly in UI
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 7. Add loading state indicators to action buttons
  - Add `isPending` check to disable buttons during mutations
  - Add loading spinner to buttons during pending state
  - Ensure loading state clears on success or error
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ]* 7.1 Write property test for loading state management
  - **Property 7: Loading state management**
  - Test that buttons are disabled and show spinner during pending state
  - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Update InboxSidebar to reflect state changes
  - Verify ConversationItem already shows mute indicator (BellOff icon)
  - Add status indicator styling to ConversationItem if not present
  - Add bot indicator to ConversationItem if not present
  - Ensure labels are displayed correctly
  - _Requirements: 1.4, 2.6, 3.4, 4.3, 5.2, 5.3, 5.4_

- [ ]* 9.1 Write property test for filter counts synchronization
  - **Property 6: Filter counts synchronization**
  - Test that filter counts update when conversation state changes
  - **Validates: Requirements 5.5**

- [x] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
