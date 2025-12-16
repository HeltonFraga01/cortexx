# Guia Rápido de Implementação - Correções de Segurança

**Tempo Estimado:** 4-6 horas  
**Dificuldade:** Média  
**Impacto:** Alto

---

## 🚀 Início Rápido

### Passo 1: Preparação (5 minutos)

```bash
# Criar branch de desenvolvimento
git checkout -b feature/auth-security-fixes

# Fazer backup
git add .
git commit -m "backup: antes das correções de segurança"

# Verificar que servidor está rodando
npm run dev
```

---

## 📝 Passo 2: Criar Novos Arquivos (30 minutos)

### 2.1 Criar Cache de Tokens

```bash
# Criar arquivo
touch server/utils/tokenCache.js
```

Copiar código completo de `CORRECOES-CRITICAS-AUTH-PT.md` seção "Correção 2" → `server/utils/tokenCache.js`

**Verificar:**
```bash
# Testar sintaxe
node -c server/utils/tokenCache.js
```

---

### 2.2 Criar Proteção de Autenticação

```bash
# Criar arquivo
touch server/middleware/authenticationProtection.js
```

Copiar código completo de `CORRECOES-CRITICAS-AUTH-PT.md` seção "Correção 3" → `server/middleware/authenticationProtection.js`

**Verificar:**
```bash
# Testar sintaxe
node -c server/middleware/authenticationProtection.js
```

---

## 🔧 Passo 3: Modificar Arquivos Existentes (90 minutos)

### 3.1 Modificar sessionValidator.js

**Arquivo:** `server/validators/sessionValidator.js`

**Adicionar no topo:**
```javascript
const tokenCache = require('../utils/tokenCache');
```

**Modificar método `validateUserToken`:**
- Adicionar verificação de cache no início
- Adicionar armazenamento em cache antes do return
- Ver código completo em `CORRECOES-CRITICAS-AUTH-PT.md`

**Verificar:**
```bash
node -c server/validators/sessionValidator.js
```

---

### 3.2 Modificar adminValidator.js

**Arquivo:** `server/validators/adminValidator.js`

**Adicionar no topo:**
```javascript
const tokenCache = require('../utils/tokenCache');
```

**Modificar método `validateAdminToken`:**
- Adicionar verificação de cache no início
- Adicionar armazenamento em cache antes do return

**Verificar:**
```bash
node -c server/validators/adminValidator.js
```

---

### 3.3 Modificar sessionRoutes.js

**Arquivo:** `server/routes/sessionRoutes.js`

**Adicionar no topo:**
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');
const authProtection = require('../middleware/authenticationProtection');
const tokenCache = require('../utils/tokenCache');
```

**Modificar TODOS os endpoints:**

```javascript
// ANTES
router.get('/status', 
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

// DEPOIS
router.get('/status', 
  strictRateLimiter,                          // NOVO
  authProtection.checkLockoutMiddleware(),    // NOVO
  errorHandler.validateTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);
```

**Aplicar a:**
- `/status`
- `/connect`
- `/disconnect`
- `/logout`
- `/qr`

**No endpoint `/logout`, adicionar:**
```javascript
router.post('/logout',
  strictRateLimiter,
  authProtection.checkLockoutMiddleware(),
  errorHandler.validateTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    try {
      const token = req.headers.token;
      
      // ADICIONAR ESTA LINHA
      tokenCache.invalidate(token);
      
      // ... resto do código
    }
  }
);
```

**Dentro do handler de `/status`, adicionar rastreamento:**
```javascript
if (validationResult.isValid) {
  // ADICIONAR
  authProtection.clearFailedAttempts(req.ip);
  
  // ... resto do código
} else {
  // ADICIONAR
  authProtection.trackFailedAttempt(req.ip);
  
  // ... resto do código
}
```

**Verificar:**
```bash
node -c server/routes/sessionRoutes.js
```

---

### 3.4 Modificar adminRoutes.js

**Arquivo:** `server/routes/adminRoutes.js`

**Adicionar no topo:**
```javascript
const { strictRateLimiter } = require('../middleware/rateLimiter');
const authProtection = require('../middleware/authenticationProtection');
```

**Modificar TODOS os endpoints admin:**

```javascript
// ANTES
router.get('/users',
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);

// DEPOIS
router.get('/users',
  strictRateLimiter,                          // NOVO
  authProtection.checkLockoutMiddleware(),    // NOVO
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => { ... }
);
```

**Aplicar a:**
- `GET /users`
- `GET /stats`
- `GET /users/:userId`
- `POST /users`
- `DELETE /users/:userId`
- `DELETE /users/:userId/full`

**Adicionar rastreamento de tentativas:**
```javascript
if (validationResult.isValid) {
  // ADICIONAR
  authProtection.clearFailedAttempts(req.ip);
  
  // ... resto do código
} else {
  // ADICIONAR
  authProtection.trackFailedAttempt(req.ip);
  
  // ... resto do código
}
```

**Verificar:**
```bash
node -c server/routes/adminRoutes.js
```

---

## ✅ Passo 4: Testar Implementação (60 minutos)

### 4.1 Teste de Sintaxe

```bash
# Testar todos os arquivos modificados
node -c server/utils/tokenCache.js
node -c server/middleware/authenticationProtection.js
node -c server/validators/sessionValidator.js
node -c server/validators/adminValidator.js
node -c server/routes/sessionRoutes.js
node -c server/routes/adminRoutes.js

