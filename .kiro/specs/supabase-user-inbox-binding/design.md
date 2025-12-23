# Design Document: Supabase User Inbox Binding

## Overview

Este documento descreve a arquitetura e implementação para vincular automaticamente as informações da caixa de entrada (inbox) ao usuário autenticado via Supabase Auth. O sistema carrega automaticamente os dados da inbox associada (token WUZAPI, instância, etc.) e os disponibiliza em todo o sistema para operações de chat, contatos e envio de mensagens.

A solução suporta tanto owners (donos de account) quanto agentes (membros de times), com controle de acesso baseado em associações inbox-agent.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  InboxContext Provider                                                   │
│  ├── useInboxContext() hook                                             │
│  ├── InboxSelector component                                            │
│  └── ConnectionStatus indicator                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Backend (Express + Supabase)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  inboxContextMiddleware                                                  │
│  ├── validateSupabaseToken()                                            │
│  ├── loadUserContext()                                                  │
│  │   ├── getAccountByUserId()                                           │
│  │   ├── getAgentByUserId()                                             │
│  │   └── getInboxesForUser()                                            │
│  └── populateRequestContext()                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  InboxContextService                                                     │
│  ├── getUserInboxContext(userId)                                        │
│  ├── getAgentInboxContext(userId)                                       │
│  ├── switchActiveInbox(userId, inboxId)                                 │
│  ├── getAvailableInboxes(userId)                                        │
│  └── saveInboxPreference(userId, inboxId)                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Supabase (PostgreSQL)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Tables:                                                                 │
│  ├── accounts (owner_user_id, wuzapi_token, tenant_id)                  │
│  ├── inboxes (account_id, wuzapi_token, phone_number, wuzapi_connected) │
│  ├── agents (user_id, account_id, role)                                 │
│  ├── inbox_members (inbox_id, agent_id)                                 │
│  ├── user_inboxes (user_id, inbox_id, is_primary)                       │
│  └── user_preferences (user_id, key, value)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Session Context Structure

```typescript
interface SessionContext {
  // User identification
  userId: string;           // Supabase Auth user ID
  userType: 'owner' | 'agent';
  email: string;
  
  // Agent info (if applicable)
  agentId?: string;
  agentRole?: string;       // 'owner' | 'administrator' | 'agent'
  
  // Account info
  accountId: string;
  accountName: string;
  tenantId: string;
  
  // Active inbox info
  inboxId: string;
  inboxName: string;
  wuzapiToken: string;
  instance: string;         // WUZAPI instance identifier
  phoneNumber?: string;
  isConnected: boolean;
  
  // Permissions
  permissions: string[];    // ['messages:send', 'contacts:read', etc.]
  
  // Available inboxes (for selector)
  availableInboxes: InboxSummary[];
}

interface InboxSummary {
  id: string;
  name: string;
  phoneNumber?: string;
  isConnected: boolean;
  isPrimary: boolean;
}
```

### 2. Backend Middleware: inboxContextMiddleware

```javascript
// server/middleware/inboxContextMiddleware.js

/**
 * Middleware que carrega o contexto completo da inbox para o usuário autenticado.
 * Deve ser usado após validateSupabaseToken.
 * 
 * Fluxo:
 * 1. Verifica se usuário é owner ou agent
 * 2. Busca account associada
 * 3. Busca inboxes disponíveis (todas para owner, associadas para agent)
 * 4. Seleciona inbox ativa (preferência salva ou padrão)
 * 5. Popula req.context com todos os dados
 */
async function inboxContextMiddleware(req, res, next) {
  // Implementation
}
```

### 3. Backend Service: InboxContextService

