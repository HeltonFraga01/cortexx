# Implementation Plan

- [x] 1. Setup base structure and routing
  - Create UserContacts page component
  - Add route to App.tsx
  - Add menu item to sidebar navigation
  - Setup basic layout with header and container
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Implement contacts storage service
- [x] 2.1 Create ContactsStorageService class
  - Implement saveContacts, loadContacts methods
  - Implement saveTags, loadTags methods
  - Implement saveGroups, loadGroups methods
  - Implement savePreferences, loadPreferences methods
  - Implement cleanOldData method with 7-day retention
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 2.2 Create ContactsService class
  - Implement filterContacts method with multiple criteria
  - Implement searchContacts method for name/phone
  - Implement addTagsToContacts, removeTagsFromContacts methods
  - Implement createTag, deleteTag methods
  - Implement createGroup, updateGroup, deleteGroup methods
  - Implement exportToCSV method
  - Implement getStats method
  - _Requirements: 4.2, 5.3, 8.4, 9.3, 10.2, 13.2_

- [ ] 3. Implement core hooks
- [x] 3.1 Create useContacts hook
  - Implement state management for contacts
  - Implement importContacts method calling contactImportService
  - Implement updateContact method
  - Implement deleteContacts method
  - Integrate with ContactsStorageService for persistence
  - _Requirements: 2.2, 2.3, 14.1_

- [x] 3.2 Create useContactFilters hook
  - Implement filters state management
  - Implement updateFilters method with debouncing
  - Implement clearFilters method
  - Implement real-time filtering with useMemo
  - Calculate and return resultCount
  - _Requirements: 4.2, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3.3 Create useContactSelection hook
  - Implement selectedIds Set state
  - Implement toggleSelection method
  - Implement selectAll method
  - Implement clearSelection method
  - Implement selectFiltered method for filtered selection
  - Persist selection in sessionStorage
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.2, 7.4_

- [x] 4. Build ContactsStats component
  - Create stats cards layout with grid
  - Display total contacts count
  - Display contacts with name count
  - Display contacts without name count
  - Display total tags count
  - Update stats based on filtered contacts
  - Add click handlers to apply related filters
  - _Requirements: 13.1, 13.2, 13.3, 13.5_

- [ ] 5. Build ContactsFilters component
- [x] 5.1 Create filter UI layout
  - Add search input with debouncing
  - Add tags multi-select dropdown
  - Add "has name" checkbox filters
  - Add clear filters button
  - Display result count vs total count
  - _Requirements: 4.1, 5.1, 5.2, 5.5_

- [x] 5.2 Implement filter logic
  - Connect to useContactFilters hook
  - Implement search filtering (name and phone)
  - Implement tags filtering with AND logic
  - Implement hasName filtering
  - Update result count in real-time
  - _Requirements: 4.2, 4.3, 4.4, 5.3, 5.4_

- [ ] 6. Build ContactsTable component
- [x] 6.1 Create table structure
  - Setup table with columns: checkbox, phone, name, tags, actions
  - Implement header with select-all checkbox
  - Implement pagination controls
  - Display current page and total pages
  - Display empty state when no contacts
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6.2 Implement virtualization
  - Integrate react-window for virtual scrolling
  - Configure row height and container height
  - Implement Row component for each contact
  - Optimize rendering for 10,000+ contacts
  - _Requirements: 15.1, 15.5_

- [x] 6.3 Implement selection logic
  - Connect individual checkboxes to useContactSelection
  - Implement select-all checkbox for current page
  - Maintain selection state across pages
  - Update selection count in real-time
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6.4 Add inline actions
  - Add edit name inline functionality
  - Add remove contact action
  - Add quick tag assignment
  - Implement action dropdown menu
  - _Requirements: 3.1, 8.1, 8.5_

- [x] 7. Build ContactSelection floating bar
  - Create floating bar component with animation
  - Display selected count badge
  - Add "Add Tags" button
  - Add "Save Group" button
  - Add "Send Message" button
  - Add "Export CSV" button
  - Add clear selection button
  - Position fixed at bottom center
  - Animate entrance/exit with framer-motion
  - _Requirements: 6.5, 7.3, 8.1, 9.1, 10.1, 11.1_

