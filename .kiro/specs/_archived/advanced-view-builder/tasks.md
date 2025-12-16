# Implementation Plan

- [x] 1. Enhance data models and type definitions
  - Update `FieldMapping` interface to include `helperText` property
  - Create new `ViewConfiguration` interface with calendar and kanban settings
  - Update `DatabaseConnection` interface to include `viewConfiguration` property
  - Add TypeScript types for calendar events and kanban columns
  - _Requirements: 1.1, 1.2, 2.1, 2.3, 3.1, 3.3_

- [x] 2. Update database schema and backend API
  - [x] 2.1 Add `view_configuration` column to database_connections table
    - Create migration script to add TEXT column for JSON storage
    - Set default value to NULL for backward compatibility
    - _Requirements: 2.5, 3.4_
  
  - [x] 2.2 Update backend API to handle view configuration
    - Modify database connection save endpoint to accept `viewConfiguration`
    - Modify database connection get endpoint to return `viewConfiguration`
    - Add validation for view configuration structure
    - _Requirements: 2.5, 3.4_
  
  - [x] 2.3 Update backend API to handle enhanced field mappings
    - Modify field mappings save to accept `helperText`
    - Ensure backward compatibility with existing field mappings
    - _Requirements: 1.2_

- [x] 3. Implement helper text feature in Admin interface
  - [x] 3.1 Add helper text column to Field Mapper table
    - Add new table column "Texto de Ajuda (Descrição)" in DatabaseAdvancedTab
    - Add Input component for helper text entry (max 500 characters)
    - Implement character counter for helper text input
    - _Requirements: 1.1_
  
  - [x] 3.2 Update field mapping state management
    - Modify `handleFieldMappingChange` to handle `helperText` updates
    - Ensure helper text is saved with field mappings
    - _Requirements: 1.2_
  
  - [x] 3.3 Add validation for helper text
    - Validate helper text length (max 500 characters)
    - Show validation error if limit exceeded
    - _Requirements: 1.2_

- [x] 4. Implement View Configuration section in Admin interface
  - [x] 4.1 Create ViewConfigurationSection component
    - Create new component file `src/components/admin/ViewConfigurationSection.tsx`
    - Implement component structure with Calendar and Kanban sections
    - Add props interface for view config and columns
    - _Requirements: 2.1, 3.1_
  
  - [x] 4.2 Implement Calendar view configuration
    - Add toggle/checkbox for "Habilitar Visualização Calendário"
    - Add dropdown for date field selection (populated with date/datetime columns)
    - Filter columns to show only Date, DateTime, CreatedTime, LastModifiedTime types
    - Implement state management for calendar configuration
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 4.3 Implement Kanban view configuration
    - Add toggle/checkbox for "Habilitar Visualização Kanban"
    - Add dropdown for status field selection (populated with groupable columns)
    - Filter columns to show Text, Select, and Tags types
    - Implement state management for kanban configuration
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.4 Integrate ViewConfigurationSection into DatabaseAdvancedTab
    - Import and render ViewConfigurationSection component
    - Pass view configuration state and handlers
    - Ensure view config is saved with database connection
    - _Requirements: 2.5, 3.4_
  
  - [x] 4.5 Add validation for view configurations
    - Validate that date field is selected when calendar is enabled
    - Validate that status field is selected when kanban is enabled
    - Validate that selected fields exist in the table
    - Show validation errors to admin
    - Prevent save if validation fails
    - _Requirements: 2.4, 3.3_

- [x] 5. Enhance DatabaseConnectionsService
  - [x] 5.1 Add view configuration validation method
    - Implement `validateViewConfiguration` method
    - Check calendar date field type
    - Check kanban status field existence
    - Return validation result with error messages
    - _Requirements: 2.4, 3.3_
  
  - [x] 5.2 Update connection save/update methods
    - Modify methods to handle `viewConfiguration` property
    - Ensure view config is serialized to JSON for backend
    - _Requirements: 2.5, 3.4_
  
  - [x] 5.3 Add helper methods for column filtering
    - Implement method to get date/datetime columns
    - Implement method to get groupable columns
    - _Requirements: 2.3, 3.3_

- [x] 6. Display helper text in end user form view
  - [x] 6.1 Update RecordForm component to display helper text
    - Modify field rendering to include helper text below input
    - Style helper text with smaller font and muted color
    - Ensure helper text is only shown when configured
    - _Requirements: 1.3, 1.4_
  
  - [x] 6.2 Update DirectEditPage to pass helper text
    - Ensure field mappings with helper text are passed to RecordForm
    - _Requirements: 1.3_
  
  - [x] 6.3 Add accessibility attributes for helper text
    - Add aria-describedby linking input to helper text
    - Ensure screen readers announce helper text
    - _Requirements: 1.3_

