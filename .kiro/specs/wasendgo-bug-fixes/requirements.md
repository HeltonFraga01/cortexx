# Requirements Document

## Introduction

Este documento especifica os requisitos para correção de 25 bugs identificados no projeto WaSendGO, uma plataforma de gerenciamento da API WhatsApp Business. Os bugs estão categorizados por severidade: críticos (6), importantes (12), moderados (6) e baixos (1). A correção prioriza segurança, performance e estabilidade do sistema.

## Glossary

- **WaSendGO**: Plataforma multi-usuário para gerenciamento de WhatsApp Business API
- **Token Hardcoded**: Credencial de acesso embutida diretamente no código-fonte
- **Memory Leak**: Vazamento de memória causado por recursos não liberados
- **Race Condition**: Condição de corrida onde múltiplas operações concorrentes causam comportamento inconsistente
- **Rate Limiting**: Mecanismo de limitação de taxa de requisições
- **CORS**: Cross-Origin Resource Sharing, política de segurança para requisições entre domínios
- **WAL Mode**: Write-Ahead Logging, modo de journaling do SQLite para melhor concorrência

## Requirements

### Requirement 1: Segurança de Credenciais

**User Story:** As a developer, I want all credentials removed from source code and stored in environment variables, so that sensitive data is not exposed in version control.

#### Acceptance Criteria

1. WHEN the system initializes, THE WaSendGO System SHALL load the NocoDB token from environment variables instead of hardcoded values
2. WHEN the system initializes, THE WaSendGO System SHALL load the WuzAPI admin token from environment variables instead of empty strings
3. WHEN Docker containers are deployed, THE WaSendGO System SHALL read database credentials from Docker secrets or environment variables
4. WHEN credentials are missing from environment, THE WaSendGO System SHALL fail with a clear error message indicating which credentials are required
5. WHEN loading credentials, THE WaSendGO System SHALL validate that tokens are non-empty and properly formatted

### Requirement 2: Configuração CORS Flexível

**User Story:** As a system administrator, I want flexible CORS configuration, so that legitimate requests from multiple domains are not blocked.

#### Acceptance Criteria

1. WHEN configuring CORS, THE WaSendGO System SHALL support multiple allowed origins via comma-separated environment variable
2. WHEN a request arrives from an allowed origin, THE WaSendGO System SHALL include appropriate CORS headers in the response
3. WHEN a request arrives from a disallowed origin, THE WaSendGO System SHALL reject the request with a 403 status code
4. WHEN CORS origins are not configured, THE WaSendGO System SHALL default to restrictive settings in production and permissive in development

### Requirement 3: Gerenciamento de Memória

**User Story:** As a developer, I want proper memory management for localStorage and timers, so that the application does not crash due to memory exhaustion.

#### Acceptance Criteria

1. WHEN storing data in localStorage, THE WaSendGO System SHALL implement size limits and cleanup mechanisms
2. WHEN creating setTimeout or setInterval, THE WaSendGO System SHALL store references and clear them on component unmount
3. WHEN components are unmounted, THE WaSendGO System SHALL cancel all pending timers and subscriptions
4. WHEN localStorage approaches capacity limits, THE WaSendGO System SHALL remove oldest entries using LRU eviction
5. WHEN monitoring memory usage, THE WaSendGO System SHALL log warnings when thresholds are exceeded

### Requirement 4: Configuração SQLite Robusta

**User Story:** As a database administrator, I want proper SQLite configuration, so that data integrity is maintained under high concurrency.

#### Acceptance Criteria

1. WHEN initializing the database, THE WaSendGO System SHALL configure WAL mode with appropriate synchronous settings
2. WHEN the database_connections table is missing, THE WaSendGO System SHALL create it automatically via migrations
3. WHEN concurrent writes occur, THE WaSendGO System SHALL handle busy timeouts gracefully with retry logic
4. WHEN database errors occur, THE WaSendGO System SHALL log detailed error information without exposing sensitive data

### Requirement 5: Timeout e Rate Limiting

**User Story:** As a developer, I want proper timeout configuration and rate limiting, so that the system remains responsive and does not overload external APIs.

#### Acceptance Criteria

