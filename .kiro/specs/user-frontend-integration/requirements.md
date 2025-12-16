# Requirements Document

## Introduction

Este documento especifica os requisitos para integração das funcionalidades de gestão multi-usuário e controle de quotas/features no frontend do usuário (User Dashboard) do WUZAPI Manager. As funcionalidades de backend já foram implementadas nas specs `admin-user-management` e `multi-user-inbox-system`, mas o frontend do usuário ainda não utiliza essas capacidades.

O objetivo é permitir que Account Owners gerenciem seus Agents, Teams e Inboxes diretamente do painel de usuário, além de visualizar suas quotas, features disponíveis e informações de assinatura.

## Glossary

- **Account_Owner**: Usuário principal que possui a conta e pode gerenciar sub-usuários (Agents).
- **Agent**: Sub-usuário cadastrado dentro de uma Account, com permissões limitadas.
- **Team**: Grupo de Agents para organização e distribuição de trabalho.
- **Inbox**: Caixa de entrada que controla acesso a conversas.
- **Quota**: Limite quantitativo de uso de recursos (mensagens, conexões, etc.).
- **Feature_Flag**: Controle que habilita/desabilita funcionalidades específicas.
- **Subscription**: Assinatura do usuário que define seu plano e limites.
- **Permission**: Permissão granular que define o que um Agent pode fazer.

## Requirements

### Requirement 1: Visualização de Informações da Conta

**User Story:** As an Account_Owner, I want to view my account information and subscription details, so that I can understand my current plan and usage.

#### Acceptance Criteria

1. WHEN an Account_Owner accesses the settings page THEN the System SHALL display the current subscription plan name, status, and billing cycle
2. WHEN an Account_Owner views subscription details THEN the System SHALL display the next billing date and current period dates
3. WHEN an Account_Owner views their account THEN the System SHALL display all quota limits and current usage with visual progress indicators
4. WHEN a quota reaches 80% usage THEN the System SHALL display a warning indicator on the quota card
5. WHEN an Account_Owner views their account THEN the System SHALL display all enabled and disabled features for their plan

### Requirement 2: Gestão de Agents pelo Account Owner

**User Story:** As an Account_Owner, I want to manage my Agents from the user dashboard, so that I can add team members and control their access.

#### Acceptance Criteria

1. WHEN an Account_Owner accesses the Agents section THEN the System SHALL display a list of all Agents with name, email, role, status, and last activity
2. WHEN an Account_Owner creates an invitation THEN the System SHALL generate a unique link and provide options to copy or share via WhatsApp
3. WHEN an Account_Owner creates an Agent directly THEN the System SHALL allow setting name, email, temporary password, and role
4. WHEN an Account_Owner updates an Agent's role THEN the System SHALL immediately apply the new permissions
5. WHEN an Account_Owner deactivates an Agent THEN the System SHALL invalidate all sessions and prevent future access
6. IF the Account has reached the max_agents quota THEN the System SHALL prevent creating new Agents and display an upgrade message

### Requirement 3: Gestão de Teams pelo Account Owner

**User Story:** As an Account_Owner, I want to organize my Agents into Teams, so that I can manage workload distribution effectively.

#### Acceptance Criteria

1. WHEN an Account_Owner accesses the Teams section THEN the System SHALL display all Teams with member count and description
2. WHEN an Account_Owner creates a Team THEN the System SHALL allow setting name, description, and initial members
3. WHEN an Account_Owner adds an Agent to a Team THEN the System SHALL update the Team membership immediately
4. WHEN an Account_Owner removes an Agent from a Team THEN the System SHALL update the membership and handle conversation reassignment
5. IF the Account has reached the max_teams quota THEN the System SHALL prevent creating new Teams and display an upgrade message

### Requirement 4: Gestão de Inboxes pelo Account Owner

**User Story:** As an Account_Owner, I want to manage Inboxes to control which Agents can access which conversations.

#### Acceptance Criteria

1. WHEN an Account_Owner accesses the Inboxes section THEN the System SHALL display all Inboxes with assigned Agents count
2. WHEN an Account_Owner creates an Inbox THEN the System SHALL allow setting name, description, and auto-assignment settings
3. WHEN an Account_Owner assigns Agents to an Inbox THEN the System SHALL update access permissions immediately
4. WHEN an Account_Owner removes an Agent from an Inbox THEN the System SHALL revoke access to conversations in that Inbox
5. IF the Account has reached the max_inboxes quota THEN the System SHALL prevent creating new Inboxes and display an upgrade message

