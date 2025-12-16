# Relatório de Auditoria - Segurança do Frontend

**Data:** 07/11/2025  
**Auditor:** Kiro AI Security Audit  
**Sistema:** WuzAPI Dashboard  
**Escopo:** Tarefa 5 - Auditoria de Segurança do Frontend

---

## 📊 Resumo Executivo

Esta auditoria examinou a segurança do frontend React, incluindo vulnerabilidades XSS, armazenamento de tokens, proteção CSRF e dependências vulneráveis.

**Principais Descobertas:**
- ⚠️ Uso de `dangerouslySetInnerHTML` (mas HTML é sanitizado no backend)
- ❌ **CRÍTICO:** Tokens armazenados em localStorage (vulnerável a XSS)
- ❌ **CRÍTICO:** Token admin hardcoded no frontend
- ❌ Sem proteção CSRF implementada
- ❌ **ALTO:** Axios vulnerável a DoS (CVE com score 7.5)
- ⚠️ Outras dependências com vulnerabilidades moderadas/baixas

**Nível de Risco Geral:** ALTO

---

## 5.1 Escaneamento de Vulnerabilidades XSS em Componentes React

### Descoberta: USO DE dangerouslySetInnerHTML COM SANITIZAÇÃO BACKEND

**Status:** ⚠️ ACEITÁVEL (Com Ressalvas)  
**Severidade:** MÉDIA  
**Requisito:** 4.1, 4.4

#### Análise

O sistema usa `dangerouslySetInnerHTML` em **1 local** para renderizar HTML customizado, mas o HTML é sanitizado no backend antes de ser armazenado.

#### Evidências

**Uso de dangerouslySetInnerHTML:**
```typescript
// src/components/user/UserOverview.tsx - Linha 254
if (shouldRenderCustomHtml) {
  return (
    <div 
      className="custom-home-content"
      style={getCssVariables()}
      dangerouslySetInnerHTML={{ __html: brandingConfig.customHomeHtml! }}
    />
  );
}
```

**Sanitização no Backend:**
```javascript
// server/utils/htmlSanitizer.js
sanitize(html) {
  const config = {
    ALLOWED_TAGS: ['div', 'span', 'p', 'h1', ...],
    ALLOWED_ATTR: ['id', 'class', 'style', ...],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    SAFE_FOR_TEMPLATES: true,
  };
  
  return this.DOMPurify.sanitize(html, config);
}
```

**Fluxo de Dados:**
1. Admin envia HTML customizado → Backend
2. Backend sanitiza com DOMPurify → Armazena no banco
3. Frontend busca HTML sanitizado → Renderiza com `dangerouslySetInnerHTML`

#### Pontos Fortes

1. ✅ **Sanitização Robusta** - DOMPurify no backend
2. ✅ **Whitelist de Tags** - Apenas tags seguras permitidas
3. ✅ **Detecção de Padrões** - Regex para detectar ataques
4. ✅ **Uso Limitado** - Apenas 1 ocorrência no código

#### Riscos Residuais

1. ⚠️ **Confiança no Backend** - Se sanitização falhar, XSS é possível
2. ⚠️ **Sem Validação Frontend** - Frontend não valida HTML antes de renderizar
3. ⚠️ **Sem Content Security Policy** - Nenhuma CSP configurada

#### Recomendações

**CURTO PRAZO:**

1. **Adicionar Validação Frontend**
```typescript
// src/components/user/UserOverview.tsx
import DOMPurify from 'dompurify';

if (shouldRenderCustomHtml) {
  // Sanitizar novamente no frontend como camada extra
  const sanitizedHtml = DOMPurify.sanitize(brandingConfig.customHomeHtml!, {
    ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'img', 'a'],
    ALLOWED_ATTR: ['class', 'style', 'href', 'src', 'alt'],
  });
  
  return (
    <div 
      className="custom-home-content"
      style={getCssVariables()}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
```

2. **Implementar Content Security Policy**
```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:;">
```

