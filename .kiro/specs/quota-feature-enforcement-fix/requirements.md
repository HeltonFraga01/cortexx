# Requirements Document

## Introduction

Este documento define os requisitos para corrigir a aplicação de quotas e features em todas as rotas de usuário do sistema WUZAPI Manager. O problema identificado é que, apesar das quotas e features estarem configuradas corretamente nos planos, elas não estão sendo aplicadas consistentemente em todas as rotas, resultando em:

1. Usuários conseguindo acessar features desabilitadas (ex: "Campanhas em Massa" mostrando bloqueio mesmo com feature ativa)
2. Quotas não sendo verificadas antes de operações de criação
3. Inconsistência na identificação do userId entre diferentes rotas
4. Contagem incorreta de recursos para cálculo de quotas

## Glossary

- **User_Routes**: Rotas HTTP que atendem operações de usuários autenticados
- **Quota_Middleware**: Middleware que verifica limites de recursos antes de permitir operações
- **Feature_Middleware**: Middleware que verifica se uma feature está habilitada para o usuário
- **User_ID**: Identificador único do usuário, derivado do hash do token WUZAPI ou session.userId
- **WUZAPI_Token**: Token de autenticação usado para comunicação com a API WUZAPI
- **Session_UserId**: ID do usuário armazenado na sessão após autenticação
- **Account_OwnerUserId**: ID do proprietário da conta em rotas de agentes

## Requirements

### Requirement 1: Padronização da Identificação de Usuário

**User Story:** As a system, I want consistent user identification across all routes, so that quotas and features are correctly applied to the right user.

#### Acceptance Criteria

1. WHEN a user route receives a request THEN the system SHALL resolve the userId using a standardized function that checks session.userId, account.ownerUserId, and token hash in order of priority
2. WHEN the userId cannot be resolved THEN the system SHALL return HTTP 401 with error code USER_NOT_IDENTIFIED
3. WHEN a route uses verifyUserToken middleware THEN the system SHALL also set session.userId for consistency with quota enforcement
4. WHEN resolving userId for quota checks THEN the system SHALL use the same resolution logic as the route handler

### Requirement 2: Aplicação de Feature Middleware em Rotas de Campanhas

**User Story:** As a user with bulk_campaigns feature enabled, I want to access bulk campaign routes, so that I can send mass messages.

#### Acceptance Criteria

1. WHEN a user accesses POST /api/user/bulk-campaigns THEN the system SHALL verify the bulk_campaigns feature is enabled before processing
2. WHEN the bulk_campaigns feature is disabled THEN the system SHALL return HTTP 403 with code FEATURE_DISABLED and a user-friendly message
3. WHEN the bulk_campaigns feature is enabled THEN the system SHALL allow the request to proceed to quota verification
4. WHEN checking feature status THEN the system SHALL use the same userId resolution as quota middleware

### Requirement 3: Aplicação de Quota Middleware em Rotas de Mensagens

**User Story:** As a user with message quotas, I want the system to track my message usage, so that I stay within my plan limits.

#### Acceptance Criteria

1. WHEN a user sends a message via POST /api/chat/send/text THEN the system SHALL check max_messages_per_day quota before sending
2. WHEN a user sends a message via POST /api/chat/send/image THEN the system SHALL check max_messages_per_day quota before sending
3. WHEN the daily message quota is exceeded THEN the system SHALL return HTTP 429 with code QUOTA_EXCEEDED
4. WHEN a message is sent successfully THEN the system SHALL increment the daily message counter

### Requirement 4: Correção da Contagem de Webhooks

**User Story:** As a user, I want my webhook count to be accurate, so that my quota reflects my actual usage.

#### Acceptance Criteria

1. WHEN counting user webhooks THEN the system SHALL query outgoing_webhooks table using the correct userId
2. WHEN the userId is a session hash THEN the system SHALL also check for webhooks created with the WUZAPI token
3. WHEN displaying webhook quota THEN the system SHALL show the combined count from all user identifiers

