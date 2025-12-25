# Design Document: Inbox Status Display Consistency

## Overview

Este design resolve a inconsistência na exibição do status de conexão das caixas de entrada entre diferentes componentes da interface. A solução garante que todos os componentes (InboxInfoCard, UnifiedInboxSelector, ConnectionStatus) exibam o mesmo status de conexão, usando o `SupabaseInboxContext` como fonte única de verdade.

O problema atual é que:
1. `InboxInfoCard` usa `sessionStatus` do hook `useInboxConnectionData` (correto, consulta WUZAPI)
2. `UnifiedInboxSelector` usa `availableInboxes.isConnected` do contexto (desatualizado)
3. O contexto não está sendo atualizado quando `useInboxConnectionData` busca status

A solução é garantir que quando `useInboxConnectionData` busca status do WUZAPI, ele também atualize o contexto global via `updateInboxStatus`.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend Architecture                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              SupabaseInboxContext (Fonte Única de Verdade)         │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ availableInboxes: InboxSummary[]                             │  │ │
│  │  │   - id, name, phoneNumber                                    │  │ │
│  │  │   - isConnected (sincronizado com WUZAPI)                    │  │ │
│  │  │   - isLoggedIn (sincronizado com WUZAPI)                     │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ updateInboxStatus(inboxId, { isConnected, isLoggedIn })      │  │ │
│  │  │   - Atualiza inbox específica em availableInboxes            │  │ │
│  │  │   - Atualiza context.isConnected se for inbox ativa/exibida  │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ Polling: getAllInboxesStatus() a cada 30s                    │  │ │
│  │  │   - Busca status de TODAS as inboxes via Provider API        │  │ │
│  │  │   - Atualiza availableInboxes com novos status               │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                    │
│                    ┌───────────────┼───────────────┐                    │
│                    ▼               ▼               ▼                    │
│  ┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐│
│  │ UnifiedInboxSelector │ │ ConnectionStatus │ │ InboxInfoCard        ││
│  │ (usa contexto)       │ │ (usa contexto)   │ │ (usa contexto)       ││
│  │                      │ │                  │ │                      ││
│  │ inbox.isConnected    │ │ context.         │ │ connectionStatus.    ││
│  │ inbox.isLoggedIn     │ │ isConnected      │ │ isConnected/isLoggedIn││
│  └──────────────────────┘ └──────────────────┘ └──────────────────────┘│
│                                    ▲                                    │
│                                    │                                    │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              useInboxConnectionData Hook                           │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ fetchStatus(inboxId)                                         │  │ │
│  │  │   1. Chama Provider API: /api/user/inbox/:id/status          │  │ │
│  │  │   2. Atualiza sessionStatus local                            │  │ │
│  │  │   3. Chama context.updateInboxStatus() ← CRÍTICO             │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. SupabaseInboxContext (Já Implementado - Verificar Funcionamento)

O contexto já possui a função `updateInboxStatus`, mas precisamos garantir que:
1. A função atualiza corretamente `availableInboxes`
2. A função atualiza `context.isConnected` quando é a inbox exibida
3. O polling está funcionando e atualizando todas as inboxes

```typescript
interface SupabaseInboxContextValue {
  // Estado
  availableInboxes: InboxSummary[]
  isConnected: boolean  // Status da inbox atualmente exibida
  
  // Função de sincronização
  updateInboxStatus: (inboxId: string, status: { isConnected: boolean; isLoggedIn: boolean }) => void
  
  // Refresh manual
  refreshInboxStatus: (inboxId: string) => Promise<InboxStatusResult | null>
}

interface InboxSummary {
  id: string
  name: string
  phoneNumber: string
  isConnected: boolean   // true se loggedIn no WUZAPI
  isLoggedIn?: boolean   // Explícito para clareza
  isPrimary: boolean
  unreadCount?: number
}
```

### 2. useInboxConnectionData Hook (Verificar Sincronização)

O hook já chama `updateInboxStatus`, mas precisamos verificar:
1. A chamada está sendo feita corretamente
2. Os valores passados estão corretos (isConnected = loggedIn)

```typescript
// Em fetchStatus:
const fetchStatus = useCallback(async (id: string) => {
  const result = await authenticatedFetch<StatusResponse>(`/inbox/${id}/status`)
  
  if (result.success && result.data) {
    // Atualizar estado local
    setSessionStatus({
      connected: result.data.connected,
      loggedIn: result.data.loggedIn
    })
    
    // CRÍTICO: Sincronizar com contexto global
    const ctx = inboxContextRef.current
    if (ctx?.updateInboxStatus) {
      ctx.updateInboxStatus(id, {
        isConnected: result.data.loggedIn,  // isConnected = loggedIn para consistência
        isLoggedIn: result.data.loggedIn
      })
    }
  }
}, [])
```

### 3. ConnectionStatusBadge (Verificar Mapeamento Visual)

O componente deve mapear status para cores de forma consistente:

```typescript
interface ConnectionStatusBadgeProps {
  isConnected: boolean | null | undefined
  hasError?: boolean
  size?: 'sm' | 'default' | 'lg'
  showLabel?: boolean
}

// Mapeamento de cores:
// - isConnected === true  → verde (bg-green-500)
// - isConnected === false → vermelho (bg-red-500)
// - isConnected === null/undefined ou hasError → cinza (bg-gray-500)
```

### 4. InboxInfoCard (Verificar Uso de Props)

O componente recebe `connectionStatus` como prop e deve usar esses valores:

