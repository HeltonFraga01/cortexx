# Requirements Document

## Introduction

Este documento especifica os requisitos para remoção completa do SQLite do sistema WUZAPI Manager. Com a migração para Supabase concluída (spec: supabase-database-migration), o sistema agora opera exclusivamente com Supabase como backend de banco de dados. Esta spec visa eliminar todo código legado relacionado ao SQLite, arquivos de configuração, dependências e documentação obsoleta.

O objetivo é simplificar a base de código, reduzir a superfície de manutenção e garantir que não existam referências residuais ao SQLite que possam causar confusão ou erros.

## Glossary

- **SQLite**: Sistema de banco de dados relacional embarcado que era usado anteriormente pelo sistema
- **Supabase**: Plataforma Backend-as-a-Service baseada em PostgreSQL atualmente em uso
- **WAL Mode**: Write-Ahead Logging, modo de operação do SQLite que era usado para melhor performance
- **Migration Files**: Arquivos JavaScript em server/migrations/ que definiam alterações de schema SQLite
- **database.js**: Arquivo de abstração do banco de dados SQLite que será removido
- **DatabaseBackend**: Abstração criada para suportar dual-write durante migração
- **Steering Files**: Arquivos de configuração do Kiro em .kiro/steering/ que contêm regras do projeto

## Requirements

### Requirement 1: Backend Code Removal

**User Story:** As a developer, I want to remove all SQLite-related backend code, so that the codebase only contains Supabase implementation.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN the server/database.js file SHALL be removed from the codebase
2. WHEN the cleanup is complete THEN the server/config/sqlite.js file SHALL be removed from the codebase
3. WHEN the cleanup is complete THEN all server/migrations/*.js files SHALL be removed or archived
4. WHEN the cleanup is complete THEN the DatabaseBackend.js dual-write abstraction SHALL be removed
5. WHEN the cleanup is complete THEN all services SHALL use only SupabaseService or Supabase client directly
6. WHEN searching for "sqlite" in the codebase THEN the system SHALL return zero matches in active code files

### Requirement 2: Dependency Removal

**User Story:** As a developer, I want to remove SQLite npm dependencies, so that the project has a smaller footprint and fewer security vulnerabilities to track.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN the better-sqlite3 package SHALL be removed from server/package.json
2. WHEN the cleanup is complete THEN the sqlite3 package SHALL be removed from server/package.json (if present)
3. WHEN the cleanup is complete THEN any SQLite-related dev dependencies SHALL be removed
4. WHEN running npm install THEN the system SHALL not install any SQLite native bindings
5. WHEN the cleanup is complete THEN package-lock.json SHALL be regenerated without SQLite dependencies

### Requirement 3: Configuration Cleanup

**User Story:** As a system administrator, I want environment variables and configuration files updated, so that there are no references to SQLite configuration.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN SQLITE_DB_PATH SHALL be removed from all .env.example files
2. WHEN the cleanup is complete THEN any SQLite-related environment variables SHALL be removed from documentation
3. WHEN the cleanup is complete THEN Docker configuration SHALL not reference SQLite database files
4. WHEN the cleanup is complete THEN the data/ directory mounting for SQLite files SHALL be removed from docker-compose files
5. WHEN the cleanup is complete THEN USE_SUPABASE and DUAL_WRITE_MODE feature flags SHALL be removed (Supabase is now the only option)

### Requirement 4: Documentation Update

**User Story:** As a developer, I want documentation updated to reflect Supabase-only architecture, so that new team members understand the current system.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN README.md SHALL not mention SQLite as a database option
2. WHEN the cleanup is complete THEN docs/CONFIGURATION.md SHALL only reference Supabase configuration
3. WHEN the cleanup is complete THEN steering files in .kiro/steering/ SHALL be updated to remove SQLite references
4. WHEN the cleanup is complete THEN ADR 001-sqlite-over-postgres.md SHALL be archived or updated to reflect the migration decision
5. WHEN the cleanup is complete THEN all architecture diagrams SHALL show only Supabase as the database layer

### Requirement 5: Database File Cleanup

**User Story:** As a system administrator, I want SQLite database files removed from the repository, so that there is no confusion about which database is active.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN *.db files SHALL be added to .gitignore (if not already)
2. WHEN the cleanup is complete THEN *.db-shm and *.db-wal files SHALL be added to .gitignore
3. WHEN the cleanup is complete THEN any committed .db files SHALL be removed from the repository
4. WHEN the cleanup is complete THEN the data/ directory SHALL be removed or repurposed
5. WHEN the cleanup is complete THEN Docker volumes for SQLite data SHALL be removed from compose files

### Requirement 6: Test Cleanup

**User Story:** As a developer, I want SQLite-specific tests removed or updated, so that the test suite only tests Supabase functionality.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN tests that create temporary SQLite databases SHALL be removed or refactored
2. WHEN the cleanup is complete THEN test fixtures that reference SQLite SHALL be updated
3. WHEN the cleanup is complete THEN migration tests for SQLite schema SHALL be removed
4. WHEN running the test suite THEN all tests SHALL pass without SQLite dependencies
5. WHEN the cleanup is complete THEN property tests for dual-write and backend switching SHALL be removed

### Requirement 7: Service Consolidation

**User Story:** As a developer, I want services consolidated to use only Supabase implementations, so that there is no code duplication.

#### Acceptance Criteria

1. WHEN the cleanup is complete THEN *ServiceSupabase.js files SHALL be renamed to replace original service files
2. WHEN the cleanup is complete THEN the server/services/supabase/ directory structure SHALL be flattened
3. WHEN the cleanup is complete THEN all route files SHALL import services from the consolidated location
4. WHEN the cleanup is complete THEN there SHALL be only one implementation of each service (Supabase-based)
5. WHEN the cleanup is complete THEN the services index file SHALL export all services without "Supabase" suffix

