# Design Document: Supabase Migration Fixes

## Overview

Este documento descreve as correções necessárias para resolver erros identificados no perfil de usuário após a migração do banco de dados SQLite para Supabase. Os erros são causados por serviços que ainda utilizam a sintaxe do SQLite (`this.db.query()`) em vez dos métodos do SupabaseService, e por métodos ausentes no ChatService.

## Architecture

### Problema Atual

```
┌─────────────────────────────────────────────────────────────┐
│                    Arquitetura Atual (Quebrada)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Routes                                                     │
│  ├── userWebhookRoutes.js                                   │
│  │   └── new OutgoingWebhookService(SupabaseService)        │
│  │       └── this.db.query() ❌ (não existe no Supabase)    │
│  │                                                          │
│  ├── chatInboxRoutes.js                                     │
│  │   └── new ChatService(SupabaseService)                   │
│  │       └── chatService.getLabels() ❌ (método ausente)    │
│  │       └── chatService.getCannedResponses() ❌ (ausente)  │
│  │                                                          │
│  └── bulkCampaignRoutes.js                                  │
│      └── db.query() ❌ (usando SQLite diretamente)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Solução Proposta

```
┌─────────────────────────────────────────────────────────────┐
│                    Arquitetura Corrigida                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Routes                                                     │
│  ├── userWebhookRoutes.js                                   │
│  │   └── new OutgoingWebhookService()                       │
│  │       └── supabaseService.getMany() ✅                   │
│  │       └── supabaseService.insert() ✅                    │
│  │       └── supabaseService.update() ✅                    │
│  │                                                          │
│  ├── chatInboxRoutes.js                                     │
│  │   └── new ChatService()                                  │
│  │       └── chatService.getLabels() ✅ (implementado)      │
│  │       └── chatService.getCannedResponses() ✅            │
│  │                                                          │
│  └── bulkCampaignRoutes.js                                  │
│      └── supabaseService.getMany() ✅                       │
│      └── supabaseService.count() ✅                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. OutgoingWebhookService (Refatoração)

O serviço precisa ser refatorado para usar SupabaseService em vez de `this.db.query()`.

**Métodos a refatorar:**
- `configureWebhook()` - INSERT usando `supabaseService.insert()`
- `updateWebhook()` - UPDATE usando `supabaseService.update()`
- `deleteWebhook()` - DELETE usando `supabaseService.delete()`
- `getWebhookById()` - SELECT usando `supabaseService.getOne()`
- `getWebhooks()` - SELECT usando `supabaseService.getMany()`
- `logDelivery()` - INSERT usando `supabaseService.insert()`
- `updateWebhookStats()` - UPDATE usando `supabaseService.update()`
- `getWebhookStats()` - SELECT usando `supabaseService.getMany()`

### 2. ChatService (Novos Métodos)

O ChatService precisa implementar os métodos ausentes:

**Métodos a adicionar:**
- `getLabels(token)` - Retorna todas as labels do usuário
- `createLabel(token, data)` - Cria uma nova label
- `updateLabel(token, id, data)` - Atualiza uma label
- `deleteLabel(token, id)` - Remove uma label
- `getCannedResponses(token, options)` - Retorna respostas prontas
- `createCannedResponse(token, data)` - Cria resposta pronta
- `updateCannedResponse(token, id, data)` - Atualiza resposta pronta
- `deleteCannedResponse(token, id)` - Remove resposta pronta

### 3. BulkCampaignRoutes (Refatoração)

A rota `/history` precisa usar SupabaseService em vez de `db.query()`.

## Data Models

### outgoing_webhooks (Supabase)
```sql
CREATE TABLE outgoing_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events JSONB DEFAULT '[]',
  secret TEXT,
  is_active BOOLEAN DEFAULT true,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### webhook_deliveries (Supabase)
```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES outgoing_webhooks(id),
  delivery_id TEXT,
  event_type TEXT,
  payload JSONB,
  status TEXT,
  success BOOLEAN,
  attempts INTEGER,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### labels (Supabase)
```sql
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### canned_responses (Supabase)
```sql
CREATE TABLE canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  shortcut TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Webhook retrieval returns valid array
*For any* user ID, when outgoing webhooks are retrieved, the system should return an array (possibly empty) without throwing errors.
**Validates: Requirements 1.1, 1.3**

### Property 2: Labels retrieval returns valid array
*For any* user token, when labels are retrieved, the system should return an array of label objects with id, name, and color properties.
**Validates: Requirements 2.1, 2.3**

### Property 3: Canned responses retrieval returns valid array
*For any* user token, when canned responses are retrieved, the system should return an array of response objects with id, shortcut, and content properties.
**Validates: Requirements 3.1, 3.3**

### Property 4: Conversations retrieval handles all states
*For any* user ID and filter combination, when conversations are retrieved, the system should return a valid response object with conversations array and pagination info.
**Validates: Requirements 4.1, 4.3**

### Property 5: Campaign history handles empty results
*For any* user token, when campaign history is retrieved and no campaigns exist, the system should return `{ total: 0, items: [] }` without errors.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 6: Error responses include meaningful messages
*For any* failed database operation, the error response should include a descriptive message that helps identify the issue.
**Validates: Requirements 6.2**

## Error Handling

### Estratégia de Tratamento de Erros

1. **Validação de Entrada**: Validar parâmetros antes de executar queries
2. **Try-Catch**: Envolver todas as operações de banco em try-catch
3. **Logging Estruturado**: Usar logger com contexto (userId, endpoint, error)
4. **Respostas Consistentes**: Sempre retornar `{ success: boolean, data?: any, error?: string }`
5. **Graceful Degradation**: Retornar arrays vazios em vez de erros quando apropriado

### Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Parâmetros inválidos |
| 404 | Recurso não encontrado |
| 500 | Erro interno do servidor |

## Testing Strategy

### Unit Tests

- Testar cada método do OutgoingWebhookService refatorado
- Testar novos métodos do ChatService (getLabels, getCannedResponses)
- Testar tratamento de erros e edge cases

### Property-Based Tests

Usar Vitest com fast-check para testes de propriedade:

1. **Webhook Service Tests**
   - Propriedade: getWebhooks sempre retorna array
   - Propriedade: webhook criado pode ser recuperado

2. **ChatService Tests**
   - Propriedade: getLabels sempre retorna array
   - Propriedade: getCannedResponses sempre retorna array

3. **Campaign History Tests**
   - Propriedade: history sempre retorna objeto com total e items

### Integration Tests

- Testar fluxo completo de criação/leitura de webhooks
- Testar fluxo completo de labels
- Testar fluxo completo de canned responses
- Testar paginação de campaign history
