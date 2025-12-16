# Plano de Remediação e Cronograma - Auditoria de Prontidão para Produção

**Sistema:** WuzAPI Dashboard  
**Data de Criação:** 07 de Novembro de 2025  
**Versão:** 1.0  
**Status:** 🔴 AÇÃO IMEDIATA NECESSÁRIA

---

## 📊 Sumário Executivo

Este documento consolida todos os achados da auditoria de prontidão para produção em um plano de ação priorizado com cronograma, responsáveis e critérios de aceitação claros.

### Status Geral da Auditoria

**Total de Problemas Identificados:** 17
- 🔴 **Críticos:** 6 (35%)
- 🟡 **Altos:** 8 (47%)
- 🟢 **Médios:** 3 (18%)

**Recomendação:** ❌ **NÃO APROVAR** para produção até correção dos 6 problemas críticos

### Investimento Necessário

| Fase | Duração | Esforço | Custo Estimado* | Prazo |
|------|---------|---------|-----------------|-------|
| **Fase 1 - Crítico** | 1 dia | 4-5h | R$ 800-1.000 | HOJE |
| **Fase 2 - Alto** | 3-4 dias | 16-20h | R$ 3.200-4.000 | Esta Semana |
| **Fase 3 - Médio** | 5-7 dias | 8-12h | R$ 1.600-2.400 | 2 Semanas |
| **TOTAL** | **9-12 dias** | **28-37h** | **R$ 5.600-7.400** | **2 Semanas** |

*Baseado em R$ 200/hora (desenvolvedor pleno)

---

## 🎯 Objetivos do Plano de Remediação

1. **Eliminar todas as vulnerabilidades críticas** que impedem deploy em produção
2. **Implementar proteções essenciais** de autenticação e autorização
3. **Estabelecer processos contínuos** de auditoria e monitoramento
4. **Documentar procedimentos** de segurança e resposta a incidentes
5. **Preparar o sistema** para escala e operação em produção

---

## 🚨 FASE 1: CORREÇÕES CRÍTICAS (HOJE - 4-5 horas)

**Prioridade:** 🔴 BLOQUEADOR DE PRODUÇÃO  
**Prazo:** Hoje (07/11/2025)  
**Responsável:** Desenvolvedor Backend + Frontend  
**Objetivo:** Eliminar vulnerabilidades que impedem deploy seguro

### Issue #1: Atualizar Axios Vulnerável (CVE-2024-XXXX)

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Dependências  
**Esforço:** 30 minutos  
**Responsável:** Desenvolvedor Frontend

**Descrição:**  
Axios versão 1.8.3 contém vulnerabilidade HIGH (CVSS 7.5) que permite ataques DoS através de respostas HTTP grandes.

**Localização:**
- `package.json` (frontend)

**Passos de Remediação:**
```bash
# 1. Atualizar Axios
npm install axios@latest

# 2. Executar testes
npm test

# 3. Build de produção
npm run build

# 4. Verificar vulnerabilidades
npm audit
```

**Critérios de Aceitação:**
- [ ] Axios atualizado para versão >= 1.12.0
- [ ] `npm audit` não mostra vulnerabilidades HIGH/CRITICAL
- [ ] Todos os testes passando
- [ ] Build de produção bem-sucedido

**Verificação:**
```bash
npm list axios
npm audit --production
```

---

### Issue #2: Remover Tokens Hardcoded (Backend)

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Segredos e Configuração  
**Esforço:** 1 hora  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Token administrativo hardcoded em 5 locais do backend como fallback, comprometendo completamente a segurança administrativa.

**Localizações:**
1. `server/routes/landingPageRoutes.js` - 3 ocorrências
2. `server/routes/index.js` - 1 ocorrência
3. `server/index.js` - 1 ocorrência

**Código Vulnerável:**
```javascript
const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
```

**Passos de Remediação:**
```javascript
// Substituir TODAS as ocorrências por:
const adminToken = process.env.VITE_ADMIN_TOKEN;
if (!adminToken) {
  logger.error('VITE_ADMIN_TOKEN não configurado - aplicação não pode iniciar');
  throw new Error('VITE_ADMIN_TOKEN é obrigatório. Configure a variável de ambiente.');
}
```

**Arquivos a Modificar:**
1. `server/routes/landingPageRoutes.js` (linhas ~15, ~45, ~78)
2. `server/routes/index.js` (linha ~23)
3. `server/index.js` (linha ~67)

**Critérios de Aceitação:**
- [ ] Todas as 5 ocorrências removidas
- [ ] Validação obrigatória implementada
- [ ] Aplicação falha ao iniciar sem token
- [ ] Logs apropriados em caso de erro
- [ ] Testes unitários atualizados

**Verificação:**
```bash
# Buscar por tokens hardcoded
grep -r "UeH7cZ2c1K3zVUBFi7SginSC" server/

# Deve retornar vazio
```

---

### Issue #3: Remover Token Hardcoded (Frontend)

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Segurança Frontend  
**Esforço:** 1 hora  
**Responsável:** Desenvolvedor Frontend

**Descrição:**  
Token administrativo hardcoded no código frontend, exposto em bundle JavaScript público.

**Localização:**
- `src/contexts/AuthContext.tsx` (linha ~18)

**Código Vulnerável:**
```typescript
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
```

**Passos de Remediação:**
```typescript
// Substituir por:
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  throw new Error('VITE_ADMIN_TOKEN não configurado. Verifique as variáveis de ambiente.');
}
```

**Critérios de Aceitação:**
- [ ] Token hardcoded removido
- [ ] Validação obrigatória implementada
- [ ] Build falha sem variável configurada
- [ ] Mensagem de erro clara
- [ ] Testes atualizados

**Verificação:**
```bash
# Buscar por token hardcoded
grep -r "UeH7cZ2c1K3zVUBFi7SginSC" src/

# Verificar bundle de produção
npm run build
grep -r "UeH7cZ2c1K3zVUBFi7SginSC" dist/
```

---

### Issue #4: Gerar e Rotacionar Token Admin

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Segredos e Configuração  
**Esforço:** 30 minutos  
**Responsável:** DevOps / Desenvolvedor Backend

**Descrição:**  
Token administrativo atual está comprometido (exposto em código). Necessário gerar novo token seguro e rotacionar em todos os ambientes.

**Passos de Remediação:**

1. **Gerar novo token seguro:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Exemplo de saída: a7f3e9d2c8b4f1a6e5d3c9b7a2f8e4d1c6b9a5f2e8d4c1b7a3f9e6d2c8b5a1f4
```

2. **Atualizar .env local:**
```bash
# .env
VITE_ADMIN_TOKEN=<novo_token_gerado>
```

3. **Atualizar docker-swarm-stack.yml:**
```yaml
environment:
  - VITE_ADMIN_TOKEN=<novo_token_gerado>
```

4. **Atualizar .env.production:**
```bash
# .env.production
VITE_ADMIN_TOKEN=<novo_token_gerado>
```

5. **Comunicar novo token:**
- Atualizar documentação interna
- Notificar administradores
- Atualizar ferramentas de monitoramento

**Critérios de Aceitação:**
- [ ] Novo token gerado (64 caracteres hex)
- [ ] Token atualizado em .env
- [ ] Token atualizado em docker-swarm-stack.yml
- [ ] Token atualizado em .env.production
- [ ] Token antigo invalidado
- [ ] Documentação atualizada
- [ ] Administradores notificados

**Verificação:**
```bash
# Verificar que token antigo não existe mais
grep -r "UeH7cZ2c1K3zVUBFi7SginSC" .

