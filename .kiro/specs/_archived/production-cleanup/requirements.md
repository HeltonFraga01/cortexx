# Requirements Document

## Introduction

Este documento especifica os requisitos para limpeza e preparação do WUZAPI Manager para produção. O objetivo é remover código legado, logs de debug, testes desnecessários, e consolidar a documentação para facilitar manutenção futura.

## Glossary

- **WUZAPI Manager**: Sistema de gerenciamento da API WhatsApp Business
- **Console.log**: Chamadas de log diretas que devem ser substituídas pelo logger estruturado
- **Código Legado**: Código não utilizado, comentado ou obsoleto
- **Logger Estruturado**: Sistema de logging em `server/utils/logger.js`
- **Specs**: Documentos de especificação em `.kiro/specs/`

## Requirements

### Requirement 1: Remoção de Console.log do Backend

**User Story:** As a developer, I want all console.log calls in the backend replaced with the structured logger, so that logs are consistent and production-ready.

#### Acceptance Criteria

1. WHEN the backend code is analyzed THEN the system SHALL identify all console.log calls in `server/` directory (excluding test files)
2. WHEN a console.log is found in production code THEN the system SHALL replace it with appropriate logger method (logger.info, logger.debug, logger.error)
3. WHEN console.log is used in `server/index.js` for startup messages THEN the system SHALL keep them as they are intentional startup indicators
4. WHEN console.log is used in test scripts (`server/scripts/`) THEN the system SHALL keep them as they are for manual testing

### Requirement 2: Remoção de Console.log do Frontend

**User Story:** As a developer, I want debug console.log calls in the frontend removed or wrapped in development checks, so that production builds are clean.

#### Acceptance Criteria

1. WHEN console.log is used in frontend services THEN the system SHALL ensure it is wrapped in `IS_DEVELOPMENT` check
2. WHEN console.log is used for debugging in components THEN the system SHALL remove it or wrap in development check
3. WHEN console.log is used in `contactsStorageService.ts` THEN the system SHALL replace with conditional logging or remove
4. WHEN console.log is used in `database-connections.ts` for cache hits THEN the system SHALL wrap in development check

### Requirement 3: Limpeza de Arquivos de Teste Desnecessários

**User Story:** As a developer, I want test files organized and unnecessary test scripts removed, so that the test suite is maintainable.

#### Acceptance Criteria

1. WHEN test files exist in `server/tests/` THEN the system SHALL verify each test file is still relevant
2. WHEN duplicate test files exist (e.g., `auth.test.js` and `authRoutes.test.js`) THEN the system SHALL consolidate them
3. WHEN test scripts in `server/scripts/` are one-time use THEN the system SHALL evaluate if they should be removed
4. WHEN test files reference deprecated functionality THEN the system SHALL update or remove them

### Requirement 4: Consolidação de Documentação

**User Story:** As a developer, I want documentation consolidated and organized, so that I can easily find relevant information.

#### Acceptance Criteria

1. WHEN multiple docs cover the same topic THEN the system SHALL consolidate them into a single authoritative document
2. WHEN docs reference deprecated features THEN the system SHALL update or remove them
3. WHEN docs exist in `docs/` THEN the system SHALL create an updated INDEX.md with clear categorization
4. WHEN release notes exist THEN the system SHALL keep only the most recent 5 versions in `docs/releases/`

### Requirement 5: Limpeza de Specs Incompletas

**User Story:** As a developer, I want incomplete specs either completed or archived, so that the specs directory is clean.

#### Acceptance Criteria

1. WHEN specs exist in `_incomplete/` THEN the system SHALL evaluate if they are still relevant
2. WHEN incomplete specs are no longer relevant THEN the system SHALL move them to `_archived/`
3. WHEN incomplete specs are still relevant THEN the system SHALL complete them or document why they are pending
4. WHEN specs are archived THEN the system SHALL update `SPEC_STATUS_REPORT.md`

### Requirement 6: Remoção de Código Comentado e Legado

**User Story:** As a developer, I want commented-out code and legacy code removed, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. WHEN large blocks of commented code exist THEN the system SHALL remove them (git history preserves them)
2. WHEN deprecated functions exist THEN the system SHALL remove them if not used
3. WHEN TODO/FIXME comments exist THEN the system SHALL address them or create tasks for them
4. WHEN unused imports exist THEN the system SHALL remove them

### Requirement 7: Atualização de Arquivos de Configuração

**User Story:** As a developer, I want configuration files cleaned and documented, so that deployment is straightforward.

#### Acceptance Criteria

1. WHEN `.env.example` files exist THEN the system SHALL ensure they are up-to-date with all required variables
2. WHEN duplicate configuration exists THEN the system SHALL consolidate it
3. WHEN configuration is environment-specific THEN the system SHALL document it clearly
4. WHEN scripts in `scripts/archive/` are obsolete THEN the system SHALL remove them

### Requirement 8: Validação Final de Produção

**User Story:** As a developer, I want a final validation that the system is production-ready, so that I can deploy with confidence.

#### Acceptance Criteria

1. WHEN all cleanup tasks are complete THEN the system SHALL run the full test suite
2. WHEN tests pass THEN the system SHALL verify the build completes successfully
3. WHEN build completes THEN the system SHALL verify Docker build works
4. WHEN all validations pass THEN the system SHALL update documentation with production status
