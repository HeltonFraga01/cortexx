# Design Document - Correções Críticas de Segurança

## Visão Geral

Este documento detalha a arquitetura técnica para eliminar vulnerabilidades críticas de segurança no WUZAPI Manager, focando na implementação de autenticação baseada em sessão, remoção de credenciais expostas no frontend, e fortalecimento geral da postura de segurança.

### Objetivos Principais

1. **Eliminar exposição de token admin** no bundle do frontend
2. **Implementar autenticação baseada em sessão** com cookies HTTP-only
3. **Proxiar todas as chamadas externas** através do backend
4. **Remover fallbacks inseguros** de autenticação
5. **Adicionar camadas de proteção** (rate limiting, CSRF, logging)

### Princípios de Design

- **Security by Default**: Todas as rotas são protegidas por padrão
- **Least Privilege**: Usuários têm apenas as permissões necessárias
- **Defense in Depth**: Múltiplas camadas de proteção
- **Fail Secure**: Falhas resultam em negação de acesso, não em bypass
- **Auditability**: Todas as ações de segurança são logadas

## Arquitetura

### Diagrama de Fluxo de Autenticação

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │         │   Backend    │         │   WuzAPI    │
│  (Frontend) │         │   (Express)  │         │  (External) │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. POST /api/auth/login                       │
       │    { username, password }                     │
       ├──────────────────────>│                        │
       │                       │                        │
       │                       │ 2. Validate credentials│
       │                       ├───────────────────────>│
       │                       │                        │
       │                       │ 3. User data + token   │
       │                       │<───────────────────────┤
       │                       │                        │
       │                       │ 4. Create session      │
       │                       │    Store: role, token  │
       │                       │                        │
       │ 5. Set-Cookie: sessionId (HTTP-only)          │
       │    { success: true, role: 'admin' }           │
       │<──────────────────────┤                        │
       │                       │                        │
       │ 6. GET /api/admin/users                       │
       │    Cookie: sessionId                          │
       ├──────────────────────>│                        │
       │                       │                        │
       │                       │ 7. Validate session    │
       │                       │    Check role = admin  │
       │                       │                        │
       │                       │ 8. Call WuzAPI with       │
       │                       │    admin token from env   │
       │                       ├───────────────────────────>│
       │                       │                            │
       │                       │ 9. Users list              │
       │                       │<───────────────────────────┤
       │                       │                            │
       │ 10. { users: [...] }  │                            │
       │<──────────────────────┤                            │
```

### Arquitetura de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │  LoginPage     │  │  AuthContext   │  │  API Client   │ │
│  │  - Form        │  │  - User state  │  │  - fetch()    │ │
│  │  - Validation  │  │  - Role        │  │  - credentials│ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + Cookies
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Express)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Middleware Stack                    │  │
│  │  1. express-session (SQLite store)                   │  │
│  │  2. CSRF protection                                   │  │
│  │  3. Rate limiting                                     │  │
│  │  4. Security logging                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Route Handlers                      │  │
│  │  /api/auth/*     - Login, logout, status            │  │
│  │  /api/admin/*    - Admin operations (requireAdmin)   │  │
│  │  /api/user/*     - User operations (requireAuth)     │  │
│  │  /api/wuzapi/*   - WuzAPI proxy (requireAuth)        │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Services Layer                      │  │
│  │  - SessionService: Manage sessions                   │  │
│  │  - WuzAPIProxyService: Forward requests              │  │
│  │  - SecurityLogger: Audit trail                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      WuzAPI (External)                       │
│  - Session validation                                        │
│  - User management                                           │
│  - WhatsApp operations                                       │
└─────────────────────────────────────────────────────────────┘
```

## Componentes e Interfaces

### 1. Sistema de Sessão

#### 1.1 Configuração do Express Session

**Arquivo**: `server/middleware/session.js`


```javascript
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const sessionConfig = {
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data',
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET, // Gerado aleatoriamente
  name: 'wuzapi.sid', // Nome customizado do cookie
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true, // Previne acesso via JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS only em prod
    sameSite: 'strict', // Proteção CSRF adicional
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
};

module.exports = sessionConfig;
```

