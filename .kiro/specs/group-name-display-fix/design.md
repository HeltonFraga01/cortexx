# Design Document: Group Name Display Fix

## Overview

Este documento descreve o design para corrigir a exibição do nome de grupos do WhatsApp na lista de conversas. O problema atual é que o sistema está usando o `PushName` do participante que enviou a mensagem como nome da conversa, ao invés de buscar o nome real do grupo via WUZAPI.

A solução envolve:
1. Corrigir a lógica de extração do nome do grupo no webhook handler
2. Garantir que o nome do grupo seja buscado via WUZAPI `/group/info` antes de criar/atualizar a conversa
3. Implementar detecção e correção de nomes incorretos (JID ou nome de participante)
4. Adicionar fallback formatado quando a API falhar

## Architecture

```mermaid
flowchart TD
    subgraph WUZAPI
        WH[Webhook Event]
        GI[/group/info API]
    end
    
    subgraph Backend
        CMH[ChatMessageHandler]
        CS[ChatService]
        DB[(SQLite DB)]
    end
    
    subgraph Frontend
        CL[ConversationList]
    end
    
    WH -->|Message Event| CMH
    CMH -->|Is Group?| CMH
    CMH -->|Yes: Fetch Group Name| GI
    GI -->|Group Name| CMH
    CMH -->|Store with Group Name| CS
    CS -->|INSERT/UPDATE contact_name| DB
    
    CL -->|GET /conversations| CS
    CS -->|SELECT| DB
    DB -->|Conversations with Group Names| CS
    CS -->|JSON Response| CL
```

## Components and Interfaces

### 1. Backend: ChatMessageHandler (Modificação)

**Arquivo:** `server/webhooks/chatMessageHandler.js`

**Problema Atual:**
O código atual tem uma condição `needsGroupNameFetch` que verifica se precisa buscar o nome do grupo, mas a lógica está incompleta:
- Não detecta quando `contact_name` é apenas números (JID sem @g.us)
- A comparação `contact_name === participantName` pode falhar se o participantName for null

**Modificações:**
1. Melhorar a função `needsGroupNameFetch` para detectar mais casos de nomes incorretos
2. Sempre buscar o nome do grupo para novas conversas de grupo
3. Adicionar validação para garantir que o nome retornado não é um JID

```javascript
// Função auxiliar para verificar se um nome parece ser um JID ou número
function isInvalidGroupName(name) {
  if (!name) return true
  // Verifica se é apenas números (JID sem @g.us)
  if (/^\d+$/.test(name)) return true
  // Verifica se contém @g.us
  if (name.includes('@g.us')) return true
  // Verifica se começa com "Grupo " seguido de números (fallback anterior)
  if (/^Grupo \d+/.test(name)) return true
  return false
}
```

### 2. Backend: fetchGroupName (Modificação)

**Arquivo:** `server/webhooks/chatMessageHandler.js`

**Problema Atual:**
A função `fetchGroupName` retorna o JID como fallback quando a API falha, o que resulta em nomes como `120363043775639115`.

**Modificações:**
1. Retornar um fallback formatado: `"Grupo (número truncado)"`
2. Adicionar cache temporário para evitar chamadas repetidas à API
3. Melhorar o tratamento de erros

```javascript
async fetchGroupName(groupJid, userToken) {
  // ... código existente ...
  
  // Fallback formatado ao invés de retornar o JID
  const groupNumber = groupJid.split('@')[0]
  const truncatedNumber = groupNumber.length > 8 
    ? groupNumber.substring(0, 8) + '...' 
    : groupNumber
  return `Grupo ${truncatedNumber}`
}
```

### 3. Backend: ChatService.getOrCreateConversation (Modificação)

**Arquivo:** `server/services/ChatService.js`

**Modificações:**
1. Adicionar validação do nome antes de criar/atualizar conversa
2. Forçar atualização do nome se o existente for inválido

## Data Models

### conversations (Sem alteração de schema)

| Column | Type | Description |
|--------|------|-------------|
| contact_name | TEXT | Nome do contato ou grupo (DEVE ser o nome real do grupo, não do participante) |

### Validação de contact_name para grupos

Para conversas de grupo (contact_jid termina em @g.us):
- ✅ "Borabrother Iptv" - Nome válido do grupo
- ✅ "Lima Sat Iptv" - Nome válido do grupo
- ❌ "120363043775639115" - JID inválido
- ❌ "streaming play" - Nome de participante (se igual ao PushName)
- ❌ null/empty - Precisa buscar

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Group name stored correctly
*For any* group message processed by the system, the resulting conversation's `contact_name` field SHALL contain the group name from WUZAPI, not the participant's PushName or the raw JID.
**Validates: Requirements 1.1, 1.2, 3.1, 3.2**

### Property 2: Invalid name detection and correction
*For any* group conversation where `contact_name` is null, empty, matches a JID pattern, or equals the participant's PushName, the system SHALL attempt to fetch and update the correct group name from WUZAPI.
**Validates: Requirements 1.3, 1.5, 3.3, 3.4**

### Property 3: Group name update persistence
*For any* group name update (whether from initial fetch or correction), the new name SHALL be immediately persisted to the database and returned in subsequent queries.
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Fallback format consistency
*For any* group where the name cannot be fetched from WUZAPI, the system SHALL display a formatted fallback in the pattern "Grupo XXXXXXXX..." (truncated JID).
**Validates: Requirements 1.4**

## Error Handling

| Scenario | Handling |
|----------|----------|
| WUZAPI /group/info returns error | Use formatted fallback "Grupo XXXX...", mark for retry on next message |
| WUZAPI /group/info returns empty name | Use formatted fallback, log warning |
| Network timeout | Use formatted fallback, retry on next message |
| Group name same as participant name | Re-fetch from WUZAPI to confirm |

## Testing Strategy

### Unit Tests
- `isInvalidGroupName()` - Validação de nomes inválidos
- `fetchGroupName()` - Busca de nome do grupo com mock da API
- `formatFallbackGroupName()` - Formatação do fallback

### Property-Based Tests (fast-check)
- **Property 1:** Gerar payloads de webhook de grupo e verificar que contact_name não é PushName nem JID
- **Property 2:** Gerar conversas com nomes inválidos e verificar correção
- **Property 3:** Gerar atualizações de nome e verificar persistência
- **Property 4:** Gerar cenários de falha de API e verificar formato do fallback

### Integration Tests
- Webhook de grupo → verificar nome correto na conversa
- Conversa existente com nome errado → verificar correção após nova mensagem

### Test Framework
- Backend: Node.js test runner com fast-check para property-based testing
- Configuração: Mínimo de 100 iterações por property test
- Cada property-based test DEVE ser anotado com: `**Feature: group-name-display-fix, Property {number}: {property_text}**`

