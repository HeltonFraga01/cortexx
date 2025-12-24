# Design Document: Connection Status Sync

## Overview

Este design resolve a inconsistência de status de conexão entre componentes e adiciona capacidades completas de gerenciamento de inbox para usuários. A solução centraliza a fonte de verdade no `SupabaseInboxContext` e garante que todos os componentes consumam o mesmo estado.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SupabaseInboxContext (Fonte de Verdade)      │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ availableInboxes: InboxSummary[]                    │ │   │
│  │  │   - id, name, phoneNumber                           │ │   │
│  │  │   - isConnected (sincronizado com WUZAPI)           │ │   │
│  │  │   - isLoggedIn (novo campo)                         │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ updateInboxStatus(inboxId, status)                  │ │   │
│  │  │   - Atualiza isConnected/isLoggedIn no contexto     │ │   │
│  │  │   - Chamado pelo hook useInboxConnectionData        │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│  ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ UnifiedInbox     │ │ Connection   │ │ InboxList        │    │
│  │ Selector         │ │ ControlCard  │ │ User             │    │
│  │ (usa contexto)   │ │ (usa contexto)│ │ (usa contexto)   │    │
│  └──────────────────┘ └──────────────┘ └──────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. SupabaseInboxContext (Modificações)

```typescript
interface InboxSummary {
  id: string
  name: string
  phoneNumber: string
  isConnected: boolean  // Sincronizado com WUZAPI
  isLoggedIn: boolean   // NOVO: indica se está autenticado no WhatsApp
  isPrimary: boolean
  unreadCount?: number
}

interface SupabaseInboxContextValue {
  // ... campos existentes ...
  
  // NOVO: Função para atualizar status de uma inbox específica
  updateInboxStatus: (inboxId: string, status: { isConnected: boolean; isLoggedIn: boolean }) => void
}
```

### 2. useInboxConnectionData Hook (Modificações)

O hook deve chamar `updateInboxStatus` do contexto quando receber status do WUZAPI:

```typescript
// Dentro do fetchStatus
const status = await authenticatedFetch(`/inbox/${id}/status`)
if (status.success && status.data) {
  // Atualizar contexto global
  inboxContext?.updateInboxStatus(id, {
    isConnected: status.data.connected,
    isLoggedIn: status.data.loggedIn
  })
}
```

### 3. ConnectionControlCard (Modificações)

Usar status do contexto em vez de sessionStatus local:

```typescript
// Antes
const isConnected = sessionStatus?.connected ?? connectionData?.isConnected ?? false

// Depois
const inboxFromContext = availableInboxes.find(i => i.id === inboxId)
const isConnected = inboxFromContext?.isConnected ?? false
const isLoggedIn = inboxFromContext?.isLoggedIn ?? false
```

### 4. InboxListUser (Novo/Modificado)

Página de gerenciamento de inboxes para usuários com CRUD completo:

```typescript
interface InboxListUserProps {
  // Nenhuma prop necessária - usa contexto
}

// Funcionalidades:
// - Listar todas as inboxes do usuário
// - Criar nova inbox (respeitando quota)
// - Editar inbox existente
// - Excluir inbox (com confirmação)
// - Conectar/Desconectar/Logout/Gerar QR
// - Exibir quota usage (ex: "3/5 caixas")
```

## Data Models

### InboxSummary (Atualizado)

```typescript
interface InboxSummary {
  id: string
  name: string
  phoneNumber: string
  isConnected: boolean    // true se Connected no WUZAPI
  isLoggedIn: boolean     // true se LoggedIn no WUZAPI (autenticado)
  isPrimary: boolean
  unreadCount?: number
  wuzapi_token?: string   // Para operações de conexão
}
```

### QuotaInfo