```javascript
// server/services/InboxContextService.js

class InboxContextService {
  /**
   * Carrega contexto completo para um usuário (owner ou agent)
   * @param {string} userId - Supabase Auth user ID
   * @returns {SessionContext}
   */
  static async getUserInboxContext(userId) {}
  
  /**
   * Busca inboxes disponíveis para o usuário
   * @param {string} userId
   * @param {string} accountId
   * @param {string} userType - 'owner' | 'agent'
   * @returns {InboxSummary[]}
   */
  static async getAvailableInboxes(userId, accountId, userType) {}
  
  /**
   * Troca a inbox ativa do usuário
   * @param {string} userId
   * @param {string} inboxId
   * @returns {SessionContext}
   */
  static async switchActiveInbox(userId, inboxId) {}
  
  /**
   * Salva preferência de inbox do usuário
   * @param {string} userId
   * @param {string} inboxId
   */
  static async saveInboxPreference(userId, inboxId) {}
  
  /**
   * Verifica se usuário tem acesso a uma inbox específica
   * @param {string} userId
   * @param {string} inboxId
   * @returns {boolean}
   */
  static async hasInboxAccess(userId, inboxId) {}
}
```

### 4. Frontend Context: InboxContext

```typescript
// src/contexts/InboxContext.tsx

interface InboxContextValue {
  // Current context
  context: SessionContext | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  switchInbox: (inboxId: string) => Promise<void>;
  refreshContext: () => Promise<void>;
  
  // Helpers
  hasPermission: (permission: string) => boolean;
  canSendMessages: () => boolean;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  // Implementation
}

export function useInboxContext() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInboxContext must be used within InboxProvider');
  }
  return context;
}
```

### 5. API Endpoints

```
GET  /api/user/inbox-context          - Retorna contexto atual do usuário
POST /api/user/inbox-context/switch   - Troca inbox ativa
GET  /api/user/inboxes/available      - Lista inboxes disponíveis
GET  /api/user/inbox-status           - Status de conexão da inbox ativa
```

## Data Models

### Database Schema Updates

```sql
-- Tabela para preferências do usuário (se não existir)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Adicionar coluna is_primary em user_inboxes se não existir
ALTER TABLE user_inboxes 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_key 
ON user_preferences(user_id, key);

CREATE INDEX IF NOT EXISTS idx_inbox_members_agent 
ON inbox_members(agent_id);

CREATE INDEX IF NOT EXISTS idx_user_inboxes_user 
ON user_inboxes(user_id);
```

### Context Resolution Flow

