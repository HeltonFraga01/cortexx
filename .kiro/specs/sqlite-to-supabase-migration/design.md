# Design Document: SQLite to Supabase Migration

## Overview

Este documento descreve a estratégia de migração para eliminar completamente o compatibility layer SQLite (`server/database.js`) e fazer com que todo o código use diretamente o `SupabaseService`. A migração será incremental para garantir que o sistema permaneça funcional durante todo o processo.

## Architecture

### Current State (Before Migration)

```
┌─────────────────────────────────────────────────────────────┐
│                     Route Files                              │
│  (chatRoutes, agentChatRoutes, adminRoutes, etc.)           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  app.locals.db                               │
│              (Compatibility Layer)                           │
│                server/database.js                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SupabaseService                            │
│           server/services/SupabaseService.js                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase                                │
│                   (PostgreSQL)                               │
└─────────────────────────────────────────────────────────────┘
```

### Target State (After Migration)

```
┌─────────────────────────────────────────────────────────────┐
│                     Route Files                              │
│  (chatRoutes, agentChatRoutes, adminRoutes, etc.)           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SupabaseService                            │
│           server/services/SupabaseService.js                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase                                │
│                   (PostgreSQL)                               │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### SupabaseService (Existing)

O `SupabaseService` já fornece todos os métodos necessários para operações de banco de dados:

```javascript
// server/services/SupabaseService.js
const SupabaseService = {
  // Query methods
  getById(table, id),
  getMany(table, filters, options),
  queryAsAdmin(table, queryBuilder),
  
  // Mutation methods
  insert(table, data),
  update(table, id, data),
  delete(table, id),
  
  // Utility methods
  healthCheck(),
  count(table, filters),
  
  // Direct client access
  adminClient  // For complex queries
};
```

### Migration Pattern

Para cada arquivo que usa `app.locals.db`, aplicar o seguinte padrão:

**Before:**
```javascript
const db = req.app.locals.db;
const result = await db.query('SELECT * FROM contacts WHERE id = ?', [id]);
```

**After:**
```javascript
const SupabaseService = require('../services/SupabaseService');
const { data, error } = await SupabaseService.getById('contacts', id);
if (error) throw error;
```

### Files to Migrate

| File | Priority | Complexity | Dependencies |
|------|----------|------------|--------------|
| `server/routes/chatRoutes.js` | High | Medium | SupabaseService |
| `server/routes/chatInboxRoutes.js` | High | High | SupabaseService, ChatService |
| `server/routes/agentChatRoutes.js` | High | High | SupabaseService, AgentService |
| `server/routes/agentMessagingRoutes.js` | High | High | SupabaseService, QuotaService |
| `server/routes/agentAuthRoutes.js` | High | Medium | SupabaseService, AgentService |
| `server/routes/adminAutomationRoutes.js` | Medium | Medium | SupabaseService, AutomationService |
| `server/routes/adminRoutes.js` | Medium | Medium | SupabaseService, AuditLogService |
| `server/routes/adminReportRoutes.js` | Medium | Medium | SupabaseService |
| `server/routes/adminUserQuotaRoutes.js` | Medium | Low | SupabaseService, QuotaService |
| `server/routes/userSubscriptionRoutes.js` | Medium | Medium | SupabaseService, SubscriptionService |
| `server/routes/userPlanRoutes.js` | Medium | Low | SupabaseService, PlanService |
| `server/routes/databaseContactRoutes.js` | Low | Low | SupabaseService |
| `server/index.js` | Final | Low | None |
| `server/database.js` | Final | N/A | Delete |

## Data Models

As tabelas já existem no Supabase. Não há mudanças de schema necessárias.

### Key Tables Used

- `contacts` - Contact information
- `contact_attributes` - Custom contact attributes
- `contact_notes` - Notes on contacts
- `conversations` - Chat conversations
- `chat_messages` - Messages in conversations
- `agents` - Agent users
- `agent_sessions` - Agent authentication sessions
- `agent_drafts` - Agent message drafts
- `agent_templates` - Agent message templates
- `agent_campaigns` - Agent bulk campaigns
- `macros` - Automation macros
- `sent_messages` - Message history
- `user_subscriptions` - User subscription data
- `user_quota_usage` - Quota tracking
- `automation_audit_log` - Automation logs
- `audit_log` - General audit log

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No SQLite References After Migration

*For any* file in the `server/routes/` directory, after migration, the file SHALL NOT contain any reference to `app.locals.db` or `req.app.locals.db`.

**Validates: Requirements 1.3, 2.4, 3.8, 4.4, 5.5, 6.5, 7.4, 8.4**

### Property 2: No Database.js Import After Migration

*For any* file in the `server/` directory (excluding `database.js` itself), after migration, the file SHALL NOT import or require `./database` or `../database`.

**Validates: Requirements 1.4, 9.1-9.7**

### Property 3: Message Logging Round-Trip

*For any* valid message sent via chatRoutes, if the message is logged to Supabase, then querying the `sent_messages` table with the same account_id and timestamp range SHALL return the logged message.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Contact Attributes Round-Trip

*For any* valid contact attribute created via chatInboxRoutes, if the attribute is inserted into Supabase, then querying the `contact_attributes` table with the same conversation_id SHALL return the created attribute.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Contact Notes Round-Trip

*For any* valid contact note created via chatInboxRoutes, if the note is inserted into Supabase, then querying the `contact_notes` table with the same conversation_id SHALL return the created note.

**Validates: Requirements 3.4, 3.5**

### Property 6: Agent Drafts Round-Trip

*For any* valid agent draft created via agentChatRoutes or agentMessagingRoutes, if the draft is inserted into Supabase, then querying the `agent_drafts` table with the same agent_id and conversation_id SHALL return the created draft.

**Validates: Requirements 4.3, 5.4**

### Property 7: Agent Templates Round-Trip

*For any* valid agent template created via agentMessagingRoutes, if the template is inserted into Supabase, then querying the `agent_templates` table with the same agent_id SHALL return the created template.

**Validates: Requirements 5.2**

### Property 8: Quota Tracking Consistency

*For any* message sent via agentMessagingRoutes, the quota usage in `user_quota_usage` table SHALL be incremented by the correct amount for the account.

**Validates: Requirements 5.1**

### Property 9: Index.js Clean State

*For any* valid server startup, the `server/index.js` file SHALL NOT set `app.locals.db` and SHALL only use `app.locals.supabase` for database access.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

## Error Handling

### Database Errors

All database operations should follow this pattern:

```javascript
try {
  const { data, error } = await SupabaseService.getById('table', id);
  if (error) {
    logger.error('Database operation failed', { 
      table: 'table', 
      operation: 'getById', 
      error: error.message 
    });
    throw new Error(`Database error: ${error.message}`);
  }
  return data;
} catch (error) {
  logger.error('Unexpected error', { error: error.message });
  throw error;
}
```

### Migration Errors

If a migration step fails:
1. Log the error with full context
2. Do not proceed to the next step
3. Rollback changes if possible
4. Notify the developer

## Testing Strategy

### Unit Tests

- Test each migrated route endpoint individually
- Mock SupabaseService for isolated testing
- Verify correct method calls and parameters

### Property-Based Tests

- Use fast-check for property-based testing
- Test round-trip properties for CRUD operations
- Test invariants (no SQLite references)

### Integration Tests

- Test full request/response cycle
- Use real Supabase connection (test database)
- Verify data persistence

### Regression Tests

- Run existing test suite after each migration step
- Ensure no functionality is broken
- Compare behavior before and after migration

### Test Configuration

- Property tests: minimum 100 iterations
- Use Vitest for frontend tests
- Use Node test runner for backend tests
- Tag format: **Feature: sqlite-to-supabase-migration, Property {number}: {property_text}**