```typescript
interface QuotaInfo {
  current: number    // Quantidade atual de inboxes
  limit: number      // Limite do plano
  canCreate: boolean // current < limit
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Context Status Synchronization

*For any* inbox ID and status update from WUZAPI, when updateInboxStatus is called, the corresponding inbox in availableInboxes SHALL have matching isConnected and isLoggedIn values.

**Validates: Requirements 1.1, 2.1, 2.2, 2.3**

### Property 2: Visual Indicator Consistency

*For any* inbox with a given connection state (connected/disconnected/loggedIn), all UI components displaying that inbox SHALL show the same visual indicator (green for loggedIn, yellow for connected-not-logged-in, red for disconnected).

**Validates: Requirements 1.2, 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 3: Quota Enforcement

*For any* user at their inbox quota limit, attempting to create a new inbox SHALL be rejected both on frontend (disabled button) and backend (API error).

**Validates: Requirements 5.2, 7.2, 7.4**

### Property 4: Quota Display Accuracy

*For any* user with N inboxes and a limit of M, the quota display SHALL show "N/M caixas" and canCreate SHALL equal (N < M).

**Validates: Requirements 7.1, 7.2**

### Property 5: Connection Action Status Update

*For any* connection action (connect/disconnect/logout), upon completion, the inbox status in the context SHALL reflect the new state returned by WUZAPI.

**Validates: Requirements 4.1, 6.5**

### Property 6: Already Connected Handling

*For any* connect action that returns "already connected" error, the system SHALL treat it as a successful connection and update the UI to show connected status.

**Validates: Requirements 8.1, 8.2**

### Property 7: Pre-Action Status Check

*For any* connection action, if the current cached status already matches the desired state, the system SHALL skip the API call and show an appropriate message.

**Validates: Requirements 9.1, 9.2**

## Error Handling

### Already Connected Error

```typescript
// No handleConnect
try {
  await wuzapi.connectSession(token, options)
  toast.success('Conectado com sucesso')
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
  
  // Tratar "already connected" como sucesso
  if (errorMessage.toLowerCase().includes('already connected')) {
    toast.info('Já conectado', {
      description: 'A sessão WhatsApp já está conectada'
    })
    // Atualizar status para refletir que está conectado
    refetchStatus()
    return
  }
  
  // Outros erros...
  toast.error('Erro ao conectar', { description: errorMessage })
}
```

### Pre-Action Status Check

```typescript
const handleConnect = async () => {
  // Verificar status atual antes de tentar conectar
  const currentStatus = sessionStatus || connectionData
  if (currentStatus?.connected && currentStatus?.loggedIn) {
    toast.info('Já conectado', {
      description: 'A sessão WhatsApp já está conectada'
    })
    return
  }
  
  // Prosseguir com a conexão...
}
```

### WUZAPI Failures

```typescript
try {
  const status = await wuzapiClient.getStatus(token)
  updateInboxStatus(inboxId, status)
} catch (error) {
  // Fallback: usar status do banco de dados
  const dbStatus = inbox.wuzapi_connected
  updateInboxStatus(inboxId, { isConnected: dbStatus, isLoggedIn: dbStatus })
  logger.warn('WUZAPI status fetch failed, using cached value', { inboxId, error })
}
```

### Quota Exceeded

```typescript
// Backend
if (currentInboxCount >= quotaLimit) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'QUOTA_EXCEEDED',
      message: 'Limite de caixas de entrada atingido',
      current: currentInboxCount,
      limit: quotaLimit
    }
  })
}

// Frontend
if (!quotaInfo.canCreate) {
  toast.error('Limite atingido', {
    description: `Você já possui ${quotaInfo.current}/${quotaInfo.limit} caixas. Faça upgrade do plano para criar mais.`
  })
}
```

## Testing Strategy

### Unit Tests

1. **Context updateInboxStatus**: Verificar que a função atualiza corretamente o inbox no array
2. **Quota calculation**: Verificar que canCreate é calculado corretamente
3. **Visual indicator mapping**: Verificar que cada estado mapeia para o indicador correto

### Property-Based Tests

Usando Vitest com fast-check:

1. **Property 1**: Gerar status aleatórios e verificar sincronização
2. **Property 3**: Gerar cenários de quota e verificar enforcement
3. **Property 4**: Gerar combinações de current/limit e verificar display

### Integration Tests

1. **E2E Flow**: Criar inbox → verificar quota → conectar → verificar status em todos os componentes
2. **Status Sync**: Mudar status via WUZAPI mock → verificar atualização em todos os componentes
