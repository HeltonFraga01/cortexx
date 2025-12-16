# Design Document

## Overview

This design addresses the authentication failures occurring on admin pages (`/admin` and `/admin/settings`) that result in "Token inválido ou erro de conexão" and 401 Unauthorized errors. The root cause is that admin routes are not properly extracting and using the session token when making requests to the WUZAPI service.

The solution involves:
1. Ensuring admin routes extract the token from `req.session.userToken`
2. Properly handling session validation in the `requireAdmin` middleware
3. Fixing the admin routes to use the session token for WUZAPI requests
4. Ensuring the frontend properly maintains session cookies

## Architecture

### Current Authentication Flow

```
Frontend (React) → Backend (Express) → WUZAPI Service
     ↓                    ↓
Session Cookie      Session Store
                    (userToken, role)
```

**Current Issues:**
1. Admin routes are not consistently using `req.session.userToken`
2. Some routes try to get token from headers instead of session
3. Session validation happens but token extraction is inconsistent

### Proposed Authentication Flow

```
1. Login:
   Frontend → POST /api/auth/login → Backend validates with WUZAPI → Creates session
   
2. Admin Request:
   Frontend → GET /api/admin/* → requireAdmin middleware → Extract token from session → Call WUZAPI
   
3. Session Structure:
   {
     userId: string,
     userToken: string,  // ← This is the WUZAPI token
     role: 'admin' | 'user',
     userName: string,
     createdAt: Date,
     lastActivity: Date
   }
```

## Components and Interfaces

### 1. Authentication Middleware (`server/middleware/auth.js`)

**Current Implementation:**
```javascript
function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.session.lastActivity = new Date();
  next();
}
```

**Status:** ✅ Working correctly - validates session and role

### 2. Admin Routes (`server/routes/adminRoutes.js`)

**Current Issues:**
- Routes are trying to get token from `req.session.userToken || process.env.WUZAPI_ADMIN_TOKEN`
- This is correct, but the issue is that some routes may not be receiving the session properly

**Required Changes:**
1. Ensure all admin routes consistently use `req.session.userToken`
2. Add better error handling when token is missing from session
3. Add logging to track token extraction

**Example Fix:**
```javascript
router.get('/users', async (req, res) => {
  try {
    // Extract token from session (set by login)
    const token = req.session.userToken;
    
    if (!token) {
      logger.error('No token in session', {
        sessionId: req.sessionID,
        userId: req.session.userId,
        hasSession: !!req.session
      });
      
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou erro de conexão',
        code: 401
      });
    }
    
    // Use token for WUZAPI request
    const validationResult = await adminValidator.validateAdminToken(token);
    // ... rest of the logic
  } catch (error) {
    // ... error handling
  }
});
```

### 3. Session Configuration (`server/index.js`)

