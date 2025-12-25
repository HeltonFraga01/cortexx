# Requirements Document

## Introduction

Este documento define os requisitos para correção de problemas identificados na auditoria técnica de 25/12/2025 da plataforma Cortexx. O objetivo é eliminar vulnerabilidades de segurança (tokens expostos), corrigir requisições duplicadas, melhorar performance de conexões HTTP, e preparar a aplicação para produção.

**Auditoria Base:** http://cortexx.localhost:8080/admin  
**Estado Atual:** OK com ajustes necessários  
**Métricas Atuais:** LCP 263ms ✅, TTFB 7ms ✅, CLS 0.00 ✅

## Glossary

- **Token_Sanitization**: Processo de mascarar dados sensíveis antes de enviar ao frontend
- **Request_Deduplication**: Técnica de evitar múltiplas requisições idênticas simultâneas
- **Keep_Alive**: Conexão HTTP persistente que reutiliza a mesma conexão TCP
- **Session_Race_Condition**: Condição onde código executa antes da sessão estar pronta
- **Web_Vitals**: Métricas de performance do Google (LCP, FID, CLS, INP)
- **WUZAPI**: API externa de WhatsApp Business usada pela plataforma
- **TanStack_Query**: Biblioteca de gerenciamento de estado assíncrono com cache
- **React_Router_v7**: Próxima versão do React Router com breaking changes

## Requirements

### Requirement 1: Token Sanitization in API Responses

**User Story:** As a security engineer, I want sensitive tokens masked in API responses, so that credentials cannot be leaked to unauthorized parties.

#### Acceptance Criteria

1. WHEN `/api/admin/dashboard-stats` returns user data, THE System SHALL mask WUZAPI tokens showing only last 4 characters (e.g., `***ULML`)
2. WHEN any admin endpoint returns user data, THE System SHALL mask `s3_config.access_key` as `***`
3. WHEN any admin endpoint returns user data, THE System SHALL mask `proxy_config.proxy_url` credentials if present
4. THE System SHALL implement a centralized `sanitizeUserData()` utility function
5. THE System SHALL log a warning if unsanitized tokens are detected in responses (development mode only)

### Requirement 2: API Request Deduplication

**User Story:** As a user, I want the application to make efficient API calls, so that pages load faster and server resources are conserved.

#### Acceptance Criteria

1. WHEN AdminOverview component mounts, THE System SHALL NOT make duplicate calls to `/api/admin/automation/statistics`
2. WHEN AdminOverview component mounts, THE System SHALL NOT make duplicate calls to `/api/admin/management/dashboard/stats`
3. THE TanStack_Query SHALL configure `staleTime: 30000` (30 seconds) for admin dashboard queries
4. THE TanStack_Query SHALL configure `refetchOnWindowFocus: false` for admin dashboard queries
5. WHEN duplicate requests are detected in development mode, THE Console SHALL log a warning with the endpoint URL
6. THE System SHALL reduce total API calls on admin dashboard load from 7 to 4 or fewer

### Requirement 3: Session Initialization Race Condition Fix

**User Story:** As a user, I want the admin dashboard to wait for authentication before loading data, so that I don't see timeout warnings.

#### Acceptance Criteria

1. WHEN AdminOverview component mounts, THE System SHALL wait for session to be ready before making API calls
2. THE Console SHALL NOT display `[AdminOverview] Session timeout, proceeding anyway` warning
3. WHEN session is not ready after 5 seconds, THE System SHALL redirect to login page
4. THE System SHALL display a loading skeleton while waiting for session
5. WHEN session becomes ready, THE System SHALL immediately fetch dashboard data

### Requirement 4: HTTP Keep-Alive Connection Optimization

**User Story:** As a user, I want faster sequential API calls, so that the dashboard loads more quickly.

#### Acceptance Criteria

1. WHEN the backend responds to requests, THE Response Headers SHALL include `Connection: keep-alive`
2. WHEN the backend responds to requests, THE Response Headers SHALL include `Keep-Alive: timeout=5, max=100`
3. THE System SHALL NOT include `Connection: close` in response headers
4. THE System SHALL reduce average latency for sequential requests by at least 20%

### Requirement 5: Web Vitals Initialization Fix

**User Story:** As a developer, I want performance metrics to be collected reliably, so that I can monitor application health.

#### Acceptance Criteria

1. WHEN the application initializes, THE Console SHALL NOT display `[Performance] Failed to initialize web-vitals` error
2. WHEN web-vitals library fails to load, THE System SHALL gracefully degrade without errors
3. THE System SHALL wrap web-vitals initialization in try-catch with proper error handling
4. WHEN in development mode, THE System SHALL log a debug message if web-vitals is unavailable

### Requirement 6: React Router v7 Future Flag Compatibility

**User Story:** As a developer, I want the application to be compatible with React Router v7, so that future upgrades are seamless.

#### Acceptance Criteria

1. THE Router SHALL enable `v7_startTransition` future flag
2. THE Console SHALL NOT display React Router deprecation warnings
3. WHEN navigating between routes, THE System SHALL use React.startTransition for state updates

### Requirement 7: WUZAPI Latency Optimization

**User Story:** As a user, I want WhatsApp operations to be responsive, so that I can manage my inboxes efficiently.

#### Acceptance Criteria

1. THE System SHALL cache WUZAPI health check status for 60 seconds
2. WHEN health check is cached, THE Response SHALL include `cached: true` indicator
3. THE Health check endpoint SHALL NOT block on WUZAPI connectivity (async check)
4. THE System SHALL reduce average WUZAPI latency impact on health check from 889ms to under 100ms (cached)

### Requirement 8: Production Logging Optimization

**User Story:** As a DevOps engineer, I want appropriate logging levels in production, so that logs are useful without being excessive.

#### Acceptance Criteria

1. WHEN NODE_ENV is 'production', THE System SHALL NOT log debug-level messages to console
2. THE System SHALL use structured logging with appropriate log levels (error, warn, info, debug)
3. WHEN in development mode, THE System SHALL log debug messages for API calls
4. THE System SHALL NOT expose sensitive data in production logs

### Requirement 9: Response Payload Size Optimization

**User Story:** As a user on a slow connection, I want smaller API responses, so that pages load faster.

#### Acceptance Criteria

1. WHEN `/api/admin/dashboard-stats` returns user data, THE System SHALL exclude unnecessary fields (full proxy config, full s3 config)
2. THE System SHALL implement a `selectFields` parameter for admin endpoints to request only needed fields
3. THE Response payload for dashboard-stats SHALL be reduced by at least 30%

### Requirement 10: Error Boundary for Session Failures

**User Story:** As a user, I want graceful error handling when authentication fails, so that I understand what went wrong.

#### Acceptance Criteria

1. WHEN session validation fails, THE System SHALL display a user-friendly error message
2. WHEN session is corrupted, THE System SHALL clear local storage and redirect to login
3. THE System SHALL NOT display raw error messages or stack traces to users
4. WHEN authentication fails, THE System SHALL log the error with context for debugging

