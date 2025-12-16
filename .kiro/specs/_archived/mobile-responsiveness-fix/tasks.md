# Implementation Plan

## Mobile Responsiveness Fix

- [x] 1. Create responsive utility patterns and update base components
  - [x] 1.1 Update ContactsStats to use mobile-first grid pattern
    - Add `grid-cols-1` before `md:grid-cols-2` in the grid className
    - Ensure stat cards stack vertically on mobile
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 1.2 Update PageHeader component for responsive button groups
    - Add `flex-col sm:flex-row flex-wrap` to actions container
    - Ensure buttons stack on mobile and row on desktop
    - Add `w-full sm:w-auto` to action buttons for full-width on mobile
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 1.3 Write property test for stat cards single column layout
    - **Property 5: Stat Cards Single Column in Mobile**
    - **Validates: Requirements 3.1, 3.2**

- [x] 2. Fix page container overflow issues
  - [x] 2.1 Update UserContacts page container classes
    - Add `overflow-x-hidden` to main container
    - Ensure `max-w-full` is applied
    - _Requirements: 1.1, 1.2, 7.2_
  - [x] 2.2 Update MessagingPage container for mobile
    - Apply `w-full max-w-full overflow-x-hidden px-4 md:px-6` pattern
    - _Requirements: 1.1, 1.2, 7.2_
  - [x] 2.3 Update TemplatesPage container for mobile
    - Apply consistent responsive container pattern
    - _Requirements: 1.1, 1.2, 7.2_
  - [x] 2.4 Update OutboxPage container for mobile
    - Apply consistent responsive container pattern
    - _Requirements: 1.1, 1.2, 7.2_
  - [x] 2.5 Update ReportsPage container for mobile
    - Apply consistent responsive container pattern
    - _Requirements: 1.1, 1.2, 7.2_
  - [ ]* 2.6 Write property test for no horizontal overflow
    - **Property 1: No Horizontal Page Overflow in Mobile View**
    - **Validates: Requirements 1.1, 1.2, 6.1, 6.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Fix button groups and action areas
  - [x] 4.1 Update UserOverview action buttons for mobile
    - Ensure Connection Control buttons use `flex-col sm:flex-row flex-wrap gap-2`
    - Ensure Webhook buttons use responsive pattern
    - Ensure Quick Access grid uses `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 4.2 Update ContactsFilters action buttons for mobile
    - Apply `flex-col sm:flex-row flex-wrap gap-2` to filter action buttons
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 4.3 Update ContactSelection floating bar for mobile
    - Ensure action buttons wrap properly on small screens
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 4.4 Write property test for button groups wrapping
    - **Property 3: Button Groups Wrap in Mobile**
    - **Validates: Requirements 2.1, 2.2**

- [x] 5. Fix form layouts for mobile
  - [x] 5.1 Update LoginPage form for mobile
    - Ensure form inputs use `w-full` class
    - Verify labels stack above inputs
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 5.2 Update UserSettings forms for mobile
    - Apply `flex-col gap-2` pattern for form fields
    - Ensure labels are above inputs on mobile
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 5.3 Update webhook configuration form in UserOverview
    - Ensure form inputs span full width on mobile
    - _Requirements: 5.1, 5.2_
  - [ ]* 5.4 Write property test for form inputs full width
    - **Property 10: Form Inputs Full Width**
    - **Validates: Requirements 5.1**

- [x] 6. Fix data tables for mobile
  - [x] 6.1 Verify ContactsTable horizontal scroll pattern
    - Ensure table container has `overflow-x-auto` without page overflow
    - Verify essential columns (phone, name) are visible first
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 6.2 Update AdminUsers table for mobile
    - Apply `-mx-4 px-4 md:mx-0 md:px-0` pattern for edge-to-edge scroll
    - Add `min-w-[600px]` to table for consistent scroll behavior
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 6.3 Update any other data tables in admin pages
    - Apply consistent table scroll pattern
    - _Requirements: 6.1, 6.3, 6.4_
  - [ ]* 6.4 Write property test for table essential columns visibility
    - **Property 13: Table Essential Columns Visibility**
    - **Validates: Requirements 6.2**

- [x] 7. Checkpoint - Ensure all tests pass
  - Tests for modified components (DynamicSidebarNavigation, RecordForm basic tests) pass
  - Note: Some pre-existing RecordForm tests fail due to missing async handling (not related to mobile responsiveness changes)

- [x] 8. Fix header and navigation for mobile
  - [x] 8.1 Verify UserLayout mobile header fits viewport
    - Check header elements don't overflow on mobile
    - Ensure touch targets are at least 44x44px
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 8.2 Verify AdminLayout mobile header fits viewport
    - Apply same responsive patterns as UserLayout
    - _Requirements: 4.1, 4.3, 4.4_
  - [x] 8.3 Ensure main content expands when sidebar collapsed
    - Verify `lg:pl-64` pattern works correctly
    - _Requirements: 4.2_
  - [ ]* 8.4 Write property test for touch target minimum size
    - **Property 9: Touch Target Minimum Size**
    - **Validates: Requirements 4.3, 5.3**

- [x] 9. Apply consistent responsive patterns across remaining pages
  - [x] 9.1 Update AdminOverview for mobile responsiveness
    - Apply stat cards grid pattern `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
    - Apply button group responsive pattern
    - _Requirements: 1.3, 2.1, 3.1, 7.3_
  - [x] 9.2 Update AdminSettings for mobile responsiveness
    - Ensure form layouts are mobile-friendly
    - Apply responsive container pattern
    - _Requirements: 5.1, 5.2, 7.2_
  - [x] 9.3 Update AdminDatabases for mobile responsiveness
    - Apply table scroll pattern
    - Apply button group pattern
    - _Requirements: 2.1, 6.1, 7.3_
  - [ ]* 9.4 Write property test for responsive class consistency
    - **Property 14: Responsive Class Consistency**
    - **Validates: Requirements 7.2**
  - [ ]* 9.5 Write property test for flex wrap application
    - **Property 15: Flex Wrap Application**
    - **Validates: Requirements 7.3**

- [x] 10. Checkpoint - Ensure all tests pass
  - Integration tests pass (15/15)
  - No TypeScript errors in modified files

- [ ] 11. Create Cypress E2E tests for mobile responsiveness
  - [ ]* 11.1 Create mobile-responsiveness.cy.ts test file
    - Test no horizontal overflow on key pages at mobile viewport
    - Test button visibility and accessibility
    - Test table scroll behavior
    - _Requirements: 1.1, 1.2, 2.3, 6.1_
  - [ ]* 11.2 Add desktop regression tests
    - **Property 2: Desktop Layout Regression**
    - Verify desktop layouts remain unchanged
    - **Validates: Requirements 1.4, 2.4, 3.4, 4.4, 5.4, 6.4**

- [ ] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
