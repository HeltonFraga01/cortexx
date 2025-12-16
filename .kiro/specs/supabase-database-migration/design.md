# Design Document: Supabase Database Migration

## Overview

Este documento descreve o design técnico para migração do banco de dados SQLite para Supabase (PostgreSQL). A migração envolve:

1. Criação do schema PostgreSQL equivalente às 40+ tabelas SQLite
2. Implementação de Row Level Security (RLS) para isolamento de dados
3. Integração com Supabase Auth para autenticação
4. Configuração de Realtime para atualizações em tempo real
5. Migração de dados existentes
6. Refatoração dos services backend
7. Integração com Supabase Storage para mídia

**Projeto Supabase:** https://bdhkfyvyvgfdukdodddr.supabase.co

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WUZAPI Manager                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Frontend (React + TypeScript)                                          │
│  ├── @supabase/supabase-js client                                       │
│  ├── Realtime subscriptions (conversations, messages)                   │
│  ├── Auth state management                                              │
│  └── Generated TypeScript types                                         │
│                                                                          │
│  Backend (Node.js + Express)                                            │
│  ├── @supabase/supabase-js (service role)                              │
│  ├── SupabaseService.js (replaces database.js)                         │
│  ├── Auth middleware (JWT validation)                                   │
│  └── Storage service (media uploads)                                    │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         Supabase Platform                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PostgreSQL Database                                                     │
│  ├── 40+ tables with RLS policies                                       │
│  ├── JSONB columns for flexible data                                    │
│  ├── UUID primary keys                                                  │
│  └── Optimized indexes (GIN, GiST, B-tree)                             │
│                                                                          │
│  Supabase Auth                                                          │
│  ├── JWT tokens with custom claims                                      │
│  ├── Role-based access (admin, owner, agent, viewer)                   │
│  └── Session management                                                 │
│                                                                          │
│  Supabase Realtime                                                      │
│  ├── conversations table subscription                                   │
│  ├── chat_messages table subscription                                   │
│  └── RLS-aware event filtering                                          │
│                                                                          │
│  Supabase Storage                                                       │
│  ├── media bucket (images, videos, documents)                          │
│  ├── avatars bucket (user/contact avatars)                             │
│  └── RLS policies for access control                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. SupabaseService (Backend)

Substitui `server/database.js` como camada de abstração do banco de dados.

```javascript
// server/services/SupabaseService.js
class SupabaseService {
  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  // Query with user context (RLS)
  async queryAsUser(userId, table, query) {}
  
  // Admin query (bypasses RLS)
  async queryAsAdmin(table, query) {}
  
  // Transaction support
  async transaction(callback) {}
  
  // Migration utilities
  async validateSchema() {}
}
```

### 2. Supabase Client (Frontend)

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Realtime subscriptions
export function subscribeToConversations(userId: string, callback: Function) {}
export function subscribeToMessages(conversationId: string, callback: Function) {}
```

### 3. Auth Middleware

```javascript
// server/middleware/supabaseAuth.js
async function validateSupabaseToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) return res.status(401).json({ error: 'Invalid token' });
  
  req.user = user;
  req.supabaseClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  
  next();
}
```

### 4. Storage Service

```javascript
// server/services/StorageService.js
class StorageService {
  async uploadMedia(file, conversationId) {
    const path = `conversations/${conversationId}/${file.name}`;
    const { data, error } = await supabase.storage
      .from('media')
      .upload(path, file.buffer);
    return data.path;
  }

  async getSignedUrl(path, expiresIn = 3600) {
    const { data } = await supabase.storage
      .from('media')
      .createSignedUrl(path, expiresIn);
    return data.signedUrl;
  }

