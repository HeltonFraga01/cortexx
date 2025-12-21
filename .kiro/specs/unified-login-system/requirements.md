# Requirements Document

## Introduction

Este documento especifica os requisitos para a unificação do sistema de login da plataforma WUZAPI Manager. O objetivo é consolidar as múltiplas páginas de login existentes (`/agent/login`, `/user-login`, `/login`) em uma única página padronizada em `/login`, utilizando exclusivamente o Supabase Auth para autenticação de todos os tipos de usuários.

A plataforma atualmente possui três tipos de usuários com sistemas de autenticação separados:
- **Agentes**: Membros de equipe que atendem conversas
- **Usuários**: Proprietários de contas com acesso ao dashboard
- **Admin/Superadmin**: Administradores do sistema

O novo sistema aproveitará os recursos nativos do Supabase Auth para:
- Cadastro com confirmação de email
- Login com email e senha
- Reset de senha via email
- Gerenciamento de sessões

## Glossary

- **Supabase_Auth**: Serviço de autenticação do Supabase que gerencia usuários, sessões, confirmação de email e reset de senha
- **User_Role**: Papel do usuário no sistema (agent, user, admin, superadmin) armazenado em `user_metadata`
- **Login_Page**: Página unificada de login em `/login`
- **Auth_Tab**: Aba de seleção do tipo de acesso na página de login
- **Session**: Sessão de autenticação gerenciada pelo Supabase Auth
- **Email_Confirmation**: Processo de verificação de email enviado automaticamente pelo Supabase
- **Password_Reset**: Processo de recuperação de senha via email enviado pelo Supabase
- **Tenant**: Organização/empresa que utiliza a plataforma (multi-tenant)

## Requirements

### Requirement 1: Página de Login Unificada

**User Story:** As a user, I want to access a single login page at `/login`, so that I can authenticate regardless of my role in the system.

#### Acceptance Criteria

1. WHEN a user navigates to `/login` THEN THE Login_Page SHALL display a unified login interface with three Auth_Tabs: "Agente", "Usuário" and "Admin"
2. WHEN a user navigates to legacy routes (`/agent/login`, `/user-login`) THEN THE System SHALL redirect to `/login` preserving any query parameters
3. WHEN the Login_Page loads THEN THE System SHALL display the tenant branding (logo, colors, app name) from the current subdomain
4. THE Login_Page SHALL be responsive and accessible on mobile devices
5. WHEN a user selects an Auth_Tab THEN THE Login_Page SHALL display the appropriate login form for that role

### Requirement 2: Autenticação de Agente

**User Story:** As an agent, I want to login with my email and password, so that I can access the agent dashboard and manage conversations.

#### Acceptance Criteria

1. WHEN an agent enters valid email and password and clicks login THEN THE Supabase_Auth SHALL authenticate the user and create a Session
2. WHEN authentication succeeds for an agent THEN THE System SHALL redirect to `/agent/dashboard`
3. WHEN authentication fails THEN THE Login_Page SHALL display an appropriate error message without revealing if the email exists
4. IF an agent account is locked due to failed attempts THEN THE Login_Page SHALL display a message indicating the account is temporarily locked
5. WHEN an agent clicks "Esqueci minha senha" THEN THE System SHALL initiate the Password_Reset flow via Supabase_Auth

### Requirement 3: Autenticação de Usuário

**User Story:** As a user (account owner), I want to login with my email and password, so that I can access my dashboard and manage my account.

#### Acceptance Criteria

1. WHEN a user enters valid email and password and clicks login THEN THE Supabase_Auth SHALL authenticate the user and create a Session
2. WHEN authentication succeeds for a user THEN THE System SHALL redirect to `/user/dashboard`
3. WHEN authentication fails THEN THE Login_Page SHALL display an appropriate error message without revealing if the email exists
4. WHEN a user clicks "Esqueci minha senha" THEN THE Login_Page SHALL initiate the Password_Reset flow via Supabase_Auth
5. WHEN a user clicks "Cadastre-se" THEN THE System SHALL navigate to the registration page

### Requirement 4: Autenticação de Admin

**User Story:** As an admin, I want to login with my email and password, so that I can access the admin panel and manage the system.

#### Acceptance Criteria

