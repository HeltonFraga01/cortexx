---
inclusion: always
---

# WUZAPI Manager - Project Overview

## What is WUZAPI Manager?

WUZAPI Manager is a multi-user platform for managing WhatsApp Business API with features for message sending, webhook configuration, and external database integration.

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    WUZAPI Manager                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (React 18 + TypeScript + Vite)                   │
│  ├── src/components/  (admin, user, shared, features)      │
│  ├── src/pages/       (route components)                    │
│  ├── src/services/    (API clients)                         │
│  ├── src/hooks/       (custom React hooks)                  │
│  ├── src/contexts/    (global state)                        │
│  └── src/types/       (TypeScript definitions)              │
│                                                             │
│  Backend (Node.js + Express + SQLite WAL)                   │
│  ├── server/routes/   (HTTP endpoints)                      │
│  ├── server/services/ (business logic)                      │
│  ├── server/validators/ (input validation)                  │
│  ├── server/middleware/ (auth, CSRF, rate limiting)         │
│  ├── server/utils/    (logger, wuzapiClient)                │
│  └── server/database.js (SQLite abstraction)                │
│                                                             │
│  External Integrations                                      │
│  ├── WUZAPI (WhatsApp Business API)                         │
│  ├── NocoDB (External Database)                             │
│  ├── Asaas (Payments - optional)                            │
│  ├── Chatwoot (Support - optional)                          │
│  └── Typebot (Chatbot flows - optional)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Directories

| Path | Purpose | Key Files |
|------|---------|-----------|
| `src/` | Frontend React application | `main.tsx`, `App.tsx` |
| `src/components/` | React components by role | `admin/`, `user/`, `shared/`, `features/` |
| `src/services/` | API client abstractions | `api-client.ts`, `wuzapi.ts`, `nocodb.ts` |
| `src/hooks/` | Custom React hooks | `useAuth.ts`, `useToast.ts` |
| `src/contexts/` | Global state providers | `AuthContext.tsx`, `BrandingContext.tsx` |
| `src/types/` | TypeScript interfaces | `user.ts`, `message.ts`, `webhook.ts` |
| `server/` | Backend Express application | `index.js` |
| `server/routes/` | HTTP endpoints | `adminRoutes.js`, `userRoutes.js`, `publicRoutes.js` |
| `server/services/` | Business logic | `UserService.js`, `MessageService.js` |
| `server/validators/` | Input validation | `messageValidator.js`, `webhookValidator.js` |
| `server/middleware/` | Request processing | `authenticate.js`, `rateLimiter.js` |
| `server/utils/` | Shared utilities | `logger.js`, `wuzapiClient.js` |
| `server/migrations/` | Database schema changes | Auto-executed on startup |

## Security Model (CRITICAL)

Three-role authentication system:

| Role | Capabilities | Token Type | Data Scope |
|------|-------------|-----------|-----------|
| **Admin** | User management, system config, branding | admin token | All data |
| **User** | Message sending, webhooks, database navigation | user token | Own data only |
| **Public** | Landing page view | none | No auth required |

**Security Rules:**
- ✅ Admin routes MUST reject user tokens
- ✅ User routes MUST limit queries to authenticated user
- ✅ NEVER allow cross-user data access
- ✅ Public routes require no authentication

## Core Features

### 1. Branding
- Stored in `branding` table (logo, colors, company name)
- Loaded via `BrandingContext` on app init
- Applied to landing page, dashboard header, email templates
- Updates apply immediately (no restart needed)

### 2. Webhooks
- User-defined URLs for WUZAPI event forwarding
- 40+ event types available
- Per-user scope via user token

### 3. Messaging
- **Individual:** Form-based with variable substitution (`{{name}}`, `{{phone}}`)
- **Bulk:** CSV upload with queue processing and status tracking
- Rate limiting applied to prevent spam

### 4. Database Navigation
- Users connect their own NocoDB instances
- Field mapping required for CRUD operations
- **All list views MUST implement pagination**
- All operations scoped to authenticated user

## Development Workflow

```bash
# Start full stack (recommended)
npm run dev:full

# Or separately:
npm run dev              # Frontend only (port 5173)
npm run server:dev       # Backend only (port 3000)

# Testing
npm run test:run         # All tests once
npm run test:e2e         # Cypress E2E tests
cd server && npm test    # Backend tests only

# Code generation
npm run generate route [feature]        # Backend route
npm run generate component [path/Name]  # React component
npm run generate hook use[Feature]      # Custom hook
npm run generate service [feature]      # Backend service
```

## Environment Variables

**Frontend (`.env`):**
```
VITE_API_BASE_URL=http://localhost:3000
VITE_WUZAPI_BASE_URL=https://wzapi.wasend.com.br
VITE_ADMIN_TOKEN=your-admin-token
```

**Backend (`server/.env`):**
```
NODE_ENV=development
PORT=3000
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
CORS_ORIGINS=http://localhost:5173
SQLITE_DB_PATH=./wuzapi.db
LOG_LEVEL=debug
```

## Important Constraints

- **Single-instance architecture** - No clustering, replicas, or horizontal scaling
- **SQLite WAL mode** - Provides sufficient performance, no Redis needed
- **CommonJS backend** - All backend code uses `require()`, not ES modules
- **ES modules frontend** - All frontend code uses `import`, not CommonJS
- **No alias imports in backend** - Use relative paths only (`../utils/logger`)
- **Always use `@/` alias in frontend** - Never use `../../../` paths

## Quick Links

- 🔗 Frontend: http://localhost:5173
- 🔗 Backend: http://localhost:3000
- 📊 Health check: http://localhost:3000/health
- 📚 API docs: http://localhost:3000/api/docs (if available)
- 🗄️ Database: `./wuzapi.db` (SQLite)

## Next Steps

When starting a new feature, follow this sequence:
1. Create backend route (`server/routes/[feature]Routes.js`)
2. Create validator (`server/validators/[feature]Validator.js`)
3. Create service (`server/services/[Feature]Service.js`)
4. Create frontend service (`src/services/[feature].ts`)
5. Create types (`src/types/[feature].ts`)
6. Create components (`src/components/[role]/[Feature].tsx`)
7. Create hook if reusable (`src/hooks/use[Feature].ts`)
