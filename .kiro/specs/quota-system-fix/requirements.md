# Requirements Document

## Introduction

O sistema de Quotas do WUZAPI Manager apresenta inconsistências entre os planos configurados pelo administrador e o que é exibido/aplicado aos usuários. A investigação revelou os seguintes problemas:

1. **Problema de identificação de usuário**: O middleware `quotaEnforcement` usa `req.user?.id || req.userId`, mas nas rotas de agentes o usuário é identificado via `req.account.ownerUserId`
2. **Quotas não refletidas**: Os limites configurados nos planos (ex: max_agents=2) não são exibidos corretamente no dashboard do usuário
3. **Enforcement inconsistente**: Ao tentar criar um segundo agente, o sistema bloqueia mesmo quando o plano permite 2 agentes
4. **Falta de enforcement em algumas operações**: Nem todas as operações que deveriam verificar quotas estão fazendo isso

Este documento especifica os requisitos para corrigir completamente o sistema de quotas.

## Glossary

- **Plan**: Plano de assinatura com quotas e features definidas (Free, Basic, Pro, Enterprise)
- **Subscription**: Registro que vincula um usuário a um plano específico
- **Quota**: Limite de uso de um recurso (ex: max_agents, max_messages_per_day)
- **Default Plan**: Plano marcado como `is_default = 1` na tabela `plans`
- **QuotaService**: Serviço backend que gerencia verificação e tracking de quotas
- **SubscriptionService**: Serviço backend que gerencia assinaturas de usuários
- **Account**: Conta do usuário que contém agentes, inboxes, teams, etc.
- **Owner User ID**: ID do usuário proprietário da conta (usado para vincular subscription)

## Requirements

### Requirement 1 (Existing - Completed)

**User Story:** As a system administrator, I want new users to automatically receive the default plan subscription, so that they have proper quota limits from the start.

#### Acceptance Criteria

1. WHEN a new user session is created THEN the System SHALL check if the user has an active subscription
2. WHEN a user has no subscription THEN the System SHALL automatically assign the default plan to the user
3. WHEN the default plan is assigned THEN the System SHALL create a subscription record with status 'active'
4. WHEN no default plan exists in the database THEN the System SHALL log a warning and use hardcoded fallback quotas

### Requirement 2 (Existing - Completed)

**User Story:** As a user, I want to see my real quota usage on the dashboard, so that I can monitor my resource consumption.

#### Acceptance Criteria

1. WHEN a user accesses the dashboard THEN the System SHALL display quota data from their active subscription
2. WHEN displaying quotas THEN the System SHALL show current usage, limit, and percentage for each quota type
3. WHEN a quota exceeds 80% usage THEN the System SHALL display a warning indicator
4. WHEN a quota exceeds 100% usage THEN the System SHALL display an exceeded indicator

### Requirement 3 (Existing - Completed)

**User Story:** As a user, I want to see my subscription details on the account page, so that I know my current plan and its limits.

#### Acceptance Criteria

1. WHEN a user accesses the account page THEN the System SHALL display their current plan name and status
2. WHEN displaying subscription data THEN the System SHALL show all quota limits from the user's plan
3. WHEN displaying features THEN the System SHALL show which features are enabled for the user's plan
4. WHEN the user has no subscription THEN the System SHALL display the default plan information

### Requirement 4 (Existing - Completed)

**User Story:** As a system administrator, I want existing users without subscriptions to be migrated to the default plan, so that the quota system works consistently for all users.

#### Acceptance Criteria

1. WHEN the system starts THEN the System SHALL identify users without active subscriptions
2. WHEN users without subscriptions are found THEN the System SHALL assign the default plan to each user
3. WHEN migrating users THEN the System SHALL log each migration action for audit purposes
4. WHEN migration completes THEN the System SHALL report the number of users migrated

### Requirement 5 (Existing - Completed)

**User Story:** As a developer, I want the quota endpoints to return consistent data, so that the frontend can reliably display quota information.

#### Acceptance Criteria

1. WHEN the `/api/user/quotas` endpoint is called THEN the System SHALL return an array of quota objects with quotaType, limit, currentUsage, percentage, warning, and exceeded fields
2. WHEN the `/api/user/account-summary` endpoint is called THEN the System SHALL return subscription, quotas, features, and summary objects
3. WHEN a user has no subscription THEN the System SHALL return data based on the default plan instead of empty arrays
4. WHEN calculating quota percentage THEN the System SHALL use the formula (currentUsage / limit) * 100

### Requirement 6 (NEW)

**User Story:** As a user, I want the quota enforcement middleware to correctly identify me via my account, so that my plan limits are properly applied.

#### Acceptance Criteria

