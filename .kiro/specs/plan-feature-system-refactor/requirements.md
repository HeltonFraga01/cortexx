# Requirements Document

## Introduction

Este documento especifica os requisitos para refatoração do sistema de planos e funcionalidades do WUZAPI Manager. O objetivo é corrigir inconsistências entre as features definidas nos planos e as funcionalidades reais do sistema, remover features inexistentes (Chatwoot, Typebot), separar features de admin das features de usuário, e garantir que o sistema de quotas e features seja aplicado corretamente.

## Glossary

- **Plan_System**: Sistema de gerenciamento de planos de assinatura que define quotas e features disponíveis para usuários
- **Feature_Flag**: Indicador booleano que habilita ou desabilita uma funcionalidade específica para um usuário
- **User_Feature**: Funcionalidade que pode ser habilitada/desabilitada por plano para usuários finais
- **Admin_Feature**: Funcionalidade exclusiva de administradores do sistema, não controlada por planos
- **Quota**: Limite numérico de recursos (mensagens, agentes, conexões, etc.) definido pelo plano
- **Agent**: Sub-usuário dentro de uma conta, com permissões específicas definidas por role
- **Feature_Enforcement**: Middleware que verifica se uma feature está habilitada antes de permitir acesso

## Requirements

### Requirement 1

**User Story:** As a System_Admin, I want to manage only real and implemented features in plans, so that users see accurate information about what their plan includes.

#### Acceptance Criteria

1. THE Plan_System SHALL NOT include chatwoot_integration as a configurable feature
2. THE Plan_System SHALL NOT include typebot_integration as a configurable feature
3. WHEN displaying plan features THEN the System SHALL only show features that have real implementations in the codebase
4. WHEN a plan is created or updated THEN the System SHALL validate that only valid User_Features are included

### Requirement 2

**User Story:** As a System_Admin, I want admin-only features separated from user plan features, so that users cannot see or request features that are not meant for them.

#### Acceptance Criteria

1. THE Plan_System SHALL NOT include page_builder as a User_Feature since it is an Admin_Feature
2. THE Plan_System SHALL NOT include custom_branding as a User_Feature since it is an Admin_Feature
3. WHEN displaying user features THEN the System SHALL exclude Admin_Features from the list
4. WHEN a user attempts to access an Admin_Feature THEN the System SHALL deny access regardless of plan

### Requirement 3

**User Story:** As a User, I want to see only the features that are relevant to my usage, so that I understand what my plan actually provides.

#### Acceptance Criteria

1. THE Plan_System SHALL include the following User_Features: bulk_campaigns, nocodb_integration, bot_automation, advanced_reports, api_access, webhooks, scheduled_messages, media_storage
2. WHEN displaying features to a user THEN the System SHALL show only User_Features with their enabled/disabled status
3. WHEN a User_Feature is disabled THEN the System SHALL display a clear message indicating the feature requires a plan upgrade

### Requirement 4

**User Story:** As a System_Admin, I want the feature enforcement to work correctly, so that users cannot access features not included in their plan.

#### Acceptance Criteria

1. WHEN a user attempts to access a disabled feature via API THEN the Feature_Enforcement middleware SHALL return HTTP 403 with feature information
2. WHEN a user has a feature enabled via plan THEN the Feature_Enforcement middleware SHALL allow access
3. WHEN a user has a feature override THEN the Feature_Enforcement middleware SHALL use the override value instead of plan default
4. WHEN checking features THEN the System SHALL skip enforcement for admin users

### Requirement 5

**User Story:** As a System_Admin, I want to remove all references to non-existent integrations, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. THE System SHALL remove all chatwoot_integration references from frontend components
2. THE System SHALL remove all typebot_integration references from frontend components
3. THE System SHALL remove all chatwoot_integration references from backend services
4. THE System SHALL remove all typebot_integration references from backend services
5. THE System SHALL remove chatwoot_integration and typebot_integration from TypeScript type definitions

### Requirement 6

**User Story:** As a User, I want my agent quota to be enforced correctly, so that I can only create agents up to my plan limit.

#### Acceptance Criteria

1. WHEN a user attempts to create an agent THEN the System SHALL check the max_agents quota
2. WHEN the agent count equals or exceeds max_agents THEN the System SHALL deny agent creation with a clear error message
3. WHEN displaying quota information THEN the System SHALL show current agent count and limit
4. WHEN an agent is deleted THEN the System SHALL update the usage count accordingly

### Requirement 7

**User Story:** As a System_Admin, I want the default plans to have correct feature configurations, so that new users get appropriate access.

#### Acceptance Criteria

1. THE Free plan SHALL have all User_Features disabled except api_access, webhooks, and media_storage
2. THE Basic plan SHALL have bulk_campaigns, nocodb_integration, scheduled_messages enabled in addition to Free features
3. THE Pro plan SHALL have all User_Features enabled except advanced_reports
4. THE Enterprise plan SHALL have all User_Features enabled
5. WHEN a new plan is created THEN the System SHALL use sensible defaults for User_Features