### Requirement 5: Gestão de Papéis Customizados

**User Story:** As an Account_Owner, I want to create custom roles with specific permissions, so that I can fine-tune what each Agent can do.

#### Acceptance Criteria

1. WHEN an Account_Owner accesses the Roles section THEN the System SHALL display default roles and custom roles
2. WHEN an Account_Owner creates a Custom Role THEN the System SHALL allow selecting granular permissions from a categorized list
3. WHEN an Account_Owner assigns a Custom Role to an Agent THEN the System SHALL apply all permissions defined in that role
4. WHEN an Account_Owner modifies a Custom Role THEN the System SHALL immediately apply changes to all Agents with that role
5. WHEN an Account_Owner deletes a Custom Role THEN the System SHALL require reassigning affected Agents to another role

### Requirement 6: Visualização de Quotas e Uso

**User Story:** As an Account_Owner, I want to see my resource usage and limits, so that I can plan my usage and avoid hitting limits.

#### Acceptance Criteria

1. WHEN an Account_Owner views the dashboard THEN the System SHALL display a summary card with key quota usage (messages, agents, connections)
2. WHEN an Account_Owner views detailed quotas THEN the System SHALL display all quotas with current usage, limit, and percentage
3. WHEN a quota is near limit (80%+) THEN the System SHALL highlight the quota with a warning color
4. WHEN a quota is exceeded THEN the System SHALL display an error state and provide upgrade options
5. WHEN an Account_Owner clicks on a quota THEN the System SHALL display usage history and trends

### Requirement 7: Controle de Features Disponíveis

**User Story:** As an Account_Owner, I want to see which features are available on my plan, so that I can understand my capabilities.

#### Acceptance Criteria

1. WHEN an Account_Owner views features THEN the System SHALL display all features with enabled/disabled status
2. WHEN a feature is disabled THEN the System SHALL display a lock icon and upgrade prompt
3. WHEN an Account_Owner attempts to access a disabled feature THEN the System SHALL display a message explaining the feature is not available
4. WHEN an Account_Owner has a feature override THEN the System SHALL indicate the override source

### Requirement 8: Navegação e Layout do User Dashboard

**User Story:** As an Account_Owner, I want easy navigation to all management features, so that I can efficiently manage my account.

#### Acceptance Criteria

1. WHEN an Account_Owner accesses the dashboard THEN the System SHALL display a navigation menu with sections for Agents, Teams, Inboxes, and Settings
2. WHEN an Account_Owner is on mobile THEN the System SHALL provide a responsive layout with collapsible navigation
3. WHEN an Account_Owner navigates between sections THEN the System SHALL maintain context and not require re-authentication
4. WHEN an Account_Owner has limited permissions THEN the System SHALL hide navigation items for inaccessible features

### Requirement 9: Visualização de Audit Log

**User Story:** As an Account_Owner, I want to see a log of all actions performed in my account, so that I can track changes and ensure accountability.

#### Acceptance Criteria

1. WHEN an Account_Owner accesses the Audit Log THEN the System SHALL display recent actions with agent name, action type, and timestamp
2. WHEN an Account_Owner filters the Audit Log THEN the System SHALL support filtering by agent, action type, and date range
3. WHEN an Account_Owner views an audit entry THEN the System SHALL display full details including affected resources
4. WHEN an Account_Owner exports the Audit Log THEN the System SHALL generate a CSV file with filtered entries

### Requirement 10: Integração com Sistema de Chat

**User Story:** As an Agent, I want to see only conversations I have access to, so that I can focus on my assigned work.

#### Acceptance Criteria

1. WHEN an Agent accesses the Chat page THEN the System SHALL filter conversations by Inbox membership
2. WHEN an Agent is assigned to multiple Inboxes THEN the System SHALL allow switching between Inboxes
3. WHEN an Agent sends a message THEN the System SHALL record the Agent ID for audit purposes
4. WHEN an Agent's Inbox access is revoked THEN the System SHALL immediately remove those conversations from view
5. WHEN an Agent sets availability status THEN the System SHALL update auto-assignment routing accordingly