```
User Login (Supabase Auth)
         │
         ▼
┌─────────────────────────────────┐
│ 1. Extract user_id from JWT     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 2. Check if user is owner       │
│    SELECT * FROM accounts       │
│    WHERE owner_user_id = ?      │
└─────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
   YES        NO
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────────────┐
│ Owner   │ │ 3. Check if agent   │
│ Flow    │ │    SELECT * FROM    │
│         │ │    agents WHERE     │
│         │ │    user_id = ?      │
└─────────┘ └─────────────────────┘
    │              │
    │         ┌────┴────┐
    │        YES        NO
    │         │         │
    │         ▼         ▼
    │    ┌─────────┐ ┌─────────┐
    │    │ Agent   │ │ Error:  │
    │    │ Flow    │ │ No      │
    │    │         │ │ Access  │
    │    └─────────┘ └─────────┘
    │         │
    ▼         ▼
┌─────────────────────────────────┐
│ 4. Get available inboxes        │
│    Owner: All account inboxes   │
│    Agent: inbox_members only    │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 5. Select active inbox          │
│    - Check user_preferences     │
│    - Or use is_primary = true   │
│    - Or use first available     │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 6. Build SessionContext         │
│    - Load inbox details         │
│    - Load permissions           │
│    - Check connection status    │
└─────────────────────────────────┘
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Context Loading Completeness

*For any* authenticated user (owner or agent) with at least one inbox associated, the system SHALL return a SessionContext containing all required fields: userId, userType, accountId, inboxId, wuzapiToken, instance, and permissions.

**Validates: Requirements 1.1, 1.2, 1.3, 2.1, 6.4, 9.4**

### Property 2: Owner Full Access

*For any* user who is the owner of an account, the availableInboxes array SHALL contain ALL inboxes belonging to that account.

**Validates: Requirements 11.2**

### Property 3: Agent Restricted Access

*For any* user who is an agent (not owner), the availableInboxes array SHALL contain ONLY inboxes where there exists a record in inbox_members linking the agent to that inbox.

**Validates: Requirements 9.2, 10.1, 11.3**

### Property 4: Inbox Access Validation

*For any* attempt to switch to an inbox, the system SHALL return error 403 if the user does not have access to that inbox (not in availableInboxes).

**Validates: Requirements 10.2, 10.4**

### Property 5: Default Inbox Selection

*For any* user with multiple inboxes and no saved preference, the system SHALL select the inbox marked as is_primary=true, or if none, the first inbox ordered by created_at.

**Validates: Requirements 7.1, 7.2, 9.3**

### Property 6: Preference Persistence

*For any* inbox switch operation, the system SHALL persist the selection in user_preferences, and subsequent context loads SHALL return the same inbox as active.

**Validates: Requirements 7.5, 12.5**

### Property 7: Context Structure Consistency

*For any* SessionContext returned by the system, the structure SHALL be identical regardless of whether the user is an owner or agent (same fields present).

**Validates: Requirements 11.1, 11.4, 11.5**

### Property 8: Error Handling for Missing Data

*For any* user without an associated account, the system SHALL return error 401 with message indicating account not found. *For any* account without active inboxes, the system SHALL return error 403 with message indicating no inboxes available.

**Validates: Requirements 1.4, 1.5, 9.5**

### Property 9: Data Filtering by Context

*For any* query for contacts, messages, or campaigns, the results SHALL be filtered by the accountId from the active SessionContext.

**Validates: Requirements 3.3, 4.1, 4.4**

### Property 10: Operation Context Usage

*For any* message send operation, the system SHALL use the wuzapiToken and instance from the active SessionContext.

**Validates: Requirements 3.2, 5.1, 5.2, 5.3**

## Error Handling

### Error Codes and Messages

| Code | HTTP Status | Message | Cause |
|------|-------------|---------|-------|
| `NO_ACCOUNT` | 401 | "Nenhuma conta vinculada ao usuário" | User has no account |
| `NO_AGENT` | 401 | "Usuário não é agente de nenhuma conta" | User is not owner or agent |
| `NO_INBOX` | 403 | "Nenhuma caixa de entrada disponível" | Account/agent has no inboxes |
| `INBOX_ACCESS_DENIED` | 403 | "Acesso negado a esta caixa de entrada" | Agent trying to access unassigned inbox |
| `INBOX_DISCONNECTED` | 503 | "Caixa de entrada desconectada" | Inbox not connected to WhatsApp |
| `CONTEXT_LOAD_ERROR` | 500 | "Erro ao carregar contexto" | Database or service error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "NO_INBOX",
    "message": "Nenhuma caixa de entrada disponível",
    "details": {
      "accountId": "uuid",
      "userType": "agent"
    }
  }
}
```

## Testing Strategy

### Unit Tests

1. **InboxContextService.getUserInboxContext()**
   - Test owner context loading
   - Test agent context loading
   - Test error cases (no account, no inbox)

2. **InboxContextService.getAvailableInboxes()**
   - Test owner gets all inboxes
   - Test agent gets only assigned inboxes
   - Test empty inbox list handling

3. **InboxContextService.switchActiveInbox()**
   - Test successful switch
   - Test access denied for unauthorized inbox
   - Test preference persistence

4. **inboxContextMiddleware**
   - Test context population in req.context
   - Test error responses
   - Test integration with validateSupabaseToken

### Property-Based Tests

Each correctness property will be implemented as a property-based test using fast-check:

1. **Property 1**: Generate random users with accounts/inboxes, verify context completeness
2. **Property 2**: Generate owners, verify all account inboxes are returned
3. **Property 3**: Generate agents with partial inbox access, verify filtering
4. **Property 4**: Generate unauthorized inbox access attempts, verify 403
5. **Property 5**: Generate users with multiple inboxes, verify default selection
6. **Property 6**: Generate inbox switches, verify persistence
7. **Property 7**: Generate both owner and agent contexts, verify structure equality
8. **Property 8**: Generate users without accounts/inboxes, verify errors
9. **Property 9**: Generate queries, verify account filtering
10. **Property 10**: Generate send operations, verify context usage

### Integration Tests

1. Full login flow with context loading
2. Inbox switch with data reload
3. Multi-user concurrent access
4. Connection status updates
