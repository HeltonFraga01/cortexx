# Requirements Document

## Introduction

Este documento define os requisitos para a migração completa do sistema de SQLite para Supabase. O objetivo é eliminar toda referência ao SQLite e ao compatibility layer (`server/database.js`), fazendo com que todo o código use diretamente o `SupabaseService`.

## Glossary

- **SupabaseService**: Serviço de abstração para operações no banco de dados Supabase (`server/services/SupabaseService.js`)
- **Compatibility_Layer**: Arquivo `server/database.js` que atualmente roteia chamadas SQLite para Supabase
- **Route_File**: Arquivo de rotas Express em `server/routes/`
- **Service_File**: Arquivo de serviço em `server/services/`
- **app.locals.db**: Referência global ao compatibility layer disponibilizada pelo Express

## Requirements

### Requirement 1: Eliminar Compatibility Layer

**User Story:** As a developer, I want to remove the database compatibility layer, so that the codebase is cleaner and uses Supabase directly.

#### Acceptance Criteria

1. THE System SHALL remove the file `server/database.js` after all references are migrated
2. THE System SHALL remove the `app.locals.db` initialization from `server/index.js`
3. THE System SHALL update all route files to use `SupabaseService` directly instead of `app.locals.db`
4. THE System SHALL update all service files to use `SupabaseService` directly instead of the compatibility layer

### Requirement 2: Migrate Chat Routes

**User Story:** As a developer, I want chat routes to use Supabase directly, so that message operations are consistent with the rest of the system.

#### Acceptance Criteria

1. WHEN sending a text message, THE chatRoutes SHALL use SupabaseService to log the sent message
2. WHEN sending an image message, THE chatRoutes SHALL use SupabaseService to log the sent message
3. WHEN fetching message history, THE chatRoutes SHALL query SupabaseService directly
4. THE chatRoutes SHALL NOT reference `app.locals.db` or `req.app.locals.db`

### Requirement 3: Migrate Chat Inbox Routes

**User Story:** As a developer, I want chat inbox routes to use Supabase directly, so that conversation and contact operations are consistent.

#### Acceptance Criteria

1. WHEN fetching contact attributes, THE chatInboxRoutes SHALL query SupabaseService directly
2. WHEN creating contact attributes, THE chatInboxRoutes SHALL insert via SupabaseService
3. WHEN updating contact attributes, THE chatInboxRoutes SHALL update via SupabaseService
4. WHEN fetching contact notes, THE chatInboxRoutes SHALL query SupabaseService directly
5. WHEN creating contact notes, THE chatInboxRoutes SHALL insert via SupabaseService
6. WHEN fetching macros, THE chatInboxRoutes SHALL query SupabaseService directly
7. WHEN updating conversation avatar, THE chatInboxRoutes SHALL update via SupabaseService
8. THE chatInboxRoutes SHALL NOT reference `app.locals.db` or `req.app.locals.db`

### Requirement 4: Migrate Agent Chat Routes

**User Story:** As a developer, I want agent chat routes to use Supabase directly, so that agent operations are consistent.

#### Acceptance Criteria

1. WHEN fetching agent conversations, THE agentChatRoutes SHALL query SupabaseService directly
2. WHEN sending agent messages, THE agentChatRoutes SHALL use SupabaseService for all database operations
3. WHEN managing agent drafts, THE agentChatRoutes SHALL use SupabaseService
4. THE agentChatRoutes SHALL NOT reference `app.locals.db` or `req.app.locals.db`

### Requirement 5: Migrate Agent Messaging Routes

**User Story:** As a developer, I want agent messaging routes to use Supabase directly, so that messaging operations are consistent.

#### Acceptance Criteria

1. WHEN sending messages via agent, THE agentMessagingRoutes SHALL use SupabaseService for quota tracking
2. WHEN managing agent templates, THE agentMessagingRoutes SHALL use SupabaseService
3. WHEN managing agent campaigns, THE agentMessagingRoutes SHALL use SupabaseService
4. WHEN managing agent drafts, THE agentMessagingRoutes SHALL use SupabaseService
5. THE agentMessagingRoutes SHALL NOT reference `app.locals.db` or `req.app.locals.db`

