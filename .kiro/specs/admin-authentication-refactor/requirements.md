# Requirements Document

## Introduction

Este documento especifica os requisitos para refatorar o sistema de autenticação administrativa do WUZAPI Manager. Atualmente, o sistema usa tokens para autenticação de administradores, o que não é ideal para segurança e usabilidade. Além disso, o botão "Manage" na lista de tenants não oferece opções de edição. O objetivo é implementar autenticação baseada em usuário/senha para administradores e adicionar funcionalidades completas de gerenciamento de tenants.

## Glossary

- **Superadmin**: Usuário com privilégios máximos na plataforma, responsável por gerenciar tenants e configurações globais
- **Tenant**: Instância isolada da plataforma para um cliente específico, com seu próprio subdomínio e dados
- **Token-based Auth**: Autenticação atual usando tokens estáticos (VITE_ADMIN_TOKEN)
- **Credential-based Auth**: Autenticação usando email/senha com sessões HTTP-only
- **Session**: Sessão de autenticação HTTP-only gerenciada pelo servidor
- **bcrypt**: Algoritmo de hash seguro para armazenamento de senhas

## Requirements

### Requirement 1

**User Story:** As a superadmin, I want to login with email and password instead of a token, so that I have a more secure and user-friendly authentication experience.

#### Acceptance Criteria

1. WHEN a superadmin accesses /superadmin/login THEN the system SHALL display a login form with email and password fields
2. WHEN a superadmin submits valid email and password THEN the system SHALL authenticate against the superadmins database table
3. WHEN authentication succeeds THEN the system SHALL create an HTTP-only session cookie and redirect to /superadmin/dashboard
4. WHEN authentication fails THEN the system SHALL display an error message without revealing whether email or password was incorrect
5. WHEN a superadmin is already authenticated THEN the system SHALL redirect from /superadmin/login to /superadmin/dashboard

### Requirement 2

**User Story:** As a superadmin, I want to manage my account credentials, so that I can update my password when needed.

#### Acceptance Criteria

1. WHEN a superadmin navigates to /superadmin/settings THEN the system SHALL display a password change form
2. WHEN a superadmin submits current password and new password THEN the system SHALL validate the current password before updating
3. WHEN password update succeeds THEN the system SHALL display a success message and invalidate other sessions
4. WHEN current password is incorrect THEN the system SHALL display an error message without updating the password
5. WHEN new password does not meet complexity requirements THEN the system SHALL display specific validation errors

### Requirement 3

**User Story:** As a superadmin, I want to edit tenant details from the tenant list, so that I can update tenant information without navigating away.

#### Acceptance Criteria

1. WHEN a superadmin clicks "Manage" on a tenant row THEN the system SHALL display a dropdown menu with Edit, View, and Delete options
2. WHEN a superadmin clicks "Edit" THEN the system SHALL display a modal form pre-filled with tenant data
3. WHEN a superadmin submits valid tenant updates THEN the system SHALL save changes and refresh the tenant list
4. WHEN a superadmin clicks "Delete" THEN the system SHALL display a confirmation dialog before deletion
5. WHEN tenant update fails THEN the system SHALL display an error message and preserve the form data

### Requirement 4

**User Story:** As a system administrator, I want superadmin accounts stored securely in the database, so that credentials are protected against unauthorized access.

#### Acceptance Criteria

1. WHEN a superadmin account is created THEN the system SHALL hash the password using bcrypt with cost factor 12
2. WHEN storing superadmin data THEN the system SHALL never store plaintext passwords in any table or log
3. WHEN a login attempt occurs THEN the system SHALL use constant-time comparison for password verification
4. WHEN multiple failed login attempts occur THEN the system SHALL implement rate limiting (5 attempts per 15 minutes)
5. WHEN a session is created THEN the system SHALL set secure, HTTP-only, and SameSite=Strict cookie attributes

### Requirement 5

**User Story:** As a superadmin, I want to create additional superadmin accounts, so that I can delegate platform management to other administrators.

#### Acceptance Criteria

1. WHEN a superadmin navigates to /superadmin/settings THEN the system SHALL display a section for managing superadmin accounts
2. WHEN a superadmin clicks "Add Superadmin" THEN the system SHALL display a form for email and temporary password
3. WHEN a new superadmin account is created THEN the system SHALL require password change on first login
4. WHEN a superadmin views the account list THEN the system SHALL display email, created date, and last login for each account
5. WHEN a superadmin deletes another account THEN the system SHALL prevent self-deletion and require confirmation

### Requirement 6

**User Story:** As a developer, I want to migrate from token-based to credential-based authentication, so that the system maintains backward compatibility during transition.

#### Acceptance Criteria

1. WHEN the migration script runs THEN the system SHALL create the superadmins table if it does not exist
2. WHEN no superadmin accounts exist THEN the system SHALL create a default account using environment variables (SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
3. WHEN the old token-based endpoint is called THEN the system SHALL return a deprecation warning in the response headers
4. WHEN both authentication methods are available THEN the system SHALL prioritize credential-based authentication
5. WHEN the migration is complete THEN the system SHALL allow removal of VITE_ADMIN_TOKEN from environment variables