- [ ] 8. Build ContactTags component
- [x] 8.1 Create tag management UI
  - Display existing tags as colored badges
  - Add tag selection dropdown
  - Add create new tag form inline
  - Add color picker for new tags
  - Add remove tag functionality
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 8.2 Implement tag operations
  - Implement addTagsToContacts in service
  - Implement removeTagsFromContacts in service
  - Implement createTag with validation
  - Update contacts with new tags
  - Persist tags to localStorage
  - _Requirements: 8.1, 8.4, 8.5_

- [ ] 9. Build ContactGroups component
- [x] 9.1 Create groups sidebar
  - Display list of saved groups
  - Show group name and contact count
  - Add create new group button
  - Add edit group inline
  - Add delete group with confirmation
  - _Requirements: 9.4, 9.1_

- [x] 9.2 Implement group operations
  - Implement createGroup method
  - Implement updateGroup method
  - Implement deleteGroup method
  - Implement getGroupContacts method
  - Auto-select contacts when group is clicked
  - Persist groups to localStorage
  - _Requirements: 9.2, 9.3, 9.5_

- [x] 10. Build ContactImportButton component
  - Create import button with loading state
  - Call contactImportService.importFromWuzapi
  - Display progress indicator
  - Show success toast with count
  - Handle errors with toast notifications
  - Update contacts state after import
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 11. Implement export functionality
  - Create exportToCSV method in service
  - Generate CSV with phone, name, tags columns
  - Format filename with current date
  - Trigger browser download
  - Show success toast
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 12. Enhance ContactImporter for dispatcher
- [x] 12.1 Add filters to ContactImporter
  - Add inline filters section
  - Implement search filter
  - Implement tags filter
  - Implement hasName filter
  - Show filtered count before adding
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 12.2 Implement pre-selection from contacts page
  - Check for preSelectedContacts in sessionStorage
  - Load and display pre-selected contacts
  - Allow adding more contacts with filters
  - Maintain selection across imports
  - Clear sessionStorage after use
  - _Requirements: 11.2, 11.3, 11.4, 12.5_

- [x] 13. Implement "Select All Filtered" feature
  - Add button when filters are active
  - Calculate total filtered contacts count
  - Select all contacts matching filters (not just page)
  - Show confirmation toast with count
  - Update selection counter
  - Maintain selection across pagination
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 14. Implement "Send Message" integration
  - Add handler in ContactSelection bar
  - Collect selected contacts
  - Save to sessionStorage
  - Navigate to /user/disparador
  - Pass contacts via navigation state
  - Show success toast
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 15. Add performance optimizations
  - Implement debouncing for search (300ms)
  - Add useMemo for filtered contacts
  - Add useMemo for statistics
  - Implement skeleton loaders
  - Add loading states for async operations
  - _Requirements: 15.2, 15.3, 15.4, 15.5_

- [x] 16. Implement pagination
  - Add pagination state (page, pageSize)
  - Calculate totalPages from filtered contacts
  - Implement page navigation (prev, next, goto)
  - Display page info (X of Y)
  - Persist current page in state
  - Reset to page 1 when filters change
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 17. Add accessibility features
  - Add ARIA labels to all interactive elements
  - Ensure keyboard navigation works
  - Add focus indicators
  - Test with screen reader
  - Ensure color contrast meets WCAG AA
  - _Requirements: All requirements (accessibility is cross-cutting)_

- [x] 18. Implement data persistence
  - Save contacts to localStorage on change
  - Save tags to localStorage on change
  - Save groups to localStorage on change
  - Save user preferences (filters, page, pageSize)
  - Load saved data on component mount
  - Implement cleanOldData on mount (7 days)
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 19. Add error handling and loading states
  - Add try-catch blocks to all async operations
  - Display toast notifications for errors
  - Show loading spinners during operations
  - Add error boundaries for component crashes
  - Implement retry logic for failed imports
  - _Requirements: All requirements (error handling is cross-cutting)_

- [x] 20. Polish UI and animations
  - Add smooth transitions for filter changes
  - Animate floating bar entrance/exit
  - Add hover effects to interactive elements
  - Implement skeleton loaders for loading states
  - Add empty states with helpful messages
  - Ensure responsive design for mobile
  - _Requirements: 15.4, 15.5_
