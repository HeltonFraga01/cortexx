# Auditoria de Segurança - WUZAPI Manager

**Data**: 16 de Novembro de 2025  
**Versão**: 1.4.9  
**Auditor**: Análise Automatizada de Código

---

## 📋 Sumário Executivo

Esta auditoria analisa as vulnerabilidades mencionadas no vídeo sobre segurança em SaaS, especificamente:

1. **IDOR (Insecure Direct Object Reference)** - Acesso indevido a dados de outros usuários
2. **Exposição de Dados Sensíveis** - Tokens, API keys e credenciais
3. **Escalada de Privilégio** - Manipulação de roles (admin/user)
4. **Exposição de Código no Cliente** - Vazamento de informações sensíveis no frontend

---

## ✅ Pontos Fortes Identificados

### 1. Validação de Ownership em Rotas de Usuário

**Localização**: `server/routes/userRoutes.js`

O sistema implementa validação rigorosa de ownership em TODAS as rotas de dados:

```javascript
// Exemplo: GET /api/user/database-connections/:id/record
async (req, res) => {
  const userToken = req.userToken;
  
  // 1. Validar usuário e obter ID
  let userId;
  try {
    userId = await db.validateUserAndGetId(userToken);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // 2. Buscar conexão
  const connection = await db.getConnectionById(parseInt(id));
  
  // 3. VALIDAR ACESSO - Impede IDOR
  if (!db.validateUserConnectionAccess(userId, connection)) {
    return res.status(403).json({ error: 'Access denied to this connection' });
  }
  
  // 4. Buscar dados apenas do usuário
  const record = await db.fetchUserRecord(connection, userLinkField, userToken);
}
```

**Proteção contra IDOR**: ✅ **IMPLEMENTADA**

- Todas as rotas de dados (`/api/user/*`) validam o `userId` contra `connection.assignedUsers`
- Não é possível trocar o ID na URL para acessar dados de outro usuário
- Validação acontece no servidor, não no cliente

### 2. Separação Clara de Rotas Admin vs User

**Localização**: `server/routes/adminRoutes.js` vs `server/routes/userRoutes.js`

```javascript
// Admin Routes - Requer token administrativo
router.get('/users', errorHandler.validateAdminTokenFormat, async (req, res) => {
  const token = req.headers.authorization;
  const validationResult = await adminValidator.validateAdminToken(token);
  
  if (!validationResult.isValid) {
    return errorHandler.handleValidationError(validationResult, req, res);
  }
  // ... retorna lista de todos os usuários
});

// User Routes - Requer token de usuário + validação de ownership
router.get('/messages', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  // ... retorna APENAS mensagens deste usuário
  const messages = await db.getMessageHistory(userToken, limit, offset);
});
```

**Proteção contra Escalada de Privilégio**: ✅ **IMPLEMENTADA**

- Rotas administrativas validam token admin via WuzAPI
- Rotas de usuário validam token user + ownership
- Não há como um usuário acessar endpoints admin sem token válido

### 3. Validação de Token no Servidor

**Localização**: `server/database.js` - `validateUserAndGetId()`

```javascript
async validateUserAndGetId(userToken) {
  try {
    // Validar via WuzAPI
    const response = await axios.get(`${wuzapiBaseUrl}/session/status`, {
      headers: { 'token': userToken }
    });
    
    const userId = response.data?.data?.id;
    if (userId) {
      return userId;
    }
    
    throw new Error('Invalid or expired token');
  } catch (error) {
    throw new Error('Authentication failed');
  }
}
```

**Proteção contra Token Tampering**: ✅ **IMPLEMENTADA**

- Tokens são validados no servidor via API externa (WuzAPI)
- Não há como manipular o role no cliente e afetar o servidor
- Cada requisição valida o token novamente

---

## ⚠️ Vulnerabilidades Identificadas

### 1. 🔴 CRÍTICO: Exposição de Token Admin no Frontend

**Localização**: Múltiplos arquivos no `src/`

```typescript
// ❌ PROBLEMA: Token admin hardcoded e exposto no bundle do cliente
const adminToken = import.meta.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
```

**Arquivos afetados**:
- `src/services/wuzapi.ts`
- `src/services/branding.ts`
- `src/services/table-permissions.ts`
- `src/components/admin/AdminOverview.tsx`
- `src/components/admin/CustomLinksManager.tsx`
- `src/components/admin/AdminSettings.tsx`
- `src/components/admin/LandingPageEditor.tsx`
- `src/contexts/AuthContext.tsx`

