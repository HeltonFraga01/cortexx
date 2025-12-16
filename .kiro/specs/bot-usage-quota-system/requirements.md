# Requirements Document

## Introduction

Este documento define os requisitos para implementar um sistema de controle de uso de bots similar ao sistema de mensagens existente. O sistema atual já possui limite de quantidade de bots (`max_bots`), mas não possui controle de uso/consumo dos bots. Este sistema permitirá limitar:

1. **Chamadas de webhook do bot** - Quantidade de vezes que o bot pode ser acionado (mensagens processadas)
2. **Tokens de IA** - Para bots que usam agentes de IA, controlar o consumo de tokens
3. **Mensagens enviadas pelo bot** - Quantidade de respostas que o bot pode enviar

O sistema seguirá a mesma arquitetura do sistema de quotas existente (`QuotaService`), com suporte a limites por dia e por mês, overrides por usuário, e alertas de threshold.

## Glossary

- **Bot_System**: Sistema de gerenciamento de bots de automação (agent_bots)
- **Quota_System**: Sistema de controle de quotas e limites de uso (`QuotaService`)
- **Plan_System**: Sistema de planos de assinatura que define os limites padrão
- **Bot_Webhook_Call**: Uma chamada ao webhook do bot quando uma mensagem é recebida
- **Bot_Message**: Uma mensagem enviada pelo bot como resposta
- **Bot_Token**: Token de IA consumido pelo bot (para agentes de IA)
- **Usage_Tracking**: Rastreamento de uso em `user_quota_usage` com períodos diários/mensais
- **Admin_Interface**: Interface administrativa para configuração de planos e limites
- **User_Interface**: Interface do usuário para visualização e gerenciamento de configurações
- **Bot_Template**: Template de bot criado pelo administrador que pode ser atribuído a inboxes de usuários
- **Admin_Assigned_Bot**: Bot template atribuído pelo administrador a uma inbox específica do usuário

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want to limit the number of webhook calls a bot can receive per day and per month, so that I can control resource usage and prevent abuse.

#### Acceptance Criteria

1. THE Plan_System SHALL include `max_bot_calls_per_day` as a configurable quota in plans
2. THE Plan_System SHALL include `max_bot_calls_per_month` as a configurable quota in plans
3. WHEN a message is received and forwarded to a bot THEN the Quota_System SHALL increment the bot calls counter for that user
4. WHEN the bot calls count equals or exceeds the daily limit THEN the Bot_System SHALL skip bot processing and log the event
5. WHEN the bot calls count equals or exceeds the monthly limit THEN the Bot_System SHALL skip bot processing and log the event
6. WHEN bot processing is skipped due to quota THEN the system SHALL continue normal message storage without bot interaction

### Requirement 2

**User Story:** As a system administrator, I want to limit the number of messages a bot can send per day and per month, so that I can control outgoing message costs.

#### Acceptance Criteria

1. THE Plan_System SHALL include `max_bot_messages_per_day` as a configurable quota in plans
2. THE Plan_System SHALL include `max_bot_messages_per_month` as a configurable quota in plans
3. WHEN a bot attempts to send a reply message THEN the Quota_System SHALL verify the bot messages limit before sending
4. WHEN the bot messages count equals or exceeds the daily limit THEN the Bot_System SHALL skip sending the reply
5. WHEN the bot messages count equals or exceeds the monthly limit THEN the Bot_System SHALL skip sending the reply
6. WHEN a bot message is successfully sent THEN the Quota_System SHALL increment the bot messages counter

### Requirement 3

**User Story:** As a system administrator, I want to limit the number of AI tokens a bot can consume per day and per month, so that I can control AI API costs for users with AI-powered bots.

#### Acceptance Criteria

1. THE Plan_System SHALL include `max_bot_tokens_per_day` as a configurable quota in plans
2. THE Plan_System SHALL include `max_bot_tokens_per_month` as a configurable quota in plans
3. WHEN a bot webhook response includes token usage information THEN the Quota_System SHALL increment the token counter by the reported amount
4. WHEN the token count equals or exceeds the daily limit THEN the Bot_System SHALL skip bot processing for subsequent messages
5. WHEN the token count equals or exceeds the monthly limit THEN the Bot_System SHALL skip bot processing for subsequent messages
6. THE Bot_System SHALL accept token usage in the webhook response payload via a `tokensUsed` field

### Requirement 4

**User Story:** As a user, I want to see my current bot usage and limits in the dashboard, so that I can monitor my consumption and plan accordingly.

#### Acceptance Criteria

