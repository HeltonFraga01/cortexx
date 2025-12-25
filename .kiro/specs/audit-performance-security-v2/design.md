# Design Document

## Introduction

Este documento descreve a arquitetura e design técnico para implementar as correções identificadas na auditoria de 25/12/2025. O design prioriza mudanças incrementais, retrocompatíveis e com rollback seguro.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CORREÇÕES DE AUDITORIA v2                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    FRONTEND (React + Vite)                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │ Session Guard   │  │ Query Config    │  │ Web Vitals      │  │   │
│  │  │ (Race Fix)      │  │ (Deduplication) │  │ (Error Handle)  │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │                    Router v7 Flags                           ││   │
│  │  │  • v7_startTransition: true                                 ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    BACKEND (Express + Node.js)                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │ Token           │  │ Keep-Alive      │  │ WUZAPI Cache    │  │   │
│  │  │ Sanitization    │  │ Headers         │  │ (60s TTL)       │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │                    Response Optimization                     ││   │
│  │  │  • Payload reduction (30%+)                                 ││   │
│  │  │  • Selective field returns                                  ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Design Details

### Component 1: Token Sanitization Utility

**Requirement Coverage:** REQ-1 (Token Sanitization), REQ-9 (Payload Optimization)

**Design:**

```javascript
// server/utils/sanitizeResponse.js
const logger = require('./logger');

/**
 * Masks sensitive token showing only last 4 characters
 * @param {string} token - Token to mask
 * @returns {string} Masked token (e.g., "***ULML")
 */
function maskToken(token) {
  if (!token || typeof token !== 'string') return null;
  if (token.length <= 4) return '***';
  return '***' + token.slice(-4);
}

/**
 * Sanitizes user data by masking sensitive fields
 * @param {Object} user - User object from WUZAPI
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized user object
 */
function sanitizeUserData(user, options = {}) {
  if (!user) return null;
  
  const { includeFullConfig = false } = options;
  
  const sanitized = {
    id: user.id,
    name: user.name,
    connected: user.connected,
    loggedIn: user.loggedIn,
    jid: user.jid,
    webhook: user.webhook,
    events: user.events,
    expiration: user.expiration,
    qrcode: user.qrcode,
    // Mask sensitive token
    token: maskToken(user.token),
  };
  
  // Sanitize proxy config
  if (user.proxy_config) {
    sanitized.proxy_config = {
      enabled: user.proxy_config.enabled,
      // Mask proxy URL if it contains credentials
      proxy_url: user.proxy_config.proxy_url 
        ? maskProxyUrl(user.proxy_config.proxy_url)
        : null
    };
  }
  
  // Sanitize S3 config
  if (user.s3_config) {
    sanitized.s3_config = {
      enabled: user.s3_config.enabled,
      bucket: user.s3_config.bucket,
      // Always mask access key
      access_key: '***'
    };
    
    // Include full config only if explicitly requested (admin detail view)
    if (includeFullConfig) {
      sanitized.s3_config.endpoint = user.s3_config.endpoint;
      sanitized.s3_config.region = user.s3_config.region;
    }
  }
  
  return sanitized;
}

/**
 * Masks credentials in proxy URL
 * @param {string} url - Proxy URL (e.g., "socks5://user:pass@host:port")
 * @returns {string} Masked URL
 */
function maskProxyUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = '***';
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, return masked version
    return url.replace(/\/\/[^@]+@/, '//***:***@');
  }
}

/**
 * Sanitizes array of users
 * @param {Array} users - Array of user objects
 * @param {Object} options - Sanitization options
 * @returns {Array} Array of sanitized user objects
 */
function sanitizeUsersArray(users, options = {}) {
  if (!Array.isArray(users)) return [];
  return users.map(user => sanitizeUserData(user, options));
}

/**
 * Development-only: Check if response contains unsanitized tokens
 * @param {Object} data - Response data to check
 */
function warnIfUnsanitized(data) {
  if (process.env.NODE_ENV !== 'development') return;
  
  const json = JSON.stringify(data);
  // Check for patterns that look like WUZAPI tokens (phone + random string)
  const tokenPattern = /\d{10,15}MIN[A-Z0-9]{10,}/;
  if (tokenPattern.test(json)) {
    logger.warn('⚠️ Possible unsanitized token detected in response', {
      type: 'security_warning',
      pattern: 'WUZAPI token pattern detected'
    });
  }
}

module.exports = {
  maskToken,
  sanitizeUserData,
  sanitizeUsersArray,
  maskProxyUrl,
  warnIfUnsanitized
};
```

