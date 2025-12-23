# Chat API & Supabase Realtime Migration - Requirements

## Visão Geral

Migração do sistema de chat atual (Socket.IO) para Supabase Realtime, preparando-o como uma API independente que pode ser integrada com sistemas externos.

## Contexto Atual

### Arquitetura Existente
- **WebSocket**: Socket.IO no namespace `/chat`
- **Backend**: Express routes em `chatInboxRoutes.js`, `chatRoutes.js`, `chatWebhookRoutes.js`
- **Serviços**: `ChatService.js` para lógica de negócio
- **Webhook Handler**: `chatMessageHandler.js` processa eventos do WUZAPI
- **Frontend**: `useChatSocket.ts` hook + `ChatLayout.tsx` componente principal

### Fluxo Atual de Mensagens
1. Mensagem chega via webhook WUZAPI → `chatWebhookRoutes.js`
2. Handler processa → `chatMessageHandler.js`
3. Salva no Supabase → `ChatService.js`
4. Broadcast via Socket.IO → `ChatWebSocketHandler.js`
5. Frontend recebe → `useChatSocket.ts`

### Problemas Identificados
- Socket.IO adiciona complexidade de infraestrutura
- Não aproveita recursos nativos do Supabase (RLS, Realtime)
- Difícil integração com sistemas externos
- Autenticação duplicada (Socket.IO + API)

---

## Requisitos Funcionais

### REQ-1: Migração para Supabase Realtime

#### REQ-1.1: Canais de Realtime
**EARS**: When a user authenticates, the system shall subscribe to Supabase Realtime channels for their conversations.

**Acceptance Criteria**:
- [ ] Canal por conversa: `conversation:{id}` para mensagens e atualizações
- [ ] Canal global por usuário: `user:{userId}:inbox` para notificações de novas conversas
- [ ] Suporte a presença (presence) para indicadores de digitação e online
- [ ] Reconexão automática em caso de desconexão

#### REQ-1.2: Eventos de Mensagem
**EARS**: When a new message is saved to the database, the system shall broadcast it via Supabase Realtime to all subscribers.

**Acceptance Criteria**:
- [ ] Evento `INSERT` na tabela `chat_messages` dispara broadcast
- [ ] Evento `UPDATE` para status de mensagem (sent, delivered, read)
- [ ] Evento `DELETE` para mensagens apagadas
- [ ] Payload inclui dados completos da mensagem transformados para camelCase

#### REQ-1.3: Eventos de Conversa
**EARS**: When a conversation is updated, the system shall notify all relevant subscribers.

**Acceptance Criteria**:
- [ ] Evento `UPDATE` na tabela `conversations` dispara broadcast
- [ ] Notificação de nova conversa para o canal do usuário
- [ ] Atualização de status (open, pending, resolved, snoozed)
- [ ] Atualização de atribuição (assignedAgentId, assignedBotId)

#### REQ-1.4: Indicadores de Presença
**EARS**: While a user is typing, the system shall broadcast typing indicators to other participants.

**Acceptance Criteria**:
- [ ] Usar Supabase Realtime Presence para tracking
- [ ] Indicador de digitação com auto-expire (5 segundos)
- [ ] Lista de agentes online por conversa
- [ ] Sincronização de estado entre múltiplas abas

---

### REQ-2: API REST para Integração Externa

#### REQ-2.1: Endpoints de Conversas
**EARS**: The system shall provide REST endpoints for external systems to manage conversations.

**Acceptance Criteria**:
- [ ] `GET /api/v1/chat/conversations` - Listar conversas com paginação
- [ ] `GET /api/v1/chat/conversations/:id` - Detalhes da conversa
- [ ] `POST /api/v1/chat/conversations` - Criar nova conversa
- [ ] `PATCH /api/v1/chat/conversations/:id` - Atualizar conversa
- [ ] `DELETE /api/v1/chat/conversations/:id` - Arquivar conversa

#### REQ-2.2: Endpoints de Mensagens
**EARS**: The system shall provide REST endpoints for external systems to send and receive messages.

**Acceptance Criteria**:
- [ ] `GET /api/v1/chat/conversations/:id/messages` - Listar mensagens com paginação
- [ ] `POST /api/v1/chat/conversations/:id/messages` - Enviar mensagem
- [ ] `PATCH /api/v1/chat/messages/:id` - Editar mensagem
- [ ] `DELETE /api/v1/chat/messages/:id` - Apagar mensagem
- [ ] Suporte a diferentes tipos: text, image, audio, video, document