# Verificar novo token configurado
grep "VITE_ADMIN_TOKEN" .env docker-swarm-stack.yml
```

---

### Issue #5: Aplicar Rate Limiting em Rotas de Autenticação

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Autenticação  
**Esforço:** 2-3 horas  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Rate limiters estão configurados mas NÃO aplicados nas rotas críticas de autenticação, permitindo ataques de força bruta e DoS.

**Rotas Afetadas:**
- `/api/session/status` - Validação de sessão
- `/api/session/connect` - Conexão
- `/api/session/disconnect` - Desconexão
- `/api/session/logout` - Logout
- `/api/session/qr` - QR Code
- `/api/admin/users` - Gerenciamento de usuários
- `/api/admin/stats` - Estatísticas
- `/api/admin/connections` - Conexões

**Passos de Remediação:**

1. **Modificar `server/routes/sessionRoutes.js`:**
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');

// Aplicar em TODAS as rotas
router.get('/status', strictRateLimiter, errorHandler.validateTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.post('/connect', strictRateLimiter, errorHandler.validateTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.post('/disconnect', strictRateLimiter, errorHandler.validateTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.post('/logout', strictRateLimiter, errorHandler.validateTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.get('/qr', strictRateLimiter, errorHandler.validateTokenFormat.bind(errorHandler), async (req, res) => { ... });
```

2. **Modificar `server/routes/adminRoutes.js`:**
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');