---

## 5.2 Revisão de Armazenamento de Tokens de Autenticação

### Descoberta: TOKENS ARMAZENADOS EM LOCALSTORAGE

**Status:** ❌ CRÍTICO  
**Severidade:** ALTA  
**Requisito:** 4.2

#### Análise

O sistema armazena tokens de autenticação em **localStorage**, que é vulnerável a ataques XSS. Além disso, há um **token admin hardcoded** no código frontend.

#### Evidências

**Armazenamento em localStorage:**
```typescript
// src/contexts/AuthContext.tsx - Linha 95
const login = async (token: string, role: 'admin' | 'user'): Promise<boolean> => {
  // ...
  if (response.ok) {
    const userData: User = {
      id: 'admin',
      name: 'Administrator',
      token,  // ❌ Token armazenado
      role: 'admin'
    };
    setUser(userData);
    localStorage.setItem('wuzapi_user', JSON.stringify(userData));  // ❌ VULNERÁVEL
    return true;
  }
};

// Linha 117
const logout = () => {
  setUser(null);
  localStorage.removeItem('wuzapi_user');
};

// Linha 122
useEffect(() => {
  const savedUser = localStorage.getItem('wuzapi_user');  // ❌ Lê do localStorage
  if (savedUser) {
    setUser(JSON.parse(savedUser));
  }
  setIsLoading(false);
}, []);
```

**Token Admin Hardcoded:**
```typescript
// src/contexts/AuthContext.tsx - Linha 77
const usersResponse = await fetch(`${baseUrl}/api/admin/users`, {
  headers: {
    'Authorization': import.meta.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC',  // ❌ HARDCODED
    'Content-Type': 'application/json'
  }
});
```


#### Impacto

**CRÍTICO:**
1. **Vulnerável a XSS** - Qualquer script malicioso pode roubar tokens do localStorage
2. **Token Exposto** - Token admin hardcoded visível no código fonte
3. **Sem Expiração** - Tokens permanecem no localStorage indefinidamente
4. **Sem Criptografia** - Tokens armazenados em texto plano

#### Recomendações

**IMEDIATO (CRÍTICO):**

1. **Migrar para httpOnly Cookies**
```typescript
// Backend: server/routes/auth.js (criar novo arquivo)
router.post('/login', async (req, res) => {
  const { token, role } = req.body;
  
  // Validar token...
  
  // Armazenar em httpOnly cookie
  res.cookie('auth_token', token, {
    httpOnly: true,      // ✅ Não acessível via JavaScript
    secure: true,        // ✅ Apenas HTTPS
    sameSite: 'strict',  // ✅ Proteção CSRF
    maxAge: 24 * 60 * 60 * 1000  // 24 horas
  });
  
  res.json({ success: true, role });
});

// Frontend: src/contexts/AuthContext.tsx
const login = async (token: string, role: 'admin' | 'user'): Promise<boolean> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',  // ✅ Incluir cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, role })
  });
  
  if (response.ok) {
    // ✅ Não armazenar token no frontend
    setUser({ id, name, role });  // Sem token
    return true;
  }
  return false;
};
```

2. **Remover Token Hardcoded**
```typescript
// ANTES (INSEGURO) ❌
'Authorization': import.meta.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC'

// DEPOIS (SEGURO) ✅
// Não fazer requisições admin do frontend
// Ou usar endpoint dedicado que valida sessão admin no backend
```

