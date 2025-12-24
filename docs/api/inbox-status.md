# Inbox Status API

API para consultar status de conexão de inboxes WhatsApp. O status SEMPRE vem da API do Provider (WUZAPI, Evolution, etc.) como fonte única de verdade.

## Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   Provider API  │
│  (React/TS)     │     │  (Node/Express) │     │    (WUZAPI)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  GET /inbox/:id/status│   getStatus()         │
        │◀──────────────────────│◀──────────────────────│
        │                       │                       │
```

## Endpoints

### GET /api/user/inbox/:id/status

Retorna o status de conexão de uma inbox específica.

**Autenticação**: Bearer Token (Supabase Auth)

**Parâmetros**:
- `id` (path): ID da inbox

**Resposta de Sucesso** (200):
```json
{
  "success": true,
  "data": {
    "success": true,
    "inboxId": "uuid-da-inbox",
    "status": {
      "connected": true,
      "loggedIn": true,
      "qrCode": null
    },
    "source": "provider",
    "cachedAt": "2024-12-24T10:30:00.000Z"
  }
}
```

**Resposta de Erro - Provider Indisponível**:
```json
{
  "success": true,
  "data": {
    "success": false,
    "inboxId": "uuid-da-inbox",
    "status": {
      "connected": false,
      "loggedIn": false
    },
    "source": "error",
    "error": "Não foi possível conectar com o provedor",
    "code": "PROVIDER_UNAVAILABLE"
  }
}
```

**Resposta de Erro - Acesso Negado** (403):
```json
{
  "success": false,
  "error": {
    "code": "ACCESS_DENIED",
    "message": "Você não tem acesso a esta caixa de entrada"
  }
}
```

### GET /api/user/inboxes/status

Retorna o status de conexão de todas as inboxes do usuário.

**Autenticação**: Bearer Token (Supabase Auth)

**Resposta de Sucesso** (200):
```json
{
  "success": true,
  "data": {
    "statuses": [
      {
        "inboxId": "uuid-inbox-1",
        "success": true,
        "status": {
          "connected": true,
          "loggedIn": true
        },
        "source": "provider"
      },
      {
        "inboxId": "uuid-inbox-2",
        "success": false,
        "status": {
          "connected": false,
          "loggedIn": false
        },
        "source": "error",
        "error": "Provedor indisponível",
        "code": "PROVIDER_UNAVAILABLE"
      }
    ],
    "totalInboxes": 2,
    "connectedCount": 1,
    "errorCount": 1
  }
}
```

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `ACCESS_DENIED` | Usuário não tem acesso à inbox |
| `INBOX_NOT_FOUND` | Inbox não encontrada |
| `PROVIDER_UNAVAILABLE` | Não foi possível conectar com o provedor |
| `PROVIDER_TIMEOUT` | Tempo limite excedido ao conectar |
| `INVALID_TOKEN` | Token de autenticação inválido |
| `RATE_LIMITED` | Muitas requisições |
| `STATUS_ERROR` | Erro genérico ao consultar status |
| `INTERNAL_ERROR` | Erro interno do servidor |

## Estados de Conexão

| Estado | `connected` | `loggedIn` | Descrição |
|--------|-------------|------------|-----------|
| Conectado | `true` | `true` | Sessão ativa, pode enviar mensagens |
| Aguardando QR | `true` | `false` | Conexão TCP ativa, aguardando scan do QR Code |
| Desconectado | `false` | `false` | Sem conexão com o WhatsApp |
| Desconhecido | - | - | Erro ao consultar status (source: 'error') |

## Uso no Frontend

### Serviço

```typescript
import { getInboxStatus, getAllInboxesStatus } from '@/services/inbox-status'

// Status de uma inbox
const result = await getInboxStatus('inbox-id')
if (result.success) {
  console.log('Conectado:', result.status.loggedIn)
}

// Status de todas as inboxes
const allStatus = await getAllInboxesStatus()
console.log('Conectadas:', allStatus.connectedCount)
```

### Context

O `SupabaseInboxContext` gerencia o polling automático de status:

```typescript
import { useSupabaseInbox } from '@/contexts/SupabaseInboxContext'

function MyComponent() {
  const { 
    isConnected,           // Status da inbox ativa
    hasDisconnectedInbox,  // Alguma inbox desconectada
    refreshInboxStatus     // Refresh manual
  } = useSupabaseInbox()
  
  // Refresh após ação de conexão
  const handleConnect = async () => {
    await connectInbox(inboxId)
    await refreshInboxStatus(inboxId)
  }
}
```

### Helpers

```typescript
import { 
  isInboxReady,      // Pode enviar mensagens?
  needsQrCode,       // Precisa escanear QR?
  hasStatusError,    // Houve erro na consulta?
  getStatusMessage,  // Mensagem amigável
  getStatusColor,    // Cor do badge
  getStatusIcon      // Ícone Lucide
} from '@/services/inbox-status'
```

## Polling

O contexto implementa polling inteligente:

- **Intervalo**: 30 segundos (configurável)
- **Page Visibility API**: Pausa quando a aba não está visível
- **Deduplicação**: Evita requisições duplicadas em andamento
- **Refresh imediato**: Após ações de conexão/desconexão

## Arquivos Relacionados

### Backend
- `server/routes/userInboxStatusRoutes.js` - Endpoints HTTP
- `server/services/InboxStatusService.js` - Lógica de negócio
- `server/services/providers/WuzapiAdapter.js` - Adapter WUZAPI
- `server/services/providers/ProviderAdapterFactory.js` - Factory de adapters

### Frontend
- `src/services/inbox-status.ts` - Cliente API
- `src/types/inbox-status.ts` - Tipos TypeScript
- `src/contexts/SupabaseInboxContext.tsx` - Context com polling
- `src/components/shared/ConnectionStatus.tsx` - Componente de status

### Testes
- `cypress/e2e/inbox-status.cy.ts` - Testes E2E
