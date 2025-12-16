# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir vulnerabilidades de segurança críticas no sistema de gerenciamento de conexões de banco de dados (Database Connections). As correções devem manter compatibilidade total com o frontend existente e os fluxos de usuário atuais.

O sistema atual possui rotas de database expostas publicamente sem autenticação, permitindo que qualquer pessoa liste, crie, modifique ou delete conexões de banco de dados, incluindo credenciais sensíveis.

## Glossary

- **Database Connection**: Configuração de conexão com banco de dados externo (NocoDB, MySQL, PostgreSQL, SQLite)
- **Admin Token**: Token de autenticação para operações administrativas
- **User Token**: Token de autenticação para operações de usuário comum
- **Rate Limiting**: Limitação de requisições por período de tempo para prevenir abuso
- **Credential Masking**: Ocultação de dados sensíveis (senhas, tokens) nas respostas da API
- **Session-based Auth**: Autenticação baseada em sessão do Express
- **backendApi**: Cliente HTTP do frontend que gerencia autenticação via sessão

## Requirements

### Requirement 1: Proteção das Rotas de Database Connections

**User Story:** As a system administrator, I want database connection routes to require authentication, so that unauthorized users cannot access or modify database configurations.

#### Acceptance Criteria

1. WHEN a request is made to `/api/database-connections` without valid admin session THEN the system SHALL return HTTP 401 Unauthorized
2. WHEN a request is made to `/api/database-connections` with valid admin session THEN the system SHALL process the request normally
3. WHEN rate limiting is applied to database routes THEN the system SHALL limit requests to 100 per 15 minutes per IP
4. WHEN the frontend makes requests via backendApi THEN the system SHALL use session-based authentication automatically

### Requirement 2: Mascaramento de Credenciais Sensíveis

**User Story:** As a security officer, I want sensitive credentials to be masked in API responses, so that passwords and tokens are not exposed in network traffic or logs.

#### Acceptance Criteria

1. WHEN listing all database connections THEN the system SHALL mask password fields with asterisks
2. WHEN listing all database connections THEN the system SHALL mask nocodb_token fields with asterisks
3. WHEN fetching a single connection by ID THEN the system SHALL mask password and token fields
4. WHEN a connection is created or updated THEN the system SHALL store credentials securely but return masked values
5. WHEN credentials need to be used internally THEN the system SHALL retrieve unmasked values only for internal operations

### Requirement 3: Validação de Entrada Robusta

**User Story:** As a developer, I want all input data to be validated before processing, so that malicious or malformed data cannot compromise the system.

#### Acceptance Criteria

1. WHEN creating a database connection THEN the system SHALL validate name length between 1 and 100 characters
2. WHEN creating a database connection THEN the system SHALL validate type is one of POSTGRES, MYSQL, NOCODB, API, SQLITE
3. WHEN creating a database connection THEN the system SHALL validate host format as valid URL or localhost
4. WHEN creating a database connection THEN the system SHALL validate port is between 1 and 65535
5. WHEN validation fails THEN the system SHALL return HTTP 400 with specific error messages

### Requirement 4: Remoção de Token Hardcoded

**User Story:** As a security officer, I want default tokens removed from source code, so that the system cannot be compromised using known default credentials.

#### Acceptance Criteria

1. WHEN VITE_ADMIN_TOKEN environment variable is not set THEN the system SHALL reject all admin token authentication attempts
2. WHEN admin token authentication fails due to missing configuration THEN the system SHALL log a warning about missing configuration
3. WHEN the system starts without VITE_ADMIN_TOKEN THEN the system SHALL log a startup warning

### Requirement 5: Logging de Segurança Aprimorado

**User Story:** As a security officer, I want security-relevant events to be logged, so that I can audit access attempts and detect potential attacks.

#### Acceptance Criteria

1. WHEN an unauthorized access attempt occurs THEN the system SHALL log the IP address, path, and timestamp
2. WHEN authentication succeeds THEN the system SHALL log the user ID and accessed resource
3. WHEN credentials are accessed THEN the system SHALL log the access without exposing the credential values
4. WHEN rate limiting is triggered THEN the system SHALL log the blocked request details

### Requirement 6: Compatibilidade com Frontend Existente

**User Story:** As a developer, I want security changes to maintain backward compatibility, so that the existing frontend continues to work without modifications.

#### Acceptance Criteria

1. WHEN the frontend calls `/api/database-connections` via backendApi THEN the system SHALL authenticate using the existing session mechanism
2. WHEN the frontend receives masked credentials THEN the system SHALL use consistent masking format (asterisks)
3. WHEN updating a connection without providing password THEN the system SHALL preserve the existing password
4. WHEN the API response format changes THEN the system SHALL maintain the same JSON structure with success, data, and error fields

### Requirement 7: Limpeza de Logs de Debug

**User Story:** As a developer, I want debug logs removed from production code, so that sensitive information is not exposed in production logs.

#### Acceptance Criteria

1. WHEN the system runs in production mode THEN the system SHALL suppress console.log debug statements
2. WHEN the system runs in development mode THEN the system SHALL allow debug logging via logger utility
3. WHEN database operations occur THEN the system SHALL use the logger utility instead of console.log
