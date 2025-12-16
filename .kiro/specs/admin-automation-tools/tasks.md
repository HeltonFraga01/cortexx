# Implementation Plan

## Phase 1: Database Foundation

- [x] 1. Create database migrations for automation tables
  - [x] 1.1 Create migration for global_settings table
    - Create table with key-value structure for storing automation settings
    - Add index on key column for fast lookups
    - _Requirements: 4.5_
  - [x] 1.2 Create migration for bot_templates table
    - Create table with name, description, outgoing_url, include_history, is_default columns
    - Add index on is_default column
    - _Requirements: 2.1, 2.2_
  - [x] 1.3 Create migration for default_labels table
    - Create table with name, color, sort_order columns
    - _Requirements: 5.1, 5.2_
  - [x] 1.4 Create migration for default_canned_responses table
    - Create table with shortcut, content, sort_order columns
    - _Requirements: 6.1, 6.2_
  - [x] 1.5 Create migration for automation_audit_log table
    - Create table with user_id, automation_type, details, status, error_message columns
    - Add indexes on user_id, automation_type, and created_at
    - _Requirements: 9.1, 9.2_

## Phase 2: Backend Services

- [x] 2. Implement AutomationService
  - [x] 2.1 Create AutomationService.js with global settings management
    - Implement getGlobalSettings() and updateGlobalSettings() methods
    - Use database.js abstraction for all queries
    - _Requirements: 4.2, 4.5_
  - [ ]* 2.2 Write property test for settings persistence
    - **Property 13: Settings Persistence**
    - **Validates: Requirements 1.2, 4.2**
  - [x] 2.3 Implement bot template CRUD methods
    - Implement getBotTemplates(), createBotTemplate(), updateBotTemplate(), deleteBotTemplate()
    - Implement setDefaultBotTemplate() with validation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 2.4 Write property test for required field validation
    - **Property 4: Required Field Validation**
    - **Validates: Requirements 2.2, 6.2**
  - [ ]* 2.5 Write property test for default template deletion prevention
    - **Property 5: Default Template Deletion Prevention**
    - **Validates: Requirements 2.4**
  - [x] 2.6 Implement default labels CRUD methods
    - Implement getDefaultLabels(), createDefaultLabel(), updateDefaultLabel(), deleteDefaultLabel()
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 2.7 Implement default canned responses CRUD methods
    - Implement getDefaultCannedResponses(), createDefaultCannedResponse(), updateDefaultCannedResponse(), deleteDefaultCannedResponse()
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 2.8 Implement applyAutomationsToNewUser method
    - Create bot from template if enabled
    - Create labels from defaults if enabled
    - Create canned responses from defaults if enabled
    - Log all actions to audit log
    - _Requirements: 1.3, 5.3, 6.3_
  - [ ]* 2.9 Write property test for new user automation application
    - **Property 1: New User Automation Application**
    - **Validates: Requirements 1.3, 5.3, 6.3, 9.2**
  - [ ]* 2.10 Write property test for template-instance isolation
    - **Property 3: Template-Instance Isolation**
    - **Validates: Requirements 2.3, 5.4, 6.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement AuditLogService
  - [x] 4.1 Create AuditLogService.js with logging methods
    - Implement logAutomation() method
    - Implement getAuditLog() with pagination and filters
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ]* 4.2 Write property test for audit log completeness
    - **Property 7: Audit Log Completeness**
    - **Validates: Requirements 9.2, 14.3**
  - [x] 4.3 Implement statistics calculation methods
    - Implement getStatistics() for dashboard cards
    - Calculate success/failure rates by automation type
    - _Requirements: 10.2, 10.3_
  - [ ]* 4.4 Write property test for statistics accuracy
    - **Property 8: Statistics Accuracy**
    - **Validates: Requirements 10.2, 10.3**
  - [x] 4.5 Implement archiveOldEntries method
    - Archive entries older than retention period
    - _Requirements: 9.5_

- [x] 5. Implement bulk actions and export/import
  - [x] 5.1 Implement applyAutomationsToExistingUsers method
    - Apply selected automations to multiple users
    - Return detailed success/failure counts
    - _Requirements: 8.3, 8.4_
  - [ ]* 5.2 Write property test for bulk action completeness
    - **Property 6: Bulk Action Completeness**
    - **Validates: Requirements 8.3, 8.4**
  - [x] 5.3 Implement exportConfiguration method
    - Export all automation settings to JSON
    - _Requirements: 13.2_
  - [x] 5.4 Implement importConfiguration and validateConfiguration methods
    - Validate JSON structure before import
    - Apply configuration with preview option
    - _Requirements: 13.3, 13.4, 13.5_
  - [ ]* 5.5 Write property test for configuration round-trip
    - **Property 9: Configuration Export/Import Round-Trip**
    - **Validates: Requirements 13.2, 13.3**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Backend Routes

