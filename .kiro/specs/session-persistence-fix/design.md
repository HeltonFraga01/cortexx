# Design Document: Session Persistence Fix

## Overview

Este documento descreve a solução para o problema crítico de persistência de sessão no sistema de autenticação. O problema atual é que a sessão é criada, mas os dados do usuário (`userId`, `role`, `userToken`) não são persistidos corretamente devido ao uso incorreto de `req.session.destroy()` seguido de recriação manual.

### Problema Raiz

O código atual em `authRoutes.js` usa:
```javascript
req.session.destroy((destroyErr) => {
  req.session = null;
  req.sessionStore.generate(req);
  // Set session data...
  req.session.save(...);
});
```

Este padrão é problemático porque:
1. `req.sessionStore.generate()` não é uma API pública do express-session
2. A sessão gerada pode não estar corretamente vinculada ao request
3. O `save()` pode não persistir os dados corretamente

### Solução

Usar `req.session.regenerate()` que é a API oficial do express-session para criar uma nova sessão de forma segura, preservando a capacidade de definir dados na nova sessão.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authentication Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Login Request                                                │
│     │                                                            │
│     ▼                                                            │
│  2. Validate Credentials (WUZAPI)                                │
│     │                                                            │
│     ▼                                                            │
│  3. Session Regeneration (NEW - using regenerate())              │
│     │                                                            │
│     ├── Old session destroyed automatically                      │
│     ├── New session created with new ID                          │
│     └── Session object ready for data                            │
│     │                                                            │
│     ▼                                                            │
│  4. Set Session Data                                             │
│     │                                                            │
│     ├── req.session.userId = userData.id                         │
│     ├── req.session.role = role                                  │
│     ├── req.session.userToken = token                            │
│     └── req.session.* (other fields)                             │
│     │                                                            │
│     ▼                                                            │
│  5. Save Session (CRITICAL - must await)                         │
│     │                                                            │
│     ├── req.session.save() called                                │
│     ├── Wait for callback completion                             │
│     └── Verify no errors                                         │
│     │                                                            │
│     ▼                                                            │
│  6. Send Response                                                │
│     │                                                            │
│     └── Only after session is persisted                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Session Helper Module (NEW)

Criar um módulo helper para operações de sessão consistentes:

```javascript
// server/utils/sessionHelper.js

/**
 * Regenerates session safely and sets user data
 * @param {Request} req - Express request
 * @param {Object} userData - User data to set in session
 * @returns {Promise<void>}
 */
async function regenerateSession(req, userData) {
  const oldSessionId = req.sessionID;
  
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regeneration failed', {
          error: err.message,
          oldSessionId
        });
        return reject(err);
      }
      
      // Set session data
      req.session.userId = userData.userId;
      req.session.role = userData.role;
      req.session.userToken = userData.userToken;
      req.session.userName = userData.userName;
      req.session.userJid = userData.userJid || null;
      req.session.createdAt = new Date().toISOString();
      req.session.lastActivity = new Date().toISOString();
      
      // Set tenant context if provided
      if (userData.tenantContext) {
        req.session.tenantId = userData.tenantContext.tenantId;
        req.session.tenantSubdomain = userData.tenantContext.subdomain;
        req.session.tenantName = userData.tenantContext.name;
      }
      
      // Save session explicitly
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Session save failed', {
            error: saveErr.message,
            sessionId: req.sessionID,
            userId: userData.userId
          });
          return reject(saveErr);
        }
        
        logger.info('Session regenerated and saved', {
          oldSessionId,
          newSessionId: req.sessionID,
          userId: userData.userId,
          role: userData.role
        });
        
        resolve();
      });
    });
  });
}

/**
 * Validates session has required authentication data
 * @param {Session} session - Express session
 * @returns {Object} Validation result
 */
function validateSession(session) {
  if (!session) {
    return { valid: false, reason: 'no_session' };
  }
  
  if (!session.userId) {
    return { valid: false, reason: 'no_user_id', corrupted: true };
  }
  
  if (!session.role) {
    return { valid: false, reason: 'no_role', corrupted: true };
  }
  
  return { valid: true };
}

/**
 * Destroys corrupted session and clears cookie
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @returns {Promise<void>}
 */
async function destroyCorruptedSession(req, res) {
  return new Promise((resolve) => {
    const sessionId = req.sessionID;
    
    req.session.destroy((err) => {
      if (err) {
        logger.warn('Error destroying corrupted session', {
          error: err.message,
          sessionId
        });
      }
      
      // Clear cookie with consistent options
      const cookieSecure = process.env.COOKIE_SECURE === 'true' || false;
      const cookieSameSite = process.env.COOKIE_SAMESITE || 'lax';
      
      res.clearCookie('wuzapi.sid', {
        path: '/',
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite
      });
      
      logger.info('Corrupted session destroyed', { sessionId });
      resolve();
    });
  });
}

module.exports = {
  regenerateSession,
  validateSession,
  destroyCorruptedSession
};
```

### 2. Updated Auth Middleware

