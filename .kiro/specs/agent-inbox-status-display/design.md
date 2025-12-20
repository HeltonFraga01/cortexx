# Design Document: Agent Inbox Status Display

## Overview

Esta funcionalidade adiciona a exibição do status de conexão (online/offline) das caixas de entrada no dashboard do agente. O sistema já possui a infraestrutura para verificar o status de conexão das caixas de entrada no contexto do usuário (`InboxListUser`), e esta implementação estende essa funcionalidade para o contexto do agente.

A solução reutiliza o endpoint existente de status de inbox (`/api/session/inboxes/:id/status`) e adiciona um novo endpoint específico para agentes que retorna o status de todas as caixas de entrada atribuídas de uma vez.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Dashboard                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────────────────────┐  │
│  │ AgentOverview    │    │ AgentInboxesPage                 │  │
│  │ (Dashboard)      │    │ (Lista de Caixas)                │  │
│  │                  │    │                                   │  │
│  │ ┌──────────────┐ │    │ ┌─────────────────────────────┐  │  │
│  │ │ Stats Card   │ │    │ │ InboxCard                   │  │  │
│  │ │ Online: 2/3  │ │    │ │ ┌─────────┐ ┌────────────┐ │  │  │
│  │ └──────────────┘ │    │ │ │ Icon    │ │ Status     │ │  │  │
│  └──────────────────┘    │ │ │ 📱      │ │ 🟢 Online  │ │  │  │
│                          │ │ └─────────┘ └────────────┘ │  │  │
│                          │ └─────────────────────────────┘  │  │
│                          └──────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Services                             │
├─────────────────────────────────────────────────────────────────┤
│  agent-data.ts                                                   │
│  ├── getMyInboxes()           // Existing                       │
│  ├── getMyInboxesWithStatus() // New - returns inboxes + status │
│  └── getInboxStatus()         // New - single inbox status      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API                                   │
├─────────────────────────────────────────────────────────────────┤
│  agentDataRoutes.js                                              │
│  ├── GET /api/agent/my/inboxes          // Existing             │
│  ├── GET /api/agent/my/inboxes/status   // New - all statuses   │
│  └── GET /api/agent/my/inboxes/:id/status // New - single status│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
├─────────────────────────────────────────────────────────────────┤
│  WUZAPI (WhatsApp Business API)                                  │
│  └── GET /session/status/:token                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. InboxStatusBadge (Novo Componente)

Componente reutilizável para exibir o status de conexão de uma caixa de entrada.

```typescript
interface InboxStatusBadgeProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'not_configured' | 'unknown'
  isLoading?: boolean
  size?: 'sm' | 'md'
}

// Mapeamento de status para visual
const STATUS_CONFIG = {
  connected: { 
    label: 'Online', 
    variant: 'success', 
    icon: Wifi 
  },
  connecting: { 
    label: 'Conectando', 
    variant: 'warning', 
    icon: RefreshCw 
  },
  disconnected: { 
    label: 'Offline', 
    variant: 'secondary', 
    icon: WifiOff 
  },
  not_configured: { 
    label: 'Não configurado', 
    variant: 'outline', 
    icon: WifiOff 
  },
  unknown: { 
    label: 'Desconhecido', 
    variant: 'outline', 
    icon: AlertCircle 
  }
}
```

#### 2. AgentInboxesPage (Modificação)

Adicionar exibição de status em cada card de caixa de entrada.

```typescript
// Novo estado para armazenar status das inboxes
const [inboxStatuses, setInboxStatuses] = useState<Record<string, InboxStatus>>({})
const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({})

// Polling automático a cada 30 segundos
useEffect(() => {
  const interval = setInterval(() => {
    refreshStatuses()
  }, 30000)
  return () => clearInterval(interval)
}, [])
```

#### 3. AgentOverview (Modificação)

Adicionar card de resumo de status das caixas de entrada.

```typescript
// Novo stats card
<StatsCard
  title="Caixas Online"
  value={`${onlineCount}/${totalCount}`}
  icon={Wifi}
  variant={onlineCount > 0 ? 'green' : 'red'}
  description={onlineCount === 0 ? 'Nenhuma caixa conectada' : undefined}
/>
```

### Backend Endpoints

#### 1. GET /api/agent/my/inboxes/status

Retorna o status de conexão de todas as caixas de entrada do agente.

```javascript
// Request
GET /api/agent/my/inboxes/status
Authorization: Bearer <agent_token>

// Response 200
{
  "success": true,
  "data": [
    {
      "inboxId": "uuid-1",
      "inboxName": "WhatsApp Principal",
      "channelType": "whatsapp",
      "status": "connected",
      "connected": true,
      "loggedIn": true
    },
    {
      "inboxId": "uuid-2",
      "inboxName": "WhatsApp Suporte",
      "channelType": "whatsapp",
      "status": "disconnected",
      "connected": false,
      "loggedIn": false
    }
  ],
  "summary": {
    "total": 2,
    "online": 1,
    "offline": 1,
    "connecting": 0
  }
}
```

#### 2. GET /api/agent/my/inboxes/:id/status

Retorna o status de uma caixa de entrada específica.

```javascript
// Request
GET /api/agent/my/inboxes/:id/status
Authorization: Bearer <agent_token>

// Response 200
{
  "success": true,
  "data": {
    "inboxId": "uuid-1",
    "status": "connected",
    "connected": true,
    "loggedIn": true,
    "details": {
      "phone": "5511999999999",
      "pushName": "Empresa"
    }
  }
}
```