- [x] 7. Create automation routes
  - [x] 7.1 Create adminAutomationRoutes.js with global settings endpoints
    - GET /api/admin/automation/settings
    - PUT /api/admin/automation/settings
    - _Requirements: 4.1, 4.2_
  - [x] 7.2 Add bot template endpoints
    - GET, POST /api/admin/automation/bot-templates
    - PUT, DELETE /api/admin/automation/bot-templates/:id
    - POST /api/admin/automation/bot-templates/:id/set-default
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 7.3 Add default labels endpoints
    - GET, POST /api/admin/automation/default-labels
    - PUT, DELETE /api/admin/automation/default-labels/:id
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 7.4 Add default canned responses endpoints
    - GET, POST /api/admin/automation/default-canned-responses
    - PUT, DELETE /api/admin/automation/default-canned-responses/:id
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 7.5 Add audit log and statistics endpoints
    - GET /api/admin/automation/audit-log
    - GET /api/admin/automation/statistics
    - _Requirements: 9.1, 9.3, 9.4, 10.1_
  - [x] 7.6 Add bulk action endpoint
    - POST /api/admin/automation/bulk-apply
    - _Requirements: 8.3, 8.4, 8.5_
  - [x] 7.7 Add export/import endpoints
    - GET /api/admin/automation/export
    - POST /api/admin/automation/import
    - POST /api/admin/automation/validate-import
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [x] 8. Create automation validator
  - [x] 8.1 Create automationValidator.js with validation schemas
    - Bot template validation (name, outgoingUrl required)
    - Label validation (name, color required)
    - Canned response validation (shortcut, content required)
    - URL format validation
    - _Requirements: 2.2, 5.2, 6.2, 7.2_
  - [ ]* 8.2 Write property test for URL validation
    - **Property 12: URL Validation**
    - **Validates: Requirements 7.2**

- [x] 9. Integrate automation with user creation
  - [x] 9.1 Modify adminRoutes.js POST /users to call applyAutomationsToNewUser
    - Call AutomationService after successful user creation
    - Handle automation failures gracefully (don't fail user creation)
    - _Requirements: 1.3, 3.3, 5.3, 6.3_
  - [ ]* 9.2 Write property test for temporal isolation
    - **Property 2: Temporal Isolation of Template Updates**
    - **Validates: Requirements 1.4, 3.5**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Frontend Services

- [x] 11. Create frontend automation service
  - [x] 11.1 Create src/services/automation.ts with API client methods
    - Global settings methods
    - Bot template CRUD methods
    - Default labels CRUD methods
    - Default canned responses CRUD methods
    - Audit log and statistics methods
    - Export/import methods
    - _Requirements: All_

- [x] 12. Create TypeScript types
  - [x] 12.1 Create src/types/automation.ts with all interfaces
    - GlobalSettings, BotTemplate, DefaultLabel, DefaultCannedResponse
    - AuditLogEntry, AutomationStatistics, ConfigurationExport
    - BulkResult, ValidationResult
    - _Requirements: All_

## Phase 5: Frontend Components

- [x] 13. Create main automation settings component
  - [x] 13.1 Create AdminAutomationSettings.tsx with tabs structure
    - Use Tabs component for organizing sections
    - Load global settings on mount
    - _Requirements: 4.1, 4.3_

- [x] 14. Create bot templates management
  - [x] 14.1 Create BotTemplateManager.tsx with inline CRUD
    - List templates with default indicator badge
    - Inline form for create/edit (no modals)
    - Delete confirmation with AlertDialog
    - Set as default action
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 15. Create default labels management
  - [x] 15.1 Create DefaultLabelsManager.tsx with inline CRUD
    - List labels with color preview
    - Inline form with color picker
    - Drag-and-drop reordering (optional)
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 16. Create default canned responses management
  - [x] 16.1 Create DefaultCannedResponsesManager.tsx with inline CRUD
    - List responses with shortcut and content preview
    - Inline form for create/edit
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [x] 17. Create audit log component
  - [x] 17.1 Create AutomationAuditLog.tsx with filters and pagination
    - Date range filter
    - Automation type filter
    - User filter
    - Paginated table
    - _Requirements: 9.1, 9.3, 9.4_

- [x] 18. Create statistics cards component
  - [x] 18.1 Create AutomationStatisticsCards.tsx for dashboard
    - Total automations card
    - Success rate card
    - By type breakdown
    - Recent failures list
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 19. Create export/import components
  - [x] 19.1 Create ConfigurationExportImport.tsx
    - Export button with download
    - Import with file upload
    - Preview changes before applying
    - Validation error display
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Integration

- [x] 21. Integrate automation settings into admin layout
  - [x] 21.1 Add automation tab to AdminSettings.tsx
    - Import and render AdminAutomationSettings component
    - _Requirements: 4.1_

- [x] 22. Integrate statistics into admin dashboard
  - [x] 22.1 Add AutomationStatisticsCards to AdminOverview.tsx
    - Display automation statistics alongside existing dashboard cards
    - _Requirements: 10.1_

- [x] 23. Add bulk actions to user management
  - [x] 23.1 Update AdminUsers.tsx with bulk action dropdown
    - Add checkbox selection for users
    - Add bulk actions dropdown (Apply Bot Template, Apply Labels, etc.)
    - Show results summary after bulk action
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 24. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
