# Requirements Document

## Introduction

Este documento especifica os requisitos para o sistema completo de mensagens para agentes. O sistema permite que agentes enviem mensagens individuais e em massa (campanhas), utilizando as caixas de entrada às quais têm acesso, enquanto o consumo de quota é debitado do saldo do usuário proprietário (owner) da conta.

O sistema replica as funcionalidades disponíveis em `/user/mensagens` para o contexto do agente em `/agent/mensagens`, incluindo:
- Envio de mensagens individuais e em massa
- Gerenciamento de templates
- Caixa de saída (campanhas)
- Relatórios de campanhas
- Humanização de envios
- Agendamento de campanhas

## Glossary

- **Agent**: Usuário com permissões limitadas que opera dentro de uma conta, podendo enviar mensagens através das caixas de entrada às quais tem acesso
- **Owner**: Usuário proprietário da conta cujo saldo de mensagens é consumido quando agentes enviam mensagens
- **Inbox**: Caixa de entrada conectada ao WhatsApp via WUZAPI, associada a uma conta
- **Campaign**: Conjunto de mensagens enviadas em massa para múltiplos destinatários
- **Template**: Modelo de mensagem reutilizável com suporte a variáveis
- **Quota**: Limite de mensagens (diário e mensal) definido pelo plano do owner
- **Humanization**: Configurações de delay e randomização para simular envio humano
- **SendFlow**: Fluxo de envio de mensagens em etapas (destinatários → mensagem → revisão)
- **WUZAPI**: API de integração com WhatsApp Business

## Requirements

### Requirement 1

**User Story:** As an agent, I want to access a complete messaging system, so that I can send individual and bulk messages using the owner's quota.

#### Acceptance Criteria

1. WHEN an agent navigates to `/agent/mensagens` THEN the Agent_Messaging_System SHALL display the main messaging page with SendFlow component
2. WHEN an agent accesses the messaging system THEN the Agent_Messaging_System SHALL display the owner's quota balance (daily and monthly remaining)
3. WHEN an agent does not have the `messages:send` permission THEN the Agent_Messaging_System SHALL hide the messaging menu item
4. WHEN an agent has the `messages:send` permission THEN the Agent_Messaging_System SHALL show the messaging menu with all sub-items

### Requirement 2

**User Story:** As an agent, I want to select recipients for my campaigns, so that I can target specific contacts or groups.

#### Acceptance Criteria

1. WHEN an agent starts a new campaign THEN the Agent_Messaging_System SHALL display the inbox selector with only inboxes the agent has access to
2. WHEN an agent selects an inbox THEN the Agent_Messaging_System SHALL load contacts from that inbox for selection
3. WHEN an agent imports contacts via CSV THEN the Agent_Messaging_System SHALL validate phone numbers and extract variables
4. WHEN an agent selects contacts manually THEN the Agent_Messaging_System SHALL allow searching and filtering contacts
5. WHEN an agent proceeds without selecting recipients THEN the Agent_Messaging_System SHALL prevent navigation to the next step

### Requirement 3

**User Story:** As an agent, I want to compose messages with templates and variables, so that I can personalize communications.

#### Acceptance Criteria

1. WHEN an agent creates a message THEN the Agent_Messaging_System SHALL provide a text editor with variable insertion buttons
2. WHEN an agent inserts a variable `{{name}}` THEN the Agent_Messaging_System SHALL replace it with the contact's name during sending
3. WHEN an agent loads a template THEN the Agent_Messaging_System SHALL populate the message editor with the template content
4. WHEN an agent creates multiple messages in sequence THEN the Agent_Messaging_System SHALL send them in order with configured delays
5. WHEN an agent saves a message as template THEN the Agent_Messaging_System SHALL store it for future use

### Requirement 4

**User Story:** As an agent, I want to configure humanization settings, so that my messages appear more natural.

#### Acceptance Criteria

1. WHEN an agent configures delay settings THEN the Agent_Messaging_System SHALL accept minimum and maximum delay values in minutes
2. WHEN an agent enables randomization THEN the Agent_Messaging_System SHALL shuffle the contact order before sending
3. WHEN the Agent_Messaging_System sends messages THEN the Agent_Messaging_System SHALL apply random delays between the configured min and max values
4. WHEN an agent sets delay values THEN the Agent_Messaging_System SHALL validate that minimum is less than or equal to maximum

### Requirement 5

**User Story:** As an agent, I want to schedule campaigns, so that I can send messages at optimal times.

#### Acceptance Criteria

1. WHEN an agent enables scheduling THEN the Agent_Messaging_System SHALL display a date/time picker
2. WHEN an agent sets a scheduled time THEN the Agent_Messaging_System SHALL validate that the time is in the future
3. WHEN an agent configures a sending window THEN the Agent_Messaging_System SHALL only send messages during the specified hours and days
4. WHEN a scheduled campaign reaches its start time THEN the Agent_Messaging_System SHALL begin sending automatically