// Aplicar em TODAS as rotas admin
router.get('/users', strictRateLimiter, errorHandler.validateAdminTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.get('/stats', strictRateLimiter, errorHandler.validateAdminTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.get('/users/:userId', strictRateLimiter, errorHandler.validateAdminTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.post('/users', strictRateLimiter, errorHandler.validateAdminTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.delete('/users/:userId', strictRateLimiter, errorHandler.validateAdminTokenFormat.bind(errorHandler), async (req, res) => { ... });
router.delete('/users/:userId/full', strictRateLimiter, errorHandler.validateAdminTokenFormat.bind(errorHandler), async (req, res) => { ... });
```

3. **Modificar `server/routes/userRoutes.js`:**
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');

// Aplicar em rotas sensíveis
router.post('/record', strictRateLimiter, async (req, res) => { ... });
router.put('/record/:id', strictRateLimiter, async (req, res) => { ... });
router.delete('/record/:id', strictRateLimiter, async (req, res) => { ... });
```

**Critérios de Aceitação:**
- [ ] Rate limiting aplicado em todas rotas de sessão (5 rotas)
- [ ] Rate limiting aplicado em todas rotas admin (6 rotas)
- [ ] Rate limiting aplicado em rotas sensíveis de usuário (3 rotas)
- [ ] Limite configurado: 10 requisições/minuto
- [ ] Resposta 429 após limite excedido
- [ ] Headers `Retry-After` incluídos
- [ ] Logs de violação de rate limit

**Teste de Verificação:**
```bash
# Testar rate limiting
for i in {1..15}; do
  curl -H "token: test-token" http://localhost:3000/api/session/status
  echo "Requisição $i"
done

# Deve retornar 429 após 10 requisições
```

---

### Issue #6: Aplicar Rate Limiting em Rotas Públicas

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Segurança API  
**Esforço:** 30 minutos  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Rotas públicas sem rate limiting permitem abuso e ataques DoS.

**Rotas Afetadas:**
- `/api/landing-page` - Landing page pública
- `/health` - Health check
- Outras rotas públicas

**Passos de Remediação:**

```javascript
const { publicRateLimiter } = require('../middleware/rateLimiter');

// Aplicar rate limiter mais permissivo em rotas públicas
router.get('/landing-page', publicRateLimiter, async (req, res) => { ... });
router.get('/health', publicRateLimiter, async (req, res) => { ... });
```

**Critérios de Aceitação:**
- [ ] Rate limiting aplicado em todas rotas públicas
- [ ] Limite configurado: 100 requisições/minuto
- [ ] Não bloqueia uso legítimo
- [ ] Previne abuso

---

### Checklist Fase 1

- [ ] **Issue #1:** Axios atualizado e verificado
- [ ] **Issue #2:** Tokens hardcoded removidos (backend)
- [ ] **Issue #3:** Token hardcoded removido (frontend)
- [ ] **Issue #4:** Novo token gerado e rotacionado
- [ ] **Issue #5:** Rate limiting aplicado (auth)
- [ ] **Issue #6:** Rate limiting aplicado (público)
- [ ] Todos os testes passando
- [ ] Build de produção bem-sucedido
- [ ] Documentação atualizada
- [ ] Deploy em staging realizado
- [ ] Validação de segurança básica

**Resultado Esperado:** Sistema seguro para deploy inicial em produção

---

## 🟡 FASE 2: PROTEÇÕES ESSENCIAIS (ESTA SEMANA - 16-20 horas)

**Prioridade:** 🔴 CRÍTICA  
**Prazo:** 08-11/11/2025 (3-4 dias)  
**Responsável:** Desenvolvedor Backend + Frontend  
**Objetivo:** Implementar proteções robustas de autenticação e segurança

### Issue #7: Implementar Cache de Tokens

**Severidade:** 🟡 ALTA  
**Categoria:** Performance e Autenticação  
**Esforço:** 3-4 horas  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Cada requisição faz chamada externa à WuzAPI, causando latência alta e dependência total de disponibilidade externa.

**Impacto:**
- Latência de 200-500ms por requisição
- Risco de indisponibilidade se WuzAPI cair
- Custo desnecessário de rede

**Passos de Remediação:**

1. **Criar `server/utils/tokenCache.js`:**
```javascript
const { logger } = require('./logger');

class TokenCache {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutos
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  get(token) {
    const cached = this.cache.get(token);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(token);
      return null;
    }
    
    return cached.result;
  }

  set(token, result) {
    this.cache.set(token, {
      result,
      timestamp: Date.now()
    });
  }

  invalidate(token) {
    this.cache.delete(token);
  }

  clear() {
    this.cache.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [token, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(token);
      }
    }
  }
}

module.exports = new TokenCache();
```

2. **Modificar `server/validators/sessionValidator.js`:**
```javascript
const tokenCache = require('../utils/tokenCache');

async validateUserToken(token) {
  // Verificar cache primeiro
  const cached = tokenCache.get(token);
  if (cached) {
    logger.info('Token validation from cache', { cache_hit: true });
    return cached;
  }
  
  // Cache miss - validar com WuzAPI
  const result = await this._validateWithWuzAPI(token);
  
  // Cachear resultado
  tokenCache.set(token, result);
  
  return result;
}
```

3. **Modificar logout para invalidar cache:**
```javascript
router.post('/logout', async (req, res) => {
  const token = req.headers.token;
  
  // Invalidar cache
  tokenCache.invalidate(token);
  
  // Continuar com logout normal
  // ...
});
```

**Critérios de Aceitação:**
- [ ] TokenCache implementado com TTL de 5 minutos
- [ ] Cache integrado em sessionValidator
- [ ] Cache integrado em adminValidator
- [ ] Logout invalida cache
- [ ] Taxa de cache hit > 70%
- [ ] Latência reduzida em 80%
- [ ] Logs de cache hit/miss
- [ ] Testes unitários

**Métricas de Sucesso:**
- Latência média: < 50ms (vs 200-500ms)
- Cache hit rate: > 70%
- Redução de chamadas WuzAPI: > 80%

---

### Issue #8: Implementar Bloqueio de Conta

**Severidade:** 🟡 ALTA  
**Categoria:** Autenticação  
**Esforço:** 3-4 horas  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Tentativas ilimitadas de autenticação permitem ataques de força bruta.

**Impacto:**
- Tokens podem ser descobertos por força bruta
- Sem proteção contra automação
- Risco de comprometimento de contas

**Passos de Remediação:**

1. **Criar `server/middleware/authenticationProtection.js`:**
```javascript
const { logger } = require('../utils/logger');

class AuthenticationProtection {
  constructor() {
    this.failedAttempts = new Map();
    this.LOCKOUT_THRESHOLD = 5;
    this.LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutos
    this.ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutos
    
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  checkLockout(identifier) {
    const attempts = this.failedAttempts.get(identifier);
    
    if (!attempts) return { locked: false };
    
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingMs = attempts.lockedUntil - Date.now();
      return {
        locked: true,
        remainingMs,
        remainingSeconds: Math.ceil(remainingMs / 1000)
      };
    }
    
    return { locked: false };
  }

  trackFailedAttempt(identifier) {
    const lockStatus = this.checkLockout(identifier);
    if (lockStatus.locked) return lockStatus;
    
    const attempts = this.failedAttempts.get(identifier) || {
      count: 0,
      firstAttempt: Date.now()
    };
    
    if (Date.now() - attempts.firstAttempt > this.ATTEMPT_WINDOW) {
      attempts.count = 0;
      attempts.firstAttempt = Date.now();
    }
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    if (attempts.count >= this.LOCKOUT_THRESHOLD) {
      attempts.lockedUntil = Date.now() + this.LOCKOUT_DURATION;
      
      logger.error('Account locked due to failed attempts', {
        identifier: this._maskIdentifier(identifier),
        attempt_count: attempts.count
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

  clearFailedAttempts(identifier) {
    this.failedAttempts.delete(identifier);
  }

  checkLockoutMiddleware() {
    return (req, res, next) => {
      const identifier = req.ip;
      const lockStatus = this.checkLockout(identifier);
      
      if (lockStatus.locked) {
        return res.status(429).json({
          success: false,
          error: 'Account Locked',
          message: `Too many failed attempts. Try again in ${lockStatus.remainingSeconds} seconds.`,
          code: 'ACCOUNT_LOCKED',
          retryAfter: lockStatus.remainingSeconds
        });
      }
      
      next();
    };
  }

  _maskIdentifier(identifier) {
    if (!identifier) return 'UNKNOWN';
    if (identifier.includes('.')) {
      const parts = identifier.split('.');
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return identifier.substring(0, 8) + '...';
  }

  cleanup() {
    const now = Date.now();
    for (const [identifier, attempts] of this.failedAttempts.entries()) {
      if (attempts.lockedUntil && now > attempts.lockedUntil + this.ATTEMPT_WINDOW) {
        this.failedAttempts.delete(identifier);
      }
    }
  }
}

module.exports = new AuthenticationProtection();
```

2. **Integrar em rotas de autenticação:**
```javascript
const authProtection = require('../middleware/authenticationProtection');

router.get('/status',
  strictRateLimiter,
  authProtection.checkLockoutMiddleware(),
  async (req, res) => {
    // ...
    
    if (!validationResult.isValid) {
      // Rastrear tentativa falhada
      const attemptStatus = authProtection.trackFailedAttempt(req.ip);
      // ...
    } else {
      // Limpar tentativas em sucesso
      authProtection.clearFailedAttempts(req.ip);
      // ...
    }
  }
);
```

**Critérios de Aceitação:**
- [ ] AuthenticationProtection implementado
- [ ] Bloqueio após 5 tentativas falhadas
- [ ] Lockout de 15 minutos
- [ ] Middleware aplicado em todas rotas de auth
- [ ] Resposta 429 com tempo de retry
- [ ] Logs de bloqueio
- [ ] Limpeza automática de entradas antigas
- [ ] Testes unitários

**Teste de Verificação:**
```bash
# Fazer 5 tentativas falhadas
for i in {1..5}; do
  curl -H "token: invalid" http://localhost:3000/api/session/status
done

# 6ª tentativa deve retornar 429 ACCOUNT_LOCKED
curl -H "token: invalid" http://localhost:3000/api/session/status
```

---

### Issue #9: Implementar Proteção CSRF

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Segurança Frontend  
**Esforço:** 4-6 horas  
**Responsável:** Desenvolvedor Backend + Frontend

**Descrição:**  
Nenhuma proteção CSRF implementada em operações que alteram estado, permitindo ataques CSRF.

**Impacto:**
- Usuários autenticados podem ser enganados a executar ações
- Especialmente crítico para operações admin
- Violação de segurança OWASP Top 10

**Passos de Remediação:**

1. **Instalar dependência:**
```bash
cd server
npm install csurf
```

2. **Configurar CSRF no backend (`server/index.js`):**
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Configurar cookie parser
app.use(cookieParser());

// Configurar CSRF protection
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Endpoint para obter token CSRF
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Aplicar em rotas que alteram estado
app.use('/api/admin', csrfProtection);
app.use('/api/session', csrfProtection);
app.use('/api/user/record', csrfProtection);
```

3. **Modificar API client no frontend (`src/lib/api.ts`):**
```typescript
// Obter token CSRF ao inicializar
let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  
  const response = await fetch('/api/csrf-token', {
    credentials: 'include'
  });
  
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

// Incluir token em todas requisições
export async function apiRequest(url: string, options: RequestInit = {}) {
  const token = await getCsrfToken();
  
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      'CSRF-Token': token
    }
  });
}
```

4. **Atualizar AuthContext para usar novo client:**
```typescript
// Usar apiRequest em vez de fetch direto
const response = await apiRequest('/api/session/status', {
  headers: { 'token': userToken }
});
```

**Critérios de Aceitação:**
- [ ] csurf instalado e configurado
- [ ] Endpoint `/api/csrf-token` criado
- [ ] CSRF protection aplicado em rotas admin
- [ ] CSRF protection aplicado em rotas de sessão
- [ ] CSRF protection aplicado em rotas de usuário
- [ ] Frontend obtém e inclui token
- [ ] Requisições sem token são rejeitadas (403)
- [ ] Cookies configurados com httpOnly e secure
- [ ] Testes de integração

**Teste de Verificação:**
```bash
# Tentar requisição sem token CSRF
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -d '{"username":"test"}'

# Deve retornar 403 Forbidden
```

---

### Issue #10: Migrar Tokens para httpOnly Cookies

**Severidade:** 🔴 CRÍTICA  
**Categoria:** Segurança Frontend  
**Esforço:** 6-8 horas  
**Responsável:** Desenvolvedor Backend + Frontend

**Descrição:**  
Tokens armazenados em localStorage são vulneráveis a ataques XSS. Migração para httpOnly cookies elimina este vetor de ataque.

**Impacto:**
- Tokens acessíveis via JavaScript (XSS)
- Tokens persistem entre sessões
- Sem proteção httpOnly

**Passos de Remediação:**

1. **Criar endpoint de login (`server/routes/auth.js`):**
```javascript
const express = require('express');
const router = express.Router();
const sessionValidator = require('../validators/sessionValidator');

router.post('/login', async (req, res) => {
  const { token, isAdmin } = req.body;
  
  // Validar token
  const validation = isAdmin 
    ? await adminValidator.validateAdminToken(token)
    : await sessionValidator.validateUserToken(token);
  
  if (!validation.isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
  
  // Definir cookie httpOnly
  res.cookie(isAdmin ? 'adminToken' : 'userToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60 * 1000 // 30 minutos
  });
  
  res.json({
    success: true,
    user: validation.userData
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.clearCookie('userToken');
  
  res.json({ success: true });
});

router.post('/refresh', async (req, res) => {
  const token = req.cookies.userToken || req.cookies.adminToken;
  
  if (!token) {
    return res.status(401).json({ success: false });
  }
  
  // Validar e renovar cookie
  // ...
});

module.exports = router;
```

2. **Modificar middleware para ler de cookies:**
```javascript
// server/middleware/auth.js
function extractToken(req) {
  // Tentar cookie primeiro (novo método)
  if (req.cookies.userToken) {
    return req.cookies.userToken;
  }
  
  // Fallback para header (compatibilidade)
  return req.headers.token;
}
```

3. **Modificar AuthContext (`src/contexts/AuthContext.tsx`):**
```typescript
// Remover localStorage
// localStorage.setItem('userToken', token); // ❌ REMOVER

// Usar endpoint de login
const login = async (token: string, isAdmin: boolean) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include', // Importante para cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, isAdmin })
  });
  
  if (response.ok) {
    const data = await response.json();
    setUser(data.user);
    setIsAuthenticated(true);
  }
};