### Frontend Services

#### agent-data.ts (Modificações)

```typescript
// Novo tipo para status
export interface InboxStatus {
  inboxId: string
  inboxName: string
  channelType: string
  status: 'connected' | 'connecting' | 'disconnected' | 'not_configured' | 'unknown'
  connected: boolean
  loggedIn: boolean
}

export interface InboxStatusSummary {
  total: number
  online: number
  offline: number
  connecting: number
}

// Nova função para buscar status de todas as inboxes
export async function getMyInboxesStatus(): Promise<{
  statuses: InboxStatus[]
  summary: InboxStatusSummary
}> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/my/inboxes/status`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar status das caixas de entrada')
  }
  
  return {
    statuses: result.data || [],
    summary: result.summary || { total: 0, online: 0, offline: 0, connecting: 0 }
  }
}

// Nova função para buscar status de uma inbox específica
export async function getInboxStatus(inboxId: string): Promise<InboxStatus> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/my/inboxes/${inboxId}/status`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar status da caixa de entrada')
  }
  
  return result.data
}
```

## Data Models

### InboxStatus (Frontend Type)

```typescript
interface InboxStatus {
  inboxId: string
  inboxName: string
  channelType: string
  status: 'connected' | 'connecting' | 'disconnected' | 'not_configured' | 'unknown'
  connected: boolean
  loggedIn: boolean
  details?: {
    phone?: string
    pushName?: string
  }
}
```

### InboxStatusSummary (Frontend Type)

```typescript
interface InboxStatusSummary {
  total: number
  online: number
  offline: number
  connecting: number
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status Badge Rendering Consistency

*For any* inbox status value (connected, connecting, disconnected, not_configured, unknown), the InboxStatusBadge component SHALL render the correct visual indicator (color, icon, label) corresponding to that status.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: WhatsApp-Only Status Display

*For any* list of inboxes with mixed channel types, the status indicator SHALL only be displayed for inboxes where channelType equals "whatsapp".

**Validates: Requirements 1.1, 1.5**

### Property 3: Summary Counter Accuracy

*For any* list of inbox statuses, the summary counter SHALL correctly calculate the number of online inboxes (where status === 'connected' AND loggedIn === true) versus the total number of inboxes.

**Validates: Requirements 3.1**

### Property 4: Visual Feedback Based on Online Count

*For any* list of inbox statuses, IF at least one inbox is online THEN the summary SHALL display with positive (green) styling, ELSE IF all inboxes are offline THEN the summary SHALL display an alert indicator.

**Validates: Requirements 3.2, 3.3**

### Property 5: Agent Authorization Enforcement

*For any* request to the inbox status endpoint, IF the request does not include a valid agent token THEN the response SHALL be 401 Unauthorized.

**Validates: Requirements 4.3**

### Property 6: Complete Status Return for Authenticated Agents

*For any* authenticated agent with N assigned inboxes, the status endpoint SHALL return exactly N status entries, one for each assigned inbox.

**Validates: Requirements 4.1**

## Error Handling

### Frontend Error Handling

1. **Status Fetch Failure**: Se a busca de status falhar, exibir status como "unknown" e mostrar toast de erro
2. **Network Timeout**: Após 10 segundos sem resposta, considerar status como "unknown"
3. **Partial Failure**: Se algumas inboxes retornarem erro, exibir status individual como "unknown" sem afetar as outras

### Backend Error Handling

1. **WUZAPI Unavailable**: Retornar status "unknown" para inboxes afetadas, não falhar a requisição inteira
2. **Invalid Inbox ID**: Retornar 404 para inbox não encontrada ou não atribuída ao agente
3. **Database Error**: Retornar 500 com mensagem genérica, logar detalhes internamente

```javascript
// Exemplo de tratamento de erro no backend
try {
  const status = await wuzapiClient.getSessionStatus(inbox.wuzapiToken)
  return { ...inbox, status: mapWuzapiStatus(status) }
} catch (error) {
  logger.error('Failed to get inbox status from WUZAPI', { 
    inboxId: inbox.id, 
    error: error.message 
  })
  return { ...inbox, status: 'unknown', connected: false, loggedIn: false }
}
```

## Testing Strategy

### Unit Tests

1. **InboxStatusBadge Component**: Testar renderização correta para cada status
2. **Status Mapping Functions**: Testar conversão de status WUZAPI para status interno
3. **Summary Calculation**: Testar cálculo correto de online/offline/total

### Property-Based Tests

Utilizando a biblioteca `fast-check` para TypeScript:

1. **Property 1**: Gerar status aleatórios e verificar renderização correta
2. **Property 2**: Gerar listas de inboxes com channelTypes variados e verificar filtro
3. **Property 3**: Gerar listas de status e verificar cálculo do summary
4. **Property 4**: Gerar listas com diferentes proporções online/offline e verificar estilo
5. **Property 5**: Gerar requisições com/sem token e verificar resposta
6. **Property 6**: Gerar agentes com N inboxes e verificar retorno completo

### Integration Tests

1. **Endpoint Authentication**: Verificar que endpoint rejeita requisições sem token
2. **Status Polling**: Verificar que polling atualiza status corretamente
3. **Error Recovery**: Verificar comportamento quando WUZAPI está indisponível

### Configuration

- Mínimo 100 iterações por property test
- Cada teste deve referenciar a propriedade do design document
- Tag format: **Feature: agent-inbox-status-display, Property {number}: {property_text}**