**Interface da Sessão**:
```typescript
interface Session {
  id: string;
  userId: string;
  userToken: string;
  role: 'admin' | 'user';
  createdAt: Date;
  lastActivity: Date;
  csrfToken: string;
}
```

#### 1.2 Middleware de Autenticação

**Arquivo**: `server/middleware/auth.js`

```javascript
// Requer autenticação (admin ou user)
function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  // Atualizar última atividade
  req.session.lastActivity = new Date();
  next();
}

// Requer role de admin
function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  if (req.session.role !== 'admin') {
    logger.security('Unauthorized admin access attempt', {
      userId: req.session.userId,
      ip: req.ip,
      path: req.path
    });
    
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'FORBIDDEN'
    });
  }
  
  req.session.lastActivity = new Date();
  next();
}

module.exports = { requireAuth, requireAdmin };
```


### 2. Rotas de Autenticação

#### 2.1 Login Endpoint

**Arquivo**: `server/routes/authRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const wuzapiClient = require('../utils/wuzapiClient');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { token, role } = req.body;
  
  try {
    // Validar token com WuzAPI
    let userData;
    if (role === 'admin') {
      // Validar token admin
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      if (token !== adminToken) {
        logger.security('Failed admin login attempt', {
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Validar que o token funciona com WuzAPI
      userData = await wuzapiClient.validateAdminToken(token);
      
    } else {
      // Validar token de usuário com WuzAPI
      userData = await wuzapiClient.validateUserToken(token);
    }
    
    // Criar sessão
    req.session.userId = userData.id;
    req.session.userToken = token;
    req.session.role = role;
    req.session.createdAt = new Date();
    req.session.lastActivity = new Date();
    
    logger.info('User logged in', {
      userId: userData.id,
      role: role,
      ip: req.ip
    });
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        role: role
      }
    });
    
  } catch (error) {
    logger.security('Login failed', {
      error: error.message,
      ip: req.ip
    });
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const userId = req.session?.userId;
  
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error', { error: err.message });
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    res.clearCookie('wuzapi.sid');
    
    logger.info('User logged out', { userId });
    res.json({ success: true });
  });
});

// GET /api/auth/status
router.get('/status', (req, res) => {
  if (!req.session?.userId) {
    return res.json({ authenticated: false });
  }
  
  res.json({
    authenticated: true,
    user: {
      id: req.session.userId,
      role: req.session.role
    }
  });
});

module.exports = router;
```


### 3. Proxy de WuzAPI

#### 3.1 Serviço de Proxy

**Arquivo**: `server/services/WuzAPIProxyService.js`

```javascript
const axios = require('axios');
const logger = require('../utils/logger');

class WuzAPIProxyService {
  constructor() {
    this.baseUrl = process.env.WUZAPI_BASE_URL;
    this.adminToken = process.env.WUZAPI_ADMIN_TOKEN;
  }
  
  /**
   * Proxy request para WuzAPI usando token da sessão
   */
  async proxyUserRequest(method, path, data, userToken) {
    try {
      const url = `${this.baseUrl}${path}`;
      
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'token': userToken,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
      
    } catch (error) {
      logger.error('WuzAPI proxy error', {
        path,
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }
  
  /**
   * Proxy request para WuzAPI usando token admin do servidor
   */
  async proxyAdminRequest(method, path, data) {
    try {
      const url = `${this.baseUrl}${path}`;
      
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'token': this.adminToken,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
      
    } catch (error) {
      logger.error('WuzAPI admin proxy error', {
        path,
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }
}

module.exports = new WuzAPIProxyService();
```

#### 3.2 Rotas de Proxy

