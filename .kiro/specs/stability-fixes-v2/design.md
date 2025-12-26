# Stability Fixes V2 - Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Express Server                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Session   │  │   Error     │  │    Health Check         │ │
│  │  Middleware │  │  Handlers   │  │    Endpoint             │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │               │
│         ▼                ▼                      ▼               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  PostgreSQL │  │   Logger    │  │   Service Health        │ │
│  │   Session   │  │   (EPIPE    │  │   Checks                │ │
│  │   Store     │  │   Safe)     │  │                         │ │
│  └──────┬──────┘  └─────────────┘  └───────────┬─────────────┘ │
│         │                                       │               │
└─────────┼───────────────────────────────────────┼───────────────┘
          │                                       │
          ▼                                       ▼
   ┌─────────────┐                    ┌─────────────────────────┐
   │  Supabase   │                    │  External Services      │
   │  PostgreSQL │                    │  ┌─────────┐ ┌────────┐ │
   │             │                    │  │ WUZAPI  │ │ Redis  │ │
   │             │                    │  │(Circuit)│ │        │ │
   └─────────────┘                    │  └─────────┘ └────────┘ │
                                      └─────────────────────────┘
```

## Component Designs

### 1. PostgreSQL Session Store

#### Database Schema (via Supabase)

```sql
-- Tabela para armazenamento de sessões Express
-- Compatível com connect-pg-simple
CREATE TABLE IF NOT EXISTS user_sessions (
  sid VARCHAR(255) NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Índice para limpeza eficiente de sessões expiradas
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire 
ON user_sessions(expire);

-- Comentário para documentação
COMMENT ON TABLE user_sessions IS 'Express session storage for persistent sessions across server restarts';
```

#### Session Configuration

```javascript
// server/middleware/session.js
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const { logger } = require('../utils/logger');

// Criar pool de conexão PostgreSQL usando URL do Supabase
const getConnectionString = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL not configured');
  }
  
  // Extrair host do Supabase URL
  const url = new URL(supabaseUrl);
  const projectRef = url.hostname.split('.')[0];
  
  // Construir connection string para PostgreSQL direto
  // Formato: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  const password = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  return `postgresql://postgres.${projectRef}:${password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
};

// Pool de conexão com configurações otimizadas
const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Configuração do session store
const sessionConfig = {
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    pruneSessionInterval: 60 * 15, // Limpar sessões expiradas a cada 15 minutos
    errorLog: (err) => logger.error('Session store error', { error: err.message })
  }),
  secret: process.env.SESSION_SECRET || 'wuzapi-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'wuzapi.sid',
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    domain: getCookieDomain()
  }
};
```

### 2. EPIPE Error Handling

#### Logger Enhancement

```javascript
// server/utils/logger.js - Adicionar no início do módulo

/**
 * Handle EPIPE errors gracefully
 * EPIPE occurs when stdout/stderr is closed (common in containers/pipes)
 */
const handleEPIPE = (err) => {
  if (err.code === 'EPIPE') {
    // Stdout/stderr closed, exit gracefully without crash
    // Don't try to log - the stream is closed
    process.exit(0);
  }
};

// Attach handlers early, before any logging
process.stdout.on('error', handleEPIPE);
process.stderr.on('error', handleEPIPE);

/**
 * Safe write to stream - handles EPIPE gracefully
 */
const safeWrite = (stream, data) => {
  try {
    if (stream && !stream.destroyed && stream.writable) {
      stream.write(data);
    }
  } catch (err) {
    if (err.code !== 'EPIPE') {
      // Re-throw non-EPIPE errors
      throw err;
    }
    // EPIPE errors are silently ignored
  }
};
```

### 3. WUZAPI Circuit Breaker

#### Circuit Breaker Implementation

```javascript
// server/utils/wuzapiClient.js - Adicionar circuit breaker

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.failures = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.lastFailure = null;
    this.successThreshold = options.successThreshold || 2;
    this.successCount = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successCount = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
      successCount: this.successCount
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailure = null;
    this.successCount = 0;
  }
}
```

#### Retry with Exponential Backoff

```javascript
// server/utils/wuzapiClient.js - Adicionar retry logic

class RetryHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.initialDelay = options.initialDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.retryableStatuses = options.retryableStatuses || [408, 429, 500, 502, 503, 504];
  }

  async execute(fn) {
    let lastError;
    let delay = this.initialDelay;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Don't retry on non-retryable errors
        if (!this.isRetryable(error)) {
          throw error;
        }

        // Don't wait after last attempt
        if (attempt < this.maxRetries) {
          await this.sleep(delay);
          delay = Math.min(delay * this.backoffMultiplier, this.maxDelay);
        }
      }
    }

    throw lastError;
  }

  isRetryable(error) {
    // Network errors are retryable
    if (error.code === 'ECONNABORTED' || 
        error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // Check HTTP status codes
    if (error.response && this.retryableStatuses.includes(error.response.status)) {
      return true;
    }

    return false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4. Error Handler Consolidation

#### Centralized Error Handlers

```javascript
// server/utils/errorHandlers.js - Novo arquivo

const { logger } = require('./logger');

let isShuttingDown = false;

/**
 * Handle uncaught exceptions
 * Should be registered ONCE in the application
 */
const handleUncaughtException = (error) => {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    logger.fatal('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      type: 'uncaughtException'
    });
  } catch (logError) {
    // If logging fails, write to stderr directly
    console.error('FATAL: Uncaught Exception:', error);
  }

  // Give time for logs to flush
  setTimeout(() => process.exit(1), 1000);
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || String(reason),
    stack: reason?.stack,
    type: 'unhandledRejection'
  });
  
  // In Node.js 15+, unhandled rejections cause exit by default
  // We log but don't exit to maintain backward compatibility
};

/**
 * Register all error handlers
 * Call this ONCE at application startup
 */
const registerErrorHandlers = () => {
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);
  
  logger.info('Error handlers registered');
};

module.exports = {
  handleUncaughtException,
  handleUnhandledRejection,
  registerErrorHandlers
};
```

## Migration Strategy

### Phase 1: Database Migration (Immediate)
1. Aplicar migração da tabela de sessões via Supabase MCP
2. Verificar criação da tabela
3. Nenhuma mudança na aplicação ainda

### Phase 2: Session Store Migration (Low Risk)
1. Atualizar middleware de sessão
2. Deploy durante período de baixo tráfego
3. Monitorar problemas de sessão
4. Rollback: Reverter para MemoryStore se houver problemas

### Phase 3: Error Handling (Low Risk)
1. Adicionar handlers EPIPE
2. Consolidar error handlers
3. Deploy e monitorar
4. Sem necessidade de rollback (mudanças aditivas)

### Phase 4: Service Resilience (Medium Risk)
1. Atualizar WUZAPI client com circuit breaker
2. Testar com falhas simuladas
3. Deploy com feature flag se possível
4. Rollback: Reverter config de timeout/retry

## Testing Strategy

### Unit Tests
- Conexão do session store
- Comportamento do handler EPIPE
- Transições de estado do circuit breaker
- Respostas do health check

### Integration Tests
- Persistência de sessão após restart
- Comportamento de retry do WUZAPI
- Precisão do health check do banco

### Load Tests
- Session store sob carga concorrente
- Circuit breaker sob condições de falha

## Monitoring & Alerts

### Metrics to Track
- Taxa de criação/destruição de sessões
- Latência do session store
- Estado do circuit breaker WUZAPI
- Tempos de resposta do health check
- Taxa de sucesso do graceful shutdown

### Alerts to Configure
- Falhas de conexão do session store
- Circuit breaker abre
- Falhas no health check
- Timeouts de graceful shutdown
