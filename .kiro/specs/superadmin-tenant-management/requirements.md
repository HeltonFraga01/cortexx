# Requirements Document

## Introduction

Este documento especifica os requisitos para implementar funcionalidades completas de gerenciamento de tenants no painel de Superadmin do WUZAPI Manager. Atualmente, o botão "Manage" na página de detalhes do tenant apenas faz impersonation, mas o superadmin precisa de acesso direto para criar, editar e gerenciar accounts, agents, branding e planos de cada tenant sem precisar fazer impersonation.

## Glossary

- **Superadmin**: Usuário com privilégios máximos na plataforma, responsável por gerenciar tenants e configurações globais
- **Tenant**: Instância isolada da plataforma para um cliente específico, com seu próprio subdomínio e dados
- **Account**: Conta de usuário dentro de um tenant, representa um cliente do tenant
- **Agent**: Usuário operador dentro de uma account, pode ser owner, administrator, agent ou viewer
- **Inbox**: Canal de comunicação WhatsApp associado a uma account
- **Tenant Plan**: Plano de assinatura específico de um tenant com quotas e features
- **Branding**: Configurações visuais do tenant (logo, cores, nome)

## Requirements

### Requirement 1

**User Story:** As a superadmin, I want to see a comprehensive management interface when clicking "Manage" on a tenant, so that I can access all tenant administration functions in one place.

#### Acceptance Criteria

1. WHEN a superadmin clicks "Manage" on a tenant detail page THEN the system SHALL display a management panel with tabs for Accounts, Agents, Branding, Plans, and Settings
2. WHEN the management panel opens THEN the system SHALL display the tenant name and status in the header
3. WHEN navigating between tabs THEN the system SHALL preserve the tenant context and update the URL accordingly
4. WHEN the tenant is inactive THEN the system SHALL display a warning banner but still allow management operations
5. WHEN any management operation fails THEN the system SHALL display an error toast with the specific error message

### Requirement 2

**User Story:** As a superadmin, I want to list and manage accounts within a tenant, so that I can help tenant administrators with account issues.

#### Acceptance Criteria

1. WHEN a superadmin views the Accounts tab THEN the system SHALL display a paginated list of all accounts in the tenant with name, email, status, and creation date
2. WHEN a superadmin clicks "Create Account" THEN the system SHALL display a form to create a new account with name, owner email, and WUZAPI token fields
3. WHEN a superadmin submits valid account data THEN the system SHALL create the account and refresh the list
4. WHEN a superadmin clicks "Edit" on an account THEN the system SHALL display a form to edit account name, status, and settings
5. WHEN a superadmin clicks "Delete" on an account THEN the system SHALL require confirmation and cascade delete all related data

### Requirement 3

**User Story:** As a superadmin, I want to list and manage agents within tenant accounts, so that I can help with user access issues.

#### Acceptance Criteria

1. WHEN a superadmin views the Agents tab THEN the system SHALL display a list of all agents across all accounts in the tenant with name, email, role, account name, and status
2. WHEN a superadmin clicks "Create Agent" THEN the system SHALL display a form to create a new agent with account selection, name, email, password, and role fields
3. WHEN a superadmin submits valid agent data THEN the system SHALL create the agent and refresh the list
4. WHEN a superadmin clicks "Edit" on an agent THEN the system SHALL display a form to edit agent name, role, and status
5. WHEN a superadmin clicks "Reset Password" on an agent THEN the system SHALL generate a temporary password and display it to the superadmin

### Requirement 4

**User Story:** As a superadmin, I want to manage tenant branding settings, so that I can customize the tenant's visual identity.

#### Acceptance Criteria

1. WHEN a superadmin views the Branding tab THEN the system SHALL display current branding settings including app name, logo, primary color, and secondary color
2. WHEN a superadmin edits branding settings THEN the system SHALL validate color formats and image URLs
3. WHEN a superadmin uploads a new logo THEN the system SHALL store the image and update the logo URL
4. WHEN a superadmin saves branding changes THEN the system SHALL update the tenant_branding table and display a success message
5. WHEN branding changes are saved THEN the system SHALL apply changes immediately without requiring tenant restart

### Requirement 5

**User Story:** As a superadmin, I want to manage tenant plans, so that I can configure pricing and quotas for the tenant's customers.

#### Acceptance Criteria

1. WHEN a superadmin views the Plans tab THEN the system SHALL display a list of all plans for the tenant with name, price, status, and subscriber count
2. WHEN a superadmin clicks "Create Plan" THEN the system SHALL display a form with name, description, price, billing cycle, quotas, and features fields
3. WHEN a superadmin edits a plan THEN the system SHALL allow modification of all plan fields except ID
4. WHEN a superadmin sets a plan as default THEN the system SHALL unset any previous default plan for the tenant
5. WHEN a superadmin deactivates a plan THEN the system SHALL prevent new subscriptions but maintain existing ones

### Requirement 6

**User Story:** As a superadmin, I want to view tenant metrics and activity, so that I can monitor tenant health and usage.

#### Acceptance Criteria

1. WHEN a superadmin views the Settings tab THEN the system SHALL display tenant metrics including total accounts, total agents, total inboxes, and MRR
2. WHEN a superadmin views activity THEN the system SHALL display recent audit log entries for the tenant
3. WHEN a superadmin exports tenant data THEN the system SHALL generate a CSV with accounts, agents, and usage data
4. WHEN viewing metrics THEN the system SHALL show comparison with previous period where applicable
5. WHEN the tenant has no activity THEN the system SHALL display appropriate empty states

