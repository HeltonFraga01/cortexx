---
inclusion: fileMatch
fileMatchPattern: 'server/**/*.js'
---

# Backend Development Guidelines

## Critical Rules

**NEVER bypass these abstractions:**
- Database: ALWAYS use `require('../services/SupabaseService')` for all database operations
- Logging: ALWAYS use `require('../utils/logger')`, NEVER `console.log/error`
- WUZAPI: ALWAYS use `require('../utils/wuzapiClient')`, NEVER direct `fetch()`
- Imports: ALWAYS use CommonJS `require()`, NEVER ES modules `import`
- Paths: ALWAYS use relative paths `../utils/logger`, NEVER aliases `@/utils/logger`

**Security requirements:**
- ALL async operations MUST have try-catch wrappers
- ALL database queries MUST use SupabaseService methods (parameterized by default)
- ALL user-scoped endpoints MUST filter by `req.user.id` or account_id
- ALL admin endpoints MUST use both `authenticate` and `requireAdmin` middleware
- ALL sensitive endpoints MUST apply rate limiting

## Route Template

Every route MUST follow this exact structure:

```javascript
const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
const logger = require('../utils/logger')
const SupabaseService = require('../services/SupabaseService')

router.get('/endpoint', authenticate, async (req, res) => {
  try {
    const { data, error } = await SupabaseService.getMany('table_name', { user_id: req.user.id })
    if (error) throw error
    res.json({ success: true, data })
  } catch (error) {
    logger.error('Operation failed', { 
      error: error.message, 
      userId: req.user?.id,
      endpoint: '/endpoint'
    })
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
```

**Required elements:**
1. Try-catch around ALL async operations
2. Structured logging with `{ error, userId, endpoint }`
3. Consistent response shape: `{ success: boolean, data?: any, error?: string }`
4. Auth middleware (unless explicitly public)
5. Proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)

## File Naming & Organization

**Route files:**
- `admin[Feature]Routes.js` → Admin-only, reject user tokens, full data access
- `user[Feature]Routes.js` → User-scoped, limit to `req.user.id`, own data only
- `public[Feature]Routes.js` → No auth required

**Service files:**
- `[Feature]Service.js` → Business logic, static methods, PascalCase class name

**Validator files:**
- `[feature]Validator.js` → Zod schemas, camelCase function names

**Registration pattern in `server/routes/index.js`:**
```javascript
const adminUserRoutes = require('./adminUserRoutes')
const userMessageRoutes = require('./userMessageRoutes')

module.exports = (app) => {
  app.use('/api/admin/users', adminUserRoutes)
  app.use('/api/user/messages', userMessageRoutes)
}
```

## Service Layer Pattern

Extract business logic from routes into services:

```javascript
// server/services/MessageService.js
const SupabaseService = require('./SupabaseService')
const logger = require('../utils/logger')
const wuzapiClient = require('../utils/wuzapiClient')

class MessageService {
  static async sendMessage(userId, phoneNumber, text) {
    // 1. Validate ownership
    const { data: phone, error } = await SupabaseService.getMany('user_phones', {
      id: phoneNumber,
      user_id: userId
    })
    
    if (error || !phone?.length) throw new Error('Phone not found or unauthorized')

    // 2. Execute operation
    const result = await wuzapiClient.sendMessage({ phoneNumber, text })
    
    // 3. Log to database
    await SupabaseService.insert('messages', {
      user_id: userId,
      phone_id: phoneNumber,
      text,
      status: 'sent'
    })
    
    // 4. Log operation
    logger.info('Message sent', { userId, phoneNumber })
    
    return result
  }
}

module.exports = MessageService
```

**Service rules:**
- Use static methods for stateless operations
- ALWAYS use SupabaseService methods (queries are parameterized by default)
- ALWAYS log operations with context
- Throw descriptive errors (caught by route handler)
- NEVER expose database directly to routes

## Input Validation

Create Zod validators for all input:

```javascript
// server/validators/messageValidator.js
const { z } = require('zod')

const sendMessageSchema = z.object({
  phoneNumber: z.string().regex(/^\d{10,15}$/),
  text: z.string().min(1).max(4096),
  variables: z.record(z.string()).optional()
})

function validateSendMessage(data) {
  return sendMessageSchema.parse(data)
}

module.exports = { validateSendMessage }
```