**Arquivo**: `server/routes/wuzapiProxyRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const wuzapiProxy = require('../services/WuzAPIProxyService');
const logger = require('../utils/logger');

// Proxy genérico para usuários
router.all('/user/*', requireAuth, async (req, res) => {
  try {
    const path = req.path.replace('/user', '');
    const userToken = req.session.userToken;
    
    const result = await wuzapiProxy.proxyUserRequest(
      req.method,
      path,
      req.body,
      userToken
    );
    
    res.json(result);
    
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({ 
      error: error.message,
      code: 'WUZAPI_ERROR'
    });
  }
});

// Proxy genérico para admin
router.all('/admin/*', requireAdmin, async (req, res) => {
  try {
    const path = req.path.replace('/admin', '');
    
    const result = await wuzapiProxy.proxyAdminRequest(
      req.method,
      path,
      req.body
    );
    
    res.json(result);
    
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({ 
      error: error.message,
      code: 'WUZAPI_ERROR'
    });
  }
});

module.exports = router;
```


### 4. Rate Limiting

#### 4.1 Configuração de Rate Limiting

**Arquivo**: `server/middleware/rateLimiter.js`

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const logger = require('../utils/logger');

// Rate limiter para login (mais restritivo)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: {
    error: 'Too many login attempts',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Rate limit exceeded - login', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      error: 'Too many login attempts',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    });
  }
});

// Rate limiter para API geral
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requisições
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Não aplicar rate limit em health checks
    return req.path === '/health';
  }
});

// Rate limiter para operações admin (moderado)
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // 50 requisições
  message: {
    error: 'Too many admin requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 minute'
  }
});

module.exports = {
  loginLimiter,
  apiLimiter,
  adminLimiter
};
```

### 5. Proteção CSRF

#### 5.1 Middleware CSRF

**Arquivo**: `server/middleware/csrf.js`

```javascript
const csrf = require('csurf');
const logger = require('../utils/logger');

// Configurar CSRF protection
const csrfProtection = csrf({ 
  cookie: false, // Usar sessão ao invés de cookie
  sessionKey: 'session'
});

// Endpoint para obter token CSRF
function getCsrfToken(req, res) {
  res.json({ 
    csrfToken: req.csrfToken() 
  });
}

// Error handler para CSRF
function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.security('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      userId: req.session?.userId
    });
    
    return res.status(403).json({
      error: 'Invalid CSRF token',
      code: 'CSRF_VALIDATION_FAILED'
    });
  }
  next(err);
}

module.exports = {
  csrfProtection,
  getCsrfToken,
  csrfErrorHandler
};
```


### 6. Logging de Segurança

#### 6.1 Security Logger

**Arquivo**: `server/utils/securityLogger.js`

```javascript
const logger = require('./logger');