### Requirement 5: Correção da Contagem de Campanhas

**User Story:** As a user, I want my campaign count to be accurate, so that my quota reflects my actual usage.

#### Acceptance Criteria

1. WHEN counting user campaigns THEN the system SHALL query campaigns table using user_token field
2. WHEN the userId is a session hash THEN the system SHALL map it to the corresponding WUZAPI token for counting
3. WHEN displaying campaign quota THEN the system SHALL show the accurate count of user's campaigns

### Requirement 6: Aplicação de Feature Middleware em Rotas de Mensagens Agendadas

**User Story:** As a user with scheduled_messages feature enabled, I want to schedule messages, so that I can send them at specific times.

#### Acceptance Criteria

1. WHEN a user schedules a message with isScheduled=true THEN the system SHALL verify the scheduled_messages feature is enabled
2. WHEN the scheduled_messages feature is disabled THEN the system SHALL return HTTP 403 with code FEATURE_DISABLED
3. WHEN the scheduled_messages feature is enabled THEN the system SHALL allow scheduling to proceed

### Requirement 7: Aplicação de Feature Middleware em Rotas de Webhooks

**User Story:** As a user with webhooks feature enabled, I want to configure outgoing webhooks, so that I can receive event notifications.

#### Acceptance Criteria

1. WHEN a user accesses POST /api/user/outgoing-webhooks THEN the system SHALL verify the webhooks feature is enabled
2. WHEN the webhooks feature is disabled THEN the system SHALL return HTTP 403 with code FEATURE_DISABLED
3. WHEN the webhooks feature is enabled THEN the system SHALL allow the request to proceed to quota verification

### Requirement 8: Aplicação de Feature Middleware em Rotas de Bots

**User Story:** As a user with bot_automation feature enabled, I want to manage bots, so that I can automate responses.

#### Acceptance Criteria

1. WHEN a user accesses POST /api/user/bots THEN the system SHALL verify the bot_automation feature is enabled
2. WHEN the bot_automation feature is disabled THEN the system SHALL return HTTP 403 with code FEATURE_DISABLED
3. WHEN the bot_automation feature is enabled THEN the system SHALL allow the request to proceed to quota verification

### Requirement 9: Mapeamento de Token para UserId

**User Story:** As a system, I want to map WUZAPI tokens to user IDs, so that quota counting works correctly across different authentication methods.

#### Acceptance Criteria

1. WHEN a user authenticates with a WUZAPI token THEN the system SHALL store the mapping between token and userId in the session
2. WHEN counting resources for quota THEN the system SHALL use both userId and token to find all user resources
3. WHEN the mapping is not found THEN the system SHALL use a hash of the token as the userId

### Requirement 10: Verificação de Feature em Rotas de NocoDB

**User Story:** As a user with nocodb_integration feature enabled, I want to access database navigation, so that I can manage my external data.

#### Acceptance Criteria

1. WHEN a user accesses /api/user/database routes THEN the system SHALL verify the nocodb_integration feature is enabled
2. WHEN the nocodb_integration feature is disabled THEN the system SHALL return HTTP 403 with code FEATURE_DISABLED
3. WHEN the nocodb_integration feature is enabled THEN the system SHALL allow the request to proceed

### Requirement 11: Verificação de Feature em Rotas de Relatórios

**User Story:** As a user with advanced_reports feature enabled, I want to access detailed reports, so that I can analyze my messaging performance.

#### Acceptance Criteria

1. WHEN a user accesses /api/user/reports routes THEN the system SHALL verify the advanced_reports feature is enabled
2. WHEN the advanced_reports feature is disabled THEN the system SHALL return HTTP 403 with code FEATURE_DISABLED
3. WHEN the advanced_reports feature is enabled THEN the system SHALL allow the request to proceed

### Requirement 12: Verificação de Feature em Rotas de Media Storage

