# Requirements Document

## Introduction

Este documento especifica os requisitos para a criação de um sistema de contas de usuário independentes. Atualmente, o sistema possui dois tipos de usuários (Proprietário e Agente) que dependem de uma Account vinculada a um token WUZAPI. A nova funcionalidade permitirá que usuários tenham contas próprias independentes da configuração de caixa de entrada/token WUZAPI, já que a API pode ser alterada dinamicamente na configuração de admin.

## Glossary

- **Sistema**: O WUZAPI Manager como um todo
- **User**: Novo tipo de usuário com conta independente, sem vínculo obrigatório com token WUZAPI
- **Account**: Entidade existente que agrupa agentes e contém configurações incluindo wuzapi_token
- **Agent**: Usuário existente (Proprietário ou Agente) vinculado a uma Account
- **Inbox**: Caixa de entrada que contém configurações de conexão WhatsApp
- **WUZAPI_Token**: Token de autenticação para a API WUZAPI (configurável pelo admin)
- **Tenant**: Contexto multi-tenant que isola dados entre organizações
- **Session**: Sessão de autenticação HTTP do usuário

## Requirements

### Requirement 1: Criação de Conta de Usuário Independente

**User Story:** As a system administrator, I want to create independent user accounts, so that users can access the system without requiring a WUZAPI token or inbox configuration.

#### Acceptance Criteria

1. THE Sistema SHALL allow creation of User accounts with email and password credentials
2. WHEN a User account is created THEN the Sistema SHALL NOT require a WUZAPI token
3. WHEN a User account is created THEN the Sistema SHALL NOT require an Inbox configuration
4. THE Sistema SHALL store User credentials securely using password hashing
5. WHEN a User is created THEN the Sistema SHALL assign the User to a Tenant context
6. THE Sistema SHALL validate email uniqueness within the same Tenant

### Requirement 2: Autenticação de Usuário Independente

**User Story:** As a user, I want to login with my email and password, so that I can access the system without needing a WUZAPI token.

#### Acceptance Criteria

1. WHEN a User provides valid email and password THEN the Sistema SHALL create an authenticated session
2. WHEN a User provides invalid credentials THEN the Sistema SHALL return an authentication error
3. THE Sistema SHALL NOT validate User credentials against WUZAPI API
4. WHEN a User logs in THEN the Sistema SHALL set appropriate session data (userId, role, tenantId)
5. WHEN a User session is created THEN the Sistema SHALL track login attempts for security
6. IF a User exceeds 5 failed login attempts THEN the Sistema SHALL lock the account for 15 minutes

### Requirement 3: Vinculação Opcional de Inbox

**User Story:** As a user, I want to optionally link my account to an inbox, so that I can use WhatsApp messaging features when needed.

#### Acceptance Criteria

1. THE Sistema SHALL allow Users to operate without any linked Inbox
2. WHEN a User links an Inbox THEN the Sistema SHALL validate the Inbox belongs to the same Tenant
3. WHEN a User has no linked Inbox THEN the Sistema SHALL disable WhatsApp messaging features
4. WHEN a User has a linked Inbox THEN the Sistema SHALL enable WhatsApp messaging features
5. THE Sistema SHALL allow Users to unlink an Inbox at any time
6. WHEN an Inbox is unlinked THEN the Sistema SHALL preserve User account and data

### Requirement 4: Gerenciamento de Permissões de Usuário

**User Story:** As a system administrator, I want to manage user permissions, so that I can control what features each user can access.

#### Acceptance Criteria

1. THE Sistema SHALL define a default permission set for User accounts
2. WHEN a User has no linked Inbox THEN the Sistema SHALL restrict messaging-related permissions
3. THE Sistema SHALL allow administrators to customize User permissions
4. WHEN permissions are updated THEN the Sistema SHALL apply changes immediately
5. THE Sistema SHALL log all permission changes in the audit log

### Requirement 5: Migração de Configuração de API

**User Story:** As a system administrator, I want to configure WUZAPI settings dynamically, so that I can change the API endpoint without affecting user accounts.

#### Acceptance Criteria

1. THE Sistema SHALL store WUZAPI configuration in the database (not environment variables)
2. WHEN WUZAPI configuration is changed THEN the Sistema SHALL NOT invalidate User sessions
3. THE Sistema SHALL allow WUZAPI_BASE_URL to be configured via admin panel
4. THE Sistema SHALL allow WUZAPI_ADMIN_TOKEN to be configured via admin panel
5. WHEN WUZAPI configuration is missing THEN the Sistema SHALL disable API-dependent features gracefully
6. THE Sistema SHALL validate WUZAPI configuration before saving

### Requirement 6: Separação de Contextos de Autenticação

**User Story:** As a developer, I want clear separation between User and Agent authentication, so that the system can handle both types correctly.

#### Acceptance Criteria

1. THE Sistema SHALL distinguish between User and Agent authentication flows
2. WHEN a User logs in THEN the Sistema SHALL set role as 'user' in session
3. WHEN an Agent logs in THEN the Sistema SHALL set role as 'admin' in session
4. THE Sistema SHALL maintain backward compatibility with existing Agent authentication
5. WHEN checking permissions THEN the Sistema SHALL consider the authentication type

### Requirement 7: Interface de Gerenciamento de Usuários

**User Story:** As a system administrator, I want a user management interface, so that I can create, edit, and manage independent user accounts.

#### Acceptance Criteria

1. THE Sistema SHALL provide a UI for listing all Users in a Tenant
2. THE Sistema SHALL provide a UI for creating new User accounts
3. THE Sistema SHALL provide a UI for editing User account details
4. THE Sistema SHALL provide a UI for activating/deactivating User accounts
5. THE Sistema SHALL provide a UI for resetting User passwords
6. WHEN a User is deactivated THEN the Sistema SHALL invalidate all active sessions

### Requirement 8: Remoção de Dependência de Variáveis de Ambiente para API

**User Story:** As a system administrator, I want to remove hardcoded API configuration from environment variables, so that I can manage API settings dynamically.

#### Acceptance Criteria

1. THE Sistema SHALL read WUZAPI_BASE_URL from database configuration
2. THE Sistema SHALL read WUZAPI_ADMIN_TOKEN from database configuration
3. THE Sistema SHALL provide fallback to environment variables during migration period
4. WHEN database configuration exists THEN the Sistema SHALL prioritize it over environment variables
5. THE Sistema SHALL cache API configuration for performance
6. WHEN API configuration is updated THEN the Sistema SHALL invalidate the cache

