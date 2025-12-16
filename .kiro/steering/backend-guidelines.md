---
inclusion: fileMatch
fileMatchPattern: 'server/**/*.js'
---

# Backend Development Guidelines

## Critical Rules

**NEVER bypass these abstractions:**
- Database: ALWAYS use `require('../database')`, NEVER `require('sqlite3')`
- Logging: ALWAYS use `require('../utils/logger')`, NEVER `console.log/error`
- WUZAPI: ALWAYS use `require('../utils/wuzapiClient')`, NEVER direct `fetch()`
- Imports: ALWAYS use CommonJS `require()`, NEVER ES modules `import`
- Paths: ALWAYS use relative paths `../utils/logger`, NEVER aliases `@/utils/logger`

**Security requirements:**
- ALL async operations MUST have try-catch wrappers
- ALL database queries MUST use parameterized statements (`db.prepare('... WHERE id = ?').get(id)`)
- ALL user-scoped endpoints MUST filter by `req.user.id` in WHERE clause
- ALL admin endpoints MUST use both `authenticate` and `requireAdmin` middleware
- ALL sensitive endpoints MUST apply rate limiting

## Route Template

Every route MUST follow this exact structure:

```javascript
const router = require('express').Router()
const { authenticate } = require('../middleware/auth')
const logger = require('../utils/logger')
const db = require('../database')

router.get('/endpoint', authenticate, async (req, res) => {
  try {
    const result = await operation()
    res.json({ success: true, data: result })
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
const db = require('../database')
const logger = require('../utils/logger')
const wuzapiClient = require('../utils/wuzapiClient')

class MessageService {
  static async sendMessage(userId, phoneNumber, text) {
    // 1. Validate ownership
    const phone = db.prepare(
      'SELECT * FROM user_phones WHERE id = ? AND user_id = ?'
    ).get(phoneNumber, userId)
    
    if (!phone) throw new Error('Phone not found or unauthorized')

    // 2. Execute operation
    const result = await wuzapiClient.sendMessage({ phoneNumber, text })
    
    // 3. Log to database
    db.prepare(
      'INSERT INTO messages (user_id, phone_id, text, status) VALUES (?, ?, ?, ?)'
    ).run(userId, phoneNumber, text, 'sent')
    
    // 4. Log operation
    logger.info('Message sent', { userId, phoneNumber })
    
    return result
  }
}

module.exports = MessageService
```

**Service rules:**
- Use static methods for stateless operations
- ALWAYS use `db.prepare()` with parameterized queries
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

## Database Access

**ALWAYS use prepared statements:**
```javascript
const db = require('../database')

// ✅ Correct - parameterized query
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
const users = db.prepare('SELECT * FROM users WHERE role = ?').all('admin')
db.prepare('INSERT INTO logs (user_id, action) VALUES (?, ?)').run(userId, 'login')

// ❌ Wrong - SQL injection vulnerability
db.prepare(`SELECT * FROM users WHERE email = '${email}'`).get()
```

**User data scoping (CRITICAL):**
```javascript
// ✅ Correct - filters by authenticated user
router.get('/my-webhooks', authenticate, async (req, res) => {
  const webhooks = db.prepare(
    'SELECT * FROM webhooks WHERE user_id = ?'
  ).all(req.user.id)
  res.json({ success: true, data: webhooks })
})

// ❌ Wrong - returns ALL users' data (security violation)
router.get('/webhooks', authenticate, async (req, res) => {
  const webhooks = db.prepare('SELECT * FROM webhooks').all()
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
const db = require('../database')
const logger = require('../utils/logger')
const MessageService = require('../services/MessageService')

// ❌ Wrong - ES modules not supported
import express from 'express'
import db from '../database'
```

**Relative paths only - NO aliases:**
```javascript
// ✅ Correct
const logger = require('../utils/logger')
const db = require('../database')
const UserService = require('../services/UserService')

// ❌ Wrong - @ alias not configured in backend
const logger = require('@/utils/logger')
```

## Implementation Checklist

Before submitting backend code, verify:

- [ ] All async operations wrapped in try-catch
- [ ] All database queries use `db.prepare()` with parameterized statements
- [ ] All user-scoped queries filter by `req.user.id`
- [ ] All errors logged with `logger.error()` including context
- [ ] All responses use consistent shape `{ success, data?, error? }`
- [ ] Auth middleware applied (unless explicitly public)
- [ ] Rate limiting applied to sensitive endpoints
- [ ] Input validation using Zod schemas
- [ ] Business logic extracted to service layer
- [ ] CommonJS `require()` used (not ES `import`)
- [ ] Relative paths used (not `@/` aliases)
- [ ] No direct `sqlite3`, `console.log`, or `fetch()` calls