#### REQ-2.3: Endpoints de Webhooks
**EARS**: The system shall provide webhook endpoints for external systems to receive real-time updates.

**Acceptance Criteria**:
- [ ] `POST /api/v1/chat/webhooks` - Registrar webhook externo
- [ ] `GET /api/v1/chat/webhooks` - Listar webhooks registrados
- [ ] `DELETE /api/v1/chat/webhooks/:id` - Remover webhook
- [ ] Eventos: `message.received`, `message.sent`, `conversation.updated`
- [ ] Retry com backoff exponencial para falhas

#### REQ-2.4: Autenticação da API
**EARS**: The system shall authenticate API requests using API keys or JWT tokens.

**Acceptance Criteria**:
- [ ] Suporte a API Key no header `X-API-Key`
- [ ] Suporte a JWT Bearer token
- [ ] Rate limiting por API key (configurável)
- [ ] Scopes de permissão: `chat:read`, `chat:write`, `chat:admin`

---

### REQ-3: Compatibilidade e Migração

#### REQ-3.1: Período de Transição
**EARS**: During migration, the system shall support both Socket.IO and Supabase Realtime simultaneously.

**Acceptance Criteria**:
- [ ] Feature flag `CHAT_REALTIME_PROVIDER` (socketio | supabase | both)
- [ ] Broadcast duplicado durante transição
- [ ] Métricas de uso de cada provider
- [ ] Rollback automático em caso de falha do Supabase Realtime

#### REQ-3.2: Migração de Dados
**EARS**: The system shall ensure all existing chat data is compatible with the new architecture.

**Acceptance Criteria**:
- [ ] Verificar RLS policies nas tabelas de chat
- [ ] Criar índices necessários para performance
- [ ] Habilitar Realtime nas tabelas relevantes
- [ ] Documentar schema de eventos

---

### REQ-4: Performance e Escalabilidade

#### REQ-4.1: Otimização de Queries
**EARS**: The system shall optimize database queries for chat operations.

**Acceptance Criteria**:
- [ ] Índices em `chat_messages(conversation_id, created_at)`
- [ ] Índices em `conversations(user_id, status, updated_at)`
- [ ] Paginação cursor-based para mensagens
- [ ] Cache de conversas recentes

#### REQ-4.2: Limites e Throttling
**EARS**: The system shall enforce rate limits to prevent abuse.

**Acceptance Criteria**:
- [ ] Limite de mensagens por minuto por usuário
- [ ] Limite de conexões Realtime por usuário
- [ ] Limite de tamanho de payload (4KB para mensagens)
- [ ] Throttling de eventos de digitação

---

## Requisitos Não-Funcionais

### NFR-1: Latência
- Mensagens devem ser entregues em < 500ms (P95)
- Indicadores de digitação em < 200ms (P95)

### NFR-2: Disponibilidade
- 99.9% uptime para o serviço de chat
- Graceful degradation se Realtime falhar (fallback para polling)

### NFR-3: Segurança
- Todas as conexões via HTTPS/WSS
- RLS policies para isolamento de dados
- Sanitização de conteúdo de mensagens
- Audit log de operações sensíveis

### NFR-4: Observabilidade
- Logs estruturados para todas as operações
- Métricas de latência e throughput
- Alertas para falhas de conexão

---

## Fora do Escopo

- Migração de histórico de mensagens antigas
- Suporte a chamadas de voz/vídeo
- Criptografia end-to-end
- Integração com outros provedores de WhatsApp

---

## Dependências

- Supabase Realtime habilitado no projeto
- Tabelas `chat_messages` e `conversations` com RLS
- WUZAPI para envio/recebimento de mensagens WhatsApp

---

## Glossário

| Termo | Definição |
|-------|-----------|
| Realtime | Supabase Realtime - serviço de WebSocket nativo do Supabase |
| RLS | Row Level Security - políticas de segurança a nível de linha |
| Presence | Recurso do Supabase para tracking de usuários online |
| Channel | Canal de comunicação do Supabase Realtime |
| Broadcast | Envio de mensagem para todos os subscribers de um canal |