const logout = async () => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  
  setUser(null);
  setIsAuthenticated(false);
};

// Verificar autenticação ao carregar
useEffect(() => {
  fetch('/api/auth/check', { credentials: 'include' })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        setUser(data.user);
        setIsAuthenticated(true);
      }
    });
}, []);
```

4. **Implementar refresh token:**
```typescript
// Renovar token a cada 25 minutos
useEffect(() => {
  if (!isAuthenticated) return;
  
  const interval = setInterval(async () => {
    await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
  }, 25 * 60 * 1000);
  
  return () => clearInterval(interval);
}, [isAuthenticated]);
```

**Critérios de Aceitação:**
- [ ] Endpoint `/api/auth/login` criado
- [ ] Endpoint `/api/auth/logout` criado
- [ ] Endpoint `/api/auth/refresh` criado
- [ ] Cookies configurados com httpOnly, secure, sameSite
- [ ] Timeout de 30 minutos
- [ ] localStorage completamente removido
- [ ] Refresh token implementado
- [ ] AuthContext atualizado
- [ ] Todas requisições usam credentials: 'include'
- [ ] Testes de integração
- [ ] Migração sem quebrar usuários existentes

**Teste de Verificação:**
```bash
# Verificar que tokens não estão em localStorage
# Abrir DevTools > Application > Local Storage
# Não deve haver 'userToken' ou 'adminToken'

# Verificar cookies
# DevTools > Application > Cookies
# Deve haver cookies httpOnly
```

---

### Checklist Fase 2

- [ ] **Issue #7:** Cache de tokens implementado
- [ ] **Issue #8:** Bloqueio de conta implementado
- [ ] **Issue #9:** Proteção CSRF implementada
- [ ] **Issue #10:** Tokens migrados para cookies
- [ ] Taxa de cache hit > 70%
- [ ] Bloqueio funcionando após 5 tentativas
- [ ] CSRF protection ativa em todas operações
- [ ] Zero tokens em localStorage
- [ ] Refresh token funcionando
- [ ] Todos os testes passando
- [ ] Deploy em staging
- [ ] Testes de segurança avançados

**Resultado Esperado:** Sistema com proteções robustas de autenticação e segurança

---

## 🟢 FASE 3: MELHORIAS E HARDENING (2 SEMANAS - 8-12 horas)

**Prioridade:** 🟡 ALTA  
**Prazo:** 12-18/11/2025 (5-7 dias)  
**Responsável:** Desenvolvedor Backend + DevOps  
**Objetivo:** Hardening adicional e melhorias de qualidade

### Issue #11: Implementar Middleware de Validação Centralizado

**Severidade:** 🟡 ALTA  
**Categoria:** Validação de Entrada  
**Esforço:** 4-6 horas  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Validação de entrada inconsistente e incompleta em alguns endpoints.

**Passos de Remediação:**

1. **Criar `server/middleware/validation.js`:**
```javascript
const { body, param, query, validationResult } = require('express-validator');

class ValidationMiddleware {
  validate(validations) {
    return async (req, res, next) => {
      await Promise.all(validations.map(validation => validation.run(req)));
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: errors.array()
        });
      }
      
      next();
    };
  }

  // Validações comuns
  userToken() {
    return [
      body('token')
        .isString()
        .isLength({ min: 10, max: 200 })
        .trim()
    ];
  }

  userId() {
    return [
      param('userId')
        .isInt({ min: 1 })
        .toInt()
    ];
  }

  recordData() {
    return [
      body('data')
        .isObject()
        .custom((value) => {
          if (JSON.stringify(value).length > 10000) {
            throw new Error('Data too large');
          }
          return true;
        })
    ];
  }

  pagination() {
    return [
      query('page').optional().isInt({ min: 1 }).toInt(),
      query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
    ];
  }
}

module.exports = new ValidationMiddleware();
```

2. **Aplicar em rotas:**
```javascript
const validation = require('../middleware/validation');

router.post('/users',
  validation.validate([
    body('username').isString().isLength({ min: 3, max: 50 }),
    body('email').isEmail(),
    body('role').isIn(['user', 'admin'])
  ]),
  async (req, res) => {
    // Dados já validados
  }
);
```

**Critérios de Aceitação:**
- [ ] ValidationMiddleware implementado
- [ ] Validação aplicada em todos endpoints POST/PUT/DELETE
- [ ] Validações comuns reutilizáveis
- [ ] Mensagens de erro claras
- [ ] Limites de tamanho implementados
- [ ] Testes unitários

---

### Issue #12: Hardening Docker

**Severidade:** 🟡 ALTA  
**Categoria:** Infraestrutura  
**Esforço:** 2-3 horas  
**Responsável:** DevOps

**Descrição:**  
Container pode rodar como root, expondo privilégios desnecessários.

**Passos de Remediação:**

1. **Modificar `Dockerfile`:**
```dockerfile
FROM node:18-alpine

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --only=production

COPY --chown=nodejs:nodejs . .

# Mudar para usuário não-root
USER nodejs

# Expor porta
EXPOSE 3000

CMD ["node", "server/index.js"]
```

2. **Adicionar security options em `docker-swarm-stack.yml`:**
```yaml
services:
  wuzapi-dashboard:
    image: wuzapi-dashboard:latest
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
```

3. **Remover exposição direta de porta:**
```yaml
# Remover ports: se usando Traefik
# ports:
#   - "3000:3000"

# Usar apenas labels do Traefik
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.wuzapi.rule=Host(`wuzapi.example.com`)"
```

**Critérios de Aceitação:**
- [ ] Container roda como usuário não-root
- [ ] Security options configuradas
- [ ] Capabilities mínimas
- [ ] Filesystem read-only
- [ ] Resource limits definidos
- [ ] Porta não exposta diretamente
- [ ] Testes de deploy

---

### Issue #13: Documentação Completa

**Severidade:** 🟢 MÉDIA  
**Categoria:** Documentação  
**Esforço:** 2-3 horas  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Documentação de variáveis de ambiente incompleta.

**Passos de Remediação:**

1. **Atualizar `.env.example`:**
```bash
# ==============================================
# CONFIGURAÇÃO DE AUTENTICAÇÃO (OBRIGATÓRIO)
# ==============================================