3. **Implementar Refresh Token**
```typescript
// Backend: Usar access token (curta duração) + refresh token (longa duração)
// Access token: 15 minutos em httpOnly cookie
// Refresh token: 7 dias em httpOnly cookie separado

// Frontend: Interceptor para renovar token automaticamente
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Tentar renovar token
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Repetir requisição original
        return axios.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 5.3 Verificação de Proteção CSRF

### Descoberta: SEM PROTEÇÃO CSRF IMPLEMENTADA

**Status:** ❌ CRÍTICO  
**Severidade:** ALTA  
**Requisito:** 4.3

#### Análise

O sistema **NÃO possui proteção CSRF** implementada, deixando-o vulnerável a ataques Cross-Site Request Forgery.

#### Evidências

**Busca por CSRF:**
```bash
grep -r "csrf\|CSRF\|xsrf\|XSRF" src/
# Resultado: Nenhuma correspondência encontrada
```

**Requisições Sem Token CSRF:**
```typescript
// src/lib/api.ts - Exemplo de requisição
export const updateBranding = async (config: BrandingConfig) => {
  const response = await fetch('/api/branding', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': adminToken  // ❌ Sem CSRF token
    },
    body: JSON.stringify(config)
  });
  return response.json();
};
```

**Formulários Sem Proteção:**
```typescript
// Nenhum formulário inclui token CSRF
<form onSubmit={handleSubmit}>
  {/* ❌ Sem campo hidden com CSRF token */}
  <input type="text" name="name" />
  <button type="submit">Enviar</button>
</form>
```

#### Impacto

**CRÍTICO:**
1. **Ataques CSRF** - Atacante pode fazer requisições em nome do usuário
2. **Operações Não Autorizadas** - Mudanças de configuração, envio de mensagens, etc.
3. **Escalação de Privilégios** - Admin pode ser enganado a executar ações maliciosas

**Cenário de Ataque:**
```html
<!-- Site malicioso -->
<img src="https://cloudapi.wasend.com.br/api/branding" 
     onerror="fetch('https://cloudapi.wasend.com.br/api/branding', {
       method: 'PUT',
       credentials: 'include',
       body: JSON.stringify({ logo: 'https://evil.com/logo.png' })
     })">
```

#### Recomendações

**IMEDIATO (CRÍTICO):**

1. **Implementar CSRF Token no Backend**
```javascript
// server/middleware/csrf.js
const csrf = require('csurf');

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
});

// Endpoint para obter token
router.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Aplicar em rotas que modificam dados
router.post('/api/branding', csrfProtection, async (req, res) => {
  // Protegido contra CSRF
});
```

2. **Incluir Token nas Requisições Frontend**
```typescript
// src/lib/api.ts
let csrfToken: string | null = null;

// Buscar token ao iniciar
export const initCsrfToken = async () => {
  const response = await fetch('/api/csrf-token', {
    credentials: 'include'
  });
  const data = await response.json();
  csrfToken = data.csrfToken;
};

// Incluir em todas as requisições
export const updateBranding = async (config: BrandingConfig) => {
  const response = await fetch('/api/branding', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken!,  // ✅ Incluir token
      'Authorization': adminToken
    },
    body: JSON.stringify(config)
  });
  return response.json();
};
```

3. **Usar SameSite Cookies (Proteção Adicional)**
```javascript
// Já implementado parcialmente no CORS
// Garantir que cookies usem sameSite: 'strict'
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'  // ✅ Bloqueia requisições cross-site
});
```

---

## 5.4 Auditoria de Dependências Frontend para Vulnerabilidades

### Descoberta: MÚLTIPLAS VULNERABILIDADES ENCONTRADAS

**Status:** ❌ CRÍTICO  
**Severidade:** ALTA  
**Requisito:** 4.5

#### Análise

O `npm audit` identificou **múltiplas vulnerabilidades** nas dependências, incluindo uma **ALTA severidade** no Axios.

#### Evidências

**Vulnerabilidades Encontradas:**

1. **Axios - DoS Vulnerability (ALTA)**
```json
{
  "name": "axios",
  "severity": "high",
  "via": [{
    "source": 1108263,
    "title": "Axios is vulnerable to DoS attack through lack of data size check",
    "url": "https://github.com/advisories/GHSA-4hjh-wcwx-xvwj",
    "severity": "high",
    "cwe": ["CWE-770"],
    "cvss": {
      "score": 7.5,
      "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H"
    },
    "range": ">=1.0.0 <1.12.0"
  }],
  "fixAvailable": true
}
```

**Versão Atual:** `axios@1.8.3`  
**Versão Segura:** `axios@1.12.0+`  
**Impacto:** DoS (Denial of Service) - Score CVSS 7.5

2. **@babel/runtime - RegExp Complexity (MODERADA)**
```json
{
  "name": "@babel/runtime",
  "severity": "moderate",
  "cvss": { "score": 6.2 },
  "range": "<7.26.10",
  "fixAvailable": true
}
```

3. **@eslint/plugin-kit - ReDoS (BAIXA)**
```json
{
  "name": "@eslint/plugin-kit",
  "severity": "low",
  "range": "<0.3.4",
  "fixAvailable": true
}
```

4. **brace-expansion - ReDoS (BAIXA)**
```json
{
  "name": "brace-expansion",
  "severity": "low",
  "fixAvailable": true
}
```

#### Impacto

**ALTO:**
- **Axios DoS** - Aplicação pode ser derrubada por requisições maliciosas
- **Disponibilidade** - Serviço pode ficar indisponível
- **Experiência do Usuário** - Aplicação pode travar ou ficar lenta

**MÉDIO:**
- **@babel/runtime** - Pode causar lentidão em operações de regex
- **Dependências de Dev** - Vulnerabilidades em ferramentas de desenvolvimento

#### Recomendações

**IMEDIATO (CRÍTICO):**

1. **Atualizar Axios**
```bash
# Atualizar para versão segura
npm install axios@latest