class SecurityLogger {
  /**
   * Log tentativa de login
   */
  logLoginAttempt(success, data) {
    const level = success ? 'info' : 'warn';
    logger[level]('Login attempt', {
      success,
      ip: data.ip,
      userId: data.userId,
      role: data.role,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log acesso a endpoint admin
   */
  logAdminAccess(data) {
    logger.info('Admin endpoint access', {
      userId: data.userId,
      ip: data.ip,
      path: data.path,
      method: data.method,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log tentativa de acesso não autorizado
   */
  logUnauthorizedAccess(data) {
    logger.warn('Unauthorized access attempt', {
      userId: data.userId,
      ip: data.ip,
      path: data.path,
      reason: data.reason,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log atividade suspeita
   */
  logSuspiciousActivity(data) {
    logger.error('Suspicious activity detected', {
      type: data.type,
      userId: data.userId,
      ip: data.ip,
      details: data.details,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Log mudança de sessão
   */
  logSessionChange(action, data) {
    logger.info(`Session ${action}`, {
      userId: data.userId,
      sessionId: data.sessionId,
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new SecurityLogger();
```

#### 6.2 Middleware de Logging

**Arquivo**: `server/middleware/securityLogging.js`

```javascript
const securityLogger = require('../utils/securityLogger');

// Log todas as requisições admin
function logAdminRequests(req, res, next) {
  if (req.path.startsWith('/api/admin')) {
    securityLogger.logAdminAccess({
      userId: req.session?.userId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
  }
  next();
}

// Log tentativas de acesso não autorizado
function logUnauthorizedAttempts(err, req, res, next) {
  if (err.status === 401 || err.status === 403) {
    securityLogger.logUnauthorizedAccess({
      userId: req.session?.userId,
      ip: req.ip,
      path: req.path,
      reason: err.message
    });
  }
  next(err);
}

module.exports = {
  logAdminRequests,
  logUnauthorizedAttempts
};
```


## Modelos de Dados

### 1. Tabela de Sessões (SQLite)

```sql
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expired_idx ON sessions(expired);
```

**Estrutura do campo `sess` (JSON)**:
```json
{
  "cookie": {
    "originalMaxAge": 86400000,
    "expires": "2025-11-17T12:00:00.000Z",
    "httpOnly": true,
    "secure": true,
    "sameSite": "strict"
  },
  "userId": "user123",
  "userToken": "encrypted_token_here",
  "role": "admin",
  "createdAt": "2025-11-16T12:00:00.000Z",
  "lastActivity": "2025-11-16T14:30:00.000Z",
  "csrfToken": "csrf_token_here"
}
```

### 2. Estrutura de Logs de Segurança

**Arquivo**: `server/logs/security-YYYY-MM-DD.log`

```json
{
  "timestamp": "2025-11-16T12:00:00.000Z",
  "level": "warn",
  "message": "Login attempt",
  "success": false,
  "ip": "192.168.1.100",
  "userId": null,
  "role": "admin"
}
```

## Tratamento de Erros

### 1. Hierarquia de Erros de Autenticação

```javascript
class AuthenticationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.status = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.status = 403;
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMIT_EXCEEDED';
    this.status = 429;
    this.retryAfter = retryAfter;
  }
}
```

### 2. Error Handler Global

**Arquivo**: `server/middleware/errorHandler.js` (atualizado)

```javascript
function handleAuthErrors(err, req, res, next) {
  // Erro de autenticação
  if (err.name === 'AuthenticationError') {
    securityLogger.logUnauthorizedAccess({
      userId: req.session?.userId,
      ip: req.ip,
      path: req.path,
      reason: err.message
    });
    
    return res.status(401).json({
      error: err.message,
      code: err.code
    });
  }
  
  // Erro de autorização
  if (err.name === 'AuthorizationError') {
    securityLogger.logUnauthorizedAccess({
      userId: req.session?.userId,
      ip: req.ip,
      path: req.path,
      reason: err.message
    });
    
    return res.status(403).json({
      error: err.message,
      code: err.code
    });
  }
  
  // Rate limit
  if (err.name === 'RateLimitError') {
    return res.status(429).json({
      error: err.message,
      code: err.code,
      retryAfter: err.retryAfter
    });
  }
  
  next(err);
}

module.exports = { handleAuthErrors };
```


## Refatoração do Frontend

### 1. Novo AuthContext

**Arquivo**: `src/contexts/AuthContext.tsx` (refatorado)

```typescript
import { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, role: 'admin' | 'user') => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/status', {
        credentials: 'include' // Importante: envia cookies
      });
      
      const data = await response.json();
      
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token: string, role: 'admin' | 'user') => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, role }),
        credentials: 'include' // Importante: recebe cookies
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 2. API Client Atualizado

**Arquivo**: `src/lib/api.ts` (refatorado)

```typescript
class APIClient {
  private baseUrl: string;

  constructor() {
    // Usar URL relativa - proxy pelo backend
    this.baseUrl = '/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // SEMPRE incluir cookies
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

  // Métodos públicos
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new APIClient();
```


### 3. Serviços Refatorados

#### 3.1 WuzAPI Service (sem tokens expostos)

**Arquivo**: `src/services/wuzapi.ts` (refatorado)

```typescript
import { apiClient } from '@/lib/api';

class WuzAPIService {
  // Todas as chamadas agora vão através do proxy do backend
  
  async getInstances() {
    // Backend decide se usa token admin ou user baseado na sessão
    return apiClient.get('/wuzapi/user/instances');
  }
  
  async sendMessage(instanceId: string, message: any) {
    return apiClient.post(`/wuzapi/user/instances/${instanceId}/send`, message);
  }
  
  async getQRCode(instanceId: string) {
    return apiClient.get(`/wuzapi/user/instances/${instanceId}/qr`);
  }
  
  // Métodos admin (requerem sessão admin)
  async getAllUsers() {
    return apiClient.get('/wuzapi/admin/users');
  }
  
  async createUser(userData: any) {
    return apiClient.post('/wuzapi/admin/users', userData);
  }
}

export const wuzapiService = new WuzAPIService();
```

#### 3.2 Branding Service (sem tokens expostos)

**Arquivo**: `src/services/branding.ts` (refatorado)

```typescript
import { apiClient } from '@/lib/api';

class BrandingService {
  async getBranding() {
    // Backend valida sessão e retorna branding
    return apiClient.get('/branding');
  }
  
  async updateBranding(data: any) {
    // Backend valida sessão admin
    return apiClient.put('/branding', data);
  }
  
  async uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    
    const response = await fetch('/api/branding/logo', {
      method: 'POST',
      body: formData,
      credentials: 'include' // Importante
    });
    
    return response.json();
  }
}

export const brandingService = new BrandingService();
```

### 4. Componente de Login Atualizado

**Arquivo**: `src/pages/LoginPage.tsx` (refatorado)

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function LoginPage() {
  const [token, setToken] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(token, role);
      
      toast({
        title: 'Login realizado',
        description: 'Bem-vindo ao WUZAPI Manager'
      });
      
      navigate(role === 'admin' ? '/admin' : '/dashboard');
      
    } catch (error) {
      toast({
        title: 'Erro no login',
        description: 'Token inválido ou expirado',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <div>
          <Label>Token de Acesso</Label>
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label>Tipo de Acesso</Label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            className="w-full"
          >
            <option value="user">Usuário</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </div>
  );
}
```


## Estratégia de Testes

### 1. Testes de Segurança

#### 1.1 Testes de Autenticação

```javascript
// server/tests/auth.test.js
describe('Authentication', () => {
  test('should reject login with invalid token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ token: 'invalid', role: 'admin' });
    
    expect(response.status).toBe(401);
  });
  
  test('should create session on valid login', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ token: validAdminToken, role: 'admin' });
    
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toBeDefined();
  });
  
  test('should reject access without session', async () => {
    const response = await request(app)
      .get('/api/admin/users');
    
    expect(response.status).toBe(401);
  });
});
```

#### 1.2 Testes de Autorização

```javascript
describe('Authorization', () => {
  test('should reject user accessing admin endpoint', async () => {
    const agent = request.agent(app);
    
    // Login como user
    await agent
      .post('/api/auth/login')
      .send({ token: userToken, role: 'user' });
    
    // Tentar acessar endpoint admin
    const response = await agent.get('/api/admin/users');
    
    expect(response.status).toBe(403);
  });
  
  test('should allow admin accessing admin endpoint', async () => {
    const agent = request.agent(app);
    
    // Login como admin
    await agent
      .post('/api/auth/login')
      .send({ token: adminToken, role: 'admin' });
    
    // Acessar endpoint admin
    const response = await agent.get('/api/admin/users');
    
    expect(response.status).toBe(200);
  });
});
```

#### 1.3 Testes de Rate Limiting

```javascript
describe('Rate Limiting', () => {
  test('should block after 5 failed login attempts', async () => {
    // Fazer 5 tentativas
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ token: 'invalid', role: 'admin' });
    }
    
    // 6ª tentativa deve ser bloqueada
    const response = await request(app)
      .post('/api/auth/login')
      .send({ token: 'invalid', role: 'admin' });
    
    expect(response.status).toBe(429);
  });
});
```

#### 1.4 Testes de CSRF

```javascript
describe('CSRF Protection', () => {
  test('should reject POST without CSRF token', async () => {
    const agent = request.agent(app);
    
    // Login
    await agent
      .post('/api/auth/login')
      .send({ token: adminToken, role: 'admin' });
    
    // Tentar POST sem CSRF token
    const response = await agent
      .post('/api/admin/users')
      .send({ name: 'Test' });
    
    expect(response.status).toBe(403);
  });
  
  test('should accept POST with valid CSRF token', async () => {
    const agent = request.agent(app);
    
    // Login
    await agent
      .post('/api/auth/login')
      .send({ token: adminToken, role: 'admin' });
    
    // Obter CSRF token
    const csrfResponse = await agent.get('/api/auth/csrf-token');
    const csrfToken = csrfResponse.body.csrfToken;
    
    // POST com CSRF token
    const response = await agent
      .post('/api/admin/users')
      .set('CSRF-Token', csrfToken)
      .send({ name: 'Test' });
    
    expect(response.status).toBe(200);
  });
});
```

### 2. Testes de Integração Frontend

```typescript
// src/tests/auth.test.tsx
describe('Frontend Authentication', () => {
  test('should redirect to login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>
    );
    
    expect(screen.getByText(/login/i)).toBeInTheDocument();
  });
  
  test('should show dashboard after login', async () => {
    const { user } = renderWithAuth(<App />);
    
    await user.type(screen.getByLabelText(/token/i), 'valid-token');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });
});
```


## Configuração e Deployment

### 1. Variáveis de Ambiente

#### Backend (.env)

```bash
# Sessão
SESSION_SECRET=<gerar com: openssl rand -base64 32>

# WuzAPI
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
WUZAPI_ADMIN_TOKEN=<token admin real - NUNCA expor>

# Ambiente
NODE_ENV=production
PORT=3001

# Database
SQLITE_DB_PATH=./data/wuzapi.db

# CORS
CORS_ORIGINS=https://seu-dominio.com

# Logging
LOG_LEVEL=info
```

#### Frontend (.env)

```bash
# Apenas URL do backend - SEM TOKENS
VITE_API_BASE_URL=/api
```

### 2. Configuração do Express

**Arquivo**: `server/index.js` (atualizado)

```javascript
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');

const sessionConfig = require('./middleware/session');
const { csrfProtection, getCsrfToken, csrfErrorHandler } = require('./middleware/csrf');
const { loginLimiter, apiLimiter, adminLimiter } = require('./middleware/rateLimiter');
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { logAdminRequests } = require('./middleware/securityLogging');

const authRoutes = require('./routes/authRoutes');
const wuzapiProxyRoutes = require('./routes/wuzapiProxyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:8080',
  credentials: true // Importante para cookies
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session(sessionConfig));

// CSRF protection (após session)
app.use(csrfProtection);

// Security logging
app.use(logAdminRequests);

// Rate limiting
app.use('/api/auth/login', loginLimiter);
app.use('/api/admin', adminLimiter);
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.get('/api/auth/csrf-token', getCsrfToken);
app.use('/api/wuzapi', wuzapiProxyRoutes);
app.use('/api/admin', requireAdmin, adminRoutes);
app.use('/api/user', requireAuth, userRoutes);

// CSRF error handler
app.use(csrfErrorHandler);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
```

### 3. Migração de Dados

**Arquivo**: `server/migrations/004_create_sessions_table.js`

```javascript
module.exports = {
  up: async (db) => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS sessions_expired_idx 
      ON sessions(expired);
    `);
  },
  
  down: async (db) => {
    await db.exec('DROP TABLE IF EXISTS sessions');
  }
};
```


## Plano de Rollout

### Fase 1: Preparação (Dia 1)

1. **Instalar dependências**
   ```bash
   cd server
   npm install express-session connect-sqlite3 csurf express-rate-limit helmet
   ```

2. **Gerar SESSION_SECRET**
   ```bash
   openssl rand -base64 32
   ```

3. **Atualizar .env**
   - Adicionar SESSION_SECRET
   - Verificar WUZAPI_ADMIN_TOKEN está seguro

### Fase 2: Backend (Dia 1-2)

1. **Criar estrutura de autenticação**
   - `server/middleware/session.js`
   - `server/middleware/auth.js`
   - `server/routes/authRoutes.js`

2. **Implementar proxy WuzAPI**
   - `server/services/WuzAPIProxyService.js`
   - `server/routes/wuzapiProxyRoutes.js`

3. **Adicionar proteções**
   - `server/middleware/rateLimiter.js`
   - `server/middleware/csrf.js`
   - `server/utils/securityLogger.js`

4. **Atualizar rotas existentes**
   - Adicionar `requireAuth` e `requireAdmin` middlewares
   - Remover validação de token inline

5. **Executar migração**
   ```bash
   npm run migrate
   ```

### Fase 3: Frontend (Dia 2-3)

1. **Refatorar AuthContext**
   - Remover VITE_ADMIN_TOKEN
   - Implementar login baseado em sessão

2. **Atualizar API Client**
   - Adicionar `credentials: 'include'`
   - Usar URLs relativas

3. **Refatorar serviços**
   - `src/services/wuzapi.ts`
   - `src/services/branding.ts`
   - `src/services/table-permissions.ts`

4. **Atualizar componentes**
   - `src/pages/LoginPage.tsx`
   - `src/components/admin/*`
   - Remover todas as referências a tokens

5. **Limpar variáveis de ambiente**
   - Remover VITE_ADMIN_TOKEN do .env
   - Remover VITE_WUZAPI_BASE_URL do .env

### Fase 4: Testes (Dia 3)

1. **Testes de segurança**
   ```bash
   cd server
   npm test -- auth.test.js
   ```

2. **Testes de integração**
   ```bash
   npm run test:e2e
   ```

3. **Testes manuais**
   - Login como admin
   - Login como user
   - Tentar acessar endpoints sem autenticação
   - Verificar rate limiting
   - Verificar CSRF protection

### Fase 5: Deploy (Dia 4)

1. **Build de produção**
   ```bash
   npm run build:production
   ```

2. **Verificar bundle**
   - Inspecionar bundle JavaScript
   - Confirmar que não há tokens expostos
   - Verificar que URLs são relativas

3. **Deploy**
   ```bash
   npm run deploy:official
   ```

4. **Smoke tests em produção**
   - Verificar login funciona
   - Verificar endpoints protegidos
   - Verificar logs de segurança

### Fase 6: Monitoramento (Contínuo)

1. **Monitorar logs de segurança**
   ```bash
   tail -f server/logs/security-*.log
   ```

2. **Verificar métricas**
   - Taxa de falhas de login
   - Rate limit hits
   - Tentativas de acesso não autorizado

3. **Alertas**
   - Configurar alertas para atividade suspeita
   - Monitorar múltiplas falhas de login do mesmo IP

## Rollback Plan

Se houver problemas críticos durante o deploy:

1. **Reverter para versão anterior**
   ```bash
   docker service update --rollback wuzapi-manager
   ```

2. **Restaurar .env anterior** (com tokens expostos temporariamente)

3. **Investigar logs**
   ```bash
   docker service logs wuzapi-manager
   ```

4. **Corrigir problemas** e tentar novamente

## Checklist de Segurança Pós-Deploy

- [ ] Token admin NÃO está no bundle do frontend
- [ ] URLs de API NÃO estão no bundle do frontend
- [ ] Login funciona com sessão HTTP-only
- [ ] Endpoints admin requerem sessão admin
- [ ] Endpoints user requerem sessão user
- [ ] Rate limiting está ativo
- [ ] CSRF protection está ativo
- [ ] Logs de segurança estão sendo gerados
- [ ] Cookies têm flags corretas (httpOnly, secure, sameSite)
- [ ] Fallback inseguro foi removido
- [ ] Todas as chamadas WuzAPI são proxiadas

## Métricas de Sucesso

1. **Segurança**
   - ✅ Zero tokens expostos no frontend
   - ✅ Zero bypass de autenticação
   - ✅ 100% das rotas protegidas validam sessão

2. **Performance**
   - ⚠️ Latência adicional < 50ms (overhead de sessão)
   - ✅ Rate limiting não afeta usuários legítimos

3. **Auditoria**
   - ✅ 100% das tentativas de login logadas
   - ✅ 100% dos acessos admin logados
   - ✅ Logs estruturados e pesquisáveis

## Documentação Adicional

- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [CSRF Protection Guide](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