1. WHEN making requests to WuzAPI, THE WaSendGO System SHALL apply configurable timeout limits
2. WHEN timeout limits are exceeded, THE WaSendGO System SHALL cancel the request and return an appropriate error
3. WHEN making requests to external APIs, THE WaSendGO System SHALL implement rate limiting to prevent overload
4. WHEN rate limits are exceeded, THE WaSendGO System SHALL queue requests or return a 429 status with retry-after header

### Requirement 6: Cache com Expiração

**User Story:** As a developer, I want cache entries to expire automatically, so that memory is not consumed indefinitely.

#### Acceptance Criteria

1. WHEN caching data, THE WaSendGO System SHALL assign a TTL (time-to-live) to each entry
2. WHEN cache entries expire, THE WaSendGO System SHALL remove them automatically
3. WHEN accessing cached data, THE WaSendGO System SHALL check expiration before returning
4. WHEN cache size exceeds limits, THE WaSendGO System SHALL evict oldest or least-used entries

### Requirement 7: Tratamento de Erros Consistente

**User Story:** As a developer, I want consistent error handling across the application, so that errors are properly logged without exposing sensitive information.

#### Acceptance Criteria

1. WHEN errors occur in API calls, THE WaSendGO System SHALL log structured error information with context
2. WHEN returning error responses, THE WaSendGO System SHALL sanitize messages to remove sensitive data
3. WHEN logging in production, THE WaSendGO System SHALL suppress verbose debug logs
4. WHEN errors have multiple causes, THE WaSendGO System SHALL provide diagnostic information for troubleshooting

### Requirement 8: Gerenciamento de Conexões

**User Story:** As a developer, I want proper connection management, so that resources are not leaked.

#### Acceptance Criteria

1. WHEN database connections are opened, THE WaSendGO System SHALL track them for proper cleanup
2. WHEN operations complete, THE WaSendGO System SHALL close connections that are no longer needed
3. WHEN connection errors occur, THE WaSendGO System SHALL implement retry logic with exponential backoff
4. WHEN sessions expire, THE WaSendGO System SHALL clean up associated resources automatically

### Requirement 9: Polling Otimizado

**User Story:** As a developer, I want efficient polling mechanisms, so that system resources are not wasted on unnecessary operations.

#### Acceptance Criteria

1. WHEN polling for updates, THE WaSendGO System SHALL use adaptive intervals based on activity
2. WHEN no activity is detected, THE WaSendGO System SHALL increase polling intervals to reduce resource usage
3. WHEN activity resumes, THE WaSendGO System SHALL decrease polling intervals for responsiveness
4. WHEN the application is backgrounded, THE WaSendGO System SHALL pause or reduce polling frequency

### Requirement 10: Validação de Dados

**User Story:** As a developer, I want proper input validation, so that invalid data does not cause system errors.

#### Acceptance Criteria

1. WHEN receiving API requests, THE WaSendGO System SHALL validate all input parameters
2. WHEN validation fails, THE WaSendGO System SHALL return descriptive error messages
3. WHEN processing user data, THE WaSendGO System SHALL sanitize inputs to prevent injection attacks
4. WHEN data types are incorrect, THE WaSendGO System SHALL reject the request with a 400 status code

### Requirement 11: Type Safety

**User Story:** As a developer, I want proper TypeScript types throughout the codebase, so that type errors are caught at compile time.

#### Acceptance Criteria

1. WHEN defining API responses, THE WaSendGO System SHALL use explicit TypeScript interfaces instead of any
2. WHEN handling dynamic data, THE WaSendGO System SHALL use type guards for runtime validation
3. WHEN importing external data, THE WaSendGO System SHALL validate and cast to appropriate types

### Requirement 12: Atualização de Dependências

**User Story:** As a security engineer, I want dependencies updated to secure versions, so that known vulnerabilities are patched.

#### Acceptance Criteria

1. WHEN dependencies have known vulnerabilities, THE WaSendGO System SHALL update to patched versions
2. WHEN updating dependencies, THE WaSendGO System SHALL verify compatibility with existing code
3. WHEN security advisories are published, THE WaSendGO System SHALL prioritize updates for affected packages
