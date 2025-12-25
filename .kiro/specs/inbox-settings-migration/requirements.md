# Requirements Document

## Introduction

Este documento especifica os requisitos para migrar configurações específicas de caixa de entrada (inbox) da página de Settings (`/user/settings`) para a página de edição de inbox (`/user/inboxes/edit/:inboxId`). 

Atualmente, algumas configurações em Settings são globais (aplicam-se ao usuário como um todo), enquanto outras deveriam ser específicas por inbox (cada conexão WhatsApp pode ter configurações diferentes). Esta migração visa:

1. Identificar quais configurações são específicas por inbox
2. Migrar essas configurações para a página de edição de inbox
3. Manter configurações globais em Settings
4. Garantir que cada inbox tenha configurações independentes
5. Eliminar código legado e redundante
6. Manter segurança e isolamento de dados entre inboxes

### Análise das Configurações Atuais

**Configurações GLOBAIS (permanecem em Settings):**
- **Conta**: Informações do usuário, token de autenticação
- **Assinatura**: Plano, quotas, features do usuário
- **Notificações**: Preferências de som (aplicam-se a todas as inboxes)
- **Bots**: Criação e gerenciamento de bots (não atribuição)
- **Etiquetas**: Labels para organizar conversas (compartilhadas entre inboxes)
- **Respostas Rápidas**: Canned responses (compartilhadas entre inboxes)

**Configurações POR INBOX (já migradas ✅):**
- **Webhook WUZAPI (WebhookConfigCard)**: Configuração de webhook no WUZAPI para receber eventos WhatsApp
- **Bot Assignment**: Atribuição de bot específico para processar mensagens da inbox

**Configurações POR INBOX (a migrar):**
- **Webhooks de Saída (OutgoingWebhooks)**: Atualmente global por user_id, deve ser por inbox_id
- **Webhook de Entrada Chat (IncomingWebhookConfig)**: Endpoint de recebimento de mensagens por inbox

### Análise Técnica do Banco de Dados

**Tabela `outgoing_webhooks` (estado atual):**
- `id` (uuid) - PK
- `account_id` (uuid) - FK para accounts
- `user_id` (text) - ID do usuário (usado para filtrar)
- `name` (text) - Nome do webhook
- `url` (text) - URL de destino
- `secret` (text) - Secret para assinatura HMAC
- `events` (text[]) - Array de eventos subscritos
- `is_active` (boolean) - Status ativo/inativo
- `success_count`, `failure_count` - Estatísticas
- **⚠️ NÃO TEM `inbox_id`** - Precisa adicionar

**Tabela `inboxes` (referência):**
- `id` (uuid) - PK
- `account_id` (uuid) - FK para accounts
- `wuzapi_token` (text) - Token WUZAPI da inbox
- `webhook_config` (jsonb) - Config de webhook WUZAPI (já usado)

### Fluxo de Dados Atual vs Desejado

**Atual (Global por Usuário):**
```
User → Settings → WebhookSettings → OutgoingWebhookService.getWebhooks(userId)
                                  → Filtra por user_id apenas
```

**Desejado (Por Inbox):**
```
User → InboxEditPage → OutgoingWebhookSection → OutgoingWebhookService.getWebhooks(userId, inboxId)
                                              → Filtra por user_id E inbox_id
```

## Glossary

- **Inbox**: Caixa de entrada WhatsApp gerenciada pelo sistema, cada uma com seu próprio token WUZAPI
- **User_Settings_Page**: Página de configurações do usuário em `/user/settings`
- **User_Inbox_Edit_Page**: Página de edição de inbox em `/user/inboxes/edit/:inboxId`
- **Outgoing_Webhook**: Webhook de saída configurado para enviar eventos de chat para sistemas externos (tabela `outgoing_webhooks`)
- **Incoming_Webhook**: Endpoint que recebe eventos do WUZAPI para o chat inbox
- **Bot_Assignment**: Associação de um bot a uma inbox específica
- **WebhookSettings**: Componente atual de webhooks de chat em Settings (`src/components/features/chat/settings/WebhookSettings.tsx`)
- **IncomingWebhookConfig**: Componente de configuração de webhook de entrada para chat (`src/components/features/chat/settings/IncomingWebhookConfig.tsx`)
- **OutgoingWebhookService**: Serviço backend para gerenciar webhooks de saída (`server/services/OutgoingWebhookService.js`)
- **Chat_Events**: Eventos de chat (message.received, message.sent, conversation.created, bot.handoff, etc.)
- **WebhookConfigCard**: Componente compartilhado para webhook WUZAPI (já na inbox edit page)
- **InboxContext**: Contexto React que fornece a inbox ativa atual

