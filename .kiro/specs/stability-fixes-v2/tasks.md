# Stability Fixes V2 - Implementation Tasks

## Task 1: Create Session Table Migration
- [x] Aplicar migração via Supabase MCP para criar tabela `express_sessions`
- [x] Definir schema com colunas sid, sess, expire
- [x] Adicionar índice na coluna expire para pruning eficiente
- [x] Verificar criação da tabela

**Files:** Supabase migration via MCP ✅

---

## Task 2: Install Required Dependencies
- [x] Adicionar `connect-pg-simple` ao package.json
- [x] Verificar se `pg` já está instalado
- [ ] Executar npm install (manual)
- [ ] Verificar instalação correta dos pacotes

**Files:** `server/package.json` ✅

---

## Task 3: Update Session Middleware
- [x] Importar connect-pg-simple e pg Pool
- [x] Criar pool de conexão com string do Supabase
- [x] Configurar pgSession store com pool
- [x] Definir pruneSessionInterval para limpeza automática
- [x] Atualizar configuração de sessão para usar novo store
- [x] Adicionar logging de erros do store
- [ ] Testar criação e recuperação de sessão (manual)

**Files:** `server/middleware/session.js` ✅

---

## Task 4: Add EPIPE Error Handling to Logger
- [x] Adicionar handler de erro stdout para EPIPE
- [x] Adicionar handler de erro stderr para EPIPE
- [x] Criar função utilitária safeWrite
- [x] Atualizar logger para usar safeConsole onde apropriado
- [x] Remover handlers duplicados de uncaughtException/unhandledRejection

**Files:** `server/utils/logger.js` ✅

---

## Task 5: Consolidate Error Handlers
- [x] Handlers centralizados em `server/index.js` (já existiam)
- [x] Remover handlers duplicados de `server/utils/logger.js`

**Files:** `server/utils/logger.js`, `server/index.js` ✅

---

## Task 6: Implement Circuit Breaker for WUZAPI
- [x] Criar classe CircuitBreaker
- [x] Implementar estados CLOSED, OPEN, HALF_OPEN
- [x] Implementar contagem de falhas e threshold
- [x] Implementar reset timeout
- [x] Integrar circuit breaker no WuzAPIClient
- [x] Expor estado do circuit breaker no health check

**Files:** `server/utils/wuzapiClient.js`, `server/index.js` ✅

---

## Task 7: Implement Retry with Exponential Backoff
- [x] Criar classe RetryHandler
- [x] Implementar lógica de retry com backoff exponencial
- [x] Definir erros retryable (network, 5xx)
- [x] Integrar retry handler no WuzAPIClient
- [x] Configurar maxRetries, initialDelay, maxDelay

**Files:** `server/utils/wuzapiClient.js` ✅

---

## Task 8: Update Health Check with Circuit Breaker Status
- [x] Adicionar estado do circuit breaker ao health check
- [x] Incluir métricas de retry
- [x] Atualizar resposta do endpoint /health

**Files:** `server/index.js` ✅

---

## Task 9: Integration Testing
- [ ] Testar persistência de sessão após restart do servidor
- [ ] Testar fluxo de autenticação com novo session store
- [ ] Testar operações WUZAPI com cenários de timeout
- [ ] Testar precisão do health endpoint
- [ ] Verificar que não há regressão em funcionalidade existente
- [ ] Monitorar logs para erros durante testes

**Files:** N/A (testes manuais)

---

## Execution Order

1. **Task 1** - Migração de banco de dados (fundação) ✅
2. **Task 2** - Dependências (necessário para Task 3) ✅
3. **Task 3** - Middleware de sessão (correção crítica) ✅
4. **Task 4** - Tratamento EPIPE (correção crítica) ✅
5. **Task 5** - Consolidação de error handlers (estabilidade) ✅
6. **Task 6** - Circuit breaker WUZAPI (resiliência) ✅
7. **Task 7** - Retry com backoff (resiliência) ✅
8. **Task 8** - Health check atualizado (observabilidade) ✅
9. **Task 9** - Testes de integração (validação) ⏳

## Rollback Procedures

### Session Store Rollback
```javascript
// Reverter para MemoryStore
const sessionConfig = {
  // Remover propriedade store para usar MemoryStore padrão
  secret: process.env.SESSION_SECRET,
  // ... resto da config
};
```

### WUZAPI Rollback
```javascript
// Desabilitar circuit breaker
this.circuitBreakerEnabled = false;

// Reverter timeout para original
this.timeout = 10000; // Original 10s timeout
```

### Error Handler Rollback
```javascript
// Restaurar handlers originais em logger.js
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
```

## Environment Variables Added

Para configurar o session store PostgreSQL, adicione ao `.env`:

```bash
# PostgreSQL Session Store (optional - falls back to MemoryStore if not configured)
SUPABASE_DB_PASSWORD=your_database_password
SUPABASE_REGION=us-east-1

# WUZAPI Circuit Breaker (optional - uses defaults if not set)
WUZAPI_CIRCUIT_FAILURE_THRESHOLD=5
WUZAPI_CIRCUIT_RESET_TIMEOUT=30000
WUZAPI_MAX_RETRIES=3
```
