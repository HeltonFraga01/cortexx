# Dynamic Sidebar Navigation - Architecture Documentation

## Overview

This document provides a comprehensive architectural overview of the Dynamic Sidebar Navigation feature, including component relationships, data flow, and implementation patterns.

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client Layer (Browser)                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  React Application                                         │  │
│  │  ├─ UserLayout (Sidebar Container)                         │  │
│  │  │   └─ DynamicDatabaseItems (Dynamic Menu Generator)      │  │
│  │  ├─ DirectEditPage (Record Editor)                         │  │
│  │  │   └─ RecordForm (Dynamic Form)                          │  │
│  │  └─ ConnectionCache (Client-side Cache)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS/REST
┌──────────────────────────────────────────────────────────────────┐
│                      Application Server (Node.js)                 │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Express.js API Layer                                      │  │
│  │  ├─ /api/user/database-connections (List)                  │  │
│  │  ├─ /api/user/database-connections/:id/record (Fetch)      │  │
│  │  └─ /api/user/database-connections/:id/data/:rid (Update)  │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Middleware Layer                                          │  │
│  │  ├─ verifyUserToken (Authentication)                       │  │
│  │  ├─ rateLimiter (Rate Limiting)                            │  │
│  │  └─ errorHandler (Error Handling)                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Service Layer                                             │  │
│  │  └─ UserRecordService                                      │  │
│  │      ├─ fetchNocoDBRecord()                                │  │
│  │      ├─ fetchSQLiteRecord()                                │  │
│  │      ├─ fetchSQLRecord()                                   │  │
│  │      └─ hasAccess()                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────────┐
│                         Data Layer                                │
│  ├─ SQLite (Local Database)                                      │
│  ├─ NocoDB (External API)                                        │
│  ├─ PostgreSQL (External Database)                               │
│  └─ MySQL (External Database)                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Components

#### Component Hierarchy

```
App
└─ BrowserRouter
    └─ Routes
        └─ Route (User Dashboard)
            └─ UserLayout
                ├─ Sidebar
                │   ├─ SidebarItem (Dashboard)
                │   ├─ SidebarItem (Messages)
                │   ├─ DynamicDatabaseItems ← NEW
                │   │   └─ SidebarItem[] (Dynamic)
                │   └─ SidebarItem (Settings)
                └─ Outlet
                    └─ DirectEditPage ← NEW
                        ├─ PageHeader
                        ├─ ConnectionMetadata
                        └─ RecordForm
                            └─ FormField[]
```

#### Component Responsibilities

**DynamicDatabaseItems**
- Fetches user's assigned database connections
- Renders dynamic sidebar menu items
- Handles click events for navigation
- Manages loading and error states
- Implements alphabetical sorting

**DirectEditPage**
- Loads connection and record data
- Renders record edit form
- Handles form submission
- Manages save operations
- Implements error handling

**RecordForm**
- Renders dynamic form fields
- Applies field mappings (visibility, editability)
- Handles field validation
- Manages form state
- Supports custom labels

### Backend Architecture

#### Service Layer Pattern

```
Controller (Route Handler)
    ↓
Middleware (Auth, Rate Limit)
    ↓
Service Layer (UserRecordService)
    ↓
Data Access Layer (Database)
```

**UserRecordService**
```javascript
class UserRecordService {
  constructor(db) {
    this.db = db;
  }

  // Main method - orchestrates record fetching
  async getUserRecord(connectionId, userToken) {
    const connection = await this.getConnection(connectionId);
    this.validateAccess(connection, userToken);
    return await this.fetchRecord(connection, userToken);
  }

  // Database-specific implementations
  async fetchNocoDBRecord(connection, userLinkField, userToken) { }
  async fetchSQLiteRecord(connection, userLinkField, userToken) { }
  async fetchSQLRecord(connection, userLinkField, userToken) { }
  
  // Access control
  hasAccess(connection, userToken) { }
}
```

## Data Flow

### User Login to Sidebar Display

```
1. User logs in
   └─> AuthContext stores userToken

2. UserLayout mounts
   └─> Sidebar renders

3. DynamicDatabaseItems mounts
   └─> useEffect triggers

4. fetchConnections() called
   ├─> Check ConnectionCache
   │   ├─> Cache hit: Return cached data
   │   └─> Cache miss: Continue to API
   └─> API: GET /api/user/database-connections
       ├─> Backend validates token
       ├─> Query database for assigned connections
       ├─> Filter by assignedUsers array
       └─> Return connections

5. Connections received
   ├─> Sort alphabetically
   ├─> Store in ConnectionCache (TTL: 5 min)
   ├─> Update component state
   └─> Render sidebar items
```

