# Correções Críticas de Autenticação - Referência Rápida

**Prioridade:** IMEDIATA  
**Esforço Estimado:** 4-6 horas  
**Nível de Risco:** ALTO

---

## Correção 1: Aplicar Rate Limiting aos Endpoints de Autenticação

**Arquivos a Modificar:**
- `server/routes/sessionRoutes.js`
- `server/routes/adminRoutes.js`

**Mudanças:**

### server/routes/sessionRoutes.js
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');

// Aplicar a TODOS os endpoints de autenticação
router.get('/status', 
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/connect',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/disconnect',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/logout',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.get('/qr',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);
```

### server/routes/adminRoutes.js
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');

// Aplicar a TODOS os endpoints admin
router.get('/users',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.get('/stats',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.get('/users/:userId',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.post('/users',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.delete('/users/:userId',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

router.delete('/users/:userId/full',
  strictRateLimiter,  // ADICIONAR ESTA LINHA
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);
```

---

## Correção 2: Implementar Cache de Tokens

**Novo Arquivo:** `server/utils/tokenCache.js`

```javascript
const { logger } = require('./logger');

/**
 * Cache de Tokens
 * Armazena resultados de validação de token para reduzir chamadas à WuzAPI
 */
class TokenCache {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    
    // Limpar entradas expiradas a cada minuto
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Obter resultado de validação de token em cache
   * @param {string} token - Token para buscar
   * @returns {Object|null} Resultado em cache ou null se não encontrado/expirado
   */
  get(token) {
    const cached = this.cache.get(token);
    
    if (!cached) {
      return null;
    }
    
    // Verificar se expirou
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(token);
      return null;
    }
    
    logger.debug('Cache de token encontrado', { 
      token_prefix: token.substring(0, 8) + '...',
      age_ms: Date.now() - cached.timestamp
    });
    
    return cached.result;
  }

  /**
   * Armazenar resultado de validação de token no cache
   * @param {string} token - Token para cachear
   * @param {Object} result - Resultado da validação
   */
  set(token, result) {
    this.cache.set(token, {
      result,
      timestamp: Date.now()
    });
    
    logger.debug('Token cacheado', { 
      token_prefix: token.substring(0, 8) + '...',
      is_valid: result.isValid
    });
  }

  /**
   * Invalidar um token específico
   * @param {string} token - Token para invalidar
   */
  invalidate(token) {
    const deleted = this.cache.delete(token);
    
    if (deleted) {
      logger.info('Token invalidado do cache', { 
        token_prefix: token.substring(0, 8) + '...'
      });
    }
  }

  /**
   * Limpar todos os tokens em cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache de tokens limpo', { entries_cleared: size });
  }

  /**
   * Remover entradas expiradas do cache
   * @private
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(token);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Limpeza do cache de tokens', { 
        entries_removed: cleaned,
        entries_remaining: this.cache.size
      });
    }
  }

  /**
   * Obter estatísticas do cache
   * @returns {Object} Estatísticas do cache
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl_ms: this.CACHE_TTL
    };
  }
}

module.exports = new TokenCache();
```

**Modificar:** `server/validators/sessionValidator.js`

```javascript
const wuzapiClient = require('../utils/wuzapiClient');
const { logger } = require('../utils/logger');
const tokenCache = require('../utils/tokenCache');  // ADICIONAR ISTO

class SessionValidator {
  async validateUserToken(token) {
    const startTime = Date.now();
    
    try {
      // VERIFICAR CACHE PRIMEIRO
      const cached = tokenCache.get(token);
      if (cached) {
        logger.info('Validação de token do cache', {
          action: 'validate_user_token',
          token_prefix: this._maskToken(token),
          response_time_ms: Date.now() - startTime,
          cache_hit: true
        });
        return cached;
      }
      
      // Cache miss - validar com WuzAPI
      logger.info('Iniciando validação de token de usuário', {
        action: 'validate_user_token',
        token_prefix: this._maskToken(token),
        cache_hit: false
      });

      const response = await wuzapiClient.get('/session/status', {
        headers: { 'token': token }
      });
      const responseTime = Date.now() - startTime;

      let result;
      if (response.success && response.status === 200) {
        const userData = this._extractUserData(response.data);
        
        result = {
          isValid: true,
          userData: userData
        };
        
        logger.info('Token de usuário validado com sucesso', {
          action: 'validate_user_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          connected: userData.connected,
          logged_in: userData.loggedIn
        });
      } else {
        result = {
          isValid: false,
          error: this._getErrorMessage(response.status, response.error)
        };
        
        logger.warn('Falha na validação de token de usuário', {
          action: 'validate_user_token',
          token_prefix: this._maskToken(token),
          status_code: response.status,
          response_time_ms: responseTime,
          error: response.error
        });
      }
      
      // CACHEAR O RESULTADO
      tokenCache.set(token, result);
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro interno na validação de token de usuário', {
        action: 'validate_user_token',
        token_prefix: this._maskToken(token),
        response_time_ms: responseTime,
        error_message: error.message
      });

      return {
        isValid: false,
        error: 'Erro interno na validação do token'
      };
    }
  }
  
  // ... resto da classe permanece igual
}

module.exports = new SessionValidator();
```

**Modificar:** `server/routes/sessionRoutes.js` - Endpoint de logout

```javascript
const tokenCache = require('../utils/tokenCache');  // ADICIONAR no topo

router.post('/logout',
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    try {
      const token = req.headers.token;
      const wuzapiClient = require('../utils/wuzapiClient');
      
      // INVALIDAR CACHE DE TOKEN
      tokenCache.invalidate(token);
      
      const response = await wuzapiClient.post('/session/logout', {}, {
        headers: { 'token': token }
      });
      
      // ... resto da lógica de logout
    } catch (error) {
      // ... tratamento de erro
    }
  }
);
```

---

## Correção 3: Implementar Rastreamento de Tentativas Falhadas

**Novo Arquivo:** `server/middleware/authenticationProtection.js`

```javascript
const { logger } = require('../utils/logger');

/**
 * Middleware de Proteção de Autenticação
 * Rastreia tentativas de autenticação falhadas e implementa bloqueio de conta
 */
class AuthenticationProtection {
  constructor() {
    this.failedAttempts = new Map();
    this.LOCKOUT_THRESHOLD = 5; // Limite de tentativas
    this.LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutos
    this.ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutos
    
    // Limpar entradas expiradas a cada minuto
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Verificar se identificador está bloqueado
   * @param {string} identifier - Endereço IP ou token
   * @returns {Object} Status de bloqueio
   */
  checkLockout(identifier) {
    const attempts = this.failedAttempts.get(identifier);
    
    if (!attempts) {
      return { locked: false };
    }
    
    // Verificar se período de bloqueio expirou
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingMs = attempts.lockedUntil - Date.now();
      
      logger.warn('Tentativa de autenticação enquanto bloqueado', {
        identifier: this._maskIdentifier(identifier),
        remaining_seconds: Math.ceil(remainingMs / 1000)
      });
      
      return {
        locked: true,
        remainingMs: remainingMs,
        remainingSeconds: Math.ceil(remainingMs / 1000)
      };
    }
    
    // Bloqueio expirou, limpar
    if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
      this.failedAttempts.delete(identifier);
      logger.info('Período de bloqueio expirado', {
        identifier: this._maskIdentifier(identifier)
      });
    }
    
    return { locked: false };
  }

  /**
   * Rastrear uma tentativa de autenticação falhada
   * @param {string} identifier - Endereço IP ou token
   * @returns {Object} Status de tentativa atualizado
   */
  trackFailedAttempt(identifier) {
    const lockStatus = this.checkLockout(identifier);
    
    if (lockStatus.locked) {
      return lockStatus;
    }
    
    const attempts = this.failedAttempts.get(identifier) || {
      count: 0,
      firstAttempt: Date.now(),
      lastAttempt: null,
      lockedUntil: null
    };
    
    // Resetar contagem se fora da janela de tentativas
    if (Date.now() - attempts.firstAttempt > this.ATTEMPT_WINDOW) {
      attempts.count = 0;
      attempts.firstAttempt = Date.now();
    }
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    logger.warn('Tentativa de autenticação falhada', {
      identifier: this._maskIdentifier(identifier),
      attempt_count: attempts.count,
      threshold: this.LOCKOUT_THRESHOLD
    });
    
    // Verificar se limite foi atingido
    if (attempts.count >= this.LOCKOUT_THRESHOLD) {
      attempts.lockedUntil = Date.now() + this.LOCKOUT_DURATION;
      
      logger.error('Conta bloqueada devido a tentativas falhadas', {
        identifier: this._maskIdentifier(identifier),
        attempt_count: attempts.count,
        lockout_duration_minutes: this.LOCKOUT_DURATION / 60000
      });
      
      this.failedAttempts.set(identifier, attempts);
      
      return {
        locked: true,
        remainingMs: this.LOCKOUT_DURATION,
        remainingSeconds: Math.ceil(this.LOCKOUT_DURATION / 1000)
      };
    }
    
    this.failedAttempts.set(identifier, attempts);
    
    return {
      locked: false,
      attemptsRemaining: this.LOCKOUT_THRESHOLD - attempts.count
    };
  }

  /**
   * Limpar tentativas falhadas para identificador (em autenticação bem-sucedida)
   * @param {string} identifier - Endereço IP ou token
   */
  clearFailedAttempts(identifier) {
    const deleted = this.failedAttempts.delete(identifier);
    
    if (deleted) {
      logger.info('Tentativas falhadas limpas', {
        identifier: this._maskIdentifier(identifier)
      });
    }
  }

  /**
   * Middleware Express para verificar bloqueio antes da autenticação
   * @returns {Function} Middleware Express
   */
  checkLockoutMiddleware() {
    return (req, res, next) => {
      const identifier = req.ip;
      const lockStatus = this.checkLockout(identifier);
      
      if (lockStatus.locked) {
        return res.status(429).json({
          success: false,
          error: 'Muitas Tentativas Falhadas',
          message: `Conta temporariamente bloqueada. Tente novamente em ${lockStatus.remainingSeconds} segundos.`,
          code: 'ACCOUNT_LOCKED',
          retryAfter: lockStatus.remainingSeconds,
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    };
  }

  /**
   * Limpar entradas expiradas
   * @private
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [identifier, attempts] of this.failedAttempts.entries()) {
      // Remover se bloqueio expirou e sem tentativas recentes
      if (attempts.lockedUntil && now > attempts.lockedUntil + this.ATTEMPT_WINDOW) {
        this.failedAttempts.delete(identifier);
        cleaned++;
      }
      // Remover se tentativas são antigas e não bloqueadas
      else if (!attempts.lockedUntil && now - attempts.lastAttempt > this.ATTEMPT_WINDOW) {
        this.failedAttempts.delete(identifier);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Limpeza de proteção de autenticação', {
        entries_removed: cleaned,
        entries_remaining: this.failedAttempts.size
      });
    }
  }

  /**
   * Mascarar identificador para logging
   * @param {string} identifier
   * @returns {string}
   * @private
   */
  _maskIdentifier(identifier) {
    if (!identifier) return 'DESCONHECIDO';
    
    // Mascarar endereço IP
    if (identifier.includes('.') || identifier.includes(':')) {
      const parts = identifier.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
      }
    }
    
    // Mascarar token
    if (identifier.length > 8) {
      return identifier.substring(0, 8) + '...';
    }
    
    return identifier;
  }

  /**
   * Obter estatísticas
   * @returns {Object}
   */
  getStats() {
    const locked = Array.from(this.failedAttempts.values())
      .filter(a => a.lockedUntil && Date.now() < a.lockedUntil).length;
    
    return {
      total_tracked: this.failedAttempts.size,
      currently_locked: locked,
      lockout_threshold: this.LOCKOUT_THRESHOLD,
      lockout_duration_minutes: this.LOCKOUT_DURATION / 60000
    };
  }
}

module.exports = new AuthenticationProtection();
```

**Modificar:** `server/routes/sessionRoutes.js`

```javascript
const authProtection = require('../middleware/authenticationProtection');  // ADICIONAR

router.get('/status', 
  strictRateLimiter,
  authProtection.checkLockoutMiddleware(),  // ADICIONAR
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.token;
      
      if (!sessionValidator.isValidTokenFormat(token)) {
        // Rastrear tentativa falhada
        authProtection.trackFailedAttempt(req.ip);
        
        logger.warn('Token com formato inválido na validação de sessão', { ... });
        return res.status(400).json({ ... });
      }

      const validationResult = await sessionValidator.validateUserToken(token);
      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Limpar tentativas falhadas em sucesso
        authProtection.clearFailedAttempts(req.ip);
        
        logger.info('Validação de sessão bem-sucedida', { ... });
        return res.status(200).json({ ... });
      } else {
        // Rastrear tentativa falhada
        const attemptStatus = authProtection.trackFailedAttempt(req.ip);
        
        return errorHandler.handleValidationError(validationResult, req, res);
      }
    } catch (error) {
      // ... tratamento de erro
    }
  }
);
```

---

## Testando as Correções

### Testar Rate Limiting
```bash
# Testar rate limiting do endpoint de sessão
for i in {1..15}; do
  curl -H "token: test-token" http://localhost:3000/api/session/status
  echo "Requisição $i"
done

# Deve ver 429 Too Many Requests após 10 requisições
```

### Testar Cache de Token
```bash
# Primeira requisição (cache miss)
time curl -H "token: valid-token" http://localhost:3000/api/session/status

# Segunda requisição (cache hit - deve ser mais rápida)
time curl -H "token: valid-token" http://localhost:3000/api/session/status
```

### Testar Rastreamento de Tentativas Falhadas
```bash
# Fazer 5 tentativas falhadas
for i in {1..5}; do
  curl -H "token: invalid-token" http://localhost:3000/api/session/status
  echo "Tentativa $i"
done

# 6ª tentativa deve retornar 429 com ACCOUNT_LOCKED
curl -H "token: invalid-token" http://localhost:3000/api/session/status
```

---

## Checklist de Implantação

- [ ] Criar `server/utils/tokenCache.js`
- [ ] Criar `server/middleware/authenticationProtection.js`
- [ ] Modificar `server/validators/sessionValidator.js`
- [ ] Modificar `server/validators/adminValidator.js`
- [ ] Modificar `server/routes/sessionRoutes.js`
- [ ] Modificar `server/routes/adminRoutes.js`
- [ ] Testar funcionalidade de rate limiting
- [ ] Testar funcionalidade de cache de token
- [ ] Testar rastreamento de tentativas falhadas
- [ ] Monitorar logs para eventos de autenticação
- [ ] Atualizar documentação

---

## Monitoramento Após Implantação

Fique atento a estas métricas:
- Taxa de acerto do cache de token (deve ser > 80%)
- Violações de rate limit (rastrear IPs)
- Bloqueios de conta (investigar padrões)
- Tempos de resposta da WuzAPI (devem diminuir com cache)
- Taxas de falha de autenticação

---

## Resumo dos Problemas Críticos Encontrados

### Problemas CRÍTICOS (Ação Imediata Necessária)

1. ❌ **Sem rate limiting nos endpoints de validação de sessão**
   - Vulnerável a ataques de força bruta
   - Solução: Aplicar `strictRateLimiter` (10 req/min)

2. ❌ **Sem rate limiting nos endpoints admin**
   - Tokens admin podem ser atacados por força bruta
   - Solução: Aplicar `strictRateLimiter` a todas as rotas admin

3. ❌ **Sem cache de token - risco de performance e disponibilidade**
   - Cada requisição chama WuzAPI (latência alta)
   - Dependência total de disponibilidade da WuzAPI
   - Solução: Implementar cache com TTL de 5 minutos

4. ❌ **Sem mecanismo de bloqueio de conta**
   - Tentativas ilimitadas de autenticação
   - Solução: Bloquear após 5 tentativas falhadas por 15 minutos

### Problemas de ALTA Prioridade (Curto Prazo)

5. ⚠️ **Sem tratamento de expiração de token**
   - Aplicação não verifica expiração localmente
   - Solução: Adicionar verificação de expiração no cache

6. ⚠️ **Sem configuração de timeout de sessão**
   - Sessões podem permanecer ativas indefinidamente
   - Solução: Implementar timeout local de 30 minutos

7. ⚠️ **Logout não invalida estado local**
   - Cache de token não é limpo no logout
   - Solução: Invalidar cache no logout (já implementado acima)

---

## Próximos Passos Recomendados

**Imediato (Esta Semana):**
1. Implementar rate limiting em todos os endpoints de autenticação
2. Adicionar cache de token com TTL de 5 minutos
3. Implementar rastreamento de tentativas falhadas e bloqueio

**Curto Prazo (Este Mês):**
4. Implementar timeout de sessão local
5. Limpar cache de token no logout
6. Criar middleware de autorização centralizado
7. Implementar comparação de token em tempo constante

**Médio Prazo (Próximo Trimestre):**
8. Migrar para cookies httpOnly
9. Implementar controle de acesso baseado em permissões
10. Adicionar proteção CAPTCHA
11. Implementar bloqueio de IP
12. Adicionar detecção de anomalias de autenticação

---

**Fim do Guia de Correções Críticas**