### Requirement 6: Migrate Admin Routes

**User Story:** As a developer, I want admin routes to use Supabase directly, so that administrative operations are consistent.

#### Acceptance Criteria

1. WHEN fetching automation settings, THE adminAutomationRoutes SHALL use SupabaseService
2. WHEN logging audit events, THE adminRoutes SHALL use SupabaseService
3. WHEN fetching usage reports, THE adminReportRoutes SHALL use SupabaseService
4. WHEN managing user quotas, THE adminUserQuotaRoutes SHALL use SupabaseService
5. THE admin routes SHALL NOT reference `app.locals.db` or `req.app.locals.db`

### Requirement 7: Migrate User Routes

**User Story:** As a developer, I want user routes to use Supabase directly, so that user operations are consistent.

#### Acceptance Criteria

1. WHEN fetching user subscription, THE userSubscriptionRoutes SHALL use SupabaseService
2. WHEN fetching user plans, THE userPlanRoutes SHALL use SupabaseService
3. WHEN fetching database contacts, THE databaseContactRoutes SHALL use SupabaseService
4. THE user routes SHALL NOT reference `app.locals.db` or `req.app.locals.db`

### Requirement 8: Migrate Agent Auth Routes

**User Story:** As a developer, I want agent authentication routes to use Supabase directly, so that auth operations are consistent.

#### Acceptance Criteria

1. WHEN authenticating agents, THE agentAuthRoutes SHALL use SupabaseService
2. WHEN managing agent sessions, THE agentAuthRoutes SHALL use SupabaseService
3. WHEN handling password reset, THE agentAuthRoutes SHALL use SupabaseService
4. THE agentAuthRoutes SHALL NOT reference `app.locals.db` or `req.app.locals.db`

### Requirement 9: Update Services to Use SupabaseService Directly

**User Story:** As a developer, I want all services to use SupabaseService directly, so that there is no dependency on the compatibility layer.

#### Acceptance Criteria

1. THE PlanService SHALL use SupabaseService directly instead of receiving db as constructor parameter
2. THE SubscriptionService SHALL use SupabaseService directly instead of receiving db as constructor parameter
3. THE QuotaService SHALL use SupabaseService directly instead of receiving db as constructor parameter
4. THE AutomationService SHALL use SupabaseService directly instead of receiving db as constructor parameter
5. THE AuditLogService SHALL use SupabaseService directly instead of receiving db as constructor parameter
6. THE AgentService SHALL use SupabaseService directly instead of receiving db as constructor parameter
7. THE ContactFetcherService SHALL use SupabaseService directly instead of receiving db as constructor parameter

### Requirement 10: Remove SQLite Test Files

**User Story:** As a developer, I want to remove SQLite-related test files, so that the test suite reflects the current architecture.

#### Acceptance Criteria

1. THE System SHALL update property test files to not require the Database compatibility layer
2. THE System SHALL ensure all tests use SupabaseService mocks or direct Supabase connections
3. THE System SHALL remove any SQLite-specific test utilities

### Requirement 11: Clean Up Index.js

**User Story:** As a developer, I want server/index.js to not reference SQLite or the compatibility layer, so that the entry point is clean.

#### Acceptance Criteria

1. THE index.js SHALL NOT require `./database`
2. THE index.js SHALL NOT set `app.locals.db`
3. THE index.js SHALL only initialize SupabaseService for database operations
4. THE index.js SHALL maintain `app.locals.supabase` for routes that need direct access

### Requirement 12: Maintain Backward Compatibility During Migration

**User Story:** As a developer, I want the migration to be incremental, so that the system remains functional during the transition.

#### Acceptance Criteria

1. WHEN migrating a route file, THE System SHALL ensure all endpoints continue to function correctly
2. WHEN migrating a service, THE System SHALL ensure all dependent routes continue to function correctly
3. THE System SHALL run existing tests after each migration step to verify functionality