  async deleteConversationMedia(conversationId) {
    await supabase.storage
      .from('media')
      .remove([`conversations/${conversationId}`]);
  }
}
```

## Data Models

### Core Tables Schema (PostgreSQL)

```sql
-- Accounts (organizations)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  wuzapi_token TEXT NOT NULL,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  locale TEXT DEFAULT 'pt-BR',
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents (sub-users)
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'agent' CHECK(role IN ('owner', 'administrator', 'agent', 'viewer')),
  custom_role_id UUID REFERENCES custom_roles(id),
  availability TEXT DEFAULT 'offline' CHECK(availability IN ('online', 'busy', 'offline')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'pending')),
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, user_id)
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_avatar_url TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  assigned_agent_id UUID REFERENCES agents(id),
  assigned_bot_id UUID REFERENCES agent_bots(id),
  inbox_id UUID REFERENCES inboxes(id),
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'pending', 'snoozed')),
  is_muted BOOLEAN DEFAULT FALSE,
  is_test BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, contact_jid)
);

-- Chat Messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('incoming', 'outgoing')),
  message_type TEXT NOT NULL CHECK(message_type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'poll', 'order', 'list_response', 'button_response')),
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  media_size_bytes INTEGER,
  media_duration_seconds INTEGER,
  reply_to_message_id TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  is_private_note BOOLEAN DEFAULT FALSE,
  sender_type TEXT CHECK(sender_type IN ('user', 'contact', 'bot', 'system')),
  sender_agent_id UUID REFERENCES agents(id),
  sender_bot_id UUID REFERENCES agent_bots(id),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK(billing_cycle IN ('monthly', 'yearly', 'lifetime')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'deprecated')),
  is_default BOOLEAN DEFAULT FALSE,
  trial_days INTEGER DEFAULT 0,
  quotas JSONB NOT NULL DEFAULT '{
    "max_agents": 1,
    "max_connections": 1,
    "max_messages_per_day": 100,
    "max_messages_per_month": 3000,
    "max_inboxes": 1,
    "max_teams": 1,
    "max_webhooks": 5,
    "max_campaigns": 1,
    "max_storage_mb": 100,
    "max_bots": 1
  }',
  features JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Accounts: owner can access their accounts
CREATE POLICY "Users can view own accounts" ON accounts
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "Users can update own accounts" ON accounts
  FOR UPDATE USING (owner_user_id = auth.uid());

-- Agents: users can access agents in their account
CREATE POLICY "Users can view agents in their account" ON agents
  FOR SELECT USING (
    account_id IN (
      SELECT id FROM accounts WHERE owner_user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Conversations: users can access conversations in their account
CREATE POLICY "Users can view conversations in their account" ON conversations
  FOR SELECT USING (
    account_id IN (
      SELECT id FROM accounts WHERE owner_user_id = auth.uid()
    )
    OR account_id IN (
      SELECT account_id FROM agents WHERE user_id = auth.uid()
    )
  );

-- Messages: users can access messages in their conversations
CREATE POLICY "Users can view messages in their conversations" ON chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE 
        account_id IN (SELECT id FROM accounts WHERE owner_user_id = auth.uid())
        OR account_id IN (SELECT account_id FROM agents WHERE user_id = auth.uid())
    )
  );

-- Plans: all authenticated users can read, only admins can write
CREATE POLICY "Anyone can view plans" ON plans
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify plans" ON plans
  FOR ALL USING (
    auth.uid() IN (
      SELECT owner_user_id FROM accounts WHERE id IN (
        SELECT account_id FROM agents WHERE role = 'owner' AND user_id = auth.uid()
      )
    )
  );