**Usage in routes:**
```javascript
const { validateSendMessage } = require('../validators/messageValidator')

router.post('/send', authenticate, async (req, res) => {
  try {
    const validated = validateSendMessage(req.body)
    const result = await MessageService.sendMessage(req.user.id, validated)
    res.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors })
    }
    logger.error('Send failed', { error: error.message, userId: req.user.id })
    res.status(500).json({ error: error.message })
  }
})
```

## Database Access (Supabase)

**ALWAYS use SupabaseService methods:**
```javascript
const SupabaseService = require('../services/SupabaseService')

// ✅ Correct - using SupabaseService
const { data: user, error } = await SupabaseService.getById('users', userId)
const { data: users } = await SupabaseService.getMany('users', { role: 'admin' })
await SupabaseService.insert('logs', { user_id: userId, action: 'login' })
await SupabaseService.update('users', userId, { last_login: new Date().toISOString() })

// ❌ Wrong - direct Supabase client usage
const { data } = await supabase.from('users').select('*')
```

**User data scoping (CRITICAL):**
```javascript
// ✅ Correct - filters by authenticated user
router.get('/my-webhooks', authenticate, async (req, res) => {
  const { data: webhooks } = await SupabaseService.getMany('webhooks', {
    user_id: req.user.id
  })
  res.json({ success: true, data: webhooks })
})

// ❌ Wrong - returns ALL users' data (security violation)
router.get('/webhooks', authenticate, async (req, res) => {
  const { data: webhooks } = await SupabaseService.getMany('webhooks', {})
  res.json({ success: true, data: webhooks })
})
```

## Logging Standards

**Required logger usage:**
```javascript
const logger = require('../utils/logger')

// Info - successful operations
logger.info('User created', { userId, email })

// Error - ALWAYS include context
logger.error('Operation failed', { 
  error: error.message,
  userId: req.user?.id,
  endpoint: req.path,
  stack: error.stack
})

// Debug - development only
logger.debug('Processing webhook', { eventType, payload })
```

**Context requirements:**
- ALWAYS include `userId` for user-scoped operations
- ALWAYS include `endpoint` or `req.path` in route handlers
- ALWAYS include `error.message` for errors
- Include relevant IDs (messageId, webhookId, campaignId, etc.)

## Authentication & Authorization

**Middleware patterns:**
```javascript
const { authenticate } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/auth')

// User endpoint - requires valid user token
router.get('/my-data', authenticate, async (req, res) => {
  // req.user.id available
})

// Admin endpoint - requires admin token
router.get('/all-users', authenticate, requireAdmin, async (req, res) => {
  // Only admin can access
})

// Public endpoint - no auth
router.get('/health', async (req, res) => {
  res.json({ status: 'ok' })
})
```

## Error Response Standards

Use consistent HTTP status codes and response shapes:

```javascript
// 400 - Validation error
res.status(400).json({ error: 'Invalid input', details: zodError.errors })

// 401 - Not authenticated
res.status(401).json({ error: 'Unauthorized' })

// 403 - Authenticated but forbidden
res.status(403).json({ error: 'Access denied' })

// 404 - Resource not found
res.status(404).json({ error: 'Resource not found' })

// 500 - Server error
res.status(500).json({ error: error.message })
```

## Rate Limiting

Apply to auth and sensitive endpoints:

```javascript
const { rateLimiter } = require('../middleware/rateLimiter')

// Message sending - 100 per 15 min per user
router.post('/send', authenticate, rateLimiter('message-send', 100, 15), async (req, res) => {
  // Implementation
})

// Login - 5 per 15 min per IP
router.post('/login', rateLimiter('login', 5, 15), async (req, res) => {
  // Implementation
})
```

## Module System

**CommonJS only - NO ES modules:**
```javascript
// ✅ Correct
const express = require('express')
const SupabaseService = require('../services/SupabaseService')
const logger = require('../utils/logger')
const MessageService = require('../services/MessageService')

// ❌ Wrong - ES modules not supported
import express from 'express'
import SupabaseService from '../services/SupabaseService'
```

**Relative paths only - NO aliases:**
```javascript
// ✅ Correct
const logger = require('../utils/logger')
const SupabaseService = require('../services/SupabaseService')
const UserService = require('../services/UserService')

// ❌ Wrong - @ alias not configured in backend
const logger = require('@/utils/logger')
```