- [x] 7. Create UserDatabaseView component with tab navigation
  - [x] 7.1 Create UserDatabaseView component structure
    - Create new file `src/components/user/UserDatabaseView.tsx`
    - Implement component with connection selector
    - Add state for selected view (form/calendar/kanban)
    - Add state for connection and records
    - _Requirements: 2.6, 3.5, 5.1_
  
  - [x] 7.2 Implement view tab navigation
    - Create tab UI for Form, Calendar, and Kanban views
    - Conditionally render tabs based on view configuration
    - Handle tab click to switch views
    - Style active tab differently
    - _Requirements: 2.6, 3.5_
  
  - [x] 7.3 Implement view preference persistence
    - Save selected view to localStorage on change
    - Load saved view preference on component mount
    - Use connection-specific keys for localStorage
    - Default to Form view if no preference saved
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 7.4 Handle disabled views gracefully
    - Auto-switch to Form view if selected view is disabled
    - Show only enabled view tabs
    - _Requirements: 2.8, 3.8, 5.5_

- [x] 8. Implement Calendar view
  - [x] 8.1 Install calendar dependencies
    - Add `react-big-calendar` or `@fullcalendar/react` to package.json
    - Add date manipulation library (date-fns or dayjs)
    - Install types for TypeScript support
    - _Requirements: 2.7_
  
  - [x] 8.2 Create CalendarView component
    - Create new file `src/components/user/CalendarView.tsx`
    - Implement component structure with calendar library
    - Add props for connection, records, dateField
    - _Requirements: 2.7_
  
  - [x] 8.3 Implement record-to-event mapping
    - Create function to map records to calendar events
    - Use configured date field for event date
    - Generate event title from "Show in Card" fields
    - Handle records with missing date values
    - _Requirements: 2.7, 4.1_
  
  - [x] 8.4 Implement calendar event rendering
    - Render events on calendar
    - Show event cards with record information
    - Implement click handler to view/edit record
    - _Requirements: 2.7_
  
  - [x] 8.5 Add calendar navigation controls
    - Implement month/week/day view switcher
    - Add date range navigation (prev/next)
    - Add "Today" button
    - _Requirements: 2.7_
  
  - [x] 8.6 Make calendar responsive
    - Adjust calendar layout for mobile devices
    - Simplify view on small screens
    - _Requirements: 2.7_

- [x] 9. Implement Kanban view
  - [x] 9.1 Install kanban dependencies
    - Add `@dnd-kit/core` and `@dnd-kit/sortable` to package.json
    - Install types for TypeScript support
    - _Requirements: 3.5_
  
  - [x] 9.2 Create KanbanView component
    - Create new file `src/components/user/KanbanView.tsx`
    - Implement component structure with kanban board
    - Add props for connection, records, statusField
    - _Requirements: 3.5_
  
  - [x] 9.3 Implement kanban column generation
    - Create function to extract unique status values
    - Generate columns based on unique statuses
    - Group records by status value
    - Handle records with missing status (Uncategorized column)
    - _Requirements: 3.6, 3.7_
  
  - [x] 9.4 Create KanbanCard component
    - Create card component to display record
    - Show fields marked as "Show in Card"
    - Use configured friendly labels
    - Implement click handler to view/edit record
    - _Requirements: 3.7, 4.1, 4.2, 4.3_
  
  - [x] 9.5 Implement drag-and-drop functionality
    - Set up DndContext from @dnd-kit
    - Make cards draggable
    - Make columns droppable
    - Handle drop event to update record status
    - _Requirements: 3.7_
  
  - [x] 9.6 Implement optimistic UI updates
    - Update UI immediately on drag-and-drop
    - Call API to persist status change
    - Revert UI if API call fails
    - Show loading state during update
    - _Requirements: 3.7_
  
  - [x] 9.7 Make kanban board responsive
    - Adjust board layout for mobile devices
    - Enable horizontal scrolling on small screens
    - Stack columns vertically on very small screens
    - _Requirements: 3.5_
  
  - [x] 9.8 Handle empty columns
    - Show placeholder message in empty columns
    - Allow dropping cards into empty columns
    - _Requirements: 3.7_

- [x] 10. Integrate views into UserDatabaseView
  - [x] 10.1 Integrate FormView
    - Refactor DirectEditPage into FormView component
    - Render FormView when form tab is selected
    - Pass connection and record data
    - _Requirements: 2.6, 3.5_
  
  - [x] 10.2 Integrate CalendarView
    - Render CalendarView when calendar tab is selected
    - Pass connection, records, and dateField
    - Handle record click to open edit modal/page
    - _Requirements: 2.6, 2.7_
  
  - [x] 10.3 Integrate KanbanView
    - Render KanbanView when kanban tab is selected
    - Pass connection, records, and statusField
    - Handle record click to open edit modal/page
    - Handle status update from drag-and-drop
    - _Requirements: 3.5, 3.7_
  
  - [x] 10.4 Implement shared record edit modal
    - Create modal component for editing records
    - Use RecordForm component inside modal
    - Open modal when record is clicked in any view
    - Close modal and refresh data after save
    - _Requirements: 2.7, 3.7_

