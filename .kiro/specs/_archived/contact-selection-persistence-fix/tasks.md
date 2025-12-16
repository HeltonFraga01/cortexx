# Implementation Plan

- [x] 1. Fix contact retrieval in UserContacts.tsx
  - Modify `handleSendMessage` function to use `contacts` array instead of `filteredContacts` when retrieving selected contacts
  - Modify `handleExport` function to use `contacts` array for selected contacts export
  - Add validation logging to detect selection mismatches
  - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.5_

- [x] 2. Add selection mismatch detection and user feedback
  - Implement validation check comparing `selectedContacts.length` with `selectedCount`
  - Add console warning when mismatch is detected with detailed information
  - Add user toast notification when some selected contacts are not found
  - _Requirements: 3.5_

- [ ]* 3. Write unit tests for the fix
  - Test that `handleSendMessage` retrieves contacts from full array
  - Test that `handleExport` retrieves selected contacts from full array
  - Test selection mismatch detection and warning
  - Test that all selected contacts are passed to dispatcher correctly
  - _Requirements: 1.3, 3.1, 3.2_

- [ ]* 4. Perform manual testing
  - Test multi-search selection scenario (select from different searches)
  - Test export functionality with cross-search selections
  - Test selection persistence across search query changes
  - Verify selection count accuracy
  - Test with large contact lists (100+ contacts)
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 3.1, 3.2, 3.3_