# Token administrativo - DEVE ser gerado com:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# NUNCA use o valor de exemplo em produção!
VITE_ADMIN_TOKEN=your_secure_admin_token_here_64_chars_hex

# ==============================================
# CONFIGURAÇÃO DE BANCO DE DADOS
# ==============================================

# Caminho para banco SQLite
DATABASE_PATH=./server/wuzapi.db

# ==============================================
# CONFIGURAÇÃO DE INTEGRAÇÃO WUZAPI
# ==============================================

# URL base da API WuzAPI
WUZAPI_BASE_URL=http://wuzapi:8080

# Timeout para requisições (ms)
WUZAPI_TIMEOUT=5000

# ==============================================
# CONFIGURAÇÃO DE SERVIDOR
# ==============================================

# Porta do servidor
PORT=3000

# Ambiente (development, production)
NODE_ENV=production

# ==============================================
# CONFIGURAÇÃO DE SEGURANÇA
# ==============================================

# Segredo para sessões (gerar com crypto.randomBytes)
SESSION_SECRET=your_session_secret_here

# Domínio para cookies (produção)
COOKIE_DOMAIN=.example.com

# ==============================================
# CONFIGURAÇÃO DE CORS
# ==============================================

# Origens permitidas (separadas por vírgula)
CORS_ORIGINS=https://wuzapi.example.com,https://admin.example.com

# ==============================================
# CONFIGURAÇÃO DE RATE LIMITING
# ==============================================

# Limite de requisições por minuto (strict)
RATE_LIMIT_STRICT=10

# Limite de requisições por minuto (public)
RATE_LIMIT_PUBLIC=100

# ==============================================
# CONFIGURAÇÃO DE LOGS
# ==============================================

# Nível de log (error, warn, info, debug)
LOG_LEVEL=info

# Diretório de logs
LOG_DIR=./logs

# ==============================================
# CONFIGURAÇÃO DE MONITORAMENTO
# ==============================================

# Habilitar métricas Prometheus
ENABLE_METRICS=true

# Porta para métricas
METRICS_PORT=9090
```

2. **Criar `docs/SECURITY.md`:**
```markdown
# Guia de Segurança - WuzAPI Dashboard

## Configuração Inicial

### 1. Gerar Token Administrativo

NUNCA use tokens de exemplo em produção!

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configurar Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
cp .env.example .env
nano .env
```

### 3. Configurar HTTPS

Em produção, SEMPRE use HTTPS:

- Configure certificados SSL/TLS
- Use Traefik ou nginx como reverse proxy
- Force redirecionamento HTTP -> HTTPS

## Melhores Práticas

### Autenticação

- ✅ Tokens devem ter 64+ caracteres
- ✅ Rotacione tokens regularmente (a cada 90 dias)
- ✅ Use tokens diferentes por ambiente
- ❌ NUNCA commite tokens no Git
- ❌ NUNCA compartilhe tokens por email/chat

### Banco de Dados

- ✅ Backups diários automáticos
- ✅ Criptografia em repouso
- ✅ Acesso restrito ao arquivo .db
- ❌ NUNCA exponha porta do banco

### Monitoramento

- ✅ Configure alertas para falhas de autenticação
- ✅ Monitore rate limit violations
- ✅ Revise logs de segurança diariamente
- ✅ Configure alertas de downtime

## Resposta a Incidentes

### Token Comprometido

1. Gere novo token imediatamente
2. Atualize em todos os ambientes
3. Revise logs de acesso
4. Notifique equipe de segurança
5. Investigue origem do vazamento

### Ataque Detectado

1. Identifique IPs atacantes
2. Bloqueie IPs no firewall
3. Revise logs completos
4. Verifique integridade dos dados
5. Documente incidente

## Auditoria de Segurança

Execute auditoria mensal:

```bash
# Verificar vulnerabilidades
npm audit

# Verificar tokens hardcoded
grep -r "UeH7cZ2c1K3zVUBFi7SginSC" .

# Verificar configurações
./scripts/security-audit-quick.sh
```

## Contatos de Segurança

- Equipe de Segurança: security@example.com
- Emergências: +55 11 9999-9999
- Slack: #security-incidents
```

3. **Criar `docs/RUNBOOK.md`:**
```markdown
# Runbook Operacional - WuzAPI Dashboard

## Procedimentos de Deploy

### Deploy em Produção

1. Executar testes
2. Build de produção
3. Backup do banco
4. Deploy com zero downtime
5. Verificar health checks
6. Monitorar logs por 30 minutos

### Rollback

1. Identificar versão anterior
2. Executar rollback do Docker
3. Restaurar backup do banco (se necessário)
4. Verificar funcionalidade
5. Documentar causa

## Troubleshooting

### Aplicação Não Inicia

- Verificar variáveis de ambiente
- Verificar logs: `docker logs wuzapi-dashboard`
- Verificar conectividade com WuzAPI
- Verificar permissões do banco

### Alta Latência

- Verificar cache hit rate
- Verificar conexões com WuzAPI
- Verificar resource limits
- Verificar logs de erro

### Rate Limit Violations

- Identificar IPs atacantes
- Revisar padrões de acesso
- Ajustar limites se necessário
- Bloquear IPs maliciosos

## Manutenção

### Backup Diário

```bash
# Backup automático
0 2 * * * /app/scripts/backup-database.sh
```

### Rotação de Logs

```bash
# Rotacionar logs semanalmente
0 0 * * 0 /app/scripts/rotate-logs.sh
```

### Atualização de Dependências

```bash
# Mensal
npm audit
npm update
npm test
```
```

**Critérios de Aceitação:**
- [ ] .env.example completo e documentado
- [ ] docs/SECURITY.md criado
- [ ] docs/RUNBOOK.md criado
- [ ] Todas variáveis documentadas
- [ ] Exemplos de valores fornecidos
- [ ] Procedimentos de emergência documentados

---

### Issue #14: Implementar Content Security Policy

**Severidade:** 🟢 MÉDIA  
**Categoria:** Segurança Frontend  
**Esforço:** 2-3 horas  
**Responsável:** Desenvolvedor Backend

**Descrição:**  
Sem Content Security Policy configurado, permitindo carregamento de recursos não confiáveis.

**Passos de Remediação:**

1. **Instalar helmet:**
```bash
cd server
npm install helmet
```

2. **Configurar CSP (`server/index.js`):**
```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Remover unsafe-inline gradualmente
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.WUZAPI_BASE_URL],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));
```

**Critérios de Aceitação:**
- [ ] Helmet instalado e configurado
- [ ] CSP implementado
- [ ] HSTS configurado
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Aplicação funciona com CSP
- [ ] Testes de compatibilidade

---

### Checklist Fase 3

- [ ] **Issue #11:** Middleware de validação implementado
- [ ] **Issue #12:** Docker hardening completo
- [ ] **Issue #13:** Documentação completa
- [ ] **Issue #14:** CSP implementado
- [ ] Validação em 100% dos endpoints
- [ ] Container rodando como não-root
- [ ] Documentação revisada e aprovada
- [ ] Security headers configurados
- [ ] Todos os testes passando
- [ ] Deploy em produção
- [ ] Monitoramento ativo

**Resultado Esperado:** Sistema production-ready com todas as best practices implementadas

---

## 📅 CRONOGRAMA DETALHADO