# Verificar se tudo funciona
npm test
npm run build
```

2. **Atualizar Todas as Dependências Vulneráveis**
```bash
# Corrigir automaticamente o que for possível
npm audit fix

# Para correções que quebram compatibilidade
npm audit fix --force

# Verificar resultado
npm audit
```

3. **Revisar package.json**
```json
{
  "dependencies": {
    "axios": "^1.12.0"  // ✅ Atualizar de 1.8.3
  }
}
```

**CURTO PRAZO:**

4. **Implementar Verificação Automática**
```json
// package.json
{
  "scripts": {
    "audit": "npm audit --audit-level=moderate",
    "audit:fix": "npm audit fix",
    "precommit": "npm run audit && npm run lint"
  }
}
```

5. **Configurar Dependabot/Renovate**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    versioning-strategy: increase
```

6. **Monitorar Vulnerabilidades Continuamente**
```bash
# Adicionar ao CI/CD
npm audit --audit-level=high
if [ $? -ne 0 ]; then
  echo "❌ Vulnerabilidades de alta severidade encontradas!"
  exit 1
fi
```

---

## 📊 Resumo de Descobertas

### Problemas Críticos

1. ❌ **Tokens em localStorage** (5.2)
   - Severidade: ALTA
   - Impacto: Vulnerável a XSS
   - Esforço: 8-12 horas

2. ❌ **Token admin hardcoded no frontend** (5.2)
   - Severidade: ALTA
   - Impacto: Credenciais expostas
   - Esforço: 1 hora

3. ❌ **Sem proteção CSRF** (5.3)
   - Severidade: ALTA
   - Impacto: Ataques CSRF possíveis
   - Esforço: 4-6 horas

4. ❌ **Axios vulnerável (CVE 7.5)** (5.4)
   - Severidade: ALTA
   - Impacto: DoS possível
   - Esforço: 30 minutos

### Problemas de Média Prioridade

5. ⚠️ **dangerouslySetInnerHTML** (5.1)
   - Severidade: MÉDIA
   - Impacto: XSS se sanitização falhar
   - Esforço: 2 horas

6. ⚠️ **Dependências com vulnerabilidades moderadas** (5.4)
   - Severidade: MÉDIA
   - Impacto: Vários
   - Esforço: 1-2 horas

---

## 🎯 Plano de Ação

### Fase 1: IMEDIATO (Hoje)

**Prioridade:** 🔴 CRÍTICA