1. WHEN displaying quota information THEN the User_Interface SHALL show current bot calls count and limit (daily and monthly)
2. WHEN displaying quota information THEN the User_Interface SHALL show current bot messages count and limit (daily and monthly)
3. WHEN displaying quota information THEN the User_Interface SHALL show current bot tokens count and limit (daily and monthly)
4. WHEN usage reaches 80% of any bot quota THEN the User_Interface SHALL display a warning indicator
5. WHEN usage reaches 100% of any bot quota THEN the User_Interface SHALL display an exceeded indicator

### Requirement 5

**User Story:** As an administrator, I want to configure bot usage limits in plans and set overrides for specific users, so that I can customize limits based on business needs.

#### Acceptance Criteria

1. WHEN creating or editing a plan THEN the Admin_Interface SHALL allow configuration of all bot quota types
2. WHEN displaying plan details THEN the Admin_Interface SHALL show all bot quota limits
3. THE Admin_Interface SHALL allow setting quota overrides for individual users for all bot quota types
4. WHEN a quota override is set THEN the Quota_System SHALL use the override value instead of the plan default

### Requirement 6

**User Story:** As a system administrator, I want bot quota counters to reset automatically at the appropriate intervals, so that users get fresh limits each period.

#### Acceptance Criteria

1. THE Quota_System SHALL reset daily bot quota counters at midnight (Brazil timezone)
2. THE Quota_System SHALL reset monthly bot quota counters on the first day of each month
3. WHEN a new period starts THEN the Quota_System SHALL create new usage records with zero counts
4. THE Quota_System SHALL maintain historical usage data for reporting purposes

### Requirement 7

**User Story:** As a developer integrating with the bot webhook, I want to receive clear information when quotas are exceeded, so that I can handle the situation appropriately.

#### Acceptance Criteria

1. WHEN bot processing is skipped due to quota THEN the webhook response SHALL include a `quotaExceeded` flag
2. WHEN bot processing is skipped due to quota THEN the webhook response SHALL include the quota type that was exceeded
3. WHEN bot processing is skipped due to quota THEN the webhook response SHALL include current usage and limit values
4. THE Bot_System SHALL log all quota-related events with sufficient detail for debugging

### Requirement 8

**User Story:** As a system administrator, I want default bot quota values for new plans, so that the system works out of the box with reasonable limits.

#### Acceptance Criteria

1. THE Plan_System SHALL define default values for all bot quota types when creating new plans
2. THE default value for `max_bot_calls_per_day` SHALL be 100
3. THE default value for `max_bot_calls_per_month` SHALL be 3000
4. THE default value for `max_bot_messages_per_day` SHALL be 50
5. THE default value for `max_bot_messages_per_month` SHALL be 1500
6. THE default value for `max_bot_tokens_per_day` SHALL be 10000
7. THE default value for `max_bot_tokens_per_month` SHALL be 300000

### Requirement 9

**User Story:** As a user, I want to see the bots assigned to my inboxes by the administrator in my settings page, so that I can understand which automations are active and monitor their usage quotas.

#### Acceptance Criteria

1. WHEN a user navigates to the Bots tab in settings THEN the User_Interface SHALL display a section showing admin-assigned bots
2. WHEN displaying admin-assigned bots THEN the User_Interface SHALL show the bot name, description, and assigned inbox
3. WHEN displaying admin-assigned bots THEN the User_Interface SHALL show current usage quotas (calls, messages, tokens) with daily and monthly values
4. WHEN displaying admin-assigned bots THEN the User_Interface SHALL visually distinguish admin-assigned bots from user-created bots
5. THE User_Interface SHALL NOT allow users to edit or delete admin-assigned bots
6. WHEN usage reaches 80% of any bot quota THEN the User_Interface SHALL display a warning indicator on the admin-assigned bot card
7. WHEN usage reaches 100% of any bot quota THEN the User_Interface SHALL display an exceeded indicator on the admin-assigned bot card
8. WHEN no admin-assigned bots exist for the user THEN the User_Interface SHALL display an informative message

### Requirement 10

**User Story:** As a user, I want to see detailed quota information for each admin-assigned bot, so that I can plan my usage and avoid exceeding limits.

#### Acceptance Criteria

1. WHEN viewing an admin-assigned bot THEN the User_Interface SHALL show a progress bar for each quota type (calls, messages, tokens)
2. WHEN viewing an admin-assigned bot THEN the User_Interface SHALL show the current usage value and limit for each quota type
3. WHEN viewing an admin-assigned bot THEN the User_Interface SHALL show when the quota will reset (daily at midnight, monthly on first day)
4. THE User_Interface SHALL update quota information in real-time when the user refreshes the page
