# Requirements Document

## Introduction

Este documento especifica os requisitos para migração do banco de dados SQLite para Supabase (PostgreSQL). O sistema WUZAPI Manager atualmente utiliza SQLite em modo WAL para persistência de dados. A migração para Supabase permitirá aproveitar recursos avançados como Row Level Security (RLS), Realtime subscriptions, autenticação integrada, Edge Functions e melhor escalabilidade.

O projeto Supabase já está configurado em: https://bdhkfyvyvgfdukdodddr.supabase.co

## Glossary

- **Supabase**: Plataforma Backend-as-a-Service baseada em PostgreSQL com autenticação, storage, realtime e edge functions
- **RLS (Row Level Security)**: Políticas de segurança a nível de linha que controlam acesso aos dados baseado no usuário autenticado
- **Migration**: Script SQL que altera a estrutura do banco de dados de forma versionada
- **Edge Function**: Função serverless executada na edge do Supabase (Deno runtime)
- **Realtime**: Sistema de subscriptions que notifica clientes sobre mudanças no banco
- **WUZAPI Manager**: Sistema de gerenciamento de API WhatsApp Business multi-usuário
- **Account**: Organização/empresa com sua própria conexão WUZAPI
- **Agent**: Sub-usuário dentro de uma conta com credenciais e permissões individuais
- **Conversation**: Thread de chat entre usuário e contato WhatsApp
- **Plan**: Plano de assinatura com quotas e features definidas

## Requirements

### Requirement 1: Schema Migration

**User Story:** As a system administrator, I want to migrate all SQLite tables to Supabase PostgreSQL, so that the system can leverage advanced database features.

#### Acceptance Criteria

1. WHEN the migration is executed THEN the Supabase database SHALL contain all 40+ tables from the SQLite schema with equivalent structure
2. WHEN creating tables THEN the system SHALL use PostgreSQL-native data types (UUID, JSONB, TIMESTAMPTZ) instead of SQLite equivalents
3. WHEN migrating foreign keys THEN the system SHALL preserve all referential integrity constraints with ON DELETE CASCADE where appropriate
4. WHEN creating indexes THEN the system SHALL recreate all performance indexes from SQLite with PostgreSQL-optimized equivalents
5. WHEN the migration completes THEN the system SHALL validate that all tables exist with correct column definitions

### Requirement 2: Row Level Security Implementation

**User Story:** As a security architect, I want RLS policies on all user-scoped tables, so that data isolation is enforced at the database level.

#### Acceptance Criteria

1. WHEN RLS is enabled THEN the accounts table SHALL only allow access to rows where the authenticated user is the owner
2. WHEN RLS is enabled THEN the agents table SHALL only allow access to rows belonging to the authenticated user's account
3. WHEN RLS is enabled THEN the conversations table SHALL only allow access to rows belonging to the authenticated user
4. WHEN RLS is enabled THEN the chat_messages table SHALL only allow access to messages in conversations owned by the authenticated user
5. WHEN RLS is enabled THEN the plans table SHALL allow read access to all authenticated users but write access only to admin role
6. WHEN a user queries data THEN the system SHALL automatically filter results based on RLS policies without application-level filtering

### Requirement 3: Authentication Integration

**User Story:** As a developer, I want to integrate Supabase Auth with the existing authentication system, so that users can authenticate seamlessly.

#### Acceptance Criteria

1. WHEN a user authenticates THEN the system SHALL use Supabase Auth for session management
2. WHEN creating new users THEN the system SHALL create corresponding entries in both Supabase Auth and the agents table
3. WHEN a user logs in THEN the system SHALL return a JWT token compatible with Supabase RLS policies
4. WHEN a session expires THEN the system SHALL handle token refresh automatically
5. WHEN migrating existing users THEN the system SHALL preserve password hashes or require password reset

### Requirement 4: Realtime Subscriptions

**User Story:** As a user, I want to receive real-time updates for conversations and messages, so that the chat interface updates instantly.

#### Acceptance Criteria

1. WHEN a new message arrives THEN the system SHALL broadcast the update via Supabase Realtime within 500ms
2. WHEN a conversation status changes THEN the system SHALL notify subscribed clients immediately
3. WHEN enabling realtime THEN the system SHALL configure publication for conversations and chat_messages tables
4. WHEN a client subscribes THEN the system SHALL respect RLS policies for realtime events
5. WHEN connection drops THEN the system SHALL automatically reconnect and sync missed events

### Requirement 5: Data Migration