- [ ] Atualizar Axios para versão >= 1.12.0
- [ ] Executar `npm audit fix`
- [ ] Remover token admin hardcoded do frontend
- [ ] Testar aplicação após atualizações

**Tempo Estimado:** 1-2 horas

### Fase 2: Curto Prazo (Esta Semana)

**Prioridade:** 🔴 CRÍTICA

- [ ] Implementar proteção CSRF (backend + frontend)
- [ ] Migrar armazenamento de tokens para httpOnly cookies
- [ ] Adicionar validação frontend para HTML customizado
- [ ] Implementar Content Security Policy
- [ ] Testar fluxo completo de autenticação

**Tempo Estimado:** 12-16 horas

### Fase 3: Médio Prazo (Este Mês)

**Prioridade:** 🟡 ALTA

- [ ] Implementar refresh token
- [ ] Configurar Dependabot para monitoramento
- [ ] Adicionar verificação de vulnerabilidades no CI/CD
- [ ] Implementar rate limiting no frontend
- [ ] Adicionar testes de segurança

**Tempo Estimado:** 8-12 horas

---

## 📋 Checklist de Segurança Frontend

### XSS Protection
- [x] Busca por dangerouslySetInnerHTML
- [x] Sanitização no backend
- [ ] Sanitização no frontend (camada extra)
- [ ] Content Security Policy
- [x] Escape de conteúdo do usuário

### Armazenamento de Tokens
- [ ] Tokens em httpOnly cookies
- [ ] Tokens não em localStorage
- [ ] Tokens não em sessionStorage
- [ ] Tokens não em URLs
- [ ] Implementar refresh token

### CSRF Protection
- [ ] CSRF tokens implementados
- [ ] Tokens em requisições POST/PUT/DELETE
- [ ] SameSite cookies configurados
- [ ] Validação de origem

### Dependências
- [ ] Axios atualizado (>= 1.12.0)
- [ ] Todas as vulnerabilidades HIGH corrigidas
- [ ] npm audit sem alertas críticos
- [ ] Dependabot configurado
- [ ] Verificação automática no CI/CD

---

## 🔗 Código de Correção Rápida

### 1. Atualizar Axios

```bash
npm install axios@latest
npm test
npm run build
```

### 2. Remover Token Hardcoded

**Arquivo:** `src/contexts/AuthContext.tsx`

```typescript
// ANTES (INSEGURO) ❌
'Authorization': import.meta.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC'

// DEPOIS (SEGURO) ✅
// Remover esta requisição do frontend
// Criar endpoint backend dedicado que valida sessão admin
```

### 3. Adicionar Sanitização Frontend

```bash
npm install dompurify @types/dompurify
```

```typescript
// src/components/user/UserOverview.tsx
import DOMPurify from 'dompurify';

if (shouldRenderCustomHtml) {
  const sanitizedHtml = DOMPurify.sanitize(brandingConfig.customHomeHtml!, {
    ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'img', 'a'],
    ALLOWED_ATTR: ['class', 'style', 'href', 'src', 'alt'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed']
  });
  
  return (
    <div 
      className="custom-home-content"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
```

---

## ✅ Conclusão

O frontend possui **múltiplas vulnerabilidades críticas** que precisam ser corrigidas imediatamente:

1. **Axios vulnerável** - Atualizar hoje (30 min)
2. **Tokens em localStorage** - Migrar para cookies (12-16 horas)
3. **Sem CSRF** - Implementar proteção (4-6 horas)
4. **Token hardcoded** - Remover hoje (1 hora)

**Prioridade Máxima:** Atualizar Axios e remover token hardcoded HOJE.

**Status da Auditoria:** ✅ COMPLETA  
**Próxima Ação:** Atualizar Axios e remover token hardcoded  
**Responsável:** Equipe de Desenvolvimento Frontend  
**Prazo:** HOJE (Axios) + Esta Semana (CSRF e Cookies)

---

*Fim do Relatório de Auditoria de Segurança do Frontend*
