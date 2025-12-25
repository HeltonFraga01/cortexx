# Requirements Document

## Introduction

Este documento especifica os requisitos para migrar a configuração de Webhooks da página de Settings (`/user/settings`) para a página de edição de inbox (`/user/inboxes/edit/:inboxId`). Atualmente, a configuração de webhooks está centralizada em Settings, mas cada caixa de entrada (inbox) deve ter sua própria configuração de webhooks independente, já que cada inbox representa uma conexão WhatsApp diferente com seu próprio token WUZAPI.

A migração envolve:
1. Mover a UI de configuração de webhooks WUZAPI para a página de edição de inbox
2. Manter a configuração de webhooks de chat (outgoing webhooks) em Settings
3. Garantir que cada inbox tenha configuração de webhook independente
4. Remover a aba de webhook WUZAPI redundante de Settings

## Glossary

- **Inbox**: Caixa de entrada WhatsApp gerenciada pelo sistema, cada uma com seu próprio token WUZAPI
- **WUZAPI_Webhook**: Webhook configurado diretamente no WUZAPI para receber eventos do WhatsApp (Message, ReadReceipt, Connected, etc.)
- **Outgoing_Webhook**: Webhook de saída configurado no sistema para enviar eventos de chat para sistemas externos
- **User_Settings_Page**: Página de configurações do usuário em `/user/settings`
- **User_Inbox_Edit_Page**: Página de edição de inbox em `/user/inboxes/edit/:inboxId`
- **WebhookConfigCard**: Componente compartilhado para configuração de webhook WUZAPI em `src/components/shared/inbox/WebhookConfigCard.tsx`
- **WebhookSettings**: Componente de webhooks de chat (outgoing) em `src/components/features/chat/settings/WebhookSettings.tsx`
- **Available_Events**: Lista de 40+ eventos WUZAPI disponíveis para subscrição (Message, ReadReceipt, GroupInfo, etc.)

## Requirements

### Requirement 1: Manter Configuração de Webhook WUZAPI na Página de Edição de Inbox

**User Story:** Como usuário, eu quero configurar o webhook WUZAPI diretamente na página de edição da minha inbox, para que eu possa gerenciar a configuração de webhook junto com as outras configurações da conexão WhatsApp.

#### Acceptance Criteria

1. THE User_Inbox_Edit_Page SHALL display the WebhookConfigCard component for WUZAPI webhook configuration
2. THE WebhookConfigCard SHALL allow users to configure the webhook URL for the specific inbox
3. THE WebhookConfigCard SHALL display all 40+ Available_Events grouped by category (Mensagens, Grupos, Conexão, etc.)
4. WHEN the user saves webhook configuration THEN THE System SHALL call the WUZAPI setWebhook endpoint with the inbox's token
5. THE WebhookConfigCard SHALL show a badge indicating the number of selected events
6. WHEN "Todos os Eventos" is selected THEN THE System SHALL subscribe to all available events

### Requirement 2: Remover Aba de Webhook WUZAPI de Settings

**User Story:** Como usuário, eu quero que a configuração de webhook WUZAPI esteja apenas na página de edição de inbox, para evitar confusão sobre onde configurar webhooks.

#### Acceptance Criteria

1. THE User_Settings_Page SHALL NOT display the "Webhook" tab for WUZAPI configuration
2. THE User_Settings_Page SHALL maintain the "Integração Chat" tab for outgoing webhooks (WebhookSettings component)
3. WHEN a user accesses Settings THEN THE System SHALL show only 7 tabs (Conta, Assinatura, Notificações, Bots, Integração Chat, Etiquetas, Respostas)
4. THE System SHALL remove all WUZAPI webhook-related code from UserSettings.tsx (availableEvents, validEventIds, fetchWebhookConfig, handleSaveWebhook, handleEventToggle, eventsByCategory)

### Requirement 3: Manter Webhooks de Chat (Outgoing) em Settings

**User Story:** Como usuário, eu quero continuar configurando webhooks de saída para sistemas externos na página de Settings, para integrar o chat com outras ferramentas.

#### Acceptance Criteria

1. THE User_Settings_Page SHALL maintain the "Integração Chat" tab with WebhookSettings component
2. THE WebhookSettings component SHALL continue to manage outgoing webhooks (message.received, message.sent, etc.)
3. THE IncomingWebhookConfig component SHALL continue to work within WebhookSettings for chat inbox integration
4. THE Outgoing_Webhook configuration SHALL remain independent of WUZAPI webhook configuration

### Requirement 4: Garantir Independência de Configuração por Inbox

**User Story:** Como usuário com múltiplas inboxes, eu quero que cada inbox tenha sua própria configuração de webhook, para que eu possa enviar eventos de diferentes conexões WhatsApp para diferentes endpoints.

#### Acceptance Criteria

1. WHEN configuring webhook for Inbox A THEN THE System SHALL NOT affect webhook configuration of Inbox B
2. THE System SHALL use the specific inbox's WUZAPI token when calling setWebhook API
3. THE WebhookConfigCard SHALL load webhook configuration from the specific inbox's WUZAPI instance
4. WHEN saving webhook THEN THE System SHALL persist configuration only for the current inbox
5. THE System SHALL display the current webhook URL and subscribed events for each inbox independently

### Requirement 5: Melhorar UX da Configuração de Webhook na Inbox

**User Story:** Como usuário, eu quero uma experiência clara e intuitiva ao configurar webhooks na página de edição de inbox, para entender facilmente o que estou configurando.

#### Acceptance Criteria

1. THE WebhookConfigCard SHALL display a clear title "Configuração de Webhook WUZAPI"
2. THE WebhookConfigCard SHALL show a description explaining that this webhook receives WhatsApp events
3. WHEN the webhook URL is empty THEN THE System SHALL display a message indicating webhook is disabled
4. THE WebhookConfigCard SHALL validate URL format before allowing save (must start with http:// or https://)
5. THE WebhookConfigCard SHALL show loading state while saving configuration
6. WHEN save is successful THEN THE System SHALL display a success toast notification
7. WHEN save fails THEN THE System SHALL display an error toast with the error message

### Requirement 6: Atualizar Navegação e Documentação

**User Story:** Como usuário, eu quero saber onde configurar webhooks, para não perder tempo procurando a funcionalidade.

#### Acceptance Criteria

1. THE User_Settings_Page "Integração Chat" tab description SHALL clarify it's for outgoing webhooks to external systems
2. THE User_Inbox_Edit_Page SHALL have the WebhookConfigCard positioned after the Connection Control section
3. IF a user tries to access the old webhook tab URL THEN THE System SHALL redirect to the inbox list or show appropriate message
4. THE WebhookConfigCard header SHALL include an icon (Globe) to visually distinguish from other cards

### Requirement 7: Manter Compatibilidade com Fluxo Existente

**User Story:** Como desenvolvedor, eu quero que a migração não quebre funcionalidades existentes, para garantir uma transição suave.

#### Acceptance Criteria

1. THE useInboxConnectionData hook SHALL continue to fetch webhook configuration for the inbox
2. THE adaptWebhookResponseToConfig adapter SHALL continue to transform WUZAPI response to WebhookConfigData
3. THE adaptWebhookConfigToWuzapi adapter SHALL continue to transform WebhookConfigData to WUZAPI format
4. THE WuzAPIService.setWebhook method SHALL continue to work with inbox-specific tokens
5. THE WuzAPIService.getWebhook method SHALL continue to return current webhook configuration
