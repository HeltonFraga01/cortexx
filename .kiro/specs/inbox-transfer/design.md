# Design Document - Transferência de Conversa entre Caixas de Entrada

## Introduction

Este documento descreve a arquitetura e design técnico para implementar a funcionalidade de transferência de conversas entre caixas de entrada (inboxes) dentro da mesma conta.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Fluxo de Transferência                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Frontend (React)                                                   │
│  ├── ConversationView.tsx                                          │
│  │   └── InboxSelector (dropdown com inboxes disponíveis)          │
│  ├── ConversationHeader.tsx                                        │
│  │   └── Indicador visual da inbox atual                           │
│  └── TransferHistoryPanel.tsx (opcional)                           │
│      └── Lista de transferências anteriores                        │
│                                                                     │
│  API Layer                                                          │
│  └── PATCH /api/chat/conversations/:id/transfer                    │
│      ├── Valida ownership da conversa                              │
│      ├── Valida acesso à inbox de destino                          │
│      ├── Atualiza inbox_id da conversa                             │
│      └── Registra histórico de transferência                       │
│                                                                     │
│  Database (Supabase)                                                │
│  ├── conversations (atualiza inbox_id)                             │
│  └── conversation_transfers (novo - histórico)                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Design

### Nova Tabela: conversation_transfers

```sql
CREATE TABLE conversation_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_inbox_id UUID NOT NULL REFERENCES inboxes(id),
  to_inbox_id UUID NOT NULL REFERENCES inboxes(id),
  transferred_by UUID REFERENCES agents(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_conversation_transfers_conversation_id ON conversation_transfers(conversation_id);
CREATE INDEX idx_conversation_transfers_transferred_at ON conversation_transfers(transferred_at DESC);

-- RLS Policy
ALTER TABLE conversation_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfers for their account conversations"
  ON conversation_transfers FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE account_id = auth.uid()
    )
  );
```

### Alteração na Tabela conversations

Nenhuma alteração necessária - já possui `inbox_id` que será atualizado.

## API Design

### Endpoint: Transfer Conversation

```
PATCH /api/chat/conversations/:conversationId/transfer
```

**Request Headers:**
```
Authorization: Bearer <user_token>
```

**Request Body:**
```json
{
  "targetInboxId": "uuid-da-inbox-destino",
  "reason": "Transferindo para equipe de suporte" // opcional
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "uuid-conversa",
      "inboxId": "uuid-nova-inbox",
      "contactName": "João Silva",
      "contactJid": "5511999999999@s.whatsapp.net"
    },
    "transfer": {
      "id": "uuid-transfer",
      "fromInboxId": "uuid-inbox-origem",
      "toInboxId": "uuid-inbox-destino",
      "transferredAt": "2025-12-23T10:00:00Z"
    }
  }
}
```

**Error Responses:**

- `400 Bad Request` - targetInboxId inválido ou igual à inbox atual
- `403 Forbidden` - Sem permissão para a inbox de destino
- `404 Not Found` - Conversa não encontrada

### Endpoint: Get Transfer History

```
GET /api/chat/conversations/:conversationId/transfers
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "transfers": [
      {
        "id": "uuid",
        "fromInbox": { "id": "uuid", "name": "WhatsApp HeltonFraga" },
        "toInbox": { "id": "uuid", "name": "WhatsApp Lívia-Suporte" },
        "transferredBy": { "id": "uuid", "name": "Admin" },
        "transferredAt": "2025-12-23T10:00:00Z",
        "reason": "Transferindo para equipe de suporte"
      }
    ]
  }
}
```

## Component Design

### InboxSelector Component

```typescript
// src/components/features/chat/InboxSelector.tsx
interface InboxSelectorProps {
  currentInboxId: string
  accountId: string
  onTransfer: (targetInboxId: string) => Promise<void>
  disabled?: boolean
}

// Exibe dropdown com inboxes disponíveis
// Mostra nome e status de conexão de cada inbox
// Desabilita inbox atual na lista
// Confirma antes de transferir
```

### ConversationHeader Enhancement

```typescript
// Adicionar ao ConversationHeader.tsx existente
// Badge/chip mostrando nome da inbox atual
// Botão/ícone para abrir InboxSelector
```

## Service Layer

### ChatService.transferConversation()

```javascript
/**
 * Transfer a conversation to another inbox
 * @param {string} accountId - Account ID
 * @param {string} conversationId - Conversation ID
 * @param {string} targetInboxId - Target inbox ID
 * @param {Object} options - Transfer options
 * @returns {Promise<Object>} Transfer result
 */
async transferConversation(accountId, conversationId, targetInboxId, options = {}) {
  // 1. Validar que conversa pertence à conta
  // 2. Validar que inbox de destino pertence à conta
  // 3. Validar que inbox de destino é diferente da atual
  // 4. Atualizar inbox_id na conversa
  // 5. Registrar transferência no histórico
  // 6. Retornar conversa atualizada
}
```

## Correctness Properties

### Property 1: Ownership Validation
- A conversa DEVE pertencer à conta do usuário autenticado
- A inbox de destino DEVE pertencer à mesma conta

### Property 2: Transfer Atomicity
- A atualização do inbox_id e o registro de histórico DEVEM ser atômicos
- Se uma operação falhar, ambas devem ser revertidas

### Property 3: Message Integrity
- Todas as mensagens da conversa DEVEM permanecer intactas após transferência
- O histórico de mensagens NÃO DEVE ser afetado

### Property 4: Token Consistency
- Após transferência, envio de mensagens DEVE usar o token WUZAPI da nova inbox
- O sistema DEVE buscar o token correto baseado no inbox_id da conversa

### Property 5: Audit Trail
- Toda transferência DEVE ser registrada com: origem, destino, timestamp, usuário
- O histórico DEVE ser imutável (apenas INSERT, nunca UPDATE/DELETE)

## Security Considerations

1. **Authorization**: Verificar que usuário tem acesso tanto à conversa quanto à inbox de destino
2. **Rate Limiting**: Limitar transferências para evitar abuso (ex: 10 por minuto)
3. **Validation**: Validar UUIDs e prevenir SQL injection via SupabaseService
4. **Logging**: Registrar todas as transferências para auditoria

## Migration Strategy

1. Criar tabela `conversation_transfers` via migration
2. Adicionar método `transferConversation` ao ChatService
3. Criar rota PATCH no chatInboxRoutes.js
4. Implementar componente InboxSelector no frontend
5. Integrar InboxSelector no ConversationView

## Dependencies

- `server/services/ChatService.js` - Adicionar método transferConversation
- `server/routes/chatInboxRoutes.js` - Adicionar rota de transferência
- `src/components/features/chat/ConversationView.tsx` - Integrar InboxSelector
- `src/hooks/useInboxes.ts` - Hook para listar inboxes (já existe)