```javascript
// server/middleware/auth.js (updated requireAdmin)

async function requireAdmin(req, res, next) {
  const { validateSession, destroyCorruptedSession } = require('../utils/sessionHelper');
  
  // Check JWT first (existing logic)
  // ...
  
  // Session-based authentication
  const validation = validateSession(req.session);
  
  if (!validation.valid) {
    // Handle corrupted session
    if (validation.corrupted) {
      await destroyCorruptedSession(req, res);
      
      return res.status(401).json({
        error: 'Sessão corrompida. Por favor, faça login novamente.',
        code: 'SESSION_CORRUPTED',
        timestamp: new Date().toISOString()
      });
    }
    
    // No session
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }
  
  // Check admin role
  if (req.session.role !== 'admin') {
    return res.status(403).json({
      error: 'Acesso de administrador necessário',
      code: 'FORBIDDEN',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}
```

### 3. Updated Login Route

```javascript
// server/routes/authRoutes.js (updated login)

router.post('/login', async (req, res) => {
  const { regenerateSession } = require('../utils/sessionHelper');
  
  // ... validation and credential check ...
  
  try {
    await regenerateSession(req, {
      userId: userData.id,
      role: role,
      userToken: token,
      userName: userData.name || userData.id,
      userJid: userData.jid || null,
      tenantContext: tenantContext
    });
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        role: role,
        token: token,
        name: userData.name || userData.id,
        jid: userData.jid || null
      }
    });
  } catch (error) {
    logger.error('Login failed - session error', {
      error: error.message,
      ip: req.ip
    });
    
    res.status(500).json({
      error: 'Falha ao criar sessão',
      code: 'SESSION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});
```

## Data Models

### Session Data Structure

```typescript
interface SessionData {
  // Required fields
  userId: string;           // User identifier (hashed token or agent ID)
  role: 'admin' | 'user' | 'superadmin';
  userToken: string;        // WUZAPI token for API calls
  
  // Optional fields
  userName?: string;        // Display name
  userJid?: string;         // WhatsApp JID
  userEmail?: string;       // Email (for agent login)
  
  // Tenant context (multi-tenant)
  tenantId?: string;
  tenantSubdomain?: string;
  tenantName?: string;
  
  // Agent-specific (admin-login)
  agentRole?: string;       // Original agent role
  accountId?: string;
  accountName?: string;
  
  // Metadata
  createdAt: string;        // ISO timestamp
  lastActivity: string;     // ISO timestamp
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Session Data Persistence After Login

*For any* valid login request with correct credentials, after the login completes successfully, the session SHALL contain non-null values for `userId`, `role`, and `userToken`.

**Validates: Requirements 1.1, 1.2**

### Property 2: Authentication Requires Non-Null UserId

*For any* request to a protected endpoint, if the session exists but `userId` is null, the System SHALL return 401 Unauthorized and NOT grant access.

**Validates: Requirements 1.4, 3.1, 3.4**

### Property 3: Corrupted Session Recovery Round-Trip

*For any* corrupted session (session exists but userId is null), after the System handles the corruption (destroys session, clears cookie), a subsequent login attempt SHALL succeed and create a valid session.

**Validates: Requirements 5.1, 5.3, 5.4**

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | No session or session expired |
| `SESSION_CORRUPTED` | 401 | Session exists but missing required data |
| `SESSION_ERROR` | 500 | Failed to create/save session |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |

### Error Response Format

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE",
  "timestamp": "2025-12-22T01:13:22.821Z"
}
```

## Testing Strategy

### Unit Tests

1. **Session Helper Tests** (`server/utils/sessionHelper.test.js`)
   - Test `regenerateSession` with valid data
   - Test `regenerateSession` with regenerate failure
   - Test `regenerateSession` with save failure
   - Test `validateSession` with valid session
   - Test `validateSession` with null session
   - Test `validateSession` with missing userId
   - Test `validateSession` with missing role
   - Test `destroyCorruptedSession` clears cookie

2. **Auth Middleware Tests** (`server/middleware/auth.test.js`)
   - Test `requireAdmin` with valid admin session
   - Test `requireAdmin` with corrupted session
   - Test `requireAdmin` with no session
   - Test `requireAdmin` with non-admin role

### Property-Based Tests

Using fast-check for property-based testing:

1. **Property 1 Test**: Generate random valid credentials, perform login, verify session data
2. **Property 2 Test**: Generate sessions with various null fields, verify auth rejection
3. **Property 3 Test**: Create corrupted session, handle it, verify subsequent login works

### Integration Tests

1. **Login Flow Test**
   - Login → Verify session → Access protected route → Success
   
2. **Corrupted Session Flow Test**
   - Create corrupted session → Access protected route → Get 401 → Login → Success

3. **Session Regeneration Test**
   - Login as user → Logout → Login as admin → Verify no data leakage

## Migration Notes

### Breaking Changes

None - this is a bug fix that maintains the same API contract.

### Rollback Plan

If issues arise, revert the changes to `authRoutes.js` and `auth.js`. The session helper module can be removed without affecting other code.
