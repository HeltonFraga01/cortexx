# Implementation Plan

## Summary

This implementation plan addresses two main issues:
1. Add `conversations:manage` permission to the permission system (backend)
2. Hide the delete conversation option when in agent mode (frontend)

---

- [x] 1. Add `conversations:manage` permission to backend
  - [x] 1.1 Add `conversations:manage` to ALL_PERMISSIONS in PermissionService.js
    - Add the permission string to the ALL_PERMISSIONS array
    - Position it after `conversations:assign` and before `conversations:delete`
    - _Requirements: 2.1_
  - [x] 1.2 Add `conversations:manage` to DEFAULT_ROLE_PERMISSIONS in PermissionService.js
    - Add to administrator role permissions
    - Add to agent role permissions
    - Ensure viewer role does NOT have this permission
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 1.3 Add `conversations:manage` to DEFAULT_ROLE_PERMISSIONS in AgentService.js
    - Add to administrator role permissions
    - Add to agent role permissions
    - Ensure viewer role does NOT have this permission
    - _Requirements: 2.2, 2.3, 2.4_
  - [ ]* 1.4 Write property test for permission enforcement
    - **Property 2: Permission enforcement for manage operations**
    - Test that agents with `conversations:manage` can update conversations
    - Test that agents without `conversations:manage` receive 403 Forbidden
    - **Validates: Requirements 2.5, 2.6**

- [x] 2. Hide delete option in agent mode (frontend)
  - [x] 2.1 Update ConversationView.tsx to conditionally render delete option
    - Add `canDelete` variable based on `!chatApi.isAgentMode`
    - Wrap delete menu item with conditional rendering
    - Wrap delete separator with conditional rendering
    - Wrap delete confirmation dialog with conditional rendering
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 2.2 Write property test for delete option visibility
    - **Property 3: Delete option visibility based on mode**
    - Test that delete option is hidden in agent mode
    - Test that delete option is visible in user mode
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 3. Add `conversations:manage` to frontend permission dialogs
  - [x] 3.1 Update CustomRoleDialog.tsx to include `conversations:manage` permission
    - Add the permission to the conversations permission group
    - Add appropriate label and description in Portuguese
    - _Requirements: 2.1_
  - [x] 3.2 Update CustomRoleDialogUser.tsx to include `conversations:manage` permission
    - Add the permission to the conversations permission group
    - Add appropriate label and description in Portuguese
    - _Requirements: 2.1_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 5. Write additional property tests for conversation operations
  - [ ]* 5.1 Write property test for status update operations
    - **Property 1: Status update with valid status succeeds**
    - Test that status updates work for all valid statuses (open, resolved, pending, snoozed)
    - **Validates: Requirements 1.1, 1.2, 1.4**
  - [ ]* 5.2 Write property test for muted toggle round-trip
    - **Property 5: Muted toggle round-trip**
    - Test that toggling muted twice restores original state
    - **Validates: Requirements 1.3**
  - [ ]* 5.3 Write property test for label assignment round-trip
    - **Property 4: Label assignment round-trip**
    - Test that assigning and removing a label restores original state
    - **Validates: Requirements 4.1, 4.2**

- [x] 6. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