### Semana 1: 07-11 Novembro 2025

| Dia | Fase | Atividades | Responsável | Horas | Status |
|-----|------|------------|-------------|-------|--------|
| **07/11 (Qui)** | Fase 1 | Issues #1-#6 | Backend + Frontend | 4-5h | 🔴 Pendente |
| | | - Atualizar Axios | Frontend | 0.5h | |
| | | - Remover tokens hardcoded | Backend + Frontend | 2h | |
| | | - Gerar novo token | DevOps | 0.5h | |
| | | - Aplicar rate limiting | Backend | 2h | |
| | | - Testes e validação | QA | 1h | |
| **08/11 (Sex)** | Fase 2 | Issues #7-#8 | Backend | 6-8h | 🟡 Pendente |
| | | - Implementar cache de tokens | Backend | 3-4h | |
| | | - Implementar bloqueio de conta | Backend | 3-4h | |
| | | - Testes unitários | Backend | 1h | |
| **09/11 (Sáb)** | - | Revisão e testes | QA | 2h | 🟡 Pendente |
| **10/11 (Dom)** | - | Buffer / Contingência | - | - | |

### Semana 2: 11-15 Novembro 2025

| Dia | Fase | Atividades | Responsável | Horas | Status |
|-----|------|------------|-------------|-------|--------|
| **11/11 (Seg)** | Fase 2 | Issue #9 | Backend + Frontend | 4-6h | 🟡 Pendente |
| | | - Implementar proteção CSRF | Backend + Frontend | 4-6h | |
| **12/11 (Ter)** | Fase 2 | Issue #10 (Parte 1) | Backend | 4h | 🟡 Pendente |
| | | - Criar endpoints de auth | Backend | 2h | |
| | | - Configurar cookies | Backend | 2h | |
| **13/11 (Qua)** | Fase 2 | Issue #10 (Parte 2) | Frontend | 4h | 🟡 Pendente |
| | | - Modificar AuthContext | Frontend | 2h | |
| | | - Implementar refresh token | Frontend | 2h | |
| **14/11 (Qui)** | Fase 2 | Testes e Deploy Staging | QA + DevOps | 4h | 🟡 Pendente |
| | | - Testes de integração | QA | 2h | |
| | | - Deploy em staging | DevOps | 1h | |
| | | - Testes de segurança | QA | 1h | |
| **15/11 (Sex)** | - | Revisão Fase 2 | Todos | 2h | 🟡 Pendente |

### Semana 3: 18-22 Novembro 2025

| Dia | Fase | Atividades | Responsável | Horas | Status |
|-----|------|------------|-------------|-------|--------|
| **18/11 (Seg)** | Fase 3 | Issues #11-#12 | Backend + DevOps | 6-9h | 🟢 Pendente |
| | | - Middleware de validação | Backend | 4-6h | |
| | | - Docker hardening | DevOps | 2-3h | |
| **19/11 (Ter)** | Fase 3 | Issues #13-#14 | Backend | 4-6h | 🟢 Pendente |
| | | - Documentação completa | Backend | 2-3h | |
| | | - Implementar CSP | Backend | 2-3h | |
| **20/11 (Qua)** | Validação | Auditoria Final | QA + Security | 4h | 🟢 Pendente |
| | | - Executar testes de segurança | Security | 2h | |
| | | - Verificar todas correções | QA | 2h | |
| **21/11 (Qui)** | Deploy | Deploy em Produção | DevOps | 4h | 🟢 Pendente |
| | | - Deploy final | DevOps | 2h | |
| | | - Monitoramento intensivo | DevOps | 2h | |
| **22/11 (Sex)** | Pós-Deploy | Validação e Documentação | Todos | 2h | 🟢 Pendente |

---

## 👥 MATRIZ DE RESPONSABILIDADES (RACI)

| Atividade | Desenvolvedor Backend | Desenvolvedor Frontend | DevOps | QA | Security |
|-----------|----------------------|----------------------|--------|-----|----------|
| **Fase 1** |
| Atualizar Axios | I | R/A | I | C | I |
| Remover tokens hardcoded (backend) | R/A | I | I | C | C |
| Remover tokens hardcoded (frontend) | I | R/A | I | C | C |
| Gerar novo token | C | C | R/A | I | C |
| Aplicar rate limiting | R/A | I | I | C | C |
| **Fase 2** |
| Cache de tokens | R/A | I | I | C | C |
| Bloqueio de conta | R/A | I | I | C | C |
| Proteção CSRF | R/A | R/A | I | C | C |
| Migrar para cookies | R/A | R/A | I | C | C |
| **Fase 3** |
| Middleware validação | R/A | I | I | C | C |
| Docker hardening | C | I | R/A | C | C |
| Documentação | R/A | C | C | I | C |
| CSP | R/A | C | I | C | C |
| **Deploy** |
| Deploy staging | C | C | R/A | C | I |
| Testes segurança | C | C | C | R/A | R/A |
| Deploy produção | C | C | R/A | C | C |

**Legenda:**
- **R** (Responsible): Executa a tarefa
- **A** (Accountable): Responsável final / Aprovador
- **C** (Consulted): Consultado / Fornece input
- **I** (Informed): Informado sobre progresso

---

## 🎯 CRITÉRIOS DE ACEITAÇÃO POR FASE

### Fase 1: Aprovação para Deploy Inicial

**Bloqueadores (DEVE estar completo):**
- [ ] Zero vulnerabilidades CRITICAL em `npm audit`
- [ ] Zero tokens hardcoded no código
- [ ] Novo token admin gerado e rotacionado
- [ ] Rate limiting ativo em 100% das rotas de auth
- [ ] Todos os testes unitários passando
- [ ] Build de produção bem-sucedido

**Verificação:**
```bash
# Executar checklist de validação
./scripts/validate-phase1.sh

# Deve retornar: ✅ PHASE 1 COMPLETE - READY FOR INITIAL DEPLOY
```

**Aprovadores:** Tech Lead + Security Lead

---

### Fase 2: Aprovação para Produção Completa

**Bloqueadores (DEVE estar completo):**
- [ ] Cache de tokens implementado (hit rate > 70%)
- [ ] Bloqueio de conta funcionando (5 tentativas)
- [ ] Proteção CSRF ativa em todas operações
- [ ] Tokens em httpOnly cookies (zero em localStorage)
- [ ] Refresh token implementado e testado
- [ ] Testes de integração passando
- [ ] Testes de segurança avançados passando
- [ ] Deploy em staging bem-sucedido

**Verificação:**
```bash
# Executar checklist de validação
./scripts/validate-phase2.sh

# Deve retornar: ✅ PHASE 2 COMPLETE - READY FOR PRODUCTION
```

**Aprovadores:** Tech Lead + Security Lead + Product Owner

---

### Fase 3: Certificação Production-Ready

**Bloqueadores (DEVE estar completo):**
- [ ] Validação em 100% dos endpoints POST/PUT/DELETE
- [ ] Docker rodando como usuário não-root
- [ ] Documentação completa e revisada
- [ ] CSP implementado e testado
- [ ] Security headers configurados
- [ ] Auditoria de segurança final aprovada
- [ ] Runbooks criados e testados
- [ ] Monitoramento ativo e alertas configurados

**Verificação:**
```bash
# Executar auditoria completa
./scripts/security-audit-full.sh

# Deve retornar: ✅ PRODUCTION-READY CERTIFIED
```

**Aprovadores:** Tech Lead + Security Lead + CTO

---