## Requirements

### Requirement 1: Adicionar Coluna inbox_id na Tabela outgoing_webhooks

**User Story:** Como desenvolvedor, eu quero que a tabela outgoing_webhooks tenha uma coluna inbox_id, para que webhooks possam ser associados a inboxes específicas.

#### Acceptance Criteria

1. THE System SHALL add an `inbox_id` column (uuid, nullable) to the `outgoing_webhooks` table
2. THE `inbox_id` column SHALL have a foreign key constraint referencing `inboxes(id)` with ON DELETE CASCADE
3. THE System SHALL create an index on `inbox_id` for query performance
4. WHEN `inbox_id` is NULL THEN THE webhook SHALL be considered a legacy global webhook
5. THE migration SHALL NOT delete or modify existing webhook records
6. THE System SHALL add a composite unique constraint on (user_id, inbox_id, url) to prevent duplicate webhooks

### Requirement 2: Migrar Webhooks Existentes para Inbox Padrão

**User Story:** Como usuário com webhooks existentes, eu quero que meus webhooks continuem funcionando após a migração, associados à minha inbox principal.

#### Acceptance Criteria

1. THE migration script SHALL identify all webhooks with NULL inbox_id
2. FOR EACH webhook without inbox_id, THE System SHALL find the user's primary inbox (first active inbox)
3. THE System SHALL update the webhook's inbox_id to the primary inbox
4. IF a user has no active inbox THEN THE webhook SHALL remain with NULL inbox_id (legacy mode)
5. THE migration SHALL log all changes for audit purposes
6. THE migration SHALL be idempotent (safe to run multiple times)

### Requirement 3: Atualizar OutgoingWebhookService para Suportar inbox_id

**User Story:** Como desenvolvedor, eu quero que o OutgoingWebhookService filtre webhooks por inbox_id, para garantir isolamento correto entre inboxes.

#### Acceptance Criteria

1. THE `configureWebhook` method SHALL accept an optional `inboxId` parameter
2. THE `getWebhooks` method SHALL accept an optional `inboxId` parameter
3. WHEN `inboxId` is provided THEN THE System SHALL filter webhooks by both `user_id` AND `inbox_id`
4. WHEN `inboxId` is NULL THEN THE System SHALL return only legacy global webhooks (inbox_id IS NULL)
5. THE `sendWebhookEvent` method SHALL accept `inboxId` to send events only to inbox-specific webhooks
6. THE System SHALL validate that the inbox belongs to the user before any operation

### Requirement 4: Atualizar API Routes para Suportar inbox_id

**User Story:** Como desenvolvedor frontend, eu quero endpoints de API que aceitem inbox_id, para gerenciar webhooks por inbox.

#### Acceptance Criteria

1. THE `GET /api/user/outgoing-webhooks` endpoint SHALL accept optional query param `inboxId`
2. THE `POST /api/user/outgoing-webhooks` endpoint SHALL accept `inboxId` in request body
3. THE `PUT /api/user/outgoing-webhooks/:id` endpoint SHALL validate inbox ownership
4. THE `DELETE /api/user/outgoing-webhooks/:id` endpoint SHALL validate inbox ownership
5. THE API SHALL return 403 Forbidden if user tries to access webhook from another user's inbox
6. THE API response SHALL include `inboxId` field in webhook objects

### Requirement 5: Criar Componente OutgoingWebhookSection para Inbox Edit Page

**User Story:** Como usuário, eu quero configurar webhooks de saída diretamente na página de edição da inbox, para ter todas as configurações da inbox em um só lugar.

#### Acceptance Criteria

1. THE User_Inbox_Edit_Page SHALL display an "Integrações de Chat" section after Bot Assignment
2. THE section SHALL show a list of outgoing webhooks configured for the current inbox
3. THE section SHALL allow creating new webhooks with URL, events, and active status
4. THE section SHALL allow editing existing webhooks
5. THE section SHALL allow deleting webhooks with confirmation dialog
6. THE section SHALL allow testing webhooks (send test event)
7. THE section SHALL display webhook statistics (success/failure counts)
8. THE section SHALL show available Chat_Events for subscription with checkboxes

