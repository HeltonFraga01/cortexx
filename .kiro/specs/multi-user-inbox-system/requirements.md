# Requirements Document

## Introduction

Este documento especifica os requisitos para implementação de um sistema de multi-usuários e multi-caixas de entrada no WUZAPI Manager. O sistema permitirá que um usuário principal (Account Owner) cadastre sub-usuários (Agents) com diferentes níveis de permissão, possibilitando que múltiplas pessoas acessem a mesma conta de forma controlada e auditável.

O modelo é inspirado no Chatwoot, que utiliza uma hierarquia de Account → AccountUser → User com Teams e Inboxes para organização.

## Glossary

- **Account**: Conta principal no sistema, representa uma organização ou empresa. Cada Account possui uma conexão WhatsApp via WUZAPI.
- **Account_Owner**: Usuário que criou/possui a Account, com acesso total a todas as funcionalidades.
- **Agent**: Sub-usuário cadastrado dentro de uma Account, com permissões limitadas definidas pelo Owner.
- **Team**: Grupo de Agents dentro de uma Account para organização e atribuição de conversas.
- **Inbox**: Caixa de entrada que representa um canal de comunicação (WhatsApp). Uma Account pode ter múltiplas Inboxes.
- **Inbox_Member**: Relacionamento entre Agent e Inbox, definindo quais Agents têm acesso a qual Inbox.
- **Role**: Papel/função que define o conjunto de permissões de um Agent (admin, agent, viewer).
- **Custom_Role**: Papel personalizado com permissões granulares definidas pelo Account_Owner.
- **Session**: Sessão de autenticação individual para cada Agent.
- **Audit_Log**: Registro de ações realizadas por cada Agent para rastreabilidade.

## Requirements

### Requirement 1: Gestão de Contas (Accounts)

**User Story:** As an administrator, I want to manage accounts in the system, so that I can organize multiple organizations with their own WhatsApp connections.

#### Acceptance Criteria

1. WHEN an administrator creates a new account THEN the System SHALL generate a unique account identifier and associate it with the creating user as Account_Owner
2. WHEN an account is created THEN the System SHALL initialize default settings including timezone, locale, and feature flags
3. WHEN an Account_Owner accesses account settings THEN the System SHALL display all configurable options including name, domain, and support email
4. WHEN an account status changes to inactive THEN the System SHALL prevent all Agents from accessing that account while preserving data
5. IF an account deletion is requested THEN the System SHALL require confirmation and cascade delete all associated Agents, Teams, and Inboxes

### Requirement 2: Gestão de Sub-Usuários (Agents)

**User Story:** As an Account_Owner, I want to create and manage sub-users (Agents) within my account, so that multiple people can access the system with individual credentials.

#### Acceptance Criteria

1. WHEN an Account_Owner creates a new Agent THEN the System SHALL generate a unique invitation link valid for 48 hours
2. WHEN an Account_Owner creates a new Agent THEN the System SHALL allow the Owner to share the invitation link via WhatsApp or copy to clipboard
3. WHEN an Agent accesses the invitation link THEN the System SHALL display a registration form to set name and password
4. WHEN an Agent completes registration via invitation link THEN the System SHALL create individual credentials and associate the Agent with the Account
5. WHERE the Account_Owner prefers direct creation THEN the System SHALL allow creating an Agent with predefined credentials (name, email, temporary password)
6. WHEN an Account_Owner views the Agents list THEN the System SHALL display all Agents with their roles, status, and last activity timestamp
7. WHEN an Account_Owner updates an Agent's role THEN the System SHALL immediately apply the new permissions without requiring re-login
8. WHEN an Account_Owner deactivates an Agent THEN the System SHALL invalidate all active sessions for that Agent
9. IF an Agent attempts to access the system after deactivation THEN the System SHALL reject the authentication and display an appropriate message
10. WHEN an Agent logs in THEN the System SHALL create a unique session token that identifies both the Agent and the Account

### Requirement 3: Sistema de Papéis e Permissões (Roles)

**User Story:** As an Account_Owner, I want to define roles with specific permissions, so that I can control what each Agent can do within the system.

#### Acceptance Criteria

1. THE System SHALL provide three default roles: administrator (full access), agent (operational access), and viewer (read-only access)
2. WHEN an Account_Owner creates a Custom_Role THEN the System SHALL allow selection of granular permissions from a predefined list
3. WHEN a permission check is performed THEN the System SHALL evaluate the Agent's role permissions before allowing the action
4. WHEN an Account_Owner assigns a Custom_Role to an Agent THEN the System SHALL apply all permissions defined in that role
5. IF an Agent attempts an action without required permission THEN the System SHALL reject the request and return a 403 Forbidden response
6. WHEN an Account_Owner modifies a Custom_Role THEN the System SHALL immediately apply changes to all Agents with that role

### Requirement 4: Gestão de Caixas de Entrada (Inboxes)

**User Story:** As an Account_Owner, I want to create multiple inboxes for different purposes, so that I can organize conversations by department or channel.

#### Acceptance Criteria