**Current Configuration:**
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  store: sessionStore
}));
```

**Required Changes:**
1. Ensure session middleware is applied before routes
2. Verify session store is working correctly
3. Add session debugging in development mode

### 4. Frontend API Client (`src/services/api-client.ts`)

**Current Implementation:**
```typescript
this.client = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // ✅ Sends session cookies
});
```

**Status:** ✅ Working correctly - sends cookies with requests

### 5. Admin Settings Component (`src/components/admin/AdminSettings.tsx`)

**Current Test Connection Logic:**
```typescript
const adminResponse = await fetch('/api/admin/users', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include', // ✅ Includes session cookie
  signal: controller.signal
});
```

**Status:** ✅ Working correctly - includes credentials

## Data Models

### Session Data Structure

```typescript
interface SessionData {
  userId: string;           // User identifier
  userToken: string;        // WUZAPI token (admin or user)
  role: 'admin' | 'user';  // User role
  userName?: string;        // Optional user name
  createdAt: Date;         // Session creation time
  lastActivity: Date;      // Last activity timestamp
}
```

### Admin Route Response

```typescript
interface AdminResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code: number;
  timestamp: string;
}
```

## Error Handling

### Public vs Protected Endpoints

**Public Endpoints (No Authentication Required):**
- `GET /api/branding` - Get branding configuration
- `GET /api/landing-page` - Get landing page HTML
- `GET /api/custom-links` - Get custom navigation links
- `POST /api/auth/login` - User login
- `GET /api/auth/csrf-token` - Get CSRF token
- `GET /health` - Health check

**Protected Admin Endpoints (Require Admin Session):**
- `PUT /api/admin/branding` - Update branding
- `PUT /api/admin/landing-page` - Update landing page HTML
- `POST /api/admin/custom-links` - Create custom link
- `PUT /api/admin/custom-links/:id` - Update custom link
- `DELETE /api/admin/custom-links/:id` - Delete custom link
- All other `/api/admin/*` routes

### Error Scenarios and Responses

| Scenario | Status Code | Error Message | Frontend Action |
|----------|-------------|---------------|-----------------|
| No session | 401 | "Authentication required" | Redirect to login |
| Not admin role | 403 | "Admin access required" | Show access denied |
| No token in session | 401 | "Token inválido ou erro de conexão" | Redirect to login |
| WUZAPI timeout | 504 | "Timeout na comunicação com WuzAPI" | Show retry option |
| WUZAPI unavailable | 502 | "Não foi possível conectar com a WuzAPI" | Show service status |
| Invalid WUZAPI token | 401 | "Token administrativo inválido" | Redirect to login |

### Error Logging Strategy

```javascript
// Log authentication failures
logger.error('Admin authentication failed', {
  sessionId: req.sessionID,
  userId: req.session?.userId,
  role: req.session?.role,
  hasToken: !!req.session?.userToken,
  path: req.path,
  ip: req.ip
});

// Log WUZAPI communication errors
logger.error('WUZAPI request failed', {
  endpoint: url,
  status: error.response?.status,
  error: error.message,
  userId: req.session?.userId
});
```

## Testing Strategy

### Unit Tests

1. **Middleware Tests** (`server/middleware/auth.test.js`)
   - Test `requireAdmin` with valid session
   - Test `requireAdmin` with missing session
   - Test `requireAdmin` with non-admin role
   - Test session activity update

2. **Admin Routes Tests** (`server/routes/adminRoutes.test.js`)
   - Test token extraction from session
   - Test WUZAPI request with session token
   - Test error handling for missing token
   - Test error handling for WUZAPI failures

### Integration Tests

1. **Authentication Flow**
   - Login as admin → Create session → Access admin route → Verify token used
   - Login as user → Try admin route → Verify 403 error
   - No login → Try admin route → Verify 401 error

2. **Admin Dashboard**
   - Login as admin → Access /admin → Verify dashboard loads
   - Login as admin → Access /admin/settings → Verify settings load
   - Login as admin → Test connection → Verify WUZAPI called with session token

### Manual Testing Checklist

- [ ] Login as admin with valid credentials
- [ ] Verify session cookie is set
- [ ] Navigate to /admin dashboard
- [ ] Verify dashboard statistics load without errors
- [ ] Navigate to /admin/settings
- [ ] Click "Testar Conexão" button
- [ ] Verify connection test succeeds
- [ ] Check browser console for errors
- [ ] Check server logs for authentication errors
- [ ] Logout and verify session is destroyed
- [ ] Try accessing /admin without login → Verify redirect to login

## Implementation Notes

### Key Changes Required

1. **Admin Routes Token Extraction**
   - Add explicit check for `req.session.userToken`
   - Add detailed logging when token is missing
   - Return clear error messages

2. **Public Branding and Landing Page Routes**
   - Ensure `GET /api/branding` is accessible without authentication
   - Ensure `GET /api/landing-page` is accessible without authentication
   - Ensure `GET /api/custom-links` is accessible without authentication
   - Only protect PUT/POST/DELETE operations on these routes

3. **Session Debugging**
   - Add development mode logging for session state
   - Log session ID and token presence on each request
   - Add endpoint to check session status

4. **Error Messages**
   - Use Portuguese error messages for user-facing errors
   - Use English for internal logging
   - Include error codes for frontend handling

### Backward Compatibility

- Existing session-based authentication flow remains unchanged
- No changes to login/logout endpoints
- No changes to frontend authentication logic
- Only internal admin route token handling is modified

### Performance Considerations

- Session lookup is already optimized by Express session middleware
- No additional database queries required
- WUZAPI requests remain the same
- Logging should be async to avoid blocking

## Security Considerations

1. **Session Security**
   - HTTP-only cookies prevent XSS attacks
   - Secure flag in production enforces HTTPS
   - SameSite=lax prevents CSRF attacks
   - Session timeout after 24 hours

2. **Token Security**
   - Admin token never exposed to frontend
   - Token stored only in server-side session
   - Token not logged in production
   - Token validated on every WUZAPI request

3. **Error Messages**
   - Generic error messages to prevent information leakage
   - Detailed errors only in server logs
   - No token values in error responses
   - Rate limiting on authentication endpoints

## Deployment Considerations

### Environment Variables

Required environment variables:
```bash
SESSION_SECRET=<random-secret>
WUZAPI_ADMIN_TOKEN=<admin-token>
WUZAPI_BASE_URL=<wuzapi-url>
NODE_ENV=production
```

### Rollout Plan

1. **Phase 1: Add Logging**
   - Deploy enhanced logging to production
   - Monitor for authentication failures
   - Identify specific failure patterns

2. **Phase 2: Fix Token Extraction**
   - Deploy token extraction fixes
   - Monitor error rates
   - Verify admin pages load correctly

3. **Phase 3: Cleanup**
   - Remove debug logging
   - Update documentation
   - Close related issues

### Rollback Plan

If issues occur:
1. Revert to previous version
2. Session data remains intact (no schema changes)
3. No data migration required
4. Users may need to re-login

## Monitoring and Observability

### Metrics to Track

- Admin login success rate
- Admin route 401/403 error rate
- WUZAPI request success rate
- Session creation/destruction rate
- Average session duration

### Alerts

- Alert if admin 401 errors exceed 10% of requests
- Alert if WUZAPI timeout rate exceeds 5%
- Alert if session store becomes unavailable

### Logging

```javascript
// Success logging
logger.info('Admin request successful', {
  userId: req.session.userId,
  path: req.path,
  responseTime: Date.now() - startTime
});

// Error logging
logger.error('Admin request failed', {
  userId: req.session.userId,
  path: req.path,
  error: error.message,
  statusCode: res.statusCode
});
```