## 📊 MÉTRICAS DE SUCESSO

### Métricas de Segurança

| Métrica | Baseline | Meta Fase 1 | Meta Fase 2 | Meta Fase 3 |
|---------|----------|-------------|-------------|-------------|
| Vulnerabilidades CRITICAL | 6 | 0 | 0 | 0 |
| Vulnerabilidades HIGH | 8 | 4 | 0 | 0 |
| Vulnerabilidades MEDIUM | 3 | 3 | 2 | 0 |
| Tokens hardcoded | 6 | 0 | 0 | 0 |
| Rotas sem rate limiting | 14 | 0 | 0 | 0 |
| Endpoints sem validação | 8 | 8 | 4 | 0 |

### Métricas de Performance

| Métrica | Baseline | Meta Fase 2 | Meta Fase 3 |
|---------|----------|-------------|-------------|
| Latência média (auth) | 200-500ms | < 50ms | < 30ms |
| Cache hit rate | 0% | > 70% | > 85% |
| Chamadas WuzAPI/min | 100 | < 30 | < 15 |
| Tempo de resposta P95 | 800ms | < 200ms | < 150ms |

### Métricas de Qualidade

| Métrica | Baseline | Meta Fase 3 |
|---------|----------|-------------|
| Cobertura de testes | 45% | > 70% |
| Documentação completa | 60% | 100% |
| Security headers | 2/7 | 7/7 |
| OWASP Top 10 coverage | 6/10 | 10/10 |

---

## 🔄 PROCEDIMENTOS DE AUDITORIA CONTÍNUA

### Auditoria Semanal (Automatizada)

**Frequência:** Toda segunda-feira, 09:00  
**Duração:** 15 minutos  
**Responsável:** CI/CD Pipeline

**Checklist:**
```bash
#!/bin/bash
# scripts/weekly-audit.sh

echo "🔍 Executando auditoria semanal..."

# 1. Verificar vulnerabilidades
npm audit --production
if [ $? -ne 0 ]; then
  echo "❌ Vulnerabilidades encontradas"
  exit 1
fi

# 2. Verificar tokens hardcoded
if grep -r "UeH7cZ2c1K3zVUBFi7SginSC" . 2>/dev/null; then
  echo "❌ Token hardcoded encontrado"
  exit 1
fi

# 3. Verificar configurações de segurança
./scripts/check-security-config.sh

# 4. Verificar logs de segurança
./scripts/analyze-security-logs.sh

# 5. Gerar relatório
./scripts/generate-audit-report.sh

echo "✅ Auditoria semanal completa"
```

**Ações em caso de falha:**
1. Notificar equipe de segurança via Slack
2. Criar issue automático no GitHub
3. Bloquear deploy até resolução

---

### Auditoria Mensal (Manual)

**Frequência:** Primeira sexta-feira do mês  
**Duração:** 4 horas  
**Responsável:** Security Lead + Tech Lead

**Checklist:**
- [ ] Revisar logs de segurança do mês
- [ ] Analisar tentativas de autenticação falhadas
- [ ] Revisar rate limit violations
- [ ] Verificar atualizações de dependências
- [ ] Executar testes de penetração básicos
- [ ] Revisar configurações de produção
- [ ] Atualizar documentação de segurança
- [ ] Rotacionar tokens (se necessário)
- [ ] Revisar permissões e acessos
- [ ] Gerar relatório mensal

**Deliverables:**
- Relatório de auditoria mensal
- Lista de ações corretivas
- Atualização de runbooks (se necessário)

---

### Auditoria Trimestral (Completa)

**Frequência:** A cada 3 meses  
**Duração:** 2 dias  
**Responsável:** Security Team + External Auditor

**Escopo:**
- Auditoria completa de código
- Testes de penetração avançados
- Revisão de arquitetura de segurança
- Análise de compliance (LGPD, OWASP)
- Revisão de processos operacionais
- Treinamento de equipe

**Deliverables:**
- Relatório de auditoria completo
- Plano de remediação atualizado
- Certificação de segurança
- Recomendações de melhorias

---

## 🚨 PLANO DE RESPOSTA A INCIDENTES

### Classificação de Incidentes

| Severidade | Descrição | Tempo de Resposta | Escalação |
|------------|-----------|-------------------|-----------|
| **P0 - Crítico** | Sistema comprometido, dados expostos | Imediato | CTO + Security Lead |
| **P1 - Alto** | Vulnerabilidade ativa, tentativa de ataque | 1 hora | Security Lead + Tech Lead |
| **P2 - Médio** | Vulnerabilidade descoberta, sem exploração | 4 horas | Tech Lead |
| **P3 - Baixo** | Problema de configuração, sem risco imediato | 24 horas | Desenvolvedor |

### Procedimento P0 - Crítico

**Detecção:**
- Alerta de monitoramento
- Relatório de usuário
- Descoberta interna