**User Story:** As a system administrator, I want to migrate existing data from SQLite to Supabase, so that no data is lost during the transition.

#### Acceptance Criteria

1. WHEN migrating data THEN the system SHALL transfer all records from all SQLite tables to Supabase
2. WHEN migrating timestamps THEN the system SHALL convert SQLite DATETIME to PostgreSQL TIMESTAMPTZ with correct timezone
3. WHEN migrating JSON fields THEN the system SHALL convert TEXT JSON to PostgreSQL JSONB type
4. WHEN migrating IDs THEN the system SHALL preserve existing IDs or create a mapping for foreign key references
5. WHEN migration completes THEN the system SHALL verify record counts match between source and destination
6. WHEN migration fails THEN the system SHALL provide rollback capability to restore SQLite operation

### Requirement 6: Backend Service Refactoring

**User Story:** As a developer, I want to refactor backend services to use Supabase client, so that the application leverages Supabase features.

#### Acceptance Criteria

1. WHEN refactoring database.js THEN the system SHALL replace SQLite queries with Supabase client calls
2. WHEN executing queries THEN the system SHALL use Supabase's query builder for type-safe operations
3. WHEN handling errors THEN the system SHALL translate PostgreSQL errors to application-specific error messages
4. WHEN connecting to database THEN the system SHALL use connection pooling via Supabase client
5. WHEN performing transactions THEN the system SHALL use Supabase's transaction support for atomic operations

### Requirement 7: TypeScript Type Generation

**User Story:** As a developer, I want auto-generated TypeScript types from the database schema, so that the codebase has type-safe database operations.

#### Acceptance Criteria

1. WHEN the schema changes THEN the system SHALL regenerate TypeScript types using Supabase CLI
2. WHEN using generated types THEN the frontend and backend SHALL share the same type definitions
3. WHEN querying data THEN the system SHALL have compile-time type checking for all database operations
4. WHEN types are generated THEN the system SHALL include types for all tables, views, and functions

### Requirement 8: Performance Optimization

**User Story:** As a system administrator, I want the migrated system to maintain or improve performance, so that users experience no degradation.

#### Acceptance Criteria

1. WHEN querying conversations THEN the system SHALL return results within 100ms for typical queries
2. WHEN listing messages THEN the system SHALL support efficient pagination with cursor-based navigation
3. WHEN the system is under load THEN the database SHALL handle concurrent connections via Supabase's connection pooling
4. WHEN indexes are created THEN the system SHALL use PostgreSQL-specific index types (GIN for JSONB, GiST for full-text)
5. WHEN analyzing performance THEN the system SHALL use Supabase advisors to identify optimization opportunities

### Requirement 9: Storage Integration

**User Story:** As a user, I want media files to be stored in Supabase Storage, so that file management is integrated with the database.

#### Acceptance Criteria

1. WHEN uploading media THEN the system SHALL store files in Supabase Storage buckets
2. WHEN storing media references THEN the chat_messages table SHALL contain Supabase Storage URLs
3. WHEN accessing media THEN the system SHALL generate signed URLs with appropriate expiration
4. WHEN deleting conversations THEN the system SHALL cascade delete associated media files
5. WHEN configuring storage THEN the system SHALL create buckets with appropriate RLS policies

### Requirement 10: Environment Configuration

**User Story:** As a developer, I want clear environment configuration for Supabase, so that the system can be deployed in different environments.

#### Acceptance Criteria

1. WHEN configuring the backend THEN the system SHALL use environment variables for Supabase URL and keys
2. WHEN configuring the frontend THEN the system SHALL use VITE environment variables for Supabase public key
3. WHEN deploying THEN the system SHALL support separate Supabase projects for development and production
4. WHEN the configuration is invalid THEN the system SHALL fail fast with clear error messages
5. WHEN using service role key THEN the system SHALL restrict its use to server-side operations only

### Requirement 11: Backward Compatibility

**User Story:** As a system administrator, I want a gradual migration path, so that the system can fall back to SQLite if issues arise.

#### Acceptance Criteria

1. WHEN migration is in progress THEN the system SHALL support dual-write to both SQLite and Supabase
2. WHEN testing migration THEN the system SHALL provide a feature flag to switch between database backends
3. WHEN rollback is needed THEN the system SHALL restore SQLite operation within 5 minutes
4. WHEN migration is complete THEN the system SHALL provide scripts to remove SQLite dependencies
5. WHEN comparing data THEN the system SHALL provide tools to verify data consistency between backends