- [x] 11. Update routing and navigation
  - [x] 11.1 Update user routes
    - Replace UserDatabase route with UserDatabaseView
    - Ensure backward compatibility with existing URLs
    - _Requirements: 2.6, 3.5_
  
  - [x] 11.2 Update navigation links
    - Update sidebar links to point to new component
    - Ensure deep linking works for specific views
    - _Requirements: 2.6, 3.5_

- [x] 12. Add error handling and loading states
  - [x] 12.1 Add loading states for view switching
    - Show skeleton loaders when switching views
    - Show loading spinner during data fetch
    - _Requirements: 2.7, 3.5_
  
  - [x] 12.2 Handle missing configuration errors
    - Show error message if view is enabled but config is incomplete
    - Provide fallback to Form view
    - _Requirements: 2.8, 3.8_
  
  - [x] 12.3 Handle data loading errors
    - Show error message if records fail to load
    - Provide retry button
    - _Requirements: 2.7, 3.5_

- [x] 13. Implement caching and performance optimizations
  - [x] 13.1 Implement view-level caching
    - Cache calendar events in memory
    - Cache kanban columns in memory
    - Invalidate cache on record updates
    - _Requirements: 2.7, 3.7_
  
  - [x] 13.2 Optimize calendar rendering
    - Implement lazy loading for events outside visible range
    - Use React.memo for event components
    - _Requirements: 2.7_
  
  - [x] 13.3 Optimize kanban rendering
    - Implement virtual scrolling for large card lists
    - Use React.memo for card components
    - Debounce drag-and-drop updates
    - _Requirements: 3.7_

- [x] 14. Add accessibility features
  - [x] 14.1 Add keyboard navigation
    - Enable tab navigation through view tabs
    - Add arrow key navigation for calendar
    - Add keyboard shortcuts for common actions
    - _Requirements: 2.6, 2.7, 3.5_
  
  - [x] 14.2 Add ARIA labels and roles
    - Add ARIA labels to all interactive elements
    - Add role attributes for calendar and kanban
    - Announce view changes to screen readers
    - _Requirements: 1.3, 2.7, 3.7_
  
  - [x] 14.3 Ensure color contrast
    - Verify color contrast meets WCAG AA standards
    - Add high contrast mode support
    - Ensure focus indicators are visible
    - _Requirements: 2.7, 3.7_

- [x] 15. Update documentation
  - [x] 15.1 Update admin documentation
    - Document how to add helper text to fields
    - Document how to enable and configure Calendar view
    - Document how to enable and configure Kanban view
    - Add screenshots of configuration interface
    - _Requirements: 1.1, 2.1, 3.1_
  
  - [x] 15.2 Update user documentation
    - Document how to use Calendar view
    - Document how to use Kanban view
    - Document how to switch between views
    - Add screenshots of each view
    - _Requirements: 2.6, 2.7, 3.5, 3.7_
  
  - [x] 15.3 Update API documentation
    - Document view configuration structure
    - Document enhanced field mapping structure
    - Add examples of valid configurations
    - _Requirements: 2.5, 3.4_

- [x] 16. Create comprehensive tests
  - [x] 16.1 Write unit tests for Admin components
    - Test DatabaseAdvancedTab helper text input
    - Test ViewConfigurationSection toggles and selectors
    - Test view configuration validation
    - _Requirements: 1.1, 2.1, 3.1_
  
  - [x] 16.2 Write unit tests for End User components
    - Test UserDatabaseView tab navigation
    - Test CalendarView event mapping
    - Test KanbanView column generation
    - Test FormView helper text display
    - _Requirements: 1.3, 2.6, 2.7, 3.5, 3.7_
  
  - [x] 16.3 Write integration tests
    - Test complete admin configuration flow
    - Test complete end user view switching flow
    - Test view preference persistence
    - _Requirements: 1.2, 2.5, 3.4, 5.1_
  
  - [x] 16.4 Write E2E tests with Cypress
    - Test admin configures helper text and saves
    - Test admin enables Calendar view and saves
    - Test admin enables Kanban view and saves
    - Test user sees helper text in form
    - Test user switches to Calendar view
    - Test user switches to Kanban view
    - Test user drags card in Kanban view
    - _Requirements: 1.1, 1.3, 2.1, 2.6, 2.7, 3.1, 3.5, 3.7_
