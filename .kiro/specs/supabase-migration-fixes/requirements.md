# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir erros identificados no perfil de usuário após a migração do banco de dados SQLite para Supabase. Os erros foram mapeados através de navegação sistemática pelas páginas do sistema usando Chrome DevTools.

## Glossary

- **Supabase**: Plataforma de banco de dados PostgreSQL na nuvem utilizada como backend do sistema
- **SupabaseService**: Serviço de abstração do banco de dados localizado em `server/services/SupabaseService.js`
- **ChatService**: Serviço responsável por operações de chat localizado em `server/services/ChatService.js`
- **OutgoingWebhookService**: Serviço responsável por webhooks de saída
- **Endpoint**: Rota HTTP da API backend
- **User Profile**: Área do sistema acessível por usuários autenticados

## Requirements

### Requirement 1: Corrigir OutgoingWebhookService

**User Story:** As a user, I want to view and manage my outgoing webhooks, so that I can integrate with external systems.

#### Acceptance Criteria

1. WHEN a user accesses the Chat Integration settings tab THEN the system SHALL load outgoing webhooks without errors
2. WHEN the OutgoingWebhookService queries the database THEN the system SHALL use SupabaseService methods instead of deprecated `this.db.query`
3. WHEN outgoing webhooks are retrieved THEN the system SHALL return a properly formatted array of webhook objects

### Requirement 2: Corrigir ChatService.getLabels

**User Story:** As a user, I want to view and manage my chat labels, so that I can organize my conversations.

#### Acceptance Criteria

1. WHEN a user accesses the Labels settings tab THEN the system SHALL load labels without errors
2. WHEN the ChatService is instantiated THEN the system SHALL include the `getLabels` method
3. WHEN labels are retrieved THEN the system SHALL return a properly formatted array of label objects

### Requirement 3: Corrigir ChatService.getCannedResponses

**User Story:** As a user, I want to view and manage my canned responses, so that I can quickly reply to common questions.

#### Acceptance Criteria

1. WHEN a user accesses the Canned Responses settings tab THEN the system SHALL load canned responses without errors
2. WHEN the ChatService is instantiated THEN the system SHALL include the `getCannedResponses` method
3. WHEN canned responses are retrieved THEN the system SHALL return a properly formatted array of response objects

### Requirement 4: Corrigir Conversations Query

**User Story:** As a user, I want to view my chat conversations, so that I can communicate with my contacts.

#### Acceptance Criteria

1. WHEN a user accesses the Chat page THEN the system SHALL load conversations without errors
2. WHEN the conversations query is executed THEN the system SHALL reference only existing columns in the Supabase schema
3. WHEN conversations are retrieved THEN the system SHALL return a properly formatted array of conversation objects with all required fields

### Requirement 5: Corrigir Bulk Campaigns History

**User Story:** As a user, I want to view my bulk campaign history, so that I can track my messaging campaigns.

#### Acceptance Criteria

1. WHEN a user accesses the Outbox page THEN the system SHALL load campaign history without errors
2. WHEN the bulk campaigns history query returns empty results THEN the system SHALL handle the response gracefully without accessing undefined properties
3. WHEN campaign history is retrieved THEN the system SHALL return a properly formatted response with `total` and `items` properties

### Requirement 6: Validação de Integridade

**User Story:** As a developer, I want all database queries to use the correct Supabase abstraction, so that the system remains consistent and maintainable.

#### Acceptance Criteria

1. WHEN any service queries the database THEN the system SHALL use SupabaseService methods exclusively
2. WHEN a database operation fails THEN the system SHALL log the error with appropriate context and return a meaningful error message
3. WHEN a service method is called THEN the system SHALL validate that required methods exist before execution
