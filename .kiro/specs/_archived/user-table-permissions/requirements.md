# Requirements Document

## Introduction

Este documento define os requisitos para um sistema de permissões de acesso a tabelas do banco de dados SQLite via API REST. O sistema permite que administradores configurem quais tabelas cada usuário pode acessar e quais operações (leitura, escrita, exclusão) podem realizar. Usuários autenticados podem então executar operações CRUD nas tabelas permitidas através de endpoints genéricos da API.

## Glossary

- **System**: O WUZAPI Manager (aplicação completa)
- **Admin**: Usuário com token administrativo que pode configurar permissões
- **User**: Usuário com token de usuário que pode acessar tabelas conforme permissões
- **Table Permission**: Configuração que define quais operações um usuário pode realizar em uma tabela específica
- **CRUD Operations**: Create (criar), Read (ler), Update (atualizar), Delete (excluir)
- **Permission Scope**: Conjunto de operações permitidas (read, write, delete)
- **SQLite Internal Tables**: Tabelas do banco de dados SQLite da aplicação (users, branding, webhooks, etc.)
- **Generic Table API**: Endpoints REST que permitem operações em qualquer tabela baseado em permissões
- **Permission Validation Middleware**: Middleware Express que valida permissões antes de executar operações

## Requirements

### Requirement 1

**User Story:** Como administrador, quero configurar permissões de acesso a tabelas para cada usuário, para que eu possa controlar quais dados cada usuário pode visualizar e modificar.

#### Acceptance Criteria

1. WHEN the Admin sends a POST request to create table permissions with valid user ID, table name, and permission scope, THE System SHALL store the permission configuration in the database and return a success response with the created permission details.

2. WHEN the Admin sends a GET request to list table permissions, THE System SHALL return all configured permissions with user information, table names, and permission scopes.

3. WHEN the Admin sends a PUT request to update existing table permissions with valid permission ID and new permission scope, THE System SHALL update the permission configuration and return the updated permission details.

4. WHEN the Admin sends a DELETE request to remove table permissions with valid permission ID, THE System SHALL remove the permission configuration from the database and return a success confirmation.

5. IF the Admin attempts to create duplicate permissions for the same user and table combination, THEN THE System SHALL return an error indicating that permissions already exist for that combination.

### Requirement 2

**User Story:** Como administrador, quero visualizar uma lista de todas as tabelas disponíveis no banco de dados, para que eu possa selecionar quais tabelas configurar permissões.

#### Acceptance Criteria

1. WHEN the Admin sends a GET request to list available tables, THE System SHALL query the SQLite schema and return a list of all non-system tables with their column information.

2. THE System SHALL exclude internal SQLite tables (sqlite_sequence, sqlite_master) from the available tables list.

3. WHEN the Admin requests table details for a specific table name, THE System SHALL return the table schema including column names, data types, and constraints.

4. THE System SHALL include metadata for each table such as row count and last modified timestamp in the table list response.

### Requirement 3

**User Story:** Como usuário autenticado, quero executar operações de leitura em tabelas para as quais tenho permissão, para que eu possa consultar dados via API.

#### Acceptance Criteria

1. WHEN the User sends a GET request to read records from a table with valid authentication token, THE System SHALL validate the user has read permission for that table and return the requested records.

2. THE System SHALL support query parameters for pagination (limit, offset), filtering (where conditions), and sorting (order by) in read operations.

3. WHEN the User sends a GET request to read a specific record by ID from a permitted table, THE System SHALL return the single record with all its fields.

4. IF the User attempts to read from a table without read permission, THEN THE System SHALL return a 403 Forbidden error with a message indicating insufficient permissions.

5. THE System SHALL sanitize and validate all query parameters to prevent SQL injection attacks before executing read operations.

### Requirement 4

**User Story:** Como usuário autenticado, quero executar operações de escrita em tabelas para as quais tenho permissão, para que eu possa criar e atualizar dados via API.

#### Acceptance Criteria

1. WHEN the User sends a POST request to create a new record in a permitted table with valid data, THE System SHALL validate write permission, insert the record, and return the created record with its generated ID.

2. WHEN the User sends a PUT request to update an existing record in a permitted table with valid data and record ID, THE System SHALL validate write permission, update the record, and return the updated record.

3. THE System SHALL validate that all required fields are provided and data types match the table schema before executing write operations.

4. IF the User attempts to write to a table without write permission, THEN THE System SHALL return a 403 Forbidden error with a message indicating insufficient permissions.

5. THE System SHALL use parameterized queries for all write operations to prevent SQL injection attacks.

### Requirement 5

**User Story:** Como usuário autenticado, quero executar operações de exclusão em tabelas para as quais tenho permissão, para que eu possa remover dados via API.

#### Acceptance Criteria

1. WHEN the User sends a DELETE request to remove a record from a permitted table with valid record ID, THE System SHALL validate delete permission, remove the record, and return a success confirmation.

2. IF the User attempts to delete from a table without delete permission, THEN THE System SHALL return a 403 Forbidden error with a message indicating insufficient permissions.

3. WHEN the User attempts to delete a non-existent record, THE System SHALL return a 404 Not Found error with an appropriate message.

4. THE System SHALL use parameterized queries for all delete operations to prevent SQL injection attacks.

### Requirement 6

**User Story:** Como administrador, quero uma interface visual para gerenciar permissões de tabelas, para que eu possa configurar permissões de forma intuitiva sem usar diretamente a API.

#### Acceptance Criteria

1. WHEN the Admin accesses the table permissions management page, THE System SHALL display a list of all users with their current table permissions.

2. THE System SHALL provide a form interface where the Admin can select a user, select a table from available tables, and choose permission scopes (read, write, delete) using checkboxes.

3. WHEN the Admin submits the permission configuration form with valid data, THE System SHALL create or update the permissions and display a success notification.

4. THE System SHALL provide edit and delete actions for each existing permission entry in the permissions list.

5. THE System SHALL display validation errors inline in the form when the Admin attempts to submit invalid permission configurations.

### Requirement 7

**User Story:** Como desenvolvedor do sistema, quero que todas as operações de tabela sejam registradas em logs, para que eu possa auditar acessos e diagnosticar problemas.

#### Acceptance Criteria

1. WHEN any table operation (read, write, delete) is executed, THE System SHALL log the operation with user ID, table name, operation type, timestamp, and success/failure status using Winston logger.

2. WHEN a permission validation fails, THE System SHALL log the failed attempt with user ID, requested table, requested operation, and reason for denial.

3. THE System SHALL log all admin operations on permission configurations including creation, updates, and deletions with admin user ID and affected permission details.

4. THE System SHALL include request metadata (IP address, user agent) in security-related log entries for permission violations.

### Requirement 8

**User Story:** Como usuário do sistema, quero que minhas operações de API sejam protegidas contra rate limiting, para que o sistema permaneça estável sob carga.

#### Acceptance Criteria

1. THE System SHALL apply rate limiting to generic table API endpoints with a maximum of 100 requests per minute per user token.

2. WHEN a User exceeds the rate limit, THE System SHALL return a 429 Too Many Requests error with a Retry-After header indicating when requests can resume.

3. THE System SHALL apply stricter rate limiting to write and delete operations (50 requests per minute) compared to read operations (100 requests per minute).

4. THE System SHALL exclude admin permission management endpoints from user rate limits but apply separate admin rate limits (200 requests per minute).