### Click to Edit Flow

```
1. User clicks connection in sidebar
   └─> handleConnectionClick(connection) triggered

2. Set loading state
   └─> Show spinner on clicked item

3. Fetch user record
   ├─> Check ConnectionCache
   │   ├─> Cache hit: Use cached record
   │   └─> Cache miss: API call
   └─> API: GET /api/user/database-connections/:id/record
       ├─> Validate user token
       ├─> Check user has access to connection
       ├─> Get user_link_field from connection
       ├─> Query database WHERE user_link_field = userToken
       └─> Return single record

4. Record received
   ├─> Store in ConnectionCache (TTL: 2 min)
   └─> Navigate to /database/:connectionId/edit/:recordId

5. DirectEditPage mounts
   ├─> Extract connectionId from URL
   ├─> Fetch connection details (cached)
   ├─> Fetch record data (cached)
   └─> Render form with data

6. User edits fields
   └─> Update local state

7. User clicks save
   ├─> API: PUT /api/user/database-connections/:id/data/:recordId
   ├─> Invalidate cache for this record
   └─> Show success message
```

### Save Operation Flow

```
1. User clicks "Salvar Alterações"
   └─> handleSave() triggered

2. Validate form data
   ├─> Check required fields
   ├─> Validate field formats
   └─> If invalid: Show error, stop

3. Set saving state
   └─> Disable save button, show spinner

4. API call
   └─> PUT /api/user/database-connections/:id/data/:recordId
       ├─> Validate user token
       ├─> Check user has access
       ├─> Apply field mappings (editable check)
       ├─> Update record in database
       └─> Return success

5. Handle response
   ├─> Success:
   │   ├─> Invalidate cache
   │   ├─> Show success toast
   │   └─> Update local state
   └─> Error:
       ├─> Show error toast
       └─> Keep form in edit mode

6. Reset saving state
   └─> Enable save button
```

## Caching Strategy

### Cache Architecture

```
ConnectionCache (In-Memory Map)
├─ Key: "user-connections:{userToken}"
│  ├─ Data: DatabaseConnection[]
│  ├─ TTL: 5 minutes
│  └─ Invalidation: On admin changes (manual)
│
├─ Key: "user-record:{userToken}:{connectionId}"
│  ├─ Data: UserRecord
│  ├─ TTL: 2 minutes
│  └─ Invalidation: On record update
│
└─ Key: "connection:{connectionId}"
   ├─ Data: DatabaseConnection
   ├─ TTL: 5 minutes
   └─ Invalidation: On connection update
```

### Cache Implementation

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ConnectionCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### Cache Invalidation Strategies

**Time-based (Automatic)**
- Connections: 5 minutes
- Records: 2 minutes
- Rationale: Balance between freshness and performance

**Event-based (Manual)**
- After record update: Invalidate specific record
- After connection update: Invalidate connection and related records
- After user logout: Clear all user-related cache

**Pattern-based (Bulk)**
- Admin changes: Invalidate all connections
- User deletion: Invalidate all user records

## Security Architecture

### Authentication Flow

```
Client Request
    ↓
Extract Token (Authorization header or token header)
    ↓
Validate Token Format
    ↓
Verify Token with WuzAPI
    ↓
Token Valid?
    ├─ Yes: Attach userToken to req, continue
    └─ No: Return 401 Unauthorized
```

### Authorization Flow

```
Authenticated Request
    ↓
Fetch Connection from Database
    ↓
Check connection.assignedUsers array
    ↓
User Token in assignedUsers?
    ├─ Yes: Allow access
    └─ No: Return 403 Forbidden
```

### Security Layers

1. **Transport Security**: HTTPS in production
2. **Authentication**: Token-based auth with WuzAPI validation
3. **Authorization**: Connection-level access control
4. **Input Validation**: Sanitize all user inputs
5. **SQL Injection Prevention**: Parameterized queries only
6. **Rate Limiting**: 30 requests/minute per user
7. **Error Handling**: No sensitive data in error messages

## Performance Optimization

### Frontend Optimizations

**1. Code Splitting**
```typescript
const DynamicDatabaseItems = lazy(() => 
  import('./DynamicDatabaseItems')
);
```

**2. Memoization**
```typescript
const sortedConnections = useMemo(() => 
  connections.sort((a, b) => a.name.localeCompare(b.name)),
  [connections]
);
```

**3. Debouncing**
```typescript
const debouncedFetch = debounce(fetchConnections, 300);
```

