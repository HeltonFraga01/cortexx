# Chat API & Supabase Realtime Migration - Tasks

## Fase 1: Preparação da Infraestrutura

- [x] 1.1 Configurar Supabase Realtime
  - Habilitar Realtime nas tabelas `chat_messages` e `conversations`
  - Criar índices de performance para queries de chat
  - Verificar e atualizar RLS policies
  - _Requisitos: REQ-1.1, REQ-4.1_

- [x] 1.2 Criar RealtimeService no Backend
  - Criar `server/services/RealtimeService.js`
  - Implementar método `broadcastToConversation()`
  - Implementar método `broadcastToUserInbox()`
  - Implementar transformação de payload (snake_case → camelCase)
  - _Requisitos: REQ-1.2, REQ-1.3_

- [x] 1.3 Criar Hook useSupabaseRealtime no Frontend
  - Criar `src/hooks/useSupabaseRealtime.ts`
  - Implementar subscription ao canal de inbox do usuário
  - Implementar `joinConversation()` e `leaveConversation()`
  - Implementar `sendTypingIndicator()` via Presence
  - _Requisitos: REQ-1.1, REQ-1.4_

- [x] 1.4 Implementar Feature Flag
  - Adicionar variável `VITE_CHAT_REALTIME_PROVIDER` no frontend
  - Adicionar variável `CHAT_REALTIME_PROVIDER` no backend
  - Documentar configuração no `.env.example`
  - _Requisitos: REQ-3.1_

## Fase 2: Integração Backend

- [x] 2.1 Atualizar ChatService para Dual-Write
  - Importar `RealtimeService` no `ChatService.js`
  - Modificar métodos de broadcast para usar ambos providers
  - Adicionar flag para controlar qual provider usar
  - _Nota: Broadcasts são feitos no chatMessageHandler.js, não no ChatService_
  - _Requisitos: REQ-1.2, REQ-1.3, REQ-3.1_

- [x] 2.2 Atualizar Webhook Handler
  - Modificar `chatMessageHandler.js` para usar `RealtimeService`
  - Garantir que eventos de mensagem incoming disparam broadcast
  - _Requisitos: REQ-1.2_

- [x] 2.3 Criar Tabelas para API Externa
  - Criar tabela `chat_api_keys` para API keys
  - Criar tabela `chat_external_webhooks` para webhooks externos
  - Criar índices e RLS policies
  - _Requisitos: REQ-2.4, REQ-2.3_

- [x] 2.4 Implementar Autenticação por API Key
  - Criar `server/middleware/apiKeyAuth.js`
  - Implementar validação de API key via hash
  - Implementar verificação de scopes e rate limiting
  - _Requisitos: REQ-2.4_

- [x] 2.5 Criar API v1 Routes
  - Criar `server/routes/api/v1/chatRoutes.js`
  - Implementar endpoints de conversas e mensagens
  - Registrar rotas em `server/routes/index.js`
  - _Requisitos: REQ-2.1, REQ-2.2_

- [x] 2.6 Implementar Webhooks Externos
  - Criar `server/services/ExternalWebhookService.js`
  - Implementar disparo de eventos com retry e HMAC
  - Criar rotas CRUD para webhooks
  - _Requisitos: REQ-2.3_

## Fase 3: Integração Frontend

- [x] 3.1 Integrar useSupabaseRealtime no ChatLayout
  - Importar `useSupabaseRealtime` no `ChatLayout.tsx`
  - Implementar lógica de seleção baseada em feature flag
  - _Requisitos: REQ-1.1, REQ-3.1_

- [x] 3.2 Atualizar Handlers de Eventos
  - Atualizar handlers para novo formato de payload
  - Garantir invalidação correta de queries
  - _Requisitos: REQ-1.2, REQ-1.3, REQ-1.4_

- [x] 3.3 Implementar Indicadores de Presença
  - Criar/atualizar componente `TypingIndicator.tsx`
  - Integrar com Supabase Presence
  - _Requisitos: REQ-1.4_

- [x] 3.4 Criar Cliente Supabase Configurado
  - Criar/atualizar `src/lib/supabase.ts`
  - Configurar cliente com auth do usuário
  - _Requisitos: REQ-1.1_

## Fase 4: Checkpoint

- [x] 4.1 Checkpoint - Validar implementação
  - Ensure all tests pass, ask the user if questions arise.

## Fase 5: Correção de Bugs Multi-Inbox

- [x] 5.1 Corrigir deleteConversation - Erro "Conversation not found or unauthorized"
  - **Problema**: Rota DELETE `/conversations/:id` passa `req.userToken` (WUZAPI token) como JWT para RLS
  - **Causa Raiz**: `getConversationById()` usa `queryAsUser(token, ...)` esperando JWT Supabase, mas recebe token WUZAPI
  - **Impacto**: Usuários com múltiplas inboxes não conseguem deletar conversas quando "Todas as Caixas" está selecionado
  - **Arquivos Modificados**: 
    - `server/routes/chatInboxRoutes.js` - Atualizado para usar `req.accountId` do middleware context
    - `server/services/ChatService.js` - Modificado `deleteConversation()` para usar `queryAsAdmin` com filtro por `account_id`
  - **Solução Implementada**:
    1. ✅ Rota DELETE agora usa `req.accountId` do middleware context em vez de `req.userToken`
    2. ✅ `deleteConversation()` verifica ownership usando `queryAsAdmin` com filtro `account_id`
    3. ✅ Adicionados logs de diagnóstico detalhados
  - _Requisitos: REQ-3.2, REQ-3.3_

- [ ] 5.2 Revisar getConversationById para Multi-Inbox
  - **Problema**: Método filtra por `account_id` mas não considera que uma conta pode ter múltiplas inboxes
  - **Verificação**: Garantir que a verificação de ownership funciona corretamente para todas as inboxes da conta
  - **Arquivos**: `server/services/ChatService.js`
  - _Requisitos: REQ-3.2_

- [x] 5.3 Padronizar uso de accountId vs userToken nas rotas de chat
  - **Problema**: Inconsistência entre rotas - algumas usam `req.accountId`, outras usam `req.userToken`
  - **Solução Implementada**: 
    - ✅ Corrigida rota `DELETE /conversations` (delete all) para usar `req.accountId`
    - ✅ Removida rota duplicada `DELETE /conversations`
  - **Arquivos Modificados**: `server/routes/chatInboxRoutes.js`
  - _Requisitos: REQ-3.1, REQ-3.2, REQ-3.3_

- [x] 5.4 Adicionar logs de diagnóstico para operações de chat
  - ✅ Adicionados logs detalhados em `deleteConversation` 
  - ✅ Logs incluem: accountId, inboxId, conversationId, userIdType
  - **Arquivos Modificados**: `server/services/ChatService.js`, `server/routes/chatInboxRoutes.js`
  - _Requisitos: REQ-4.1_

## Notas

- Tasks marcadas com `*` são opcionais
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