**Impacto**:
- ⚠️ Qualquer pessoa pode inspecionar o código fonte do frontend (React é client-side)
- ⚠️ O token admin fica visível no bundle JavaScript
- ⚠️ Atacante pode usar o token para acessar endpoints administrativos

**Risco**: 🔴 **CRÍTICO**

**Recomendação**: 
1. **NUNCA** enviar token admin para o frontend
2. Implementar autenticação baseada em sessão/cookie HTTP-only
3. Backend deve validar sessão e fazer chamadas admin internamente

### 2. 🟡 MÉDIO: Fallback de Token como UserID

**Localização**: `server/database.js` - `validateUserAndGetId()`

```javascript
// ⚠️ PROBLEMA: Se WuzAPI falhar, usa o token diretamente como userId
if (userToken && userToken.length > 0) {
  logger.info('✅ Usando token como ID de usuário direto');
  return userToken;
}
```

**Impacto**:
- Se a WuzAPI estiver offline, qualquer string é aceita como userId
- Atacante pode forjar um userId e potencialmente acessar dados

**Risco**: 🟡 **MÉDIO** (mitigado pela validação de `assignedUsers`)

**Recomendação**:
1. Remover fallback ou torná-lo mais restritivo
2. Implementar cache de usuários válidos
3. Retornar erro 503 se WuzAPI estiver offline

### 3. 🟡 MÉDIO: Exposição de URLs de API no Frontend

**Localização**: `src/config/environment.ts`

```typescript
// ⚠️ PROBLEMA: URLs de API expostas no código cliente
WUZAPI_BASE_URL: import.meta.env.VITE_WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'
```

**Impacto**:
- Atacante descobre endpoints da API externa
- Pode tentar ataques diretos contra a WuzAPI
- Facilita reconhecimento da infraestrutura

**Risco**: 🟡 **MÉDIO**

**Recomendação**:
1. Proxy todas as chamadas através do backend
2. Não expor URLs de APIs externas no frontend
3. Backend faz chamadas para WuzAPI internamente

### 4. 🟢 BAIXO: Validação de Nome de Tabela/Campo

**Localização**: `server/database.js` - `getSQLiteTableData()`

```javascript
// ✅ BOM: Validação contra SQL injection
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
  throw new Error(`Nome de tabela inválido: ${tableName}`);
}
```

**Status**: ✅ **PROTEGIDO**

A validação está implementada corretamente.

---

## 🔒 Análise por Vulnerabilidade do Vídeo

### 1. IDOR (Acesso Indevido a Dados)

**Pergunta**: "Nossos endpoints realizam verificação de autorização para garantir que o ID do usuário solicitado corresponda ao ID do usuário autenticado?"

**Resposta**: ✅ **SIM, MAS COM RESSALVAS**

**Implementação Atual**:
```javascript
// ✅ Validação de ownership implementada
const userId = await db.validateUserAndGetId(userToken);
if (!db.validateUserConnectionAccess(userId, connection)) {
  return res.status(403).json({ error: 'Access denied' });
}
```

**Pontos Fortes**:
- Todas as rotas de dados validam ownership
- Não é possível trocar ID na URL para ver dados de outro usuário
- Validação acontece no servidor

**Pontos Fracos**:
- ⚠️ Fallback de token como userId pode ser explorado se WuzAPI cair
- ⚠️ Dependência de API externa para validação

**Recomendação**: 
- Implementar cache local de usuários válidos
- Remover fallback inseguro
- Adicionar rate limiting em rotas de dados

### 2. Exposição de Dados Sensíveis

**Pergunta**: "Nossas credenciais e variáveis de ambiente estão sendo totalmente ocultadas do lado do cliente?"

**Resposta**: ❌ **NÃO**

**Problemas Identificados**:

1. **Token Admin Exposto**:
```typescript
// ❌ CRÍTICO: Visível no bundle do cliente
const adminToken = import.meta.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
```

2. **URLs de API Expostas**:
```typescript
// ⚠️ Facilita reconhecimento
WUZAPI_BASE_URL: 'https://wzapi.wasend.com.br'
```

**Impacto**:
- 🔴 Atacante pode usar token admin para acessar endpoints administrativos
- 🔴 Pode criar/deletar usuários
- 🔴 Pode modificar configurações do sistema
- 🟡 Pode atacar diretamente a WuzAPI