**User Story:** As a user with media_storage feature enabled, I want to upload and manage media files, so that I can send rich content.

#### Acceptance Criteria

1. WHEN a user accesses POST /api/media/upload THEN the system SHALL verify the media_storage feature is enabled
2. WHEN the media_storage feature is disabled THEN the system SHALL return HTTP 403 with code FEATURE_DISABLED
3. WHEN the media_storage feature is enabled THEN the system SHALL allow the request to proceed to quota verification

### Requirement 13: Quotas no Contexto de Agentes e Accounts

**User Story:** As a user with multiple agents and inboxes, I want quotas to be counted at the account owner level, so that all my resources are properly tracked.

#### Acceptance Criteria

1. WHEN an agent performs an operation that consumes quota THEN the system SHALL attribute the usage to the account owner (ownerUserId)
2. WHEN counting agents for quota THEN the system SHALL count all agents in accounts owned by the user
3. WHEN counting inboxes for quota THEN the system SHALL count all inboxes in accounts owned by the user
4. WHEN counting teams for quota THEN the system SHALL count all teams in accounts owned by the user
5. WHEN an agent sends a message THEN the system SHALL increment the message quota of the account owner

### Requirement 14: Propagação de Quotas para Rotas de Account

**User Story:** As a user managing my account, I want quota limits to be enforced when creating agents, inboxes, and teams, so that I stay within my plan limits.

#### Acceptance Criteria

1. WHEN creating an agent via POST /api/account/agents THEN the system SHALL check max_agents quota using account.ownerUserId
2. WHEN creating an inbox via POST /api/account/inboxes THEN the system SHALL check max_inboxes quota using account.ownerUserId
3. WHEN creating a team via POST /api/account/teams THEN the system SHALL check max_teams quota using account.ownerUserId
4. WHEN quota is exceeded THEN the system SHALL return HTTP 429 with code QUOTA_EXCEEDED and details about the limit

### Requirement 15: Contagem de Conexões por Usuário

**User Story:** As a user with multiple WhatsApp connections, I want my connection count to reflect all connected inboxes, so that my quota is accurate.

#### Acceptance Criteria

1. WHEN counting connections for quota THEN the system SHALL count inboxes with wuzapi_connected=1 in accounts owned by the user
2. WHEN an inbox connects to WhatsApp THEN the system SHALL verify max_connections quota before allowing connection
3. WHEN the connection quota is exceeded THEN the system SHALL prevent new connections and return HTTP 429

### Requirement 16: Mensagens Enviadas por Agentes Contam para o Owner

**User Story:** As a user with agents, I want messages sent by my agents to count against my message quota, so that usage is properly tracked.

#### Acceptance Criteria

1. WHEN an agent sends a message via chat routes THEN the system SHALL resolve the ownerUserId from the agent's account
2. WHEN incrementing message usage THEN the system SHALL use the ownerUserId, not the agent ID
3. WHEN checking message quota THEN the system SHALL use the ownerUserId to get the correct limits

### Requirement 17: Resolução de UserId em Rotas de Account

**User Story:** As a system, I want to correctly resolve the user ID in account routes, so that quotas are applied to the account owner.

#### Acceptance Criteria

1. WHEN a request comes through requireAgentAuth middleware THEN the system SHALL set req.account.ownerUserId
2. WHEN quota middleware runs in account routes THEN the system SHALL use req.account.ownerUserId for quota checks
3. WHEN the ownerUserId is not available THEN the system SHALL log a warning and skip quota enforcement

### Requirement 18: Sincronização de Token e UserId

**User Story:** As a system, I want to maintain a mapping between WUZAPI tokens and user IDs, so that resources created with tokens are correctly attributed.

#### Acceptance Criteria

1. WHEN a user authenticates via session THEN the system SHALL store the userToken in the session
2. WHEN counting resources THEN the system SHALL check both userId and userToken to find all user resources
3. WHEN a resource is created with userToken THEN the system SHALL also store the userId for future reference