```

### Type Mappings (SQLite → PostgreSQL)

| SQLite Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| INTEGER PRIMARY KEY AUTOINCREMENT | UUID PRIMARY KEY DEFAULT gen_random_uuid() | Use UUIDs for distributed systems |
| TEXT (JSON) | JSONB | Native JSON operations |
| DATETIME | TIMESTAMPTZ | Timezone-aware timestamps |
| INTEGER (boolean) | BOOLEAN | Native boolean type |
| TEXT | TEXT | Same |
| INTEGER | INTEGER | Same |
| REAL | DOUBLE PRECISION | Higher precision |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Schema Completeness
*For any* table defined in the SQLite schema, after migration, the Supabase database should contain an equivalent table with all columns and constraints preserved.
**Validates: Requirements 1.1, 1.5**

### Property 2: Data Type Correctness
*For any* column in the migrated schema, the PostgreSQL data type should be the appropriate native equivalent (TEXT JSON → JSONB, DATETIME → TIMESTAMPTZ, INTEGER boolean → BOOLEAN).
**Validates: Requirements 1.2**

### Property 3: Foreign Key Integrity
*For any* foreign key relationship in the SQLite schema, the Supabase schema should have an equivalent constraint with the same referential actions.
**Validates: Requirements 1.3**

### Property 4: RLS Data Isolation
*For any* user querying the accounts, agents, conversations, or chat_messages tables, the results should only include rows that belong to accounts they own or are agents of.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

### Property 5: Plans Access Control
*For any* authenticated user, reading the plans table should return all plans, but write operations should only succeed for users with admin/owner role.
**Validates: Requirements 2.5**

### Property 6: Auth User Sync
*For any* user created in the system, there should be corresponding entries in both Supabase Auth (auth.users) and the agents table with matching user_id.
**Validates: Requirements 3.2**

### Property 7: JWT RLS Compatibility
*For any* JWT token issued by Supabase Auth, the token should contain claims that allow RLS policies to correctly identify the user and their permissions.
**Validates: Requirements 3.3**

### Property 8: Realtime RLS Filtering
*For any* realtime subscription, events should only be delivered to users who have RLS access to the affected rows.
**Validates: Requirements 4.4**

### Property 9: Data Migration Completeness
*For any* table in the SQLite database, after migration, the record count in Supabase should equal the record count in SQLite.
**Validates: Requirements 5.1, 5.5**

### Property 10: Timestamp Preservation
*For any* timestamp value in SQLite, after migration to Supabase, the equivalent TIMESTAMPTZ value should represent the same point in time.
**Validates: Requirements 5.2**

### Property 11: JSON Data Preservation
*For any* JSON string stored in SQLite TEXT columns, after migration to JSONB, the data should be queryable and equivalent to the original.
**Validates: Requirements 5.3**

### Property 12: Foreign Key Preservation
*For any* foreign key reference in SQLite, after migration, the relationship should be preserved with the same referenced row.
**Validates: Requirements 5.4**

### Property 13: Error Translation
*For any* PostgreSQL error returned by Supabase, the system should translate it to an application-specific error message that is user-friendly.
**Validates: Requirements 6.3**

### Property 14: Transaction Atomicity
*For any* transaction executed via Supabase, either all operations should succeed and be committed, or all should be rolled back with no partial state.
**Validates: Requirements 6.5**

### Property 15: Pagination Consistency
*For any* paginated query on messages, the results should maintain consistent ordering and not skip or duplicate records across pages.
**Validates: Requirements 8.2**

### Property 16: Index Type Correctness
*For any* JSONB column with an index, the index type should be GIN. For full-text search columns, the index should be GiST or GIN.
**Validates: Requirements 8.4**

### Property 17: Media Storage Consistency
*For any* media file uploaded, the file should be stored in Supabase Storage and the chat_messages.media_url should contain a valid Supabase Storage path.
**Validates: Requirements 9.1, 9.2**

### Property 18: Signed URL Generation
*For any* media file in storage, the system should be able to generate a signed URL with the specified expiration time.
**Validates: Requirements 9.3**

### Property 19: Media Cascade Delete
*For any* conversation deleted, all associated media files in Supabase Storage should also be deleted.
**Validates: Requirements 9.4**

### Property 20: Configuration Validation
*For any* invalid Supabase configuration (missing URL or keys), the system should fail fast with a clear error message.
**Validates: Requirements 10.4**

### Property 21: Dual Write Consistency
*For any* write operation during migration, the data should be written to both SQLite and Supabase with identical values.
**Validates: Requirements 11.1**

### Property 22: Backend Switch
*For any* value of the database backend feature flag, queries should be routed to the correct database (SQLite or Supabase).
**Validates: Requirements 11.2**

### Property 23: Data Consistency Verification
*For any* table, the data consistency tool should correctly identify differences between SQLite and Supabase records.
**Validates: Requirements 11.5**

## Error Handling

### Database Errors

```javascript
// server/utils/supabaseErrors.js
const errorMap = {
  '23505': { code: 'DUPLICATE_KEY', message: 'Record already exists' },
  '23503': { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record not found' },
  '42501': { code: 'INSUFFICIENT_PRIVILEGE', message: 'Access denied' },
  'PGRST301': { code: 'ROW_NOT_FOUND', message: 'Record not found' },
};

function translateSupabaseError(error) {
  const mapped = errorMap[error.code] || {
    code: 'DATABASE_ERROR',
    message: 'An unexpected database error occurred'
  };
  return new AppError(mapped.code, mapped.message, error);
}
```

### Auth Errors

```javascript
const authErrorMap = {
  'invalid_grant': 'Invalid credentials',
  'user_not_found': 'User not found',
  'email_not_confirmed': 'Please confirm your email',
  'session_expired': 'Session expired, please login again',
};
```

### Storage Errors

```javascript
const storageErrorMap = {
  'Bucket not found': 'Storage bucket not configured',
  'Object not found': 'File not found',
  'Payload too large': 'File size exceeds limit',
  'Invalid file type': 'File type not allowed',
};
```

## Testing Strategy

### Dual Testing Approach

O projeto utilizará tanto testes unitários quanto testes baseados em propriedades:

- **Testes unitários**: Verificam exemplos específicos, edge cases e condições de erro
- **Testes de propriedade**: Verificam propriedades universais que devem valer para todas as entradas

### Property-Based Testing Framework

**Framework escolhido:** fast-check (JavaScript/TypeScript)

```javascript
// Configuração: mínimo 100 iterações por propriedade
fc.configureGlobal({ numRuns: 100 });
```

### Test Structure

```
server/
├── services/
│   ├── SupabaseService.js
│   └── SupabaseService.property.test.js
├── utils/
│   ├── supabaseErrors.js
│   └── supabaseErrors.test.js
└── tests/
    ├── migration/
    │   ├── schema.property.test.js
    │   └── data.property.test.js
    └── rls/
        └── policies.property.test.js

src/
├── lib/
│   ├── supabase.ts
│   └── supabase.test.ts
└── services/
    └── realtime.test.ts
```

### Property Test Examples

```javascript
// **Feature: supabase-database-migration, Property 4: RLS Data Isolation**
describe('RLS Data Isolation', () => {
  it('should only return rows belonging to user account', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.uuid(), // accountId
        async (userId, accountId) => {
          // Create test data
          const client = createClientAsUser(userId);
          const { data } = await client.from('conversations').select('*');
          
          // All returned rows should belong to user's account
          return data.every(row => 
            row.account_id === accountId || 
            isUserAgentInAccount(userId, row.account_id)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// **Feature: supabase-database-migration, Property 14: Transaction Atomicity**
describe('Transaction Atomicity', () => {
  it('should rollback all changes on failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ table: fc.string(), data: fc.object() })),
        async (operations) => {
          const initialState = await getTableStates();
          
          try {
            await supabase.rpc('transaction_test', { operations });
          } catch (error) {
            // On error, state should be unchanged
            const finalState = await getTableStates();
            return deepEqual(initialState, finalState);
          }
          return true;
        }
      )
    );
  });
});
```

### Unit Test Examples

```javascript
// server/utils/supabaseErrors.test.js
describe('translateSupabaseError', () => {
  it('should translate duplicate key error', () => {
    const error = { code: '23505', message: 'duplicate key' };
    const result = translateSupabaseError(error);
    expect(result.code).toBe('DUPLICATE_KEY');
  });

  it('should handle unknown errors gracefully', () => {
    const error = { code: 'UNKNOWN', message: 'something went wrong' };
    const result = translateSupabaseError(error);
    expect(result.code).toBe('DATABASE_ERROR');
  });
});
```

### Migration Verification Tests

```javascript
// server/tests/migration/data.property.test.js
// **Feature: supabase-database-migration, Property 9: Data Migration Completeness**
describe('Data Migration Completeness', () => {
  it('should have equal record counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...tableNames),
        async (tableName) => {
          const sqliteCount = await sqlite.query(`SELECT COUNT(*) FROM ${tableName}`);
          const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
          return sqliteCount === count;
        }
      )
    );
  });
});
```