# Se todos passarem, continuar
```

---

### 4.2 Iniciar Servidor

```bash
# Parar servidor se estiver rodando
# Ctrl+C

# Iniciar novamente
npm run dev

# Verificar logs - não deve ter erros
```

---

### 4.3 Teste Manual - Rate Limiting

**Terminal 1:**
```bash
# Fazer 15 requisições rápidas
for i in {1..15}; do
  echo "Requisição $i:"
  curl -s -H "token: test-token" http://localhost:3000/api/session/status | jq '.error'
  sleep 0.5
done
```

**Resultado Esperado:**
- Primeiras 10 requisições: resposta normal (400 ou 401)
- Requisições 11-15: `"Too Many Requests"`

✅ **PASSOU** se viu "Too Many Requests"  
❌ **FALHOU** se todas as 15 passaram

---

### 4.4 Teste Manual - Cache de Token

**Terminal 1:**
```bash
# Primeira requisição (cache miss)
echo "Primeira requisição (cache miss):"
time curl -H "token: seu-token-valido" http://localhost:3000/api/session/status

# Aguardar 2 segundos
sleep 2

# Segunda requisição (cache hit)
echo "Segunda requisição (cache hit):"
time curl -H "token: seu-token-valido" http://localhost:3000/api/session/status
```

**Terminal 2 (logs do servidor):**
```bash
# Procurar por:
# "cache_hit: false" na primeira requisição
# "cache_hit: true" na segunda requisição
```

✅ **PASSOU** se segunda requisição foi mais rápida e logs mostram cache hit  
❌ **FALHOU** se ambas têm mesma velocidade

---

### 4.5 Teste Manual - Bloqueio de Conta

**Terminal 1:**
```bash
# Fazer 6 tentativas falhadas
for i in {1..6}; do
  echo "Tentativa $i:"
  curl -s -H "token: token-invalido-123" http://localhost:3000/api/session/status | jq '.error, .code'
  sleep 1
done
```

**Resultado Esperado:**
- Tentativas 1-5: `"Token inválido"` ou similar
- Tentativa 6: `"Muitas Tentativas Falhadas"` e `"ACCOUNT_LOCKED"`

✅ **PASSOU** se 6ª tentativa retornou ACCOUNT_LOCKED  
❌ **FALHOU** se todas as 6 retornaram erro normal

---

### 4.6 Teste Manual - Logout Invalida Cache

**Terminal 1:**
```bash
# 1. Fazer login (validar token)
curl -H "token: seu-token-valido" http://localhost:3000/api/session/status

# 2. Fazer logout
curl -X POST -H "token: seu-token-valido" http://localhost:3000/api/session/logout

# 3. Tentar usar token novamente (deve chamar WuzAPI, não cache)
curl -H "token: seu-token-valido" http://localhost:3000/api/session/status
```

**Terminal 2 (logs):**
```bash
# Procurar por "Token invalidado do cache" após logout
```

✅ **PASSOU** se viu mensagem de invalidação  
❌ **FALHOU** se não viu mensagem

---

## 📊 Passo 5: Verificar Logs (15 minutos)

### 5.1 Verificar Logs de Cache

```bash
# Procurar por mensagens de cache
grep "cache_hit" logs/app.log | tail -20
grep "Token cacheado" logs/app.log | tail -20
```

**Esperado:**
- Ver mensagens de cache hit e miss
- Taxa de hit deve aumentar com o tempo

---

### 5.2 Verificar Logs de Rate Limiting

```bash
# Procurar por violações de rate limit
grep "Rate limit" logs/app.log | tail -20
```

**Esperado:**
- Ver mensagens quando limite é excedido

---

### 5.3 Verificar Logs de Bloqueio

```bash
# Procurar por bloqueios de conta
grep "bloqueado" logs/app.log | tail -20
grep "ACCOUNT_LOCKED" logs/app.log | tail -20
```

**Esperado:**
- Ver mensagens de bloqueio após 5 tentativas falhadas

---

## 🎯 Passo 6: Commit e Deploy (15 minutos)

### 6.1 Commit das Mudanças

```bash
# Adicionar arquivos novos
git add server/utils/tokenCache.js
git add server/middleware/authenticationProtection.js

# Adicionar arquivos modificados
git add server/validators/sessionValidator.js
git add server/validators/adminValidator.js
git add server/routes/sessionRoutes.js
git add server/routes/adminRoutes.js