**Recomendação URGENTE**:
1. **REMOVER** todos os tokens do frontend
2. Implementar autenticação baseada em sessão
3. Backend deve armazenar tokens em variáveis de ambiente
4. Usar cookies HTTP-only para sessões

### 3. Escalada de Privilégio (Role Tampering)

**Pergunta**: "As permissões e o role de um usuário são definidos e verificados somente no lado do servidor?"

**Resposta**: ✅ **SIM**

**Implementação Atual**:
```javascript
// ✅ Validação de role no servidor
router.get('/users', errorHandler.validateAdminTokenFormat, async (req, res) => {
  const validationResult = await adminValidator.validateAdminToken(token);
  if (!validationResult.isValid) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... código admin
});
```

**Pontos Fortes**:
- Roles são validados no servidor via WuzAPI
- Não há como manipular role no cliente e afetar o servidor
- Rotas admin e user são completamente separadas

**Pontos Fracos**:
- ⚠️ Token admin exposto no frontend permite bypass completo

**Recomendação**:
- Manter validação atual no servidor
- Remover token admin do frontend
- Implementar sessões com roles armazenados no servidor

### 4. Exposição Geral e Arquitetura

**Pergunta**: "Há risco de exposição de qualquer token ou chave de API no código fonte acessível?"

**Resposta**: ❌ **SIM, HÁ RISCO**

**Tokens/Chaves Expostos**:

1. **VITE_ADMIN_TOKEN**: 
   - Exposto em 8+ arquivos do frontend
   - Valor padrão hardcoded: `'UeH7cZ2c1K3zVUBFi7SginSC'`
   - Visível no bundle JavaScript

2. **VITE_WUZAPI_BASE_URL**:
   - Exposto em múltiplos arquivos
   - Facilita reconhecimento da infraestrutura

**Tokens/Chaves SEGUROS** (não expostos):
- ✅ Tokens de usuário (fornecidos via login)
- ✅ Variáveis de ambiente do backend (`server/.env`)
- ✅ Credenciais de banco de dados

**Recomendação**:
1. Mover TODAS as credenciais para o backend
2. Frontend deve apenas enviar credenciais de login
3. Backend gerencia tokens internamente
4. Usar sessões HTTP-only para autenticação

---

## 🛡️ Plano de Ação Recomendado

### Prioridade 1 - CRÍTICO (Implementar IMEDIATAMENTE)

#### 1.1. Remover Token Admin do Frontend

**Problema**: Token admin exposto em 8+ arquivos

**Solução**:

```typescript
// ❌ ANTES (INSEGURO)
const adminToken = import.meta.env.VITE_ADMIN_TOKEN;
fetch('/api/admin/users', {
  headers: { 'Authorization': adminToken }
});

// ✅ DEPOIS (SEGURO)
// Frontend: Apenas envia credenciais de login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username, password }),
  credentials: 'include' // Envia cookies
});

// Backend: Cria sessão HTTP-only
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Validar credenciais
  if (username === 'admin' && password === process.env.ADMIN_PASSWORD) {
    // Criar sessão
    req.session.role = 'admin';
    req.session.userId = 'admin';
    
    res.json({ success: true, role: 'admin' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Backend: Middleware de autenticação
function requireAdmin(req, res, next) {
  if (req.session?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Backend: Rotas protegidas
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  // Usar token admin do .env
  const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
  const users = await wuzapiClient.getUsers(adminToken);
  res.json(users);
});
```

**Arquivos a modificar**:
1. Criar `server/middleware/auth.js` com sessões
2. Criar `server/routes/authRoutes.js` para login/logout
3. Remover `VITE_ADMIN_TOKEN` de todos os arquivos `src/`
4. Adicionar `express-session` ao backend
5. Configurar cookies HTTP-only

**Tempo estimado**: 4-6 horas

#### 1.2. Implementar Autenticação Baseada em Sessão

**Dependências**:
```bash
npm install express-session connect-sqlite3
```

**Configuração**:
```javascript
// server/index.js
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));
```

**Tempo estimado**: 2-3 horas

### Prioridade 2 - ALTO (Implementar em 1 semana)

#### 2.1. Remover Fallback Inseguro de Token

**Localização**: `server/database.js` - `validateUserAndGetId()`

```javascript
// ❌ ANTES (INSEGURO)
if (userToken && userToken.length > 0) {
  return userToken; // Aceita qualquer string
}

// ✅ DEPOIS (SEGURO)
// Implementar cache de usuários válidos
const cachedUser = this.userCache.get(userToken);
if (cachedUser && Date.now() - cachedUser.timestamp < 300000) { // 5 min
  return cachedUser.userId;
}

// Se WuzAPI falhar, retornar erro
throw new Error('Authentication service unavailable');
```

