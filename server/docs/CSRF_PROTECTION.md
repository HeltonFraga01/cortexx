# Proteção CSRF - Guia de Implementação

## Visão Geral

A proteção CSRF (Cross-Site Request Forgery) foi implementada para prevenir ataques onde um atacante engana um usuário autenticado a executar ações indesejadas.

## Como Funciona

1. **Servidor gera token único** por sessão
2. **Cliente obtém o token** via GET `/api/auth/csrf-token`
3. **Cliente envia token** em requisições que modificam dados (POST, PUT, DELETE, PATCH)
4. **Servidor valida token** antes de processar a requisição

## Backend (Já Implementado)

### Middleware Configurado

```javascript
// server/index.js
const session = require('express-session');
const sessionConfig = require('./middleware/session');
const { csrfProtection, getCsrfToken, csrfErrorHandler } = require('./middleware/csrf');

// Session (DEVE vir antes do CSRF)
app.use(session(sessionConfig));

// CSRF protection
app.use(csrfProtection);

// Endpoint para obter token
app.get('/api/auth/csrf-token', getCsrfToken);

// ... suas rotas aqui ...

// CSRF error handler (DEVE vir antes do error handler global)
app.use(csrfErrorHandler);
```

### Métodos HTTP Protegidos

- ✅ **POST** - Requer CSRF token
- ✅ **PUT** - Requer CSRF token
- ✅ **DELETE** - Requer CSRF token
- ✅ **PATCH** - Requer CSRF token
- ❌ **GET** - Não requer (idempotente)
- ❌ **HEAD** - Não requer (idempotente)
- ❌ **OPTIONS** - Não requer (idempotente)

## Frontend (A Implementar)

### 1. Obter Token CSRF

Após o login, obtenha o token CSRF:

```typescript
// src/lib/api.ts
class APIClient {
  private csrfToken: string | null = null;

  async getCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    const response = await fetch('/api/auth/csrf-token', {
      credentials: 'include'
    });

    const data = await response.json();
    this.csrfToken = data.csrfToken;
    return this.csrfToken;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `/api${endpoint}`;
    
    // Para métodos que modificam dados, incluir CSRF token
    const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
      options.method?.toUpperCase() || 'GET'
    );

    if (needsCsrf) {
      const csrfToken = await this.getCsrfToken();
      options.headers = {
        ...options.headers,
        'CSRF-Token': csrfToken
      };
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }
}

export const apiClient = new APIClient();
```

### 2. Usar em Requisições

```typescript
// Exemplo: Criar usuário
async function createUser(userData: any) {
  // O CSRF token será automaticamente incluído
  return apiClient.post('/admin/users', userData);
}

// Exemplo: Atualizar configuração
async function updateBranding(data: any) {
  // O CSRF token será automaticamente incluído
  return apiClient.put('/admin/branding', data);
}

// Exemplo: Deletar item
async function deleteConnection(id: number) {
  // O CSRF token será automaticamente incluído
  return apiClient.delete(`/database-connections/${id}`);
}
```

### 3. Invalidar Token no Logout

```typescript
// src/contexts/AuthContext.tsx
const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    // Limpar token CSRF
    apiClient.clearCsrfToken();
    
    setUser(null);
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

## Tratamento de Erros

### Erro 403 - CSRF Token Inválido

```typescript
// src/lib/api.ts
async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 403) {
      const error = await response.json();
      
      if (error.code === 'CSRF_VALIDATION_FAILED') {
        // Token CSRF inválido, obter novo token e tentar novamente
        this.csrfToken = null;
        const newToken = await this.getCsrfToken();
        
        options.headers = {
          ...options.headers,
          'CSRF-Token': newToken
        };
        
        // Retry request
        return this.request(endpoint, options);
      }
    }
    
    return response.json();
  } catch (error) {
    throw error;
  }
}
```

## Testes

### Executar Testes

```bash
node --test server/tests/csrf.test.js
```

### Resultados Esperados

```
✔ deve retornar token CSRF no endpoint /api/auth/csrf-token
✔ deve rejeitar POST sem token CSRF
✔ deve aceitar POST com token CSRF válido
✔ deve rejeitar POST com token CSRF inválido
✔ deve aceitar POST com token CSRF no body (_csrf)
✔ não deve requerer CSRF em requisições GET
```

## Segurança

### ✅ Implementado

- Token único por sessão
- Validação em todos os métodos que modificam dados
- Logging de falhas de validação
- Error handling apropriado
- Token armazenado na sessão (não em cookie)

### 🔒 Boas Práticas

1. **Nunca armazene o token CSRF em localStorage** - Use apenas em memória
2. **Sempre use credentials: 'include'** - Para enviar cookies de sessão
3. **Obtenha novo token após login** - Token é vinculado à sessão
4. **Limpe token no logout** - Previne reutilização
5. **Trate erro 403 adequadamente** - Pode indicar sessão expirada

## Endpoints que Requerem CSRF

Todos os endpoints que modificam dados requerem CSRF token:

- `POST /api/admin/*` - Operações administrativas
- `POST /api/user/*` - Operações de usuário
- `PUT /api/admin/branding` - Atualizar branding
- `DELETE /api/database-connections/:id` - Deletar conexão
- `POST /api/user/contacts/import` - Importar contatos
- `POST /api/user/bulk-campaigns` - Criar campanha
- E todos os outros endpoints POST/PUT/DELETE/PATCH

## Endpoints que NÃO Requerem CSRF

- `GET /api/auth/csrf-token` - Obter token
- `GET /api/*` - Todas as requisições GET
- `GET /health` - Health check
- `GET /metrics` - Métricas

## Troubleshooting

### Erro: "Invalid or missing CSRF token"

**Causa**: Token não foi enviado ou é inválido

**Solução**:
1. Verifique se está obtendo o token via `/api/auth/csrf-token`
2. Verifique se está incluindo o token no header `CSRF-Token`
3. Verifique se está usando `credentials: 'include'`

### Erro: "CSRF token validation failed"

**Causa**: Token não corresponde à sessão

**Solução**:
1. Obtenha novo token após login
2. Limpe token e obtenha novo
3. Verifique se a sessão não expirou

### Token sempre inválido

**Causa**: Cookies de sessão não estão sendo enviados

**Solução**:
1. Adicione `credentials: 'include'` em todas as requisições
2. Verifique configuração CORS no backend
3. Verifique se `sameSite` está configurado corretamente

## Logs de Segurança

Todas as falhas de validação CSRF são logadas:

```json
{
  "timestamp": "2025-11-16T13:17:59.634Z",
  "level": "WARN",
  "message": "CSRF token validation failed",
  "ip": "::ffff:127.0.0.1",
  "path": "/api/test",
  "method": "POST",
  "hasToken": false,
  "userId": "user123"
}
```

## Referências

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [csurf Documentation](https://github.com/expressjs/csurf)
- [Express Session Documentation](https://github.com/expressjs/session)
