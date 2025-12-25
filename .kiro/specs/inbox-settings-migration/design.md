# Design Document: Inbox Settings Migration

## Overview

Este documento descreve o design técnico para migrar configurações de webhooks de chat da página de Settings para a página de edição de inbox. A migração envolve:

1. Alteração do schema do banco de dados (adicionar `inbox_id` à tabela `outgoing_webhooks`)
2. Atualização do serviço backend (`OutgoingWebhookService`)
3. Atualização das rotas de API (`userWebhookRoutes`)
4. Criação de novos componentes frontend
5. Remoção de código legado da página de Settings

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  UserSettings.tsx                    UserInboxEditPage.tsx               │
│  ├── Conta                           ├── Informações da Conexão          │
│  ├── Assinatura                      ├── Controle de Conexão             │
│  ├── Notificações                    ├── WebhookConfigCard (WUZAPI)      │
│  ├── Bots (gerenciamento)            ├── ChatIntegrationSection (NEW)    │
│  ├── Etiquetas                       │   ├── IncomingWebhookConfig       │
│  └── Respostas                       │   └── OutgoingWebhookList         │
│                                      └── Bot Assignment                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Backend (Express)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  userWebhookRoutes.js                                                    │
│  ├── GET  /api/user/outgoing-webhooks?inboxId=xxx                       │
│  ├── POST /api/user/outgoing-webhooks (body: { inboxId, url, events })  │
│  ├── PUT  /api/user/outgoing-webhooks/:id                               │
│  ├── DELETE /api/user/outgoing-webhooks/:id                             │
│  └── POST /api/user/outgoing-webhooks/:id/test                          │
│                                                                          │
│  OutgoingWebhookService.js                                               │
│  ├── configureWebhook(userId, { inboxId, url, events })                 │
│  ├── getWebhooks(userId, inboxId?)                                      │
│  ├── sendWebhookEvent(userId, inboxId, eventType, payload)              │
│  └── validateInboxOwnership(userId, inboxId)                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Database (Supabase)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  outgoing_webhooks                                                       │
│  ├── id (uuid, PK)                                                       │
│  ├── account_id (uuid, FK → accounts)                                   │
│  ├── user_id (text)                                                      │
│  ├── inbox_id (uuid, FK → inboxes, nullable) ← NEW                      │
│  ├── name (text)                                                         │
│  ├── url (text)                                                          │
│  ├── secret (text)                                                       │
│  ├── events (text[])                                                     │
│  ├── is_active (boolean)                                                 │
│  ├── success_count, failure_count (int)                                 │
│  └── last_delivery_at, last_error (timestamp, text)                     │
│                                                                          │
│  Indexes:                                                                │
│  ├── idx_outgoing_webhooks_inbox_id ON inbox_id                         │
│  └── idx_outgoing_webhooks_user_inbox ON (user_id, inbox_id)            │
│                                                                          │
│  Constraints:                                                            │
│  └── unique_user_inbox_url ON (user_id, inbox_id, url)                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Database Migration

```sql
-- Migration: add_inbox_id_to_outgoing_webhooks

-- 1. Add inbox_id column (nullable for backward compatibility)
ALTER TABLE outgoing_webhooks 
ADD COLUMN inbox_id uuid REFERENCES inboxes(id) ON DELETE CASCADE;

-- 2. Create index for performance
CREATE INDEX idx_outgoing_webhooks_inbox_id ON outgoing_webhooks(inbox_id);

-- 3. Create composite index for common query pattern
CREATE INDEX idx_outgoing_webhooks_user_inbox ON outgoing_webhooks(user_id, inbox_id);

-- 4. Add unique constraint to prevent duplicates
ALTER TABLE outgoing_webhooks 
ADD CONSTRAINT unique_user_inbox_url UNIQUE (user_id, inbox_id, url);
```

### Backend Service Updates