### Requirement 6

**User Story:** As an agent, I want to manage my campaigns in an outbox, so that I can monitor and control ongoing sends.

#### Acceptance Criteria

1. WHEN an agent navigates to `/agent/mensagens/caixa` THEN the Agent_Messaging_System SHALL display a list of campaigns organized by status
2. WHEN an agent views a running campaign THEN the Agent_Messaging_System SHALL display real-time progress (sent/total)
3. WHEN an agent pauses a campaign THEN the Agent_Messaging_System SHALL stop sending and preserve the current position
4. WHEN an agent resumes a paused campaign THEN the Agent_Messaging_System SHALL continue from where it stopped
5. WHEN an agent cancels a campaign THEN the Agent_Messaging_System SHALL stop sending and mark remaining contacts as cancelled

### Requirement 7

**User Story:** As an agent, I want to view campaign reports, so that I can analyze the results of my sends.

#### Acceptance Criteria

1. WHEN an agent navigates to `/agent/mensagens/relatorios` THEN the Agent_Messaging_System SHALL display a list of completed campaigns with summary statistics
2. WHEN an agent views a campaign report THEN the Agent_Messaging_System SHALL show delivery rate, sent count, failed count, and per-contact status
3. WHEN an agent filters reports by date range THEN the Agent_Messaging_System SHALL display only campaigns within that range
4. WHEN an agent exports a report THEN the Agent_Messaging_System SHALL generate a CSV file with all contact statuses

### Requirement 8

**User Story:** As an agent, I want to manage message templates, so that I can reuse common messages.

#### Acceptance Criteria

1. WHEN an agent navigates to `/agent/mensagens/templates` THEN the Agent_Messaging_System SHALL display a list of available templates
2. WHEN an agent creates a new template THEN the Agent_Messaging_System SHALL save it with name, content, and configuration
3. WHEN an agent edits a template THEN the Agent_Messaging_System SHALL update the stored template
4. WHEN an agent deletes a template THEN the Agent_Messaging_System SHALL remove it from the list
5. WHEN an agent selects a template to use THEN the Agent_Messaging_System SHALL navigate to the messaging page with the template pre-loaded

### Requirement 9

**User Story:** As an agent, I want my message sends to consume the owner's quota, so that the account limits are properly enforced.

#### Acceptance Criteria

1. WHEN an agent sends a message THEN the Agent_Messaging_System SHALL check the owner's daily and monthly quota before sending
2. WHEN the owner's daily quota is exceeded THEN the Agent_Messaging_System SHALL reject the send with a clear error message
3. WHEN the owner's monthly quota is exceeded THEN the Agent_Messaging_System SHALL reject the send with a clear error message
4. WHEN a message is successfully sent THEN the Agent_Messaging_System SHALL increment the owner's daily and monthly usage counters
5. WHEN an agent views the quota display THEN the Agent_Messaging_System SHALL show the owner's remaining balance, not the agent's

### Requirement 10

**User Story:** As an agent, I want to send different media types, so that I can share images, documents, and audio.

#### Acceptance Criteria

1. WHEN an agent sends an image THEN the Agent_Messaging_System SHALL accept a URL or base64 encoded image with optional caption
2. WHEN an agent sends a document THEN the Agent_Messaging_System SHALL accept a URL or base64 encoded file with filename
3. WHEN an agent sends audio THEN the Agent_Messaging_System SHALL accept a URL or base64 encoded audio file
4. WHEN an agent sends media THEN the Agent_Messaging_System SHALL consume one message from the owner's quota per media item

### Requirement 11

**User Story:** As an agent, I want the navigation menu to show messaging sub-items, so that I can easily access all messaging features.

#### Acceptance Criteria

1. WHEN an agent has `messages:send` permission THEN the Agent_Layout SHALL display "Mensagens" menu item with expandable sub-items
2. WHEN the agent clicks on "Mensagens" THEN the Agent_Layout SHALL expand to show: Enviar, Templates, Caixa de Saída, Relatórios
3. WHEN the agent is on a messaging route THEN the Agent_Layout SHALL auto-expand the Mensagens menu
4. WHEN the agent navigates to a sub-item THEN the Agent_Layout SHALL highlight the active item

### Requirement 12

**User Story:** As an agent, I want to save drafts of my campaigns, so that I can continue working on them later.

#### Acceptance Criteria

1. WHEN an agent clicks "Salvar Rascunho" THEN the Agent_Messaging_System SHALL persist the current campaign state
2. WHEN an agent returns to the messaging page with an existing draft THEN the Agent_Messaging_System SHALL prompt to restore or discard
3. WHEN an agent restores a draft THEN the Agent_Messaging_System SHALL load all saved recipients, messages, and settings
4. WHEN an agent successfully sends a campaign THEN the Agent_Messaging_System SHALL clear the draft