```typescript
interface InboxInfoCardProps {
  inbox: InboxInfo
  connectionStatus: {
    isConnected: boolean
    isLoggedIn: boolean
  }
  // ...
}

// O badge deve usar:
// - isLoggedIn → "Logado" (verde)
// - isConnected && !isLoggedIn → "Aguardando QR" (amarelo)
// - !isConnected → "Desconectado" (vermelho)
```

## Data Models

### Status Flow

```
Provider API Response:
{
  connected: boolean,  // Sessão WUZAPI conectada
  loggedIn: boolean    // WhatsApp autenticado
}

↓ Transformação no Hook

Context State:
{
  isConnected: loggedIn,  // Para UI, "conectado" = "logado no WhatsApp"
  isLoggedIn: loggedIn
}

↓ Consumo nos Componentes

Visual Indicator:
- loggedIn=true  → Verde "Conectado/Logado"
- connected=true, loggedIn=false → Amarelo "Aguardando QR"
- connected=false → Vermelho "Desconectado"
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Context Status Synchronization

*For any* inbox ID and status update from Provider API, when `updateInboxStatus` is called with `{ isConnected, isLoggedIn }`, the corresponding inbox in `availableInboxes` SHALL have matching `isConnected` and `isLoggedIn` values, AND if that inbox is the currently displayed inbox, `context.isConnected` SHALL also be updated.

**Validates: Requirements 1.1, 2.1, 2.2**

### Property 2: Status to Visual Mapping

*For any* connection status combination, the visual indicator SHALL follow this mapping:
- `isLoggedIn=true` → green indicator
- `isConnected=true && isLoggedIn=false` → yellow indicator  
- `isConnected=false && isLoggedIn=false` → red indicator
- `status=null/undefined` or `hasError=true` → gray indicator

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 3: Selection Status Consistency

*For any* inbox selection in the UnifiedInboxSelector, the status indicator displayed in the selector SHALL equal the status that would be displayed in the InboxInfoCard for that same inbox, because both derive from `availableInboxes` in the context.

**Validates: Requirements 5.1, 5.3, 5.4**

### Property 4: Aggregated Status Warning

*For any* selection of "Todas as Caixas", if ANY inbox in `availableInboxes` has `isConnected=false`, the `hasDisconnectedInbox` flag SHALL be `true` and a warning indicator SHALL be displayed.

**Validates: Requirements 5.2**

### Property 5: Error State Handling

*For any* Provider API error response, the system SHALL set the inbox status to unknown (null/undefined) rather than using stale cached data, and the visual indicator SHALL be gray.

**Validates: Requirements 1.4, 6.1, 6.3**

## Error Handling

### Provider API Failure

```typescript
// No contexto, ao fazer polling:
try {
  const result = await getAllInboxesStatus()
  // Atualizar com novos status
} catch (error) {
  // NÃO usar dados cacheados como se fossem atuais
  // Marcar status como desconhecido
  setContext(prev => ({
    ...prev,
    availableInboxes: prev.availableInboxes.map(inbox => ({
      ...inbox,
      isConnected: null,  // Desconhecido
      isLoggedIn: null
    }))
  }))
}
```

### Hook Fetch Failure

```typescript
// No hook useInboxConnectionData:
const fetchStatus = async (id: string) => {
  try {
    const result = await authenticatedFetch(`/inbox/${id}/status`)
    if (result.success) {
      // Atualizar normalmente
    } else {
      // Marcar como erro, não usar cache
      setSessionStatus(null)
    }
  } catch (error) {
    setSessionStatus(null)
    setError('Erro ao buscar status')
  }
}
```

## Testing Strategy

### Unit Tests

1. **updateInboxStatus function**: Verificar que atualiza corretamente o inbox no array e context.isConnected
2. **ConnectionStatusBadge**: Verificar mapeamento de cores para cada estado
3. **hasDisconnectedInbox calculation**: Verificar cálculo correto do flag agregado

### Property-Based Tests (Vitest + fast-check)

1. **Property 1 - Context Sync**: Gerar status aleatórios, chamar updateInboxStatus, verificar estado
2. **Property 2 - Visual Mapping**: Gerar combinações de isConnected/isLoggedIn, verificar cor retornada
3. **Property 3 - Selection Consistency**: Gerar seleções, verificar que ambos componentes mostram mesmo status
4. **Property 4 - Aggregated Warning**: Gerar arrays de inboxes com status variados, verificar hasDisconnectedInbox
5. **Property 5 - Error Handling**: Simular erros, verificar que status é marcado como desconhecido

### Integration Tests

1. **E2E Flow**: Navegar para página de edição → verificar status no InboxInfoCard → verificar mesmo status no selector
2. **Status Update**: Simular mudança de status → verificar atualização em todos os componentes

## Implementation Notes

### Diagnóstico do Problema Atual

Baseado na análise do código:

1. **useInboxConnectionData** já chama `updateInboxStatus` (linha 188-191)
2. **SupabaseInboxContext** já tem `updateInboxStatus` implementado (linha 544-590)
3. O problema pode estar em:
   - A função não está sendo chamada (verificar logs)
   - Os valores passados estão incorretos
   - A lógica de "inbox exibida" não está correta

### Verificações Necessárias

1. Adicionar logs para confirmar que `updateInboxStatus` está sendo chamado
2. Verificar se `selection` no contexto está correto para determinar inbox exibida
3. Verificar se `ConnectionStatusBadge` está recebendo os valores corretos

### Correções Potenciais

1. **Se updateInboxStatus não está sendo chamado**: Verificar se `inboxContextRef.current` não é null
2. **Se valores estão incorretos**: Ajustar mapeamento `isConnected = loggedIn`
3. **Se inbox exibida não está correta**: Revisar lógica em `updateInboxStatus` que determina `shouldUpdateContextStatus`