1. WHEN an Account_Owner creates an Inbox THEN the System SHALL associate it with the Account and generate a unique identifier
2. WHEN an Inbox is created THEN the System SHALL allow configuration of name, description, and auto-assignment settings
3. WHEN an Account_Owner assigns Agents to an Inbox THEN the System SHALL create Inbox_Member records linking Agents to the Inbox
4. WHEN an Agent accesses the conversation list THEN the System SHALL filter conversations to show only those from Inboxes the Agent is a member of
5. IF an Agent attempts to access a conversation from an Inbox they are not a member of THEN the System SHALL reject the request
6. WHEN an Inbox is deleted THEN the System SHALL reassign or archive associated conversations based on Account settings

### Requirement 5: Gestão de Equipes (Teams)

**User Story:** As an Account_Owner, I want to organize Agents into Teams, so that I can manage workload distribution and conversation routing.

#### Acceptance Criteria

1. WHEN an Account_Owner creates a Team THEN the System SHALL associate it with the Account and allow adding multiple Agents
2. WHEN an Agent is added to a Team THEN the System SHALL create a Team_Member record linking the Agent to the Team
3. WHEN a conversation is assigned to a Team THEN the System SHALL make it visible to all Team members
4. WHEN an Account_Owner views Team statistics THEN the System SHALL display member count, active conversations, and response metrics
5. WHEN an Agent is removed from a Team THEN the System SHALL reassign their active Team conversations based on Team settings

### Requirement 6: Autenticação e Sessões Individuais

**User Story:** As an Agent, I want to have my own login credentials, so that my actions are tracked individually and I can access the system securely.

#### Acceptance Criteria

1. WHEN an Agent logs in THEN the System SHALL validate credentials and create a session token containing Agent ID and Account ID
2. WHEN an Agent performs any action THEN the System SHALL log the action with Agent ID, timestamp, and action details
3. WHEN an Agent's session expires THEN the System SHALL require re-authentication
4. WHEN an Account_Owner views the audit log THEN the System SHALL display all actions performed by Agents with filtering options
5. IF multiple login attempts fail THEN the System SHALL temporarily lock the Agent account and notify the Account_Owner
6. WHEN an Agent changes their password THEN the System SHALL invalidate all existing sessions for that Agent

### Requirement 7: Controle de Acesso a Conversas

**User Story:** As an Agent, I want to see only the conversations I'm authorized to access, so that I can focus on my assigned work.

#### Acceptance Criteria

1. WHEN an Agent requests the conversation list THEN the System SHALL return only conversations from Inboxes where the Agent is a member
2. WHEN a conversation is assigned to an Agent THEN the System SHALL notify the Agent and add the conversation to their assigned list
3. WHEN an Agent views a conversation THEN the System SHALL verify Inbox membership before displaying content
4. WHEN an Agent sends a message THEN the System SHALL record the Agent ID as the sender for audit purposes
5. IF an Agent attempts to reassign a conversation without permission THEN the System SHALL reject the action

### Requirement 8: Disponibilidade e Status do Agent

**User Story:** As an Agent, I want to set my availability status, so that conversations are routed appropriately based on who is available.

#### Acceptance Criteria

1. WHEN an Agent sets their status to available THEN the System SHALL include them in auto-assignment routing
2. WHEN an Agent sets their status to busy THEN the System SHALL exclude them from new auto-assignments while keeping existing assignments
3. WHEN an Agent sets their status to offline THEN the System SHALL exclude them from all assignments and optionally reassign active conversations
4. WHEN an Account_Owner views the dashboard THEN the System SHALL display real-time availability status of all Agents
5. WHEN an Agent's status changes THEN the System SHALL broadcast the change via WebSocket to relevant dashboard views

### Requirement 9: Serialização e Persistência de Dados

**User Story:** As a system architect, I want data to be properly serialized and persisted, so that the system maintains data integrity across sessions.

#### Acceptance Criteria

1. WHEN storing Agent data THEN the System SHALL serialize it using JSON format with defined schema
2. WHEN retrieving Agent data THEN the System SHALL deserialize JSON and validate against the schema
3. WHEN storing role permissions THEN the System SHALL use a consistent JSON structure for permission arrays
4. WHEN migrating data THEN the System SHALL preserve all relationships between Accounts, Agents, Teams, and Inboxes

### Requirement 10: Integração com Sistema Existente

**User Story:** As a developer, I want the multi-user system to integrate seamlessly with existing features, so that current functionality is preserved.

#### Acceptance Criteria

1. WHEN an Agent sends a message via WUZAPI THEN the System SHALL use the Account's WUZAPI credentials while logging the Agent ID
2. WHEN an Agent configures webhooks THEN the System SHALL scope webhooks to the Account level with Agent attribution
3. WHEN an Agent accesses NocoDB integration THEN the System SHALL use Account-level credentials with Agent-specific audit logging
4. WHEN the system receives a webhook from WUZAPI THEN the System SHALL route it to the appropriate Account and notify relevant Agents
5. WHEN an Agent accesses the dashboard THEN the System SHALL display Account-level metrics filtered by Agent permissions