**4. Optimistic Updates**
```typescript
// Update UI immediately, rollback on error
const optimisticSave = async (data) => {
  const backup = { ...record };
  setRecord(data);
  try {
    await api.save(data);
  } catch (error) {
    setRecord(backup);
  }
};
```

### Backend Optimizations

**1. Connection Pooling**
```javascript
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000
});
```

**2. Query Optimization**
```javascript
// Use indexes on user_link_field
CREATE INDEX idx_user_link ON table_name(user_link_field);
```

**3. Response Compression**
```javascript
app.use(compression());
```

**4. Caching Headers**
```javascript
res.set('Cache-Control', 'private, max-age=300');
```

## Error Handling

### Error Types and Handling

```typescript
enum ErrorCode {
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  suggestion?: string;
  timestamp: string;
}
```

### Error Recovery Strategies

**Frontend**
- Display user-friendly error messages
- Provide retry mechanisms
- Implement fallback UI
- Log errors for debugging

**Backend**
- Return appropriate HTTP status codes
- Include error codes for client handling
- Log detailed error information
- Implement circuit breakers for external services

## Monitoring and Observability

### Metrics to Track

**Performance Metrics**
- API response times (p50, p95, p99)
- Cache hit rates
- Database query times
- Frontend render times

**Business Metrics**
- Connections per user
- Click-through rates
- Edit session durations
- Save success rates

**Error Metrics**
- Error rates by type
- Failed authentication attempts
- Database connection failures
- API timeout rates

### Logging Strategy

```typescript
// Structured logging
logger.info('User action', {
  action: 'connection_click',
  userId: userToken.substring(0, 8),
  connectionId,
  timestamp: new Date().toISOString()
});

logger.error('Operation failed', {
  operation: 'fetchUserRecord',
  userId: userToken.substring(0, 8),
  connectionId,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

## Deployment Architecture

### Production Deployment

```
┌─────────────────────────────────────────┐
│         Load Balancer (Nginx)           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│      Application Servers (Docker)       │
│  ┌─────────────┐  ┌─────────────┐      │
│  │  Instance 1 │  │  Instance 2 │      │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Database Layer                  │
│  ├─ SQLite (Local)                      │
│  ├─ PostgreSQL (External)               │
│  └─ NocoDB (External API)               │
└─────────────────────────────────────────┘
```

### Scaling Considerations

**Horizontal Scaling**
- Stateless application servers
- Shared database layer
- Load balancer distribution

**Vertical Scaling**
- Increase server resources
- Optimize database queries
- Implement caching

**Database Scaling**
- Read replicas for heavy read operations
- Connection pooling
- Query optimization

## Testing Strategy

### Test Pyramid

```
        ┌─────────────┐
        │     E2E     │  ← Few, slow, expensive
        │   (Cypress) │
        └─────────────┘
       ┌───────────────┐
       │  Integration  │  ← Some, medium speed
       │    (Vitest)   │
       └───────────────┘
      ┌─────────────────┐
      │      Unit       │  ← Many, fast, cheap
      │  (Vitest/Jest)  │
      └─────────────────┘
```

### Test Coverage Goals

- Unit Tests: > 80% coverage
- Integration Tests: Critical paths
- E2E Tests: User journeys

## Migration Path

### Phase 1: Preparation
- Create new API endpoints
- Implement UserRecordService
- Add comprehensive logging

### Phase 2: Frontend Development
- Build DynamicDatabaseItems
- Build DirectEditPage
- Implement caching

### Phase 3: Integration
- Integrate into UserLayout
- Update routing
- Add redirects

### Phase 4: Testing
- Unit tests
- Integration tests
- E2E tests
- Performance testing

### Phase 5: Deployment
- Deploy to staging
- User acceptance testing
- Production deployment
- Monitor and iterate

## Rollback Strategy

If critical issues arise:

1. **Immediate**: Revert to previous Docker image
2. **Short-term**: Re-enable old "Meu Banco" route
3. **Long-term**: Fix issues and redeploy

## Future Enhancements

### Planned Features

1. **Real-time Updates**: WebSocket for live data sync
2. **Offline Support**: Service worker for offline editing
3. **Advanced Caching**: IndexedDB for persistent cache
4. **Bulk Operations**: Edit multiple records at once
5. **Search & Filter**: Search across connections
6. **Audit Trail**: Track all record changes
7. **Permissions**: Granular field-level permissions

### Technical Debt

1. Migrate to React Query for better cache management
2. Implement GraphQL for more efficient data fetching
3. Add comprehensive error boundaries
4. Improve TypeScript coverage
5. Optimize bundle size

---

**Document Version**: 1.0.0  
**Last Updated**: November 7, 2025  
**Status**: Complete