**Tempo estimado**: 2 horas

#### 2.2. Implementar Proxy para WuzAPI

**Problema**: URLs de API expostas no frontend

**Solução**:
```javascript
// Backend: Proxy todas as chamadas
app.post('/api/wuzapi/send', requireAuth, async (req, res) => {
  const userToken = req.session.userToken;
  const wuzapiUrl = process.env.WUZAPI_BASE_URL; // Não exposto
  
  const result = await axios.post(`${wuzapiUrl}/send`, req.body, {
    headers: { 'token': userToken }
  });
  
  res.json(result.data);
});

// Frontend: Chama apenas o backend
fetch('/api/wuzapi/send', {
  method: 'POST',
  body: JSON.stringify(message),
  credentials: 'include'
});
```

**Tempo estimado**: 3-4 horas

### Prioridade 3 - MÉDIO (Implementar em 1 mês)

#### 3.1. Implementar Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: 'Too many login attempts'
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  // ...
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições
  message: 'Too many requests'
});

app.use('/api/', apiLimiter);
```

**Tempo estimado**: 1-2 horas

#### 3.2. Adicionar Logging de Segurança

```javascript
// Logar todas as tentativas de acesso admin
app.use('/api/admin/*', (req, res, next) => {
  logger.security('Admin access attempt', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userId: req.session?.userId,
    timestamp: new Date().toISOString()
  });
  next();
});

// Logar falhas de autenticação
app.post('/api/auth/login', async (req, res) => {
  // ...
  if (!valid) {
    logger.security('Failed login attempt', {
      ip: req.ip,
      username: req.body.username,
      timestamp: new Date().toISOString()
    });
  }
});
```

**Tempo estimado**: 2 horas

#### 3.3. Implementar CSRF Protection

```javascript
const csrf = require('csurf');

app.use(csrf({ cookie: true }));

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Frontend: Incluir token em requisições
const csrfToken = await fetch('/api/csrf-token').then(r => r.json());
fetch('/api/admin/users', {
  headers: {
    'CSRF-Token': csrfToken.csrfToken
  }
});
```

**Tempo estimado**: 2-3 horas

---

## 📊 Resumo de Riscos

| Vulnerabilidade | Risco | Status | Prioridade |
|----------------|-------|--------|-----------|
| Token Admin Exposto | 🔴 CRÍTICO | ❌ Vulnerável | P1 |
| Fallback de Token Inseguro | 🟡 MÉDIO | ⚠️ Parcial | P2 |
| URLs de API Expostas | 🟡 MÉDIO | ⚠️ Parcial | P2 |
| IDOR | 🟢 BAIXO | ✅ Protegido | - |
| Escalada de Privilégio | 🟢 BAIXO | ✅ Protegido* | P1 |
| SQL Injection | 🟢 BAIXO | ✅ Protegido | - |

*Protegido no servidor, mas token admin exposto permite bypass

---

## 🎯 Conclusão

### Pontos Positivos

1. ✅ **Validação de Ownership**: Implementada corretamente em todas as rotas de dados
2. ✅ **Separação de Roles**: Rotas admin e user bem separadas
3. ✅ **Validação de SQL**: Proteção contra SQL injection implementada
4. ✅ **Logging**: Sistema de logs robusto para auditoria

### Pontos Críticos

1. 🔴 **Token Admin Exposto**: Vulnerabilidade CRÍTICA que permite acesso administrativo completo
2. 🟡 **Fallback Inseguro**: Pode ser explorado se WuzAPI estiver offline
3. 🟡 **Falta de Rate Limiting**: Permite ataques de força bruta

### Recomendação Final

**O sistema NÃO está pronto para produção** devido à exposição do token administrativo no frontend. Esta é uma vulnerabilidade crítica que deve ser corrigida IMEDIATAMENTE antes de qualquer deploy em produção.

**Ações Urgentes**:
1. Implementar autenticação baseada em sessão (P1)
2. Remover token admin do frontend (P1)
3. Implementar proxy para WuzAPI (P2)
4. Adicionar rate limiting (P3)

**Tempo estimado para correção completa**: 2-3 dias de desenvolvimento

---

## 📚 Referências

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP IDOR](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

**Documento gerado em**: 16/11/2025  
**Próxima revisão**: Após implementação das correções P1
