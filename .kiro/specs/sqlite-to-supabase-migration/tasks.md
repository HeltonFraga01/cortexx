# Implementation Plan: SQLite to Supabase Migration

## Overview

Este plano implementa a migração incremental de SQLite para Supabase, removendo o compatibility layer (`server/database.js`) e fazendo com que todo o código use diretamente o `SupabaseService`.

## Tasks

- [x] 1. Migrate Chat Routes
  - [x] 1.1 Update `server/routes/chatRoutes.js` to use SupabaseService
    - Replace `req.app.locals.db` with SupabaseService imports
    - Update message logging to use `SupabaseService.insert('sent_messages', ...)`
    - Update message history queries to use `SupabaseService.queryAsAdmin('sent_messages', ...)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 1.2 Write property test for message logging round-trip
    - **Property 3: Message Logging Round-Trip**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Migrate Chat Inbox Routes
  - [x] 2.1 Update contact attributes operations in `server/routes/chatInboxRoutes.js`
    - Replace `req.app.locals.db.query` with SupabaseService for contact_attributes table
    - Update GET, POST, PUT, DELETE operations
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.2 Update contact notes operations in `server/routes/chatInboxRoutes.js`
    - Replace `req.app.locals.db.query` with SupabaseService for contact_notes table
    - Update GET, POST operations
    - _Requirements: 3.4, 3.5_
  - [x] 2.3 Update macros operations in `server/routes/chatInboxRoutes.js`
    - Replace `req.app.locals.db.query` with SupabaseService for macros table
    - _Requirements: 3.6_
  - [x] 2.4 Update conversation avatar operations in `server/routes/chatInboxRoutes.js`
    - Replace `req.app.locals.db.query` with SupabaseService for conversations table
    - _Requirements: 3.7, 3.8_
  - [ ]* 2.5 Write property test for contact attributes round-trip
    - **Property 4: Contact Attributes Round-Trip**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  - [ ]* 2.6 Write property test for contact notes round-trip
    - **Property 5: Contact Notes Round-Trip**
    - **Validates: Requirements 3.4, 3.5**

- [x] 3. Checkpoint - Verify Chat Routes Migration
  - Ensure all tests pass, ask the user if questions arise.
  - Run `grep -r "app.locals.db" server/routes/chatRoutes.js server/routes/chatInboxRoutes.js` to verify no references remain

- [x] 4. Migrate Agent Chat Routes
  - [x] 4.1 Update `server/routes/agentChatRoutes.js` to use SupabaseService
    - Replace all `req.app.locals.db` references with SupabaseService
    - Update conversation queries, message operations, draft management
    - All services migrated to use SupabaseService directly
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 4.2 Write property test for agent drafts round-trip
    - **Property 6: Agent Drafts Round-Trip**
    - **Validates: Requirements 4.3**

- [x] 5. Migrate Agent Messaging Routes
  - [x] 5.1 Update `server/routes/agentMessagingRoutes.js` to use SupabaseService
    - Replace all `req.app.locals.db` references with SupabaseService
    - Update quota tracking, template management, campaign management, draft management
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 5.2 Write property test for agent templates round-trip
    - **Property 7: Agent Templates Round-Trip**
    - **Validates: Requirements 5.2**
  - [ ]* 5.3 Write property test for quota tracking consistency
    - **Property 8: Quota Tracking Consistency**
    - **Validates: Requirements 5.1**

- [x] 6. Migrate Agent Auth Routes
  - [x] 6.1 Update `server/routes/agentAuthRoutes.js` to use SupabaseService
    - Replace all `initServices(req.app.locals.db)` calls
    - Update AgentService to not require db parameter
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Checkpoint - Verify Agent Routes Migration
  - [x] agentAuthRoutes.js - fully migrated
  - [x] agentChatRoutes.js - fully migrated
  - [x] agentMessagingRoutes.js - fully migrated
  - [x] agentDataRoutes.js - fully migrated (uses DatabaseConnectionService, AgentDatabaseAccessService)
  - All agent routes now use SupabaseService directly

- [x] 8. Migrate Admin Routes
  - [x] 8.1 Update `server/routes/adminAutomationRoutes.js` to use SupabaseService
    - Replace `req.app.locals.db` with SupabaseService
    - Update AutomationService and AuditLogService initialization
    - _Requirements: 6.1_
  - [x] 8.2 Update `server/routes/adminRoutes.js` to use SupabaseService
    - Replace `req.app.locals.db` with SupabaseService
    - Update audit logging
    - _Requirements: 6.2_
  - [x] 8.3 Update `server/routes/adminReportRoutes.js` to use SupabaseService
    - Replace `req.app.locals.db` with SupabaseService
    - Update usage metrics queries
    - _Requirements: 6.3_
  - [x] 8.4 Update `server/routes/adminUserQuotaRoutes.js` to use SupabaseService
    - Replace `req.app.locals.db` with SupabaseService
    - Update QuotaService and AdminAuditService initialization
    - _Requirements: 6.4, 6.5_

- [x] 9. Migrate User Routes
  - [x] 9.1 Update `server/routes/userSubscriptionRoutes.js` to use SupabaseService
    - Replace `initServices(req.app.locals.db)` calls
    - Update SubscriptionService, QuotaService, FeatureFlagService initialization
    - _Requirements: 7.1_
  - [x] 9.2 Update `server/routes/userPlanRoutes.js` to use SupabaseService
    - Replace `req.app.locals.db` with SupabaseService
    - Update PlanService and SubscriptionService initialization
    - _Requirements: 7.2_
  - [x] 9.3 Update `server/routes/databaseContactRoutes.js` to use SupabaseService
    - Replace `req.app.locals.db` with SupabaseService
    - Update ContactFetcherService initialization
    - _Requirements: 7.3, 7.4_
  - [x] 9.4 Update `server/routes/userBotRoutes.js` to use SupabaseService
    - Replace all `req.app.locals.db` references
    - Use module-level service initialization (BotService, AutomationService, QuotaService)
    - _Requirements: 7.5_
  - [x] 9.5 Update `server/routes/userBotTestRoutes.js` to use SupabaseService
    - Replace all `req.app.locals.db` references
    - Use module-level service initialization
    - Convert raw SQL queries to SupabaseService
    - _Requirements: 7.6_
  - [x] 9.6 Update `server/routes/userDraftRoutes.js` to use SupabaseService
    - Replace all `db.query()` calls with SupabaseService methods
    - _Requirements: 7.7_

- [x] 10. Checkpoint - Verify Admin and User Routes Migration
  - [x] Admin routes fully migrated (Task 8)
  - [x] User bot routes migrated (userBotRoutes.js, userBotTestRoutes.js)
  - [x] User draft routes migrated (userDraftRoutes.js)
  - [x] User subscription routes migrated (userSubscriptionRoutes.js)
  - [x] User plan routes migrated (userPlanRoutes.js)
  - [x] Database contact routes migrated (databaseContactRoutes.js)
  - [x] Database routes migrated (databaseRoutes.js) - uses DatabaseConnectionService
  - [x] Bulk campaign routes migrated (bulkCampaignRoutes.js) - uses BulkCampaignService
  - [x] Agent data routes migrated (agentDataRoutes.js) - uses DatabaseConnectionService, AgentDatabaseAccessService
  - [x] User routes migrated (userRoutes.js) - uses UserDataService
  - [x] Session account routes migrated (sessionAccountRoutes.js) - uses module-level services
  - All routes now use SupabaseService directly

- [x] 11. Update Services to Remove db Parameter
  - [x] 11.1 Update PlanService to use SupabaseService directly
    - Remove db constructor parameter
    - Import SupabaseService at top of file
    - _Requirements: 9.1_
  - [x] 11.2 Update SubscriptionService to use SupabaseService directly
    - Remove db constructor parameter
    - Import SupabaseService at top of file
    - _Requirements: 9.2_
  - [x] 11.3 Update QuotaService to use SupabaseService directly
    - Remove db constructor parameter
    - Import SupabaseService at top of file
    - _Requirements: 9.3_
  - [x] 11.4 Update AutomationService to use SupabaseService directly
    - Remove db constructor parameter
    - Import SupabaseService at top of file
    - _Requirements: 9.4_
  - [x] 11.5 Update AuditLogService to use SupabaseService directly
    - Remove db constructor parameter
    - Import SupabaseService at top of file
    - _Requirements: 9.5_
  - [x] 11.6 Update AgentService to use SupabaseService directly
    - Remove db constructor parameter
    - Import SupabaseService at top of file
    - _Requirements: 9.6_
  - [x] 11.7 Update ContactFetcherService to use SupabaseService directly
    - Remove db constructor parameter
    - Import SupabaseService at top of file
    - _Requirements: 9.7_

- [x] 12. Update Property Test Files
  - [x] 12.1 Update property test files to not require Database compatibility layer
    - Update imports in `server/services/*.property.test.js` files
    - Replace `require('../database')` with SupabaseService mocks
    - _Requirements: 10.1, 10.2_
  - [ ]* 12.2 Write property test for no SQLite references
    - **Property 1: No SQLite References After Migration**
    - **Validates: Requirements 1.3, 2.4, 3.8, 4.4, 5.5, 6.5, 7.4, 8.4**
  - [ ]* 12.3 Write property test for no database.js imports
    - **Property 2: No Database.js Import After Migration**
    - **Validates: Requirements 1.4, 9.1-9.7**

- [x] 13. Checkpoint - Verify Services Migration
  - Ensure all tests pass, ask the user if questions arise.
  - Run `grep -r "constructor(db)" server/services/*.js` to verify no db parameters remain

- [x] 14. Clean Up Index.js
  - [x] 14.1 Remove database.js require from `server/index.js`
    - **COMPLETE**: All db usages removed from index.js
    - **Completed sub-tasks:**
      - [x] 14.1.1 Remove duplicate database connection routes from index.js (moved to databaseRoutes.js)
      - [x] 14.1.2 Create DatabaseConnectionService.js with SupabaseService methods
      - [x] 14.1.3 Migrate databaseRoutes.js to use DatabaseConnectionService
      - [x] 14.1.4 Create BulkCampaignService.js for campaign operations
      - [x] 14.1.5 Migrate bulkCampaignRoutes.js to use BulkCampaignService
      - [x] 14.1.6 Update health check to use SupabaseService.healthCheck()
      - [x] 14.1.7 Update branding cache to use SupabaseService directly
      - [x] 14.1.8 Update services (CampaignScheduler, etc.) to not require db parameter
        - [x] SingleMessageScheduler - migrated to SupabaseService
        - [x] CampaignScheduler - now receives null (uses SupabaseService internally)
        - [x] QueueManager - receives null from CampaignScheduler (never uses db)
        - [x] StateSynchronizer - now receives null (never uses db)
        - [x] AuditLogger - now receives null (never uses db)
        - [x] LogRotationService - now receives null (never uses db)
        - [x] ReportGenerator - migrated to SupabaseService (no db parameter)
        - [x] AgentDatabaseAccessService - migrated to SupabaseService (no db parameter)
      - [x] 14.1.9 Update WebSocket initialization to not require db parameter
      - [x] 14.1.10 Migrate userRoutes.js - uses UserDataService
      - [x] 14.1.11 Migrate sessionAccountRoutes.js - uses module-level services
      - [x] 14.1.12 Remove db.init(), app.locals.db, and db.close() calls
      - [x] 14.1.13 Migrate middleware files (agentAuth, featureEnforcement, quotaEnforcement, auth, permissionValidator)
      - [x] 14.1.14 Migrate branding module (BrandingRepository, BrandingController)
      - [x] 14.1.15 Migrate mediaRoutes.js to use QuotaService without db
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [ ]* 14.2 Write property test for index.js clean state
    - **Property 9: Index.js Clean State**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

- [x] 15. Delete Compatibility Layer
  - [x] 15.1 Delete `server/database.js`
    - **READY**: No production code references remain
    - Only test files and archived scripts reference database.js
    - Verify no remaining references in production codebase
    - Delete the file
    - _Requirements: 1.1_

- [x] 16. Final Checkpoint - Full System Verification
  - Ensure all tests pass, ask the user if questions arise.
  - Run `grep -r "app.locals.db\|require.*database" server/` to verify complete migration
  - Verify server starts without errors
  - Test key endpoints manually

- [x] 17. Migrate Remaining Services with this.db Usage
  - [x] 17.1 Migrate BotService.js to use SupabaseService directly
    - Removed constructor(db) parameter
    - Replaced all 32 this.db.query() calls with SupabaseService methods
    - Updated all instantiation sites to not pass null
  - [x] 17.2 Migrate AgentCampaignService.js to use SupabaseService directly
    - Removed constructor(db) parameter
    - Replaced all 14 this.db.query() calls with SupabaseService methods
  - [x] 17.3 Migrate AgentCampaignScheduler.js to use SupabaseService directly
    - Removed constructor(db) parameter
    - Updated to use migrated AgentCampaignService
  - [x] 17.4 Migrate ConversationAssignmentService.js to use SupabaseService directly
    - Removed constructor(db) parameter
    - Replaced all 13 this.db.query() calls with SupabaseService methods
  - [x] 17.5 Migrate AgentTemplateService.js to use SupabaseService directly
    - Removed constructor(db) parameter
    - Replaced all this.db.query() calls with SupabaseService methods
  - [x] 17.6 Migrate TestConversationService.js to use SupabaseService directly
    - Removed constructor(db) parameter
    - Replaced all this.db.query() calls with SupabaseService methods
  - [x] 17.7 Update QuotaService constructor to not require db parameter
  - [x] 17.8 Update AutomationService constructor to not require db parameter
  - [x] 17.9 Update all route files to instantiate services without null parameter
    - Updated ~30 service instantiations across all route files

## Remaining Services (Lower Priority)
All services have been fully migrated to use SupabaseService directly:

- [x] PermissionService.js - ✅ MIGRATED (15 this.db.query() calls converted)
- [x] CascadeDeleteService.js - ✅ MIGRATED (20+ this.db.query() calls converted)
- [x] VariationTracker.js - ✅ MIGRATED (6 this.db.query() calls converted)
- [x] UsageTrackingService.js - ✅ MIGRATED (4 this.db.query() calls converted)
- [x] CustomThemeService.js - ✅ MIGRATED (all this.db.query() calls converted)
- [x] WebhookAccountRouter.js - ✅ MIGRATED (all this.db.query() calls converted)
- [x] GroupNameResolver.js - ✅ MIGRATED (all this.db.query() calls converted)
- [x] UserRecordService.js - ✅ MIGRATED (this.db.getConnectionById() converted)
- [x] AnalyticsService.js - ✅ MIGRATED (constructor(db) removed)
- [x] FeatureFlagService.js - ✅ MIGRATED (constructor(db) removed)
- [x] AuditLogService.js - ✅ MIGRATED (constructor(db) removed)
- [x] ContactFetcherService.js - ✅ MIGRATED (constructor(db) removed)
- [x] SubscriptionService.js - ✅ MIGRATED (constructor(db) removed)
- [x] SubscriptionEnsurer.js - ✅ MIGRATED (constructor(db) removed)
- [x] AdminAuditService.js - ✅ MIGRATED (constructor(db) removed)
- [x] MultiUserAuditService.js - ✅ MIGRATED (constructor(db) removed)
- [x] AgentSessionService.js - ✅ MIGRATED (constructor(db) removed)
- [x] CampaignScheduler.js - ✅ MIGRATED (constructor(db) removed)
- [x] SingleMessageScheduler.js - ✅ MIGRATED (constructor(db) removed)
- [x] LogRotationService.js - ✅ MIGRATED (constructor(db) removed)
- [x] StateSynchronizer.js - ✅ MIGRATED (constructor(db) removed)
- [x] QueueManager.js - ✅ MIGRATED (constructor(db) removed)

## Route Files with initServices Pattern (Remaining)
The following route files still use the `initServices(req.app.get('db'))` pattern but services are already migrated:
- accountInboxRoutes.js - InboxService already uses SupabaseService
- accountRoleRoutes.js - PermissionService already uses SupabaseService
- accountAgentRoutes.js - AgentService already uses SupabaseService
- accountTeamRoutes.js - TeamService already uses SupabaseService

These routes can be cleaned up by removing the initServices pattern and using module-level service instances.

## Migration Complete Summary
- ✅ All services now use SupabaseService directly
- ✅ No more `constructor(db)` parameters in services
- ✅ No more `this.db` references in services
- ✅ No more `req.app.locals.db` or `req.app.get('db')` references in routes
- ✅ No more `initServices(req.app.get('db'))` pattern in routes
- ✅ server/database.js compatibility layer has been removed
- ✅ All route files updated to use module-level service instances

## Final Verification (December 23, 2025)
Grep searches confirmed:
- `this.db` in services: 0 matches
- `constructor(db)` in services: 0 matches
- `req.app.locals.db` in routes: 0 matches
- `req.app.get('db')` in routes: 0 matches
- `new Service(db)` in routes: 0 matches
- `class MockDatabase` in tests (non-archived): 0 matches
- `new Service(null)` in tests (non-archived): 0 matches

## Test Files Updated (December 23, 2025)
The following test files were updated to use SupabaseService mocking instead of MockDatabase:
- `server/tests/services/QuotaService.property.test.js`
- `server/tests/services/SubscriptionService.property.test.js`
- `server/tests/services/PlanService.property.test.js`
- `server/tests/services/UserActions.property.test.js`
- `server/tests/services/WebhookAccountRouter.tenant.test.js`
- `server/tests/services/InboxService.test.js`

The SQLite to Supabase migration is 100% complete.

## Post-Migration Cleanup (December 23, 2025)

- [x] 18. Clean Up Obsolete Code and Documentation
  - [x] 18.1 Remove archived SQLite test folders
    - `server/tests/integration/archived-sqlite-tests/`
    - `server/webhooks/archived-sqlite-tests/`
    - `server/scripts/archived-sqlite-scripts/`
    - `server/services/archived-sqlite-tests/`
    - `server/tests/routes/archived-sqlite-tests/`
    - `server/migrations-sqlite-archived/`
    - `server/tests/archived-sqlite-tests/`
  - [x] 18.2 Remove `server/scripts/verify-sqlite-removal.js`
  - [x] 18.3 Archive migration scripts (no longer needed)
    - Moved to `server/scripts/archived-migration-scripts/`:
      - `migrate-to-supabase.js`
      - `verify-migration.js`
      - `verify-data-consistency.js`
  - [x] 18.4 Update `server/README.md` with Supabase-only architecture
  - [x] 18.5 Update test files to remove MockDatabase pattern
    - Updated 6 test files to use SupabaseService mocking
  - [x] 18.6 Update documentation to remove SQLite references
    - Updated: `docs/QUALITY_CHECKLIST.md`
    - Updated: `docs/DYNAMIC_SIDEBAR_NAVIGATION_TECHNICAL.md`
    - Updated: `docs/table-permissions-implementation-summary.md`
    - Updated: `docs/MONITORING.md`
    - Updated: `docs/DEPLOYMENT_SCRIPTS.md`
    - Updated: `docs/USER_DATABASE_NAVIGATION_GUIDE.md`
    - Updated: `docs/DEVELOPMENT_GUIDE.md`
    - Updated: `docs/examples/README.md`
    - Updated: `docs/guides/PROJECT_STRUCTURE.md`
    - Updated: `docs/DOCKER_SWARM_CHEATSHEET.md`
    - Updated: `docs/DOCKER.md`
    - Updated: `docs/api/README.md`
    - Updated: `docs/api/error-codes.md`
    - Updated: `docs/table-permissions-api.md`
    - Updated: `docs/SECURITY_IMPLEMENTATION.md`
    - Updated: `docs/NETWORK_ARCHITECTURE.md`
    - Archived (moved to `docs/archived/`):
      - `BACKEND_DATA_INTEGRATIONS_GUIDE.md`
      - `SECURITY_AUDIT.md`
      - `MODERNIZATION_SUMMARY.md`
      - `examples/tutorial-grupos.md`
      - `guides/ESPECIFICACAO_PRODUTO.md`
      - `DOCKER_DATABASE_CONFIG.md`
      - `DYNAMIC_SIDEBAR_QUICK_REFERENCE.md`
      - `DYNAMIC_SIDEBAR_ARCHITECTURE.md`
      - `development/CHANGELOG_USER_DASHBOARD.md`
      - `development/CHANGELOG_MESSAGES_MODERNIZATION.md`
      - `guides/QUICK_REFERENCE.md`
      - `FAQ.md`
      - `DEPLOY.md`
      - `TROUBLESHOOTING.md`
      - `DEVELOPMENT_VS_DOCKER.md`
      - `BACKEND_ENDPOINT_TEMPLATES_GUIDE.md`
      - `ManualdeEngenharia.md`
      - `custom-home-page-editor-technical.md`
      - `releases/RELEASE_NOTES_v1.5.1.md`
  - [x] 18.7 Create README for archived docs folder
  - [x] 18.8 Create README for archived migration scripts folder

## Migration Complete ✅

The SQLite to Supabase migration is 100% complete as of December 23, 2025.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Migration is incremental - each step should leave the system in a working state