1. WHEN an admin enters valid email and password and clicks login THEN THE Supabase_Auth SHALL authenticate the user and create a Session
2. WHEN authentication succeeds for an admin THEN THE System SHALL redirect to `/admin`
3. WHEN authentication succeeds for a superadmin THEN THE System SHALL redirect to `/superadmin/dashboard`
4. WHEN authentication fails THEN THE Login_Page SHALL display an appropriate error message
5. THE Admin Auth_Tab SHALL be visually distinct to indicate elevated access

### Requirement 5: Cadastro de Usuário com Supabase Auth

**User Story:** As a new user, I want to register with my email and password, so that I can create an account and start using the platform.

#### Acceptance Criteria

1. WHEN a user submits the registration form with valid data THEN THE Supabase_Auth SHALL create a new user account
2. WHEN registration succeeds THEN THE Supabase_Auth SHALL send an Email_Confirmation to the user's email address
3. WHEN a user clicks the confirmation link in the email THEN THE Supabase_Auth SHALL verify the email and activate the account
4. IF a user attempts to login before confirming email THEN THE Login_Page SHALL display a message indicating email confirmation is required
5. WHEN registration fails due to existing email THEN THE System SHALL display a generic error without confirming the email exists

### Requirement 6: Reset de Senha via Supabase Auth

**User Story:** As a user who forgot my password, I want to reset it via email, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user requests password reset THEN THE Supabase_Auth SHALL send a Password_Reset email to the provided address
2. WHEN a user clicks the reset link in the email THEN THE System SHALL navigate to `/reset-password` with the token
3. WHEN a user submits a new password THEN THE Supabase_Auth SHALL update the password and invalidate the reset token
4. IF the reset token is expired or invalid THEN THE System SHALL display an error and offer to send a new reset email
5. THE Password_Reset email SHALL be sent regardless of whether the email exists (to prevent enumeration)

### Requirement 7: Gerenciamento de Sessão

**User Story:** As an authenticated user, I want my session to persist across page refreshes, so that I don't need to login repeatedly.

#### Acceptance Criteria

1. WHEN a user successfully authenticates THEN THE Supabase_Auth SHALL store the Session securely
2. WHEN a user refreshes the page THEN THE System SHALL restore the Session from Supabase_Auth
3. WHEN a user clicks logout THEN THE System SHALL terminate the Session via Supabase_Auth
4. WHEN a Session expires THEN THE System SHALL redirect to `/login` with a message indicating session expiration
5. THE System SHALL listen for auth state changes via `onAuthStateChange` and update UI accordingly

### Requirement 8: Determinação de Role do Usuário

**User Story:** As the system, I need to determine the user's role after authentication, so that I can redirect them to the appropriate dashboard.

#### Acceptance Criteria

1. WHEN a user authenticates THEN THE System SHALL read the User_Role from `user_metadata.role`
2. WHEN User_Role is "agent" THEN THE System SHALL redirect to `/agent/dashboard`
3. WHEN User_Role is "user" THEN THE System SHALL redirect to `/user/dashboard`
4. WHEN User_Role is "admin" THEN THE System SHALL redirect to `/admin`
5. WHEN User_Role is "superadmin" THEN THE System SHALL redirect to `/superadmin/dashboard`
6. IF User_Role is not set THEN THE System SHALL default to "user" role

### Requirement 9: Migração de Usuários Existentes

**User Story:** As an existing user with credentials in the legacy system, I want to be able to login with the new unified system, so that I don't lose access to my account.

#### Acceptance Criteria

1. THE System SHALL provide a migration script to create Supabase Auth users from existing `agents`, `users`, and `superadmins` tables
2. WHEN migrating users THEN THE System SHALL preserve the email and set a temporary password requiring reset
3. WHEN migrating users THEN THE System SHALL set the appropriate User_Role in `user_metadata`
4. THE Migration script SHALL link Supabase Auth user IDs to existing records via `user_id` foreign key
5. WHEN a migrated user first logs in THEN THE System SHALL prompt for password change if using temporary password

### Requirement 10: Multi-Tenant Support

**User Story:** As a tenant administrator, I want users to be scoped to my tenant, so that data isolation is maintained.

#### Acceptance Criteria

1. WHEN a user registers THEN THE System SHALL associate them with the current Tenant based on subdomain
2. WHEN a user authenticates THEN THE System SHALL verify they belong to the current Tenant
3. IF a user attempts to access a different Tenant THEN THE System SHALL deny access and display an error
4. THE Login_Page SHALL display Tenant-specific branding based on subdomain
5. WHEN creating Supabase Auth users THEN THE System SHALL store `tenant_id` in `user_metadata`