## Multi-Tenant Isolation (CRITICAL)

All admin routes MUST enforce tenant isolation to prevent cross-tenant data access.

**Required tenant validation pattern:**
```javascript
// server/routes/admin[Feature]Routes.js
const { requireAdmin } = require('../middleware/auth')
const { validateUserTenant, filterUsersByTenant } = require('../middleware/tenantResourceValidator')
const { logger } = require('../utils/logger')

/**
 * Helper to get tenant ID from request context
 */
function getTenantId(req) {
  return req.context?.tenantId || null;
}

router.get('/:userId/data', requireAdmin, async (req, res) => {
  try {
    // 1. ALWAYS validate tenant context
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    // 2. ALWAYS validate user belongs to tenant before operations
    const { valid, account } = await validateUserTenant(req.params.userId, tenantId);
    if (!valid) {
      logger.warn('Cross-tenant access blocked', {
        type: 'security_violation',
        tenantId,
        targetUserId: req.params.userId,
        adminId: req.session.userId,
        endpoint: req.path
      });
      return res.status(403).json({ error: 'User not found or access denied' });
    }

    // 3. Proceed with tenant-scoped operation
    const data = await SomeService.getData(req.params.userId, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Operation failed', { error: error.message, tenantId: req.context?.tenantId });
    res.status(500).json({ error: error.message });
  }
});
```

**Bulk operations MUST filter userIds:**
```javascript
router.post('/bulk/action', requireAdmin, async (req, res) => {
  const tenantId = getTenantId(req);
  const { userIds } = req.body;

  // CRITICAL: Filter to only users in this tenant
  const { validUserIds, invalidUserIds } = await filterUsersByTenant(userIds, tenantId);

  // Log cross-tenant attempts
  if (invalidUserIds.length > 0) {
    logger.warn('Bulk cross-tenant attempt blocked', {
      tenantId,
      invalidUserIds,
      adminId: req.session.userId
    });
  }

  // Process only valid users
  for (const userId of validUserIds) {
    // ... operation
  }
});
```

**Tenant-scoped services pattern:**
```javascript
// server/services/Tenant[Feature]Service.js
class TenantFeatureService {
  // All methods require tenantId parameter
  static async getById(id, tenantId) {
    const { data, error } = await SupabaseService.adminClient
      .from('tenant_features')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)  // ALWAYS filter by tenant
      .single();
    
    if (error || !data) return null;
    return data;
  }

  static async list(tenantId, filters = {}) {
    const { data } = await SupabaseService.adminClient
      .from('tenant_features')
      .select('*')
      .eq('tenant_id', tenantId)  // ALWAYS filter by tenant
      .match(filters);
    
    return data || [];
  }
}
```

**Available tenant services:**
- `TenantPlanService` - Subscription plans per tenant
- `TenantSettingsService` - Configuration per tenant
- `TenantCreditPackageService` - Credit packages per tenant

**Security logging requirements:**
- Log ALL cross-tenant access attempts as warnings
- Include: `type: 'security_violation'`, `tenantId`, `targetUserId`, `adminId`, `endpoint`
- Use generic error messages to avoid information leakage

## Implementation Checklist

Before submitting backend code, verify:

- [ ] All async operations wrapped in try-catch
- [ ] All database queries use SupabaseService methods
- [ ] All user-scoped queries filter by `req.user.id` or account_id
- [ ] All admin routes validate `req.context.tenantId` (MULTI-TENANT)
- [ ] All admin operations verify resource belongs to tenant (MULTI-TENANT)
- [ ] All bulk operations filter userIds by tenant (MULTI-TENANT)
- [ ] Cross-tenant access attempts logged as warnings (MULTI-TENANT)
- [ ] All errors logged with `logger.error()` including context
- [ ] All responses use consistent shape `{ success, data?, error? }`
- [ ] Auth middleware applied (unless explicitly public)
- [ ] Rate limiting applied to sensitive endpoints
- [ ] Input validation using Zod schemas
- [ ] Business logic extracted to service layer
- [ ] CommonJS `require()` used (not ES `import`)
- [ ] Relative paths used (not `@/` aliases)
- [ ] No direct Supabase client, `console.log`, or `fetch()` calls