```javascript
// OutgoingWebhookService.js - Updated methods

/**
 * Configure a new webhook with inbox context
 * @param {string} userId - User ID
 * @param {Object} data - Webhook configuration
 * @param {string} [data.inboxId] - Inbox ID (optional for legacy)
 * @returns {Promise<Object>} Created webhook
 */
async configureWebhook(userId, data) {
  const { url, events = [], secret = null, inboxId = null } = data

  // Validate inbox ownership if inboxId provided
  if (inboxId) {
    await this.validateInboxOwnership(userId, inboxId)
  }

  const webhookData = {
    user_id: userId,
    inbox_id: inboxId,
    url,
    events: JSON.stringify(events),
    secret: secret || this.generateSecret(),
    is_active: true
  }

  // ... rest of implementation
}

/**
 * Get webhooks filtered by inbox
 * @param {string} userId - User ID
 * @param {string} [inboxId] - Inbox ID (null for legacy webhooks)
 * @returns {Promise<Array>} Webhooks
 */
async getWebhooks(userId, inboxId = undefined) {
  let query = supabaseService.queryAsAdmin('outgoing_webhooks', (q) =>
    q.select('*').eq('user_id', userId)
  )

  if (inboxId !== undefined) {
    // Filter by specific inbox (or NULL for legacy)
    if (inboxId === null) {
      query = query.is('inbox_id', null)
    } else {
      query = query.eq('inbox_id', inboxId)
    }
  }

  // ... rest of implementation
}

/**
 * Send webhook event to inbox-specific webhooks
 * @param {string} userId - User ID
 * @param {string} inboxId - Inbox ID (required)
 * @param {string} eventType - Event type
 * @param {Object} payload - Event payload
 */
async sendWebhookEvent(userId, inboxId, eventType, payload) {
  // Get webhooks for this specific inbox
  const inboxWebhooks = await this.getWebhooks(userId, inboxId)
  
  // Also get legacy webhooks (inbox_id IS NULL) for backward compatibility
  const legacyWebhooks = await this.getWebhooks(userId, null)
  
  const allWebhooks = [...inboxWebhooks, ...legacyWebhooks]
  
  // ... send to matching webhooks
}

/**
 * Validate that inbox belongs to user
 * @param {string} userId - User ID
 * @param {string} inboxId - Inbox ID
 * @throws {Error} If inbox doesn't belong to user
 */
async validateInboxOwnership(userId, inboxId) {
  const { data: inbox } = await supabaseService.queryAsAdmin('inboxes', (q) =>
    q.select('id, accounts!inner(owner_user_id)')
      .eq('id', inboxId)
      .single()
  )

  if (!inbox || inbox.accounts.owner_user_id !== userId) {
    throw new Error('Inbox not found or unauthorized')
  }
}
```

### API Routes Updates

```javascript
// userWebhookRoutes.js - Updated routes

/**
 * GET /api/user/outgoing-webhooks
 * List webhooks, optionally filtered by inbox
 */
router.get('/', verifyUserToken, async (req, res) => {
  const { inboxId } = req.query
  
  const webhooks = await webhookService.getWebhooks(
    req.userId, 
    inboxId || undefined
  )
  
  res.json({ success: true, data: webhooks })
})

/**
 * POST /api/user/outgoing-webhooks
 * Create webhook with inbox context
 */
router.post('/', verifyUserToken, async (req, res) => {
  const { url, events, inboxId } = req.body
  
  const webhook = await webhookService.configureWebhook(req.userId, {
    url,
    events,
    inboxId // Can be null for legacy
  })
  
  res.status(201).json({ success: true, data: webhook })
})
```

### Frontend Components

```typescript
// ChatIntegrationSection.tsx - New component for inbox edit page

interface ChatIntegrationSectionProps {
  inboxId: string
}

export function ChatIntegrationSection({ inboxId }: ChatIntegrationSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Webhook className="h-5 w-5 mr-2 text-primary" />
          Integrações de Chat
        </CardTitle>
        <CardDescription>
          Configure webhooks para integrar o chat com sistemas externos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Incoming Webhook - receives events from WUZAPI */}
        <IncomingWebhookConfig inboxId={inboxId} />
        
        <Separator />
        
        {/* Outgoing Webhooks - sends events to external systems */}
        <OutgoingWebhookList inboxId={inboxId} />
      </CardContent>
    </Card>
  )
}
```

```typescript
// OutgoingWebhookList.tsx - Webhook list for specific inbox

interface OutgoingWebhookListProps {
  inboxId: string
}

export function OutgoingWebhookList({ inboxId }: OutgoingWebhookListProps) {
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['outgoing-webhooks', inboxId],
    queryFn: () => getOutgoingWebhooks(inboxId)
  })

  // ... render webhook list with CRUD operations
}
```

## Data Models

### Webhook Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   WUZAPI     │────▶│   Backend    │────▶│  Outgoing    │
│   Events     │     │   Router     │     │  Webhooks    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Filter by   │
                     │  inbox_id    │
                     └──────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Inbox A  │  │ Inbox B  │  │ Legacy   │
        │ Webhooks │  │ Webhooks │  │ Webhooks │
        └──────────┘  └──────────┘  └──────────┘
```

### TypeScript Interfaces

```typescript
// types/chat.ts - Updated interfaces

interface OutgoingWebhook {
  id: string
  userId: string
  inboxId: string | null  // null for legacy webhooks
  url: string
  events: string[]
  secret: string
  isActive: boolean
  successCount: number
  failureCount: number
  lastDeliveryAt: string | null
  lastError: string | null
  createdAt: string
}

