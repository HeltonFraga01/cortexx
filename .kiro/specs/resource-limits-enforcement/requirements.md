# Requirements Document

## Introduction

Este documento especifica os requisitos para diagnóstico e correção do sistema de limites de recursos do WUZAPI Manager. O objetivo é garantir que todos os limites definidos nos planos (quotas) sejam corretamente aplicados aos usuários, incluindo: agentes, conexões, inboxes, times, webhooks, bots, campanhas e armazenamento S3. O sistema deve verificar limites antes de permitir a criação de novos recursos e exibir informações claras sobre uso atual vs. limite disponível.

## Glossary

- **Quota_System**: Sistema que define e aplica limites numéricos de recursos por plano de assinatura
- **Resource_Limit**: Limite máximo de um tipo específico de recurso (ex: max_agents, max_inboxes)
- **Quota_Enforcement**: Middleware que verifica se o usuário pode criar um novo recurso antes de permitir a operação
- **Usage_Count**: Contagem atual de recursos utilizados por um usuário
- **Plan_Quota**: Limite definido no plano de assinatura do usuário
- **Quota_Override**: Limite personalizado que sobrescreve o limite do plano para um usuário específico
- **Agent_Bot**: Bot de automação configurado pelo usuário para atendimento automático

## Requirements

### Requirement 1

**User Story:** As a System_Admin, I want all resource limits to be enforced consistently, so that users cannot exceed their plan quotas.

#### Acceptance Criteria

1. WHEN a user attempts to create an agent THEN the Quota_System SHALL verify the max_agents limit before allowing creation
2. WHEN a user attempts to create an inbox THEN the Quota_System SHALL verify the max_inboxes limit before allowing creation
3. WHEN a user attempts to create a team THEN the Quota_System SHALL verify the max_teams limit before allowing creation
4. WHEN a user attempts to create a webhook THEN the Quota_System SHALL verify the max_webhooks limit before allowing creation
5. WHEN a user attempts to create a campaign THEN the Quota_System SHALL verify the max_campaigns limit before allowing creation
6. WHEN a user attempts to create a connection THEN the Quota_System SHALL verify the max_connections limit before allowing creation

### Requirement 2

**User Story:** As a System_Admin, I want bot limits to be enforced, so that users cannot create unlimited bots.

#### Acceptance Criteria

1. THE Plan_System SHALL include max_bots as a configurable quota in plans
2. WHEN a user attempts to create an Agent_Bot THEN the Quota_System SHALL verify the max_bots limit before allowing creation
3. WHEN the bot count equals or exceeds max_bots THEN the Quota_System SHALL deny bot creation with a clear error message
4. WHEN displaying quota information THEN the Quota_System SHALL show current bot count and limit

### Requirement 3

**User Story:** As a User, I want to see my current resource usage compared to my limits, so that I understand how much capacity I have remaining.

#### Acceptance Criteria

1. WHEN displaying user quotas THEN the Quota_System SHALL show usage percentage for each resource type
2. WHEN a resource usage exceeds 80% of the limit THEN the Quota_System SHALL display a warning indicator
3. WHEN a resource usage reaches 100% THEN the Quota_System SHALL display a blocked indicator
4. THE Quota_System SHALL display remaining capacity for each resource type

### Requirement 4

**User Story:** As a System_Admin, I want storage limits to be enforced, so that users cannot exceed their S3 storage allocation.

#### Acceptance Criteria

1. WHEN a user uploads media THEN the Quota_System SHALL verify the max_storage_mb limit before allowing upload
2. WHEN the storage usage would exceed max_storage_mb THEN the Quota_System SHALL deny the upload with a clear error message
3. WHEN displaying storage quota THEN the Quota_System SHALL show current storage usage in MB and percentage
4. THE Quota_System SHALL track storage usage per user accurately

### Requirement 5

**User Story:** As a System_Admin, I want the admin plans page to display all resource limits correctly, so that I can configure plans accurately.

#### Acceptance Criteria

1. WHEN displaying plan details THEN the Admin_Interface SHALL show all quota types including max_bots
2. WHEN creating or editing a plan THEN the Admin_Interface SHALL allow configuration of all quota types
3. WHEN displaying plan comparison THEN the Admin_Interface SHALL show all resource limits side by side
4. THE Admin_Interface SHALL validate that quota values are positive integers

### Requirement 6

**User Story:** As a User, I want clear error messages when I reach a limit, so that I understand why I cannot create more resources.

#### Acceptance Criteria

1. WHEN a quota is exceeded THEN the Quota_System SHALL return HTTP 429 with quota details
2. WHEN a quota is exceeded THEN the error response SHALL include the quota type, current usage, and limit
3. WHEN a quota is exceeded THEN the error message SHALL suggest upgrading the plan
4. WHEN a quota is exceeded THEN the frontend SHALL display a user-friendly message with upgrade option

### Requirement 7

**User Story:** As a System_Admin, I want to verify that all quota enforcement is working correctly, so that I can trust the system is protecting resources.

#### Acceptance Criteria

1. THE Quota_System SHALL have property-based tests for each quota type enforcement
2. THE Quota_System SHALL log all quota check operations for audit purposes
3. WHEN quota enforcement fails THEN the Quota_System SHALL log the failure with context
4. THE Quota_System SHALL handle edge cases like zero limits and negative values gracefully