### Requirement 6: Migrar IncomingWebhookConfig para Inbox Edit Page

**User Story:** Como usuário, eu quero configurar o webhook de entrada do chat na página de edição da inbox, para que cada inbox tenha seu próprio endpoint de integração.

#### Acceptance Criteria

1. THE User_Inbox_Edit_Page SHALL display the IncomingWebhookConfig component
2. THE IncomingWebhookConfig SHALL use the current inbox's ID to generate the webhook URL
3. THE webhook URL format SHALL be `/api/webhook/events/:inboxId`
4. THE component SHALL show the current configuration status (configured/not configured)
5. THE component SHALL allow configuring/reconfiguring the webhook
6. THE component SHALL display the required events for chat integration

### Requirement 7: Remover Tab "Integração Chat" de Settings

**User Story:** Como usuário, eu quero que a página de Settings mostre apenas configurações globais, para evitar confusão sobre onde configurar webhooks.

#### Acceptance Criteria

1. THE User_Settings_Page SHALL remove the "Integração Chat" tab (webhooks-chat)
2. THE User_Settings_Page SHALL have 6 tabs: Conta, Assinatura, Notificações, Bots, Etiquetas, Respostas
3. THE TabsList grid SHALL be updated from grid-cols-7 to grid-cols-6
4. THE System SHALL remove imports of WebhookSettings and IncomingWebhookConfig from UserSettings.tsx
5. THE System SHALL remove the InboxProvider wrapper that was used for WebhookSettings

### Requirement 8: Atualizar Envio de Eventos para Filtrar por Inbox

**User Story:** Como desenvolvedor, eu quero que eventos de chat sejam enviados apenas para webhooks da inbox correspondente, para garantir isolamento de dados.

#### Acceptance Criteria

1. WHEN a chat event occurs in Inbox A THEN THE System SHALL send it only to webhooks of Inbox A
2. THE `sendWebhookEvent` method SHALL require `inboxId` parameter (not optional)
3. THE System SHALL NOT send events to webhooks of other inboxes
4. THE System SHALL log which inbox triggered the webhook event
5. IF no webhooks are configured for the inbox THEN THE System SHALL skip sending (no error)

### Requirement 9: Manter Compatibilidade com Webhooks Legados

**User Story:** Como usuário com webhooks antigos, eu quero que meus webhooks continuem funcionando durante a transição.

#### Acceptance Criteria

1. THE System SHALL support webhooks with NULL inbox_id (legacy mode) during transition period
2. WHEN sending events, THE System SHALL check both inbox-specific AND legacy webhooks
3. THE UI SHALL show a warning for legacy webhooks suggesting migration to inbox-specific
4. THE System SHALL provide a migration button to associate legacy webhook with an inbox
5. AFTER 30 days, THE System MAY deprecate legacy webhook support (configurable)

### Requirement 10: Melhorar UX da Página de Edição de Inbox

**User Story:** Como usuário, eu quero uma experiência clara e organizada ao configurar minha inbox, para entender facilmente todas as opções disponíveis.

#### Acceptance Criteria

1. THE User_Inbox_Edit_Page SHALL organize settings in logical sections with clear headers
2. THE sections SHALL be ordered: Informações, Controle de Conexão, Webhook WUZAPI, Integrações de Chat, Bot Assignment
3. EACH section SHALL have a descriptive title and subtitle explaining its purpose
4. THE "Integrações de Chat" section SHALL have two sub-sections: Webhook de Entrada, Webhooks de Saída
5. THE System SHALL show loading states while fetching/saving configurations
6. THE System SHALL display success/error toasts for all operations

### Requirement 11: Documentar Mudanças para Usuários

**User Story:** Como usuário, eu quero saber onde encontrar as configurações que foram movidas, para não perder tempo procurando.

#### Acceptance Criteria

1. THE User_Settings_Page SHALL display a notice about inbox-specific settings location (first access after migration)
2. THE notice SHALL include a link to the inbox management page
3. THE User_Inbox_Edit_Page SHALL have clear section headers indicating what can be configured
4. THE System SHALL show a tooltip explaining the difference between WUZAPI webhook and Chat webhooks