interface CreateWebhookData {
  url: string
  events: string[]
  inboxId?: string  // Optional for backward compatibility
  isActive?: boolean
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Foreign Key Cascade Delete

*For any* webhook with a non-null inbox_id, when the referenced inbox is deleted, the webhook should also be deleted (CASCADE behavior).

**Validates: Requirements 1.2**

### Property 2: Unique Constraint Enforcement

*For any* combination of (user_id, inbox_id, url), attempting to create a duplicate webhook should fail with a constraint violation error.

**Validates: Requirements 1.6**

### Property 3: Webhook Filtering by Inbox

*For any* user with multiple inboxes and webhooks distributed across them, calling `getWebhooks(userId, inboxId)` should return only webhooks where `inbox_id` matches the provided `inboxId`, and calling `getWebhooks(userId, null)` should return only webhooks where `inbox_id IS NULL`.

**Validates: Requirements 3.3, 3.4**

### Property 4: Inbox Ownership Validation

*For any* API request to create, update, or delete a webhook with an inbox_id, if the inbox does not belong to the authenticated user, the system should return 403 Forbidden.

**Validates: Requirements 3.6, 4.3, 4.4, 4.5**

### Property 5: Event Isolation by Inbox

*For any* chat event occurring in Inbox A, the event should only be sent to webhooks configured for Inbox A (and legacy webhooks with null inbox_id), never to webhooks configured for Inbox B.

**Validates: Requirements 8.1, 8.3**

### Property 6: Legacy Webhook Compatibility

*For any* webhook with null inbox_id (legacy), it should continue to receive events from all inboxes of the user during the transition period.

**Validates: Requirements 9.1, 9.2**

### Property 7: Migration Idempotency

*For any* database state, running the migration script multiple times should produce the same final state as running it once, with no errors or duplicate changes.

**Validates: Requirements 2.6**

### Property 8: Primary Inbox Selection

*For any* user with multiple active inboxes, the migration should associate legacy webhooks with the first active inbox (ordered by created_at), ensuring deterministic behavior.

**Validates: Requirements 2.2**

## Error Handling

### Database Errors

| Error | Cause | Handling |
|-------|-------|----------|
| Foreign key violation | Invalid inbox_id | Return 400 Bad Request with message |
| Unique constraint violation | Duplicate webhook | Return 409 Conflict with message |
| Not found | Webhook/Inbox doesn't exist | Return 404 Not Found |

### Authorization Errors

| Error | Cause | Handling |
|-------|-------|----------|
| Inbox not owned by user | User trying to access another user's inbox | Return 403 Forbidden |
| Invalid token | Expired or invalid JWT | Return 401 Unauthorized |

### Webhook Delivery Errors

| Error | Cause | Handling |
|-------|-------|----------|
| Connection timeout | Target server not responding | Retry with exponential backoff (3 attempts) |
| HTTP 4xx | Client error | Log and don't retry |
| HTTP 5xx | Server error | Retry with exponential backoff |

## Testing Strategy

### Unit Tests

Unit tests should cover:
- `OutgoingWebhookService` methods with mocked database
- API route handlers with mocked service
- Frontend components with mocked API

### Property-Based Tests

Property-based tests should use a library like `fast-check` (JavaScript) to verify:
- **Property 3**: Generate random users, inboxes, and webhooks, verify filtering
- **Property 4**: Generate random access attempts, verify authorization
- **Property 5**: Generate random events and webhook configurations, verify routing

Configuration:
- Minimum 100 iterations per property test
- Use `fast-check` for JavaScript/TypeScript
- Tag format: `Feature: inbox-settings-migration, Property N: description`

### Integration Tests

Integration tests should verify:
- Database migration applies correctly
- API endpoints work end-to-end
- Frontend components integrate with API

### E2E Tests (Cypress)

E2E tests should verify:
- User can create webhook in inbox edit page
- User can edit/delete webhook
- Webhook list shows correct webhooks per inbox
- Settings page no longer shows "Integração Chat" tab

## Migration Strategy

### Phase 1: Database Migration (Non-Breaking)

1. Add `inbox_id` column as nullable
2. Add indexes and constraints
3. No changes to existing data

### Phase 2: Backend Updates (Backward Compatible)

1. Update `OutgoingWebhookService` to support `inboxId`
2. Update API routes to accept `inboxId`
3. Keep existing behavior when `inboxId` not provided

### Phase 3: Data Migration

1. Run script to associate existing webhooks with primary inbox
2. Log all changes for audit
3. Verify migration success

### Phase 4: Frontend Updates

1. Add `ChatIntegrationSection` to inbox edit page
2. Remove "Integração Chat" tab from Settings
3. Add migration notice for users

### Phase 5: Deprecation (Future)

1. Add warning for legacy webhooks
2. Provide migration UI
3. Eventually require inbox_id for new webhooks