1. WHEN the quota enforcement middleware is called in agent routes THEN the System SHALL identify the user via `req.account.ownerUserId`
2. WHEN the quota enforcement middleware is called in user routes THEN the System SHALL identify the user via `req.session.userId`
3. WHEN the user cannot be identified THEN the System SHALL log a warning and skip quota enforcement
4. WHEN checking quotas THEN the System SHALL use the correct user ID to lookup the subscription and plan limits

### Requirement 7 (NEW)

**User Story:** As a user, I want to create agents up to my plan limit, so that I can use all the resources I'm paying for.

#### Acceptance Criteria

1. WHEN a user tries to create an agent THEN the System SHALL check the `max_agents` quota from their plan
2. WHEN the current agent count is less than the limit THEN the System SHALL allow the agent creation
3. WHEN the current agent count equals or exceeds the limit THEN the System SHALL return a 429 error with quota details
4. WHEN counting agents THEN the System SHALL only count active agents (status = 'active')

### Requirement 8 (NEW)

**User Story:** As a user, I want to create inboxes up to my plan limit, so that I can organize my conversations.

#### Acceptance Criteria

1. WHEN a user tries to create an inbox THEN the System SHALL check the `max_inboxes` quota from their plan
2. WHEN the current inbox count is less than the limit THEN the System SHALL allow the inbox creation
3. WHEN the current inbox count equals or exceeds the limit THEN the System SHALL return a 429 error with quota details
4. WHEN counting inboxes THEN the System SHALL count all inboxes in the user's account

### Requirement 9 (NEW)

**User Story:** As a user, I want to create teams up to my plan limit, so that I can organize my agents.

#### Acceptance Criteria

1. WHEN a user tries to create a team THEN the System SHALL check the `max_teams` quota from their plan
2. WHEN the current team count is less than the limit THEN the System SHALL allow the team creation
3. WHEN the current team count equals or exceeds the limit THEN the System SHALL return a 429 error with quota details
4. WHEN counting teams THEN the System SHALL count all teams in the user's account

### Requirement 10 (NEW)

**User Story:** As a user, I want to create webhooks up to my plan limit, so that I can integrate with external systems.

#### Acceptance Criteria

1. WHEN a user tries to create a webhook THEN the System SHALL check the `max_webhooks` quota from their plan
2. WHEN the current webhook count is less than the limit THEN the System SHALL allow the webhook creation
3. WHEN the current webhook count equals or exceeds the limit THEN the System SHALL return a 429 error with quota details
4. WHEN counting webhooks THEN the System SHALL count all webhooks in the user's account

### Requirement 11 (NEW)

**User Story:** As a user, I want to create campaigns up to my plan limit, so that I can send bulk messages.

#### Acceptance Criteria

1. WHEN a user tries to create a campaign THEN the System SHALL check the `max_campaigns` quota from their plan
2. WHEN the current campaign count is less than the limit THEN the System SHALL allow the campaign creation
3. WHEN the current campaign count equals or exceeds the limit THEN the System SHALL return a 429 error with quota details
4. WHEN counting campaigns THEN the System SHALL count all campaigns in the user's account

### Requirement 12 (NEW)

**User Story:** As a user, I want to send messages up to my daily and monthly limits, so that I can communicate with my contacts.

#### Acceptance Criteria

1. WHEN a user tries to send a message THEN the System SHALL check both `max_messages_per_day` and `max_messages_per_month` quotas
2. WHEN both quotas have remaining capacity THEN the System SHALL allow the message and increment usage counters
3. WHEN either quota is exceeded THEN the System SHALL return a 429 error with quota details
4. WHEN the day changes THEN the System SHALL reset the daily message counter
5. WHEN the month changes THEN the System SHALL reset the monthly message counter

### Requirement 13 (NEW)

**User Story:** As a user, I want to see all my quota limits in the dashboard, so that I know exactly what resources I have available.

#### Acceptance Criteria

1. WHEN displaying quotas in the dashboard THEN the System SHALL show all 9 quota types (agents, connections, messages/day, messages/month, inboxes, teams, webhooks, campaigns, storage)
2. WHEN a quota type is not used THEN the System SHALL still display it with 0 usage
3. WHEN displaying quotas THEN the System SHALL use the limits from the user's actual plan, not hardcoded defaults
4. WHEN the user's plan changes THEN the System SHALL immediately reflect the new limits in the dashboard

### Requirement 14 (NEW)

**User Story:** As a user, I want to create connections up to my plan limit, so that I can connect multiple WhatsApp numbers.

#### Acceptance Criteria

1. WHEN a user tries to create a connection THEN the System SHALL check the `max_connections` quota from their plan
2. WHEN the current connection count is less than the limit THEN the System SHALL allow the connection creation
3. WHEN the current connection count equals or exceeds the limit THEN the System SHALL return a 429 error with quota details
4. WHEN counting connections THEN the System SHALL count all active connections in the user's account