**Resposta Imediata (0-15 min):**
1. ✅ Confirmar incidente
2. ✅ Notificar CTO e Security Lead
3. ✅ Ativar war room (Slack #incident-response)
4. ✅ Avaliar escopo do comprometimento

**Contenção (15-60 min):**
1. ✅ Isolar sistema afetado
2. ✅ Bloquear IPs atacantes
3. ✅ Rotacionar credenciais comprometidas
4. ✅ Ativar modo de manutenção (se necessário)

**Erradicação (1-4 horas):**
1. ✅ Identificar causa raiz
2. ✅ Aplicar correção
3. ✅ Verificar integridade dos dados
4. ✅ Executar testes de segurança

**Recuperação (4-8 horas):**
1. ✅ Restaurar serviço
2. ✅ Monitorar intensivamente
3. ✅ Validar correção
4. ✅ Comunicar stakeholders

**Pós-Incidente (24-48 horas):**
1. ✅ Documentar incidente completo
2. ✅ Realizar post-mortem
3. ✅ Atualizar runbooks
4. ✅ Implementar melhorias preventivas
5. ✅ Treinar equipe

---

## 📞 CONTATOS E ESCALAÇÃO

### Equipe Principal

| Papel | Nome | Email | Telefone | Slack |
|-------|------|-------|----------|-------|
| Tech Lead | [Nome] | tech.lead@example.com | +55 11 9999-0001 | @tech-lead |
| Security Lead | [Nome] | security@example.com | +55 11 9999-0002 | @security-lead |
| DevOps Lead | [Nome] | devops@example.com | +55 11 9999-0003 | @devops-lead |
| Product Owner | [Nome] | product@example.com | +55 11 9999-0004 | @product-owner |
| CTO | [Nome] | cto@example.com | +55 11 9999-0005 | @cto |

### Canais de Comunicação

- **Emergências P0:** Slack #incident-response + Ligação telefônica
- **Incidentes P1:** Slack #security-alerts
- **Atualizações:** Slack #security-updates
- **Discussões:** Slack #security-general

### Escalação

```
P3 (Baixo) → Desenvolvedor
    ↓ (não resolvido em 24h)
P2 (Médio) → Tech Lead
    ↓ (não resolvido em 4h)
P1 (Alto) → Security Lead + Tech Lead
    ↓ (não resolvido em 1h ou agravamento)
P0 (Crítico) → CTO + Security Lead + Tech Lead
```

---

## 📝 DOCUMENTAÇÃO E RASTREABILIDADE

### Issues no GitHub

Cada problema identificado deve ter uma issue correspondente:

**Template de Issue:**
```markdown
## 🔴 [SECURITY] Título do Problema

**Severidade:** Crítica / Alta / Média / Baixa  
**Categoria:** Autenticação / Validação / Configuração / etc  
**Fase:** 1 / 2 / 3

### Descrição
[Descrição detalhada do problema]

### Impacto
[Impacto em segurança, performance, usuários]

### Localização
- Arquivo: `path/to/file.js`
- Linha: 123
- Função: `functionName()`

### Passos de Remediação
- [ ] Passo 1
- [ ] Passo 2
- [ ] Passo 3

### Critérios de Aceitação
- [ ] Critério 1
- [ ] Critério 2

### Teste de Verificação
```bash
# Comando para verificar correção
```

### Referências
- Requisito: 1.1
- Documento: COMPREHENSIVE-AUDIT-REPORT.md
- CVE: CVE-2024-XXXX (se aplicável)

### Estimativa
**Esforço:** X horas  
**Prazo:** DD/MM/YYYY

### Responsável
@username
```

### Labels Obrigatórias

- `security` - Problema de segurança
- `critical` / `high` / `medium` / `low` - Severidade
- `phase-1` / `phase-2` / `phase-3` - Fase do plano
- `authentication` / `validation` / `configuration` / etc - Categoria
- `blocked` - Bloqueador de produção

### Rastreamento de Progresso

**Dashboard de Issues:**
- Total de issues: 14
- Fase 1 (Crítico): 6 issues
- Fase 2 (Alto): 4 issues
- Fase 3 (Médio): 4 issues

**Progresso:**
```
Fase 1: ⬜⬜⬜⬜⬜⬜ 0/6 (0%)
Fase 2: ⬜⬜⬜⬜ 0/4 (0%)
Fase 3: ⬜⬜⬜⬜ 0/4 (0%)
```

---

## ✅ CHECKLIST FINAL DE APROVAÇÃO

### Antes de Deploy em Produção

**Segurança:**
- [ ] Todas vulnerabilidades CRITICAL corrigidas
- [ ] Todas vulnerabilidades HIGH corrigidas
- [ ] Tokens hardcoded removidos
- [ ] Novo token admin gerado e rotacionado
- [ ] Rate limiting aplicado em todas rotas
- [ ] Proteção CSRF implementada
- [ ] Tokens em httpOnly cookies
- [ ] Security headers configurados
- [ ] CSP implementado

**Testes:**
- [ ] Todos testes unitários passando
- [ ] Todos testes de integração passando
- [ ] Testes de segurança passando
- [ ] Testes de performance passando
- [ ] Testes de carga executados

**Infraestrutura:**
- [ ] Docker hardening completo
- [ ] Resource limits configurados
- [ ] Health checks funcionando
- [ ] Monitoramento ativo
- [ ] Alertas configurados
- [ ] Backups automáticos configurados

**Documentação:**
- [ ] .env.example atualizado
- [ ] docs/SECURITY.md criado
- [ ] docs/RUNBOOK.md criado
- [ ] Procedimentos de emergência documentados
- [ ] Contatos atualizados

**Operacional:**
- [ ] Deploy em staging bem-sucedido
- [ ] Validação de stakeholders
- [ ] Plano de rollback testado
- [ ] Equipe treinada
- [ ] Comunicação preparada

**Aprovações:**
- [ ] Tech Lead: _________________ Data: _______
- [ ] Security Lead: _____________ Data: _______
- [ ] Product Owner: _____________ Data: _______
- [ ] CTO: ______________________ Data: _______

---

## 📈 RELATÓRIOS E COMUNICAÇÃO

### Relatório Diário (Durante Implementação)

**Para:** Tech Lead, Security Lead  
**Formato:** Slack #security-updates  
**Conteúdo:**
- Issues completadas hoje
- Issues em progresso
- Bloqueadores identificados
- Próximas atividades

### Relatório Semanal

**Para:** Tech Lead, Product Owner, CTO  
**Formato:** Email + Documento  
**Conteúdo:**
- Progresso geral (% completo)
- Issues completadas na semana
- Métricas de segurança
- Riscos e mitigações
- Próximos marcos

### Relatório Final

**Para:** Todos stakeholders  
**Formato:** Apresentação + Documento  
**Conteúdo:**
- Resumo executivo
- Todas correções implementadas
- Métricas antes/depois
- Lições aprendidas
- Recomendações futuras
- Certificação de produção

---

## 🎓 LIÇÕES APRENDIDAS E MELHORIAS FUTURAS

### Para Prevenir Problemas Similares

1. **Implementar Security Linting no CI/CD**
   - Bloquear commits com tokens hardcoded
   - Executar npm audit em cada PR
   - Validar configurações de segurança

2. **Code Review Obrigatório**
   - Checklist de segurança em cada PR
   - Aprovação de Security Lead para mudanças críticas
   - Pair programming para features de autenticação

3. **Treinamento Contínuo**
   - Workshop mensal de segurança
   - Certificações OWASP para equipe
   - Simulações de incidentes

4. **Automação de Segurança**
   - Testes de segurança automatizados
   - Rotação automática de tokens
   - Alertas proativos de vulnerabilidades

### Roadmap de Segurança (Próximos 6 Meses)

**Q1 2026:**
- [ ] Implementar autenticação multi-fator (MFA)
- [ ] Migrar para OAuth 2.0 / OpenID Connect
- [ ] Implementar audit log completo
- [ ] Certificação ISO 27001

**Q2 2026:**
- [ ] Implementar WAF (Web Application Firewall)
- [ ] Penetration testing por empresa externa
- [ ] Implementar SIEM (Security Information and Event Management)
- [ ] Bug bounty program

---

## 📋 RESUMO EXECUTIVO

### Investimento Total

| Categoria | Horas | Custo* | % Total |
|-----------|-------|--------|---------|
| Desenvolvimento | 24-32h | R$ 4.800-6.400 | 80% |
| QA/Testes | 4-6h | R$ 800-1.200 | 13% |
| DevOps | 2-3h | R$ 400-600 | 7% |
| **TOTAL** | **30-41h** | **R$ 6.000-8.200** | **100%** |

*Baseado em R$ 200/hora

### ROI Esperado

**Riscos Evitados:**
- Vazamento de dados (LGPD): R$ 50.000 - R$ 500.000
- Downtime por ataque: R$ 10.000 - R$ 100.000/dia
- Comprometimento de contas: R$ 20.000 - R$ 200.000
- Perda de reputação: Incalculável

**ROI:** 900% - 1.200%

### Timeline

- **Início:** 07/11/2025 (Hoje)
- **Fase 1 Completa:** 07/11/2025 (1 dia)
- **Fase 2 Completa:** 14/11/2025 (1 semana)
- **Fase 3 Completa:** 19/11/2025 (2 semanas)
- **Deploy Produção:** 21/11/2025 (2 semanas)

### Recomendação Final

✅ **APROVAR** plano de remediação e iniciar **IMEDIATAMENTE**

O investimento de R$ 6.000-8.200 e 2 semanas de trabalho é **CRÍTICO** e **ALTAMENTE JUSTIFICADO** para:
1. Eliminar 6 vulnerabilidades críticas
2. Implementar proteções essenciais
3. Preparar sistema para produção
4. Evitar perdas potenciais de R$ 80.000+

---

**Documento Criado:** 07/11/2025  
**Última Atualização:** 07/11/2025  
**Versão:** 1.0  
**Status:** 🔴 AGUARDANDO APROVAÇÃO E INÍCIO

---

*Fim do Plano de Remediação e Cronograma*
