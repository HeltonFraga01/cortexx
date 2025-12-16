# Requirements Document

## Introduction

Este documento especifica os requisitos para o sistema de gerenciamento avançado de permissões de agentes na página `/user/agents`. O objetivo é transformar a interface atual de edição via dialog para uma experiência inline mais fluida, permitindo que o usuário (owner/admin) configure de forma granular todas as permissões e acessos de cada agente, incluindo times, inboxes, databases e permissões específicas do sistema.

## Glossary

- **Agent**: Sub-usuário dentro de uma conta que pode acessar o sistema com permissões específicas
- **Account**: Conta principal do usuário que contém agentes, times, inboxes e configurações
- **Team**: Grupo de agentes para organização e distribuição de trabalho
- **Inbox**: Canal de comunicação (WhatsApp) que agentes podem acessar
- **Database Connection**: Conexão NocoDB configurada pelo usuário para navegação de dados externos
- **Permission**: Capacidade específica de realizar uma ação no sistema (ex: `conversations:view`)
- **Role**: Papel predefinido com conjunto de permissões (owner, administrator, agent, viewer)
- **Custom Role**: Papel personalizado criado pelo usuário com permissões específicas
- **Inline Editing**: Edição de dados diretamente na linha da tabela sem abrir dialogs

## Requirements

### Requirement 1

**User Story:** As a account owner, I want to edit agent settings inline in the table, so that I can quickly configure agents without opening multiple dialogs.

#### Acceptance Criteria

1. WHEN a user clicks on an agent row or edit button THEN the System SHALL expand the row to show inline editing options
2. WHEN the inline editor is expanded THEN the System SHALL display all configurable options in organized tabs or sections
3. WHEN a user makes changes in the inline editor THEN the System SHALL provide visual feedback of unsaved changes
4. WHEN a user clicks save THEN the System SHALL persist all changes and collapse the inline editor
5. WHEN a user clicks cancel THEN the System SHALL discard changes and collapse the inline editor

### Requirement 2

**User Story:** As a account owner, I want to assign agents to teams, so that I can organize my workforce and control workload distribution.

#### Acceptance Criteria

1. WHEN viewing the inline editor THEN the System SHALL display a team assignment section with all available teams
2. WHEN a user selects teams for an agent THEN the System SHALL update the agent's team memberships
3. WHEN an agent is assigned to a team THEN the System SHALL show the team badge in the agent list
4. WHEN a user removes an agent from a team THEN the System SHALL update the membership immediately

### Requirement 3

**User Story:** As a account owner, I want to assign agents to inboxes, so that I can control which communication channels each agent can access.

#### Acceptance Criteria

1. WHEN viewing the inline editor THEN the System SHALL display an inbox assignment section with all available inboxes
2. WHEN a user selects inboxes for an agent THEN the System SHALL update the agent's inbox access
3. WHEN an agent is assigned to an inbox THEN the System SHALL allow the agent to view and manage conversations in that inbox
4. WHEN a user removes an agent from an inbox THEN the System SHALL revoke access immediately

### Requirement 4

**User Story:** As a account owner, I want to configure database access permissions for agents, so that I can control which external databases each agent can view or edit.

#### Acceptance Criteria

1. WHEN viewing the inline editor THEN the System SHALL display a database access section with all configured database connections
2. WHEN a user configures database access THEN the System SHALL allow selection of access level: none, view-only, or full-access
3. WHEN an agent has view-only access THEN the System SHALL prevent the agent from creating, editing, or deleting records
4. WHEN an agent has full-access THEN the System SHALL allow the agent to perform all CRUD operations on the database
5. WHEN an agent has no access THEN the System SHALL hide the database from the agent's navigation

### Requirement 5

**User Story:** As a account owner, I want to configure granular system permissions for agents, so that I can precisely control what each agent can do in the system.

#### Acceptance Criteria

1. WHEN viewing the inline editor THEN the System SHALL display a permissions section with all available system permissions
2. WHEN a user selects a predefined role THEN the System SHALL apply the default permissions for that role
3. WHEN a user customizes permissions THEN the System SHALL allow individual permission toggles
4. WHEN permissions are changed THEN the System SHALL immediately enforce the new permission set
5. WHEN a permission is denied THEN the System SHALL hide or disable the corresponding UI elements for the agent

### Requirement 6

**User Story:** As a account owner, I want to see a summary of agent configurations at a glance, so that I can quickly understand each agent's access level.

#### Acceptance Criteria

1. WHEN viewing the agent list THEN the System SHALL display badges or icons indicating team memberships
2. WHEN viewing the agent list THEN the System SHALL display badges or icons indicating inbox access count
3. WHEN viewing the agent list THEN the System SHALL display badges or icons indicating database access level
4. WHEN hovering over summary badges THEN the System SHALL show a tooltip with detailed information

### Requirement 7

**User Story:** As a account owner, I want to bulk configure multiple agents, so that I can efficiently manage large teams.

#### Acceptance Criteria

1. WHEN selecting multiple agents THEN the System SHALL enable bulk action buttons
2. WHEN applying bulk team assignment THEN the System SHALL update all selected agents
3. WHEN applying bulk inbox assignment THEN the System SHALL update all selected agents
4. WHEN applying bulk permission changes THEN the System SHALL update all selected agents

### Requirement 8

**User Story:** As a account owner, I want the system to validate permission changes, so that I don't accidentally lock myself out or create security issues.

#### Acceptance Criteria

1. WHEN a user attempts to remove owner permissions from themselves THEN the System SHALL prevent the action and display a warning
2. WHEN a user attempts to grant permissions they don't have THEN the System SHALL prevent the action
3. WHEN a user attempts to create a permission configuration that conflicts THEN the System SHALL display a warning
4. IF a permission change would affect active sessions THEN the System SHALL notify the user before applying