# Commit
git commit -m "feat: implementar correções críticas de segurança

- Adicionar rate limiting (10 req/min) em endpoints de auth
- Implementar cache de token (TTL 5 min)
- Adicionar bloqueio de conta após 5 tentativas falhadas
- Invalidar cache no logout

Refs: auditoria de segurança 2025-11-07"
```

---

### 6.2 Merge para Main

```bash
# Voltar para main
git checkout main

# Merge
git merge feature/auth-security-fixes

# Push
git push origin main
```

---

### 6.3 Deploy para Staging

```bash
# Deploy para staging (ajustar comando conforme seu setup)
npm run deploy:staging

# OU
docker-compose -f docker-compose.staging.yml up -d --build
```

---

### 6.4 Monitorar por 24 Horas

**Métricas para Acompanhar:**

1. **Taxa de Acerto do Cache**
   ```bash
   # Contar cache hits vs misses
   grep "cache_hit: true" logs/app.log | wc -l
   grep "cache_hit: false" logs/app.log | wc -l
   
   # Meta: > 70% de hits
   ```

2. **Violações de Rate Limit**
   ```bash
   # Contar violações
   grep "Rate limit excedido" logs/app.log | wc -l
   
   # Investigar IPs com muitas violações
   grep "Rate limit excedido" logs/app.log | grep -o "ip: [^,]*" | sort | uniq -c | sort -rn
   ```

3. **Bloqueios de Conta**
   ```bash
   # Contar bloqueios
   grep "Conta bloqueada" logs/app.log | wc -l
   
   # Ver IPs bloqueados
   grep "Conta bloqueada" logs/app.log | grep -o "identifier: [^,]*"
   ```

4. **Tempo de Resposta**
   ```bash
   # Verificar se melhorou com cache
   grep "response_time_ms" logs/app.log | tail -100
   
   # Meta: < 150ms em média
   ```

---

## 🚨 Troubleshooting

### Problema: Servidor não inicia

**Erro:** `Cannot find module './tokenCache'`

**Solução:**
```bash
# Verificar se arquivo existe
ls -la server/utils/tokenCache.js

# Verificar sintaxe
node -c server/utils/tokenCache.js
```

---

### Problema: Rate limiting não funciona

**Sintoma:** Consegue fazer mais de 10 requisições

**Solução:**
```bash
# Verificar se middleware está aplicado
grep "strictRateLimiter" server/routes/sessionRoutes.js

# Verificar logs
grep "Rate limit" logs/app.log
```

---

### Problema: Cache não funciona

**Sintoma:** Todas as requisições mostram `cache_hit: false`

**Solução:**
```bash
# Verificar se tokenCache está sendo importado
grep "tokenCache" server/validators/sessionValidator.js

# Verificar se set() está sendo chamado
grep "tokenCache.set" server/validators/sessionValidator.js

# Verificar logs
grep "Token cacheado" logs/app.log
```

---

### Problema: Bloqueio não funciona

**Sintoma:** Consegue fazer mais de 5 tentativas falhadas

**Solução:**
```bash
# Verificar se middleware está aplicado
grep "checkLockoutMiddleware" server/routes/sessionRoutes.js

# Verificar se trackFailedAttempt está sendo chamado
grep "trackFailedAttempt" server/routes/sessionRoutes.js

# Verificar logs
grep "Tentativa de autenticação falhada" logs/app.log
```

---

## ✅ Checklist Final

### Antes de Marcar como Completo

- [ ] Todos os arquivos novos criados
- [ ] Todos os arquivos existentes modificados
- [ ] Todos os testes manuais passaram
- [ ] Logs mostram funcionamento correto
- [ ] Commit feito com mensagem descritiva
- [ ] Deploy para staging realizado
- [ ] Monitoramento configurado
- [ ] Documentação atualizada
- [ ] Equipe notificada

### Após 24 Horas

- [ ] Taxa de cache hit > 70%
- [ ] Rate limiting funcionando (violações detectadas)
- [ ] Bloqueios funcionando (tentativas bloqueadas)
- [ ] Tempo de resposta melhorou
- [ ] Sem erros críticos nos logs
- [ ] Pronto para deploy em produção

---

## 📞 Suporte

**Dúvidas?** Consultar:
- `CORRECOES-CRITICAS-AUTH-PT.md` - Código completo
- `RESUMO-AUDITORIA-AUTH-PT.md` - Visão geral
- `audit-report-authentication.md` - Relatório detalhado

---

## 🎉 Parabéns!

Se chegou até aqui e todos os testes passaram, você implementou com sucesso as correções críticas de segurança! 

**Próximos Passos:**
1. Monitorar por 24-48 horas
2. Fazer deploy em produção
3. Implementar Fase 2 (correções de alta prioridade)

---

*Fim do Guia Rápido de Implementação*
