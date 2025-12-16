# Implementation Plan

## Phase 1: Backup and Preparation

- [x] 1. Create backup and archive SQLite files
  - [x] 1.1 Archive server/migrations/ directory to server/migrations-sqlite-archived/
    - Move all 81 migration files to archived folder
    - Keep for historical reference
    - _Requirements: 1.3_
  - [x] 1.2 Create backup of database.js before removal
    - Save to docs/archived/database-sqlite.js.bak
    - _Requirements: 1.1_

## Phase 2: Service Consolidation

- [x] 2. Consolidate Supabase services
  - [x] 2.1 Rename AccountServiceSupabase.js to AccountService.js
    - Delete original AccountService.js (SQLite version)
    - Update internal class name from AccountServiceSupabase to AccountService
    - Update module.exports
    - _Requirements: 7.1_
  - [x] 2.2 Rename AgentServiceSupabase.js to AgentService.js
    - Delete original AgentService.js (SQLite version)
    - Update internal class name
    - _Requirements: 7.1_
  - [x] 2.3 Rename ChatServiceSupabase.js to ChatService.js
    - Delete original ChatService.js (SQLite version)
    - Update internal class name
    - _Requirements: 7.1_
  - [x] 2.4 Rename ConversationInboxServiceSupabase.js to ConversationInboxService.js
    - Delete original ConversationInboxService.js (SQLite version)
    - Update internal class name
    - _Requirements: 7.1_
  - [x] 2.5 Rename PlanServiceSupabase.js to PlanService.js
    - Delete original PlanService.js (SQLite version)
    - Update internal class name
    - _Requirements: 7.1_
  - [x] 2.6 Update server/services/supabase/index.js
    - Remove "Supabase" suffix from exports
    - Update import paths
    - _Requirements: 7.5_
  - [ ]* 2.7 Write property test for single service implementation
    - **Property 5: Single Service Implementation**
    - **Validates: Requirements 7.1, 7.4**