**Usage in Routes:**

```javascript
// server/routes/adminRoutes.js
const { sanitizeUsersArray, warnIfUnsanitized } = require('../utils/sanitizeResponse');

router.get('/dashboard-stats', requireAdmin, async (req, res) => {
  try {
    // ... fetch data ...
    
    // Sanitize user data before sending
    const sanitizedUsers = sanitizeUsersArray(data.users);
    
    const response = {
      success: true,
      data: {
        ...data,
        users: sanitizedUsers
      }
    };
    
    // Development warning
    warnIfUnsanitized(response);
    
    res.json(response);
  } catch (error) {
    // ... error handling ...
  }
});
```

**Correctness Properties:**
- P1: Tokens NUNCA devem aparecer completos em responses
- P2: Sanitização deve ser idempotente (aplicar 2x = mesmo resultado)
- P3: Campos não-sensíveis devem permanecer inalterados

---

### Component 2: TanStack Query Deduplication Config

**Requirement Coverage:** REQ-2 (Request Deduplication)

**Design:**

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

// Development-only: Track pending requests for duplicate detection
const pendingRequests = new Map<string, number>();

function trackRequest(key: string, action: 'start' | 'end') {
  if (import.meta.env.PROD) return;
  
  const count = pendingRequests.get(key) || 0;
  if (action === 'start') {
    if (count > 0) {
      console.warn(`[Query] Duplicate request detected: ${key}`);
    }
    pendingRequests.set(key, count + 1);
  } else {
    pendingRequests.set(key, Math.max(0, count - 1));
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent refetching for 30 seconds
      staleTime: 30 * 1000,
      // Keep in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Don't refetch on window focus (prevents duplicates)
      refetchOnWindowFocus: false,
      // Don't refetch on mount if data exists
      refetchOnMount: false,
      // Retry logic
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

// Export tracking function for custom hooks
export { trackRequest };
```

**Admin Dashboard Query Hooks:**

```typescript
// src/hooks/useAdminDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { trackRequest } from '@/lib/queryClient';

const ADMIN_DASHBOARD_STALE_TIME = 30 * 1000; // 30 seconds

export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: async () => {
      const key = 'GET:/api/admin/management/dashboard/stats';
      trackRequest(key, 'start');
      try {
        const response = await fetch('/api/admin/management/dashboard/stats', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        return response.json();
      } finally {
        trackRequest(key, 'end');
      }
    },
    staleTime: ADMIN_DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useAutomationStatistics() {
  return useQuery({
    queryKey: ['admin', 'automation', 'statistics'],
    queryFn: async () => {
      const key = 'GET:/api/admin/automation/statistics';
      trackRequest(key, 'start');
      try {
        const response = await fetch('/api/admin/automation/statistics', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        return response.json();
      } finally {
        trackRequest(key, 'end');
      }
    },
    staleTime: ADMIN_DASHBOARD_STALE_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
```

**Correctness Properties:**
- P1: Requisições com mesmo queryKey devem ser deduplicadas
- P2: Dados em cache devem ser retornados imediatamente
- P3: Refetch só deve ocorrer após staleTime expirar

---

### Component 3: Session Guard Component

**Requirement Coverage:** REQ-3 (Session Race Condition)

**Design:**

```typescript
// src/components/shared/SessionGuard.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RouteLoadingSkeleton } from './RouteLoadingSkeleton';

interface SessionGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user' | 'superadmin';
  timeoutMs?: number;
}

export function SessionGuard({ 
  children, 
  requiredRole,
  timeoutMs = 5000 
}: SessionGuardProps) {
  const { session, isLoading, role } = useAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // Set timeout for session loading
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('[SessionGuard] Session loading timeout, redirecting to login');
        setTimedOut(true);
      }
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  // Handle timeout
  useEffect(() => {
    if (timedOut) {
      navigate('/login', { replace: true });
    }
  }, [timedOut, navigate]);

  // Still loading
  if (isLoading && !timedOut) {
    return <RouteLoadingSkeleton />;
  }

  // No session
  if (!session) {
    navigate('/login', { replace: true });
    return null;
  }

  // Check role if required
  if (requiredRole && role !== requiredRole) {
    console.warn('[SessionGuard] Insufficient permissions', { required: requiredRole, actual: role });
    navigate('/unauthorized', { replace: true });
    return null;
  }

  return <>{children}</>;
}
```

**Usage in AdminOverview:**

```typescript
// src/components/admin/AdminOverview.tsx
import { SessionGuard } from '@/components/shared/SessionGuard';

export function AdminOverview() {
  return (
    <SessionGuard requiredRole="admin">
      <AdminOverviewContent />
    </SessionGuard>
  );
}

function AdminOverviewContent() {
  // Now safe to make API calls - session is guaranteed ready
  const { data: stats } = useAdminDashboardStats();
  const { data: automation } = useAutomationStatistics();
  
  // ... rest of component
}
```

**Correctness Properties:**
- P1: API calls só devem ocorrer após sessão estar pronta
- P2: Timeout deve redirecionar para login, não prosseguir
- P3: Loading skeleton deve ser exibido durante espera

---

### Component 4: Keep-Alive Headers Middleware

**Requirement Coverage:** REQ-4 (HTTP Keep-Alive)

**Design:**

```javascript
// server/middleware/connectionHeaders.js
const logger = require('../utils/logger');

/**
 * Middleware to set HTTP Keep-Alive headers
 * Improves performance for sequential requests by reusing TCP connections
 */
function keepAliveHeaders(req, res, next) {
  // Set keep-alive headers
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=100');
  
  // Remove any conflicting headers
  res.removeHeader('connection'); // Remove lowercase version if exists
  
  next();
}

module.exports = { keepAliveHeaders };
```

**Integration in server/index.js:**

```javascript
// server/index.js
const { keepAliveHeaders } = require('./middleware/connectionHeaders');

// Apply early in middleware chain (after compression, before routes)
app.use(keepAliveHeaders);
```

**Correctness Properties:**
- P1: Todas as responses devem ter `Connection: keep-alive`
- P2: Nenhuma response deve ter `Connection: close`
- P3: Conexões devem ser reutilizadas para requests sequenciais

---

### Component 5: Web Vitals Error Handling

**Requirement Coverage:** REQ-5 (Web Vitals Fix)

**Design:**

```typescript
// src/lib/performance.ts
import { logger } from '@/lib/logger';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

/**
 * Safely initializes web-vitals monitoring
 * Gracefully handles environments where web-vitals is unavailable
 */
export async function initPerformanceMonitoring(): Promise<void> {
  try {
    // Dynamic import to handle missing module gracefully
    const webVitals = await import('web-vitals');
    
    const reportMetric = (metric: WebVitalMetric) => {
      // Log poor metrics as warnings
      if (metric.rating === 'poor') {
        logger.warn(`[Performance] ${metric.name} is poor: ${metric.value}`);
      }
      
      // Send to backend in production
      if (import.meta.env.PROD) {
        try {
          navigator.sendBeacon('/api/metrics/web-vitals', JSON.stringify({
            ...metric,
            timestamp: Date.now(),
            url: window.location.pathname
          }));
        } catch {
          // Silently fail - metrics are not critical
        }
      }
    };

    // Initialize all web vitals
    webVitals.onLCP((metric) => reportMetric({ 
      name: 'LCP', 
      value: metric.value, 
      rating: metric.rating 
    }));
    webVitals.onFID((metric) => reportMetric({ 
      name: 'FID', 
      value: metric.value, 
      rating: metric.rating 
    }));
    webVitals.onCLS((metric) => reportMetric({ 
      name: 'CLS', 
      value: metric.value, 
      rating: metric.rating 
    }));
    webVitals.onINP((metric) => reportMetric({ 
      name: 'INP', 
      value: metric.value, 
      rating: metric.rating 
    }));
    webVitals.onTTFB((metric) => reportMetric({ 
      name: 'TTFB', 
      value: metric.value, 
      rating: metric.rating 
    }));

    if (import.meta.env.DEV) {
      console.log('✅ Web vitals monitoring initialized');
    }
  } catch (error) {
    // Graceful degradation - don't break the app
    if (import.meta.env.DEV) {
      console.debug('[Performance] Web vitals not available in this environment:', 
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    // Don't log error in production - it's expected in some environments
  }
}
```

**Integration in main.tsx:**

```typescript
// src/main.tsx
import { initPerformanceMonitoring } from '@/lib/performance';

// Initialize after app renders
initPerformanceMonitoring().catch(() => {
  // Silently ignore - already handled internally
});
```

**Correctness Properties:**
- P1: Falha no web-vitals NÃO deve quebrar a aplicação
- P2: Erro deve ser logado apenas em desenvolvimento
- P3: Métricas devem ser enviadas via sendBeacon (não bloqueia)

---

### Component 6: React Router v7 Future Flags

**Requirement Coverage:** REQ-6 (Router Compatibility)

**Design:**

```typescript
// src/App.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

**Correctness Properties:**
- P1: Console não deve exibir warnings de deprecação
- P2: Navegação deve usar startTransition automaticamente

---

### Component 7: WUZAPI Health Cache

**Requirement Coverage:** REQ-7 (WUZAPI Latency)

**Design:**

```javascript
// server/utils/wuzapiConnectivityChecker.js
const logger = require('./logger');

const CACHE_TTL = 60 * 1000; // 60 seconds
let cachedStatus = null;
let cacheTimestamp = 0;

/**
 * Gets WUZAPI connectivity status with caching
 * @param {boolean} forceRefresh - Force refresh ignoring cache
 * @returns {Promise<Object>} Status object
 */
async function getStatus(forceRefresh = false) {
  const now = Date.now();
  
  // Return cached status if valid
  if (!forceRefresh && cachedStatus && (now - cacheTimestamp) < CACHE_TTL) {
    return {
      ...cachedStatus,
      cached: true,
      cacheAge: now - cacheTimestamp
    };
  }
  
  // Fetch fresh status
  const start = Date.now();
  try {
    const response = await fetch(`${process.env.WUZAPI_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': process.env.WUZAPI_ADMIN_TOKEN
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const responseTime = Date.now() - start;
    
    cachedStatus = {
      connected: response.ok,
      baseUrl: process.env.WUZAPI_BASE_URL,
      responseTime,
      timestamp: new Date().toISOString(),
      error: response.ok ? null : `HTTP ${response.status}`
    };
    cacheTimestamp = now;
    
    return { ...cachedStatus, cached: false };
  } catch (error) {
    const responseTime = Date.now() - start;
    
    cachedStatus = {
      connected: false,
      baseUrl: process.env.WUZAPI_BASE_URL,
      responseTime,
      timestamp: new Date().toISOString(),
      error: error.message
    };
    cacheTimestamp = now;
    
    logger.warn('WUZAPI connectivity check failed', {
      error: error.message,
      responseTime
    });
    
    return { ...cachedStatus, cached: false };
  }
}

/**
 * Invalidates the WUZAPI status cache
 */
function invalidateCache() {
  cachedStatus = null;
  cacheTimestamp = 0;
}

module.exports = { getStatus, invalidateCache };
```

**Correctness Properties:**
- P1: Cache deve ser retornado em < 1ms
- P2: Refresh deve ocorrer apenas após TTL expirar
- P3: Erro de conectividade deve ser cacheado também (evita retry storm)

---

## Data Models

### Sanitized User Response

```typescript
interface SanitizedUser {
  id: string;
  name: string;
  connected: boolean;
  loggedIn: boolean;
  jid: string;
  webhook: string;
  events: string;
  expiration: number;
  qrcode: string;
  token: string; // Masked: "***ULML"
  proxy_config: {
    enabled: boolean;
    proxy_url: string | null; // Masked credentials
  };
  s3_config: {
    enabled: boolean;
    bucket: string;
    access_key: string; // Always "***"
  };
}
```

### Query Cache Keys

```typescript
const QUERY_KEYS = {
  adminDashboard: ['admin', 'dashboard', 'stats'],
  automationStats: ['admin', 'automation', 'statistics'],
  systemHealth: ['system', 'health'],
  wuzapiStatus: ['wuzapi', 'status'],
} as const;
```

---

## Error Handling

| Error Type | Handling Strategy | User Feedback |
|------------|-------------------|---------------|
| Session timeout | Redirect to login | "Sessão expirada" |
| API duplicate | Log warning (dev only) | None |
| Web vitals fail | Graceful degradation | None |
| WUZAPI timeout | Return cached status | None (transparent) |
| Token sanitization fail | Log error, return null | None |

---

## Testing Strategy

### Unit Tests

| Component | Test Focus | Tool |
|-----------|------------|------|
| sanitizeResponse | Token masking, edge cases | Vitest |
| queryClient config | staleTime, retry logic | Vitest |
| SessionGuard | Timeout, redirect logic | Vitest + RTL |

### Integration Tests

| Flow | Test Focus | Tool |
|------|------------|------|
| Admin dashboard load | No duplicate requests | Cypress |
| Session expiry | Redirect to login | Cypress |
| Health check | Cached WUZAPI status | Supertest |

### Security Tests

| Test | Expected Result | Tool |
|------|-----------------|------|
| Token in response | Should be masked | Manual + grep |
| Proxy credentials | Should be masked | Manual + grep |
| S3 access key | Should be "***" | Manual + grep |

---

## Migration Plan

### Phase 1: Backend Security (Day 1)
1. Implement `sanitizeResponse.js` utility
2. Apply to `/api/admin/dashboard-stats`
3. Apply to all admin user endpoints
4. Test token masking

### Phase 2: Frontend Optimization (Day 2)
1. Update `queryClient.ts` configuration
2. Create `useAdminDashboard.ts` hooks
3. Implement `SessionGuard` component
4. Update `AdminOverview` to use SessionGuard

### Phase 3: Performance (Day 3)
1. Add keep-alive middleware
2. Fix web-vitals initialization
3. Add React Router v7 flags
4. Implement WUZAPI cache

### Phase 4: Testing & Validation (Day 4)
1. Run security tests (token masking)
2. Verify no duplicate requests
3. Check console for warnings
4. Performance comparison

---

## Rollback Strategy

| Change | Rollback Method | Risk |
|--------|-----------------|------|
| Token sanitization | Remove sanitize calls | Low |
| Query config | Reset to defaults | Low |
| SessionGuard | Remove wrapper | Low |
| Keep-alive | Remove middleware | Low |
| Web vitals | Revert to old code | Low |
| Router flags | Remove future config | Low |
| WUZAPI cache | Set TTL to 0 | Low |

---

## Dependencies

### No New Dependencies Required

Todas as mudanças utilizam dependências existentes:
- `@tanstack/react-query` (já instalado)
- `web-vitals` (já instalado)
- `react-router-dom` (já instalado)

### Configuration Changes Only

- `vite.config.ts` - Nenhuma mudança
- `package.json` - Nenhuma mudança
- `tsconfig.json` - Nenhuma mudança

