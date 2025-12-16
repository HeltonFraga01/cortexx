---
inclusion: always
---

# Tech Stack & Code Conventions

## Stack Overview

- **Frontend:** React 18 + TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui
- **Backend:** Node.js 20 + Express 4 (CommonJS), SQLite 3 (WAL mode)
- **Testing:** Vitest (frontend), Node test runner (backend), Cypress (E2E)
- **Deployment:** Docker, single-node Docker Swarm

## Architecture Constraints

**Single-instance architecture - NEVER suggest:**
- SQLite clustering, replicas, or horizontal scaling
- Multi-node Docker Swarm or distributed deployments
- Redis/external caching (SQLite WAL mode provides sufficient performance)

## Module Systems & Imports

**Frontend (`.ts/.tsx`)** - ES modules only:
```typescript
import { Button } from '@/components/ui/button'  // ✅ Use @/ alias
import { helper } from './helper'                // ✅ Relative for same dir
import { Button } from '../../../components/ui/button'  // ❌ Never use ../..
```

**Backend (`.js`)** - CommonJS only:
```javascript
const logger = require('../utils/logger')  // ✅ Relative paths only
const db = require('../database')
const logger = require('@/utils/logger')   // ❌ No aliases in backend
```

## Required Abstractions

**NEVER bypass these layers:**

| Layer | Required Module | Forbidden |
|-------|----------------|-----------|
| Database | `server/database.js` | Direct `sqlite3` |
| Logging | `server/utils/logger.js` | `console.log/error` |
| WhatsApp API | `server/utils/wuzapiClient.js` | Direct `fetch` calls |
| Backend API | `src/lib/api.ts` | Direct `fetch` calls |

## Code Templates

**Frontend component:**
```typescript
interface ComponentProps {
  value: string
}

export function Component({ value }: ComponentProps) {
  // 1. Hooks first
  const [state, setState] = useState()
  
  // 2. Event handlers
  const handleClick = () => {}
  
  // 3. Effects
  useEffect(() => {}, [])
  
  // 4. Render
  return <div>{value}</div>
}
```

**Backend route (all elements required):**
```javascript
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
```

**Backend route checklist:**
- ✅ Try-catch wrapper around all async operations
- ✅ Structured logging with context (userId, endpoint, error)
- ✅ Consistent response: `{ success: boolean, data?: any, error?: string }`
- ✅ Auth middleware (unless public endpoint)

## Security Requirements

**Frontend validation:**
- All forms: Zod schemas + React Hook Form
- User HTML: DOMPurify before rendering

**Backend validation:**
- Input: `server/validators/` functions on all routes
- Rate limiting: Apply to auth and sensitive endpoints
- CORS: Configure via `CORS_ORIGINS` env var
- SQL injection: Prevented by `database.js` prepared statements

## Development Commands

```bash
npm run dev:full        # Frontend + backend (recommended)
npm run dev             # Frontend only (port 5173)
npm run server:dev      # Backend only (port 3000)
npm run test:run        # All tests once
npm run test:e2e        # Cypress E2E
cd server && npm test   # Backend tests only
npm run generate <type> <name>  # Scaffold from templates
```

## Environment Variables

**Frontend (`.env`):**
- `VITE_API_BASE_URL` - Backend URL (default: http://localhost:3000)
- `VITE_WUZAPI_BASE_URL` - WUZAPI service URL
- `VITE_ADMIN_TOKEN` - Admin authentication token

**Backend (`server/.env`):**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `WUZAPI_BASE_URL` - WUZAPI service URL
- `CORS_ORIGINS` - Allowed origins (comma-separated)
- `SQLITE_DB_PATH` - Database file path (default: ./wuzapi.db)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