- [x] 3. Update service imports in routes
  - [x] 3.1 Update all route files to use consolidated service names
    - Search and replace ServiceSupabase → Service in imports
    - Update server/routes/*.js files
    - _Requirements: 7.3_
  - [ ]* 3.2 Write property test for consolidated service imports
    - **Property 6: Consolidated Service Imports**
    - **Validates: Requirements 7.3**

- [x] 4. Checkpoint - Verify service consolidation
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Remove SQLite Code

- [x] 5. Remove SQLite core files
  - [x] 5.1 Delete server/database.js
    - _Requirements: 1.1_
  - [x] 5.2 Delete server/config/sqlite.js
    - _Requirements: 1.2_
  - [x] 5.3 Delete server/services/DatabaseBackend.js
    - _Requirements: 1.4_
  - [x] 5.4 Update server/index.js to remove database.js initialization
    - Remove require('./database')
    - Remove db initialization code
    - Remove app.locals.db assignment
    - _Requirements: 1.5_
  - [ ]* 5.5 Write property test for no SQLite code references
    - **Property 1: No SQLite Code References**
    - **Validates: Requirements 1.5, 1.6**

- [x] 6. Update remaining files with SQLite references
  - [x] 6.1 Update server/routes/userWebhookRoutes.js
    - Replace req.app.locals.db with SupabaseService
    - _Requirements: 1.5_
  - [x] 6.2 Update server/services/SessionMappingService.js
    - Already uses SupabaseService (verified)
    - _Requirements: 1.5_
  - [x] 6.3 Update server/services/AuditLogger.js
    - Already uses SupabaseService (verified)
    - _Requirements: 1.5_
  - [x] 6.4 Update server/webhooks/chatMessageHandler.js
    - Already uses SupabaseService (verified)
    - _Requirements: 1.5_
  - [x] 6.5 Update server/services/UserRecordService.js
    - No SQLITE case exists - only handles external DBs (NocoDB, MySQL, PostgreSQL)
    - _Requirements: 1.5_
  - [x] 6.6 Update templates/backend/*.js files
    - No SQLite references found in templates
    - _Requirements: 1.5_

- [x] 7. Checkpoint - Verify SQLite code removal
  - Many route files still use req.app.locals.db pattern
  - Need to update remaining routes before proceeding to Phase 4

## Phase 4: Remove Dependencies

- [x] 8. Remove npm dependencies
  - [x] 8.1 Remove better-sqlite3 from server/package.json
    - Run: npm uninstall better-sqlite3 --save
    - _Requirements: 2.1_
  - [x] 8.2 Remove sqlite3 from server/package.json (if present)
    - Run: npm uninstall sqlite3 --save
    - _Requirements: 2.2_
  - [x] 8.3 Regenerate package-lock.json
    - Run: rm -rf node_modules && npm install
    - Verify no SQLite bindings in node_modules
    - _Requirements: 2.4, 2.5_

## Phase 5: Clean Environment Configuration

- [x] 9. Update environment files
  - [x] 9.1 Remove SQLite variables from .env.example
    - Remove SQLITE_DB_PATH, SQLITE_WAL_MODE, SQLITE_TIMEOUT, etc.
    - Remove USE_SUPABASE, DUAL_WRITE_MODE, DATABASE_BACKEND
    - _Requirements: 3.1, 3.5_
  - [x] 9.2 Remove SQLite variables from .env.docker.example
    - _Requirements: 3.1, 3.5_
  - [x] 9.3 Remove SQLite variables from .env.production.example
    - _Requirements: 3.1, 3.5_
  - [x] 9.4 Remove SQLite variables from server/.env.example
    - _Requirements: 3.1, 3.5_
  - [x] 9.5 Update .env.docker to remove SQLite config
    - _Requirements: 3.3_
  - [ ]* 9.6 Write property test for no SQLite environment variables
    - **Property 2: No SQLite Environment Variables**
    - **Validates: Requirements 3.1, 3.5**

- [x] 10. Update Docker configuration
  - [x] 10.1 Update docker-compose.yml
    - Remove data/ volume mount for SQLite
    - Remove SQLite environment variables
    - _Requirements: 3.4, 5.5_
  - [x] 10.2 Update docker-compose.local.yml
    - Remove SQLite references
    - _Requirements: 3.4, 5.5_
  - [x] 10.3 Update Dockerfile
    - Remove any SQLite-specific build steps
    - _Requirements: 3.3_

## Phase 6: Update Documentation

- [x] 11. Update main documentation
  - [x] 11.1 Update README.md
    - Remove SQLite mentions
    - Update architecture description to Supabase-only
    - _Requirements: 4.1_
  - [x] 11.2 Update docs/CONFIGURATION.md
    - Remove SQLite configuration section
    - Keep only Supabase configuration
    - _Requirements: 4.2_
  - [x] 11.3 Archive docs/adr/001-sqlite-over-postgres.md
    - Move to docs/adr/archived/
    - Add note about migration to Supabase
    - _Requirements: 4.4_

- [x] 12. Update steering files
  - [x] 12.1 Update .kiro/steering/tech.md
    - Remove SQLite from stack overview
    - Remove SQLite WAL mode mentions
    - Update database layer to Supabase only
    - _Requirements: 4.3_
  - [x] 12.2 Update .kiro/steering/project-overview.md
    - Remove SQLite architecture references
    - Update to Supabase-only architecture
    - _Requirements: 4.3_
  - [x] 12.3 Update .kiro/steering/product.md
    - Remove any SQLite references
    - _Requirements: 4.3_
  - [ ]* 12.4 Write property test for no SQLite references in steering files
    - **Property 3: No SQLite References in Steering Files**
    - **Validates: Requirements 4.3**

## Phase 7: Clean Database Files

- [x] 13. Clean database files and directories
  - [x] 13.1 Update .gitignore for database files
    - Ensure *.db, *.db-shm, *.db-wal are ignored
    - _Requirements: 5.1, 5.2_
  - [x] 13.2 Remove committed .db files from repository
    - Remove wuzapi.db, server/wuzapi.db, data/wuzapi.db
    - Remove test database files (test-*.db)
    - _Requirements: 5.3_
  - [x] 13.3 Remove or repurpose data/ directory
    - Remove if only used for SQLite
    - Or repurpose for other data storage
    - _Requirements: 5.4_

## Phase 8: Clean Tests

- [x] 14. Remove SQLite-specific tests
  - [x] 14.1 Remove server/services/MultiUserAuditService.property.test.js SQLite setup
    - Remove TEST_DB_PATH and SQLite database creation
    - Update to use Supabase mocks
    - _Requirements: 6.1_
  - [x] 14.2 Update server/services/AuditLogger.test.js
    - Remove SQLite mock database
    - Update to use Supabase mocks
    - _Requirements: 6.2_
  - [x] 14.3 Remove server/tests/migration/backward-compatibility.property.test.js
    - Tests dual-write which is no longer needed
    - _Requirements: 6.5_
  - [x] 14.4 Update src/test/templates/*.js
    - Remove SQLITE type references
    - Update test fixtures
    - _Requirements: 6.2_
  - [ ]* 14.5 Write property test for no SQLite test dependencies
    - **Property 4: No SQLite Test Dependencies**
    - **Validates: Requirements 6.1, 6.2**

- [x] 15. Checkpoint - Verify test cleanup
  - Ensure all tests pass, ask the user if questions arise.

## Phase 9: Final Verification

- [x] 16. Run verification script
  - [x] 16.1 Create server/scripts/verify-sqlite-removal.js
    - Check no SQLite files exist
    - Check no SQLite imports in code
    - Check no SQLite in package.json
    - Check no SQLite env vars in .env files
    - _Requirements: 1.6_
  - [x] 16.2 Run full test suite
    - npm run test:run
    - Verify all tests pass without SQLite
    - _Requirements: 6.4_
  - [x] 16.3 Run grep verification
    - grep -r "sqlite" server/ --include="*.js" should return empty
    - grep -r "SQLITE" . --include=".env*" should return empty
    - _Requirements: 1.6_

- [x] 17. Final Checkpoint - Complete SQLite removal verification
  - Ensure all tests pass, ask the user if questions arise.

