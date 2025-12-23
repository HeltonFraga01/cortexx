# Dynamic Sidebar Navigation - Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Frontend Components](#frontend-components)
5. [Caching Strategy](#caching-strategy)
6. [Security](#security)
7. [Performance](#performance)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

The Dynamic Sidebar Navigation feature replaces the static "Meu Banco" menu item with dynamically generated menu items based on database connections assigned to each user. This provides direct access to user records without intermediate navigation steps.

### Key Features

- **Dynamic Menu Generation**: Automatically creates sidebar items for each assigned database connection
- **Direct-to-Edit Navigation**: Single-click access from sidebar to record edit form
- **Multi-Database Support**: Works with NocoDB, PostgreSQL, and MySQL (external user databases)
- **Intelligent Caching**: Reduces API calls and improves performance
- **Real-time Updates**: Reflects admin configuration changes after login/refresh

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  UserLayout (Sidebar)                                  │ │
│  │    └─ DynamicDatabaseItems                             │ │
│  │         ├─ Fetches user connections                    │ │
│  │         ├─ Renders dynamic menu items                  │ │
│  │         └─ Handles click → navigation                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  DirectEditPage                                        │ │
│  │    ├─ Loads connection & record                        │ │
│  │    ├─ Renders RecordForm                               │ │
│  │    └─ Handles save operations                          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ConnectionCache                                       │ │
│  │    ├─ TTL-based caching (5 min connections, 2 min records) │ │
│  │    └─ Pattern-based invalidation                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express/Node.js)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GET /api/user/database-connections                    │ │
│  │    └─ Returns connections assigned to user token       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GET /api/user/database-connections/:id/record         │ │
│  │    ├─ Validates user access                            │ │
│  │    ├─ Fetches record via UserRecordService             │ │
│  │    └─ Returns single user record                       │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  UserRecordService                                     │ │
│  │    ├─ fetchNocoDBRecord()                              │ │
│  │    ├─ fetchSQLRecord()                                 │ │
│  │    └─ hasAccess()                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│       External Databases (NocoDB, PostgreSQL, MySQL)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Component Hierarchy

```
UserLayout
  └─ Sidebar
       ├─ SidebarItem (Dashboard)
       ├─ SidebarItem (Messages)
       ├─ DynamicDatabaseItems ← NEW
       │    └─ SidebarItem[] (Dynamic connections)
       └─ SidebarItem (Settings)

DirectEditPage
  ├─ PageHeader
  ├─ ConnectionMetadata
  └─ RecordForm
       └─ FormField[] (Dynamic fields)
```

### Data Flow

1. **User Login** → Auth token stored in context
2. **Sidebar Mount** → DynamicDatabaseItems fetches connections
3. **User Clicks Connection** → Fetch user record via API
4. **Navigate to Edit Page** → Load connection + record data
5. **User Edits Fields** → Update local state
6. **User Saves** → POST to API → Invalidate cache → Show success

### State Management


**Global State (React Context)**
- `AuthContext`: User token, authentication status
- `BrandingContext`: Application branding configuration

**Component State**
- `DynamicDatabaseItems`: connections[], loading, error, activeConnectionId
- `DirectEditPage`: connection, record, loading, saving, error

**Cache State**
- `ConnectionCache`: In-memory Map with TTL-based expiration

---

## API Endpoints

### 1. Get User Connections

**Endpoint**: `GET /api/user/database-connections`

**Purpose**: Fetch all database connections assigned to the authenticated user.

**Authentication**: Required (User Token)

**Headers**:
```http
Authorization: Bearer {userToken}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Teste Final",
      "type": "NOCODB",
      "host": "https://nocodb.example.com",
      "nocodb_project_id": "p123",
      "nocodb_table_id": "my7kpxstrt02976",
      "table_name": "users",
      "user_link_field": "apiToken",
      "field_mappings": [
        {
          "columnName": "companyName",
          "label": "Nome da Empresa",
          "visible": true,
          "editable": true
        },
        {
          "columnName": "websiteUrl",
          "label": "Website",
          "visible": true,
          "editable": true
        }
      ]
    }
  ]
}
```

**Error Responses**:

- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Database or server error

**Implementation**:
```javascript
// server/routes/userRoutes.js
app.get('/api/user/database-connections', verifyUserToken, async (req, res) => {
  const userToken = req.userToken;
  const connections = await db.getConnectionsByUserToken(userToken);
  res.json({ success: true, data: connections });
});
```

---

### 2. Get User Record

**Endpoint**: `GET /api/user/database-connections/:id/record`

**Purpose**: Fetch the single record belonging to the authenticated user for a specific connection.

**Authentication**: Required (User Token)

**Headers**:
```http
Authorization: Bearer {userToken}
```

**Path Parameters**:
- `id` (integer): Database connection ID

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "created_at": "2025-10-30T11:30:40+00:00",
    "updated_at": "2025-11-04T20:51:09+00:00",
    "updated_at": "2025-11-04T20:51:09+00:00",
    "companyName": "Minha Empresa",
    "websiteUrl": "https://minhaempresa.com",
    "apiToken": "01K7MXQ1..."
  },
  "metadata": {
    "connectionId": 1,
    "connectionName": "Teste Final",
    "tableName": "my7kpxstrt02976",
    "userLinkField": "apiToken"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: User doesn't have access to this connection
- `404 Not Found`: Connection not found or no record for user
- `500 Internal Server Error`: Database or server error

**Error Response Example** (404):
```json
{
  "success": false,
  "error": "No record found for this user",
  "code": "RECORD_NOT_FOUND",
  "suggestion": "Contact administrator to create a record for your account",
  "timestamp": "2025-11-07T10:30:00.000Z"
}
```

**Implementation**:
```javascript
// server/routes/userRoutes.js
app.get('/api/user/database-connections/:id/record', 
  rateLimiter, 
  verifyUserToken, 
  async (req, res) => {
    const { id } = req.params;
    const userToken = req.userToken;
    
    const connection = await db.getConnectionById(parseInt(id));
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
        code: 'CONNECTION_NOT_FOUND'
      });
    }
    
    if (!connection.assignedUsers?.includes(userToken)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        code: 'UNAUTHORIZED'
      });
    }
    
    const userRecordService = new UserRecordService(db);
    const record = await userRecordService.getUserRecord(
      parseInt(id), 
      userToken
    );
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'No record found for this user',
        code: 'RECORD_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: record,
      metadata: {
        connectionId: parseInt(id),
        connectionName: connection.name,
        tableName: connection.table_name
      }
    });
});
```

---

## Frontend Components

### DynamicDatabaseItems Component

**Location**: `src/components/user/DynamicDatabaseItems.tsx`

**Purpose**: Renders dynamic sidebar items for user's database connections.


**Props**: None (uses AuthContext for user token)

**State**:
```typescript
interface State {
  connections: DatabaseConnection[];
  loading: boolean;
  error: string | null;
  loadingConnectionId: number | null;
}
```

**Key Methods**:

1. **fetchConnections()**: Fetches user connections from API
2. **handleConnectionClick(connection)**: Handles navigation to edit page
3. **renderConnectionItem(connection)**: Renders individual menu item

**Usage Example**:
```tsx
// In UserLayout.tsx
import { DynamicDatabaseItems } from '@/components/user/DynamicDatabaseItems';

<Sidebar>
  <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/dashboard" />
  <SidebarItem icon={MessageSquare} label="Mensagens" path="/messages" />
  <DynamicDatabaseItems />
  <SidebarItem icon={Settings} label="Configurações" path="/settings" />
</Sidebar>
```

**Implementation Highlights**:
```tsx
export const DynamicDatabaseItems = () => {
  const { userToken } = useAuth();
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConnectionId, setLoadingConnectionId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchConnections();
  }, [userToken]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const data = await databaseConnectionsService.getUserConnections(userToken);
      setConnections(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      toast.error('Erro ao carregar conexões');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionClick = async (connection: DatabaseConnection) => {
    setLoadingConnectionId(connection.id);
    try {
      const record = await databaseConnectionsService.getUserRecord(
        userToken,
        connection.id
      );
      navigate(`/database/${connection.id}/edit/${record.id}`);
    } catch (error) {
      toast.error('Erro ao carregar registro');
    } finally {
      setLoadingConnectionId(null);
    }
  };

  // Render logic...
};
```

---

### DirectEditPage Component

**Location**: `src/pages/user/DirectEditPage.tsx`


**Purpose**: Displays and allows editing of user's database record.

**Route**: `/database/:connectionId/edit/:recordId`

**State**:
```typescript
interface State {
  connection: DatabaseConnection | null;
  record: Record<string, any> | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}
```

**Key Methods**:

1. **fetchData()**: Loads connection and record data
2. **handleFieldChange(field, value)**: Updates record state
3. **handleSave()**: Saves changes to API
4. **applyFieldMappings()**: Filters fields based on visibility settings

**Implementation Highlights**:
```tsx
export const DirectEditPage = () => {
  const { connectionId, recordId } = useParams();
  const { userToken } = useAuth();
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [connectionId, userToken]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const conn = await databaseConnectionsService.getConnectionById(
        Number(connectionId)
      );
      setConnection(conn);
      
      const userRecord = await databaseConnectionsService.getUserRecord(
        userToken,
        Number(connectionId)
      );
      setRecord(userRecord);
    } catch (error) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await databaseConnectionsService.updateUserTableRecord(
        userToken,
        connection!.id,
        record!.id,
        record
      );
      toast.success('Alterações salvas com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  // Render logic with RecordForm...
};
```

---

### RecordForm Component

**Location**: `src/components/user/RecordForm.tsx`

**Purpose**: Renders dynamic form based on field mappings.


**Props**:
```typescript
interface RecordFormProps {
  connection: DatabaseConnection;
  record: Record<string, any>;
  onRecordChange: (record: Record<string, any>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}
```

**Features**:
- Applies field visibility settings (visible: true/false)
- Applies field editability settings (editable: true/false)
- Uses custom labels when configured
- Validates required fields
- Handles different field types (text, number, date, etc.)

**Implementation**:
```tsx
export const RecordForm = ({ 
  connection, 
  record, 
  onRecordChange, 
  onSave, 
  saving 
}: RecordFormProps) => {
  const visibleFields = connection.field_mappings?.filter(f => f.visible) || [];
  
  const handleFieldChange = (fieldName: string, value: any) => {
    onRecordChange({ ...record, [fieldName]: value });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      {visibleFields.map(field => (
        <FormField
          key={field.columnName}
          label={field.label || field.columnName}
          value={record[field.columnName]}
          onChange={(value) => handleFieldChange(field.columnName, value)}
          disabled={!field.editable}
          required={field.required}
        />
      ))}
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar Alterações'}
      </Button>
    </form>
  );
};
```

---

## Caching Strategy

### ConnectionCache Service

**Location**: `src/services/cache/connectionCache.ts`

**Purpose**: Provides TTL-based caching to reduce API calls and improve performance.

**Architecture**:
```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class ConnectionCache {
  private cache: Map<string, CacheEntry<any>>;
  
  set<T>(key: string, data: T, ttl: number): void;
  get<T>(key: string): T | null;
  invalidate(key: string): void;
  invalidatePattern(pattern: RegExp): void;
  clear(): void;
}
```

**Cache Keys**:
- `user-connections:{userToken}` - User's database connections (TTL: 5 minutes)
- `user-record:{userToken}:{connectionId}` - User's record for a connection (TTL: 2 minutes)
- `connection:{connectionId}` - Connection details (TTL: 5 minutes)

**TTL Configuration**:

```typescript
const CACHE_TTL = {
  CONNECTIONS: 5 * 60 * 1000,  // 5 minutes
  RECORD: 2 * 60 * 1000,        // 2 minutes
  CONNECTION: 5 * 60 * 1000     // 5 minutes
};
```

**Usage in Service**:
```typescript
// src/services/database-connections.ts
export class DatabaseConnectionsService {
  async getUserConnections(userToken: string): Promise<DatabaseConnection[]> {
    const cacheKey = `user-connections:${userToken}`;
    
    // Try cache first
    const cached = connectionCache.get<DatabaseConnection[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from API
    const response = await apiClient.get('/api/user/database-connections', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    
    const connections = response.data.data;
    
    // Cache for 5 minutes
    connectionCache.set(cacheKey, connections, CACHE_TTL.CONNECTIONS);
    
    return connections;
  }

  async updateUserTableRecord(
    userToken: string,
    connectionId: number,
    recordId: string,
    data: Record<string, any>
  ): Promise<any> {
    // Update via API
    const result = await apiClient.put(
      `/api/user/database-connections/${connectionId}/data/${recordId}`,
      data,
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    
    // Invalidate cache for this record
    connectionCache.invalidate(`user-record:${userToken}:${connectionId}`);
    
    return result.data;
  }
}
```

**Cache Invalidation Strategies**:

1. **Time-based**: Automatic expiration after TTL
2. **Event-based**: Manual invalidation after updates
3. **Pattern-based**: Invalidate multiple related entries

**Example - Pattern Invalidation**:
```typescript
// Invalidate all records for a user
connectionCache.invalidatePattern(new RegExp(`^user-record:${userToken}:`));

// Invalidate all connection-related cache
connectionCache.invalidatePattern(/^connection:/);
```

---

## Security

### Authentication & Authorization

**Token Validation**:
```javascript
// server/middleware/verifyUserToken.js
const verifyUserToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers.token;
  
  let userToken = null;
  if (authHeader?.startsWith('Bearer ')) {
    userToken = authHeader.substring(7);
  } else if (tokenHeader) {
    userToken = tokenHeader;
  }
  
  if (!userToken) {
    return res.status(401).json({
      error: 'Token não fornecido',
      code: 'UNAUTHORIZED'
    });
  }
  
  // Validate with external service
  const isValid = await validateTokenWithWuzAPI(userToken);
  if (!isValid) {
    return res.status(401).json({
      error: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }
  
  req.userToken = userToken;
  next();
};
```

**Access Control**:

```javascript
// Check if user has access to connection
const hasAccess = (connection, userToken) => {
  return connection.assignedUsers && 
         Array.isArray(connection.assignedUsers) &&
         connection.assignedUsers.includes(userToken);
};

// In endpoint
if (!hasAccess(connection, userToken)) {
  return res.status(403).json({
    success: false,
    error: 'Access denied to this connection',
    code: 'FORBIDDEN'
  });
}
```

### SQL Injection Prevention

**Always use parameterized queries**:
```javascript
// ❌ BAD - Vulnerable to SQL injection
const query = `SELECT * FROM ${tableName} WHERE ${fieldName} = '${userToken}'`;

// ✅ GOOD - Safe parameterized query
const query = `SELECT * FROM ?? WHERE ?? = ?`;
const params = [tableName, fieldName, userToken];
const results = await db.query(query, params);
```

### XSS Prevention

**Frontend sanitization**:
```typescript
import DOMPurify from 'dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};

// Use in form inputs
const handleFieldChange = (field: string, value: string) => {
  const sanitized = sanitizeInput(value);
  setRecord({ ...record, [field]: sanitized });
};
```

### Rate Limiting

**Configuration**:
```javascript
// server/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const userRecordLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute window
  max: 30,                     // 30 requests per minute
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userToken || req.ip
});

// Apply to endpoints
app.get('/api/user/database-connections/:id/record', 
  userRecordLimiter,
  verifyUserToken,
  handler
);
```

---

## Performance

### Optimization Techniques

**1. Lazy Loading**:
```typescript
// Lazy load DynamicDatabaseItems
const DynamicDatabaseItems = lazy(() => 
  import('./DynamicDatabaseItems').then(m => ({ default: m.DynamicDatabaseItems }))
);

// Usage with Suspense
<Suspense fallback={<LoadingSkeleton />}>
  <DynamicDatabaseItems />
</Suspense>
```

**2. Debounced Fetching**:
```typescript
import { debounce } from 'lodash';

const debouncedFetch = debounce(async () => {
  await fetchConnections();
}, 300);
```

**3. Optimistic Updates**:
```typescript
const handleSave = async () => {
  const originalRecord = { ...record };
  
  try {
    // Update UI immediately
    toast.success('Salvando...');
    
    // Make API call
    await saveRecord(record);
    toast.success('Salvo com sucesso!');
  } catch (error) {
    // Rollback on error
    setRecord(originalRecord);
    toast.error('Erro ao salvar');
  }
};
```

**4. Request Batching**:

```typescript
// Fetch multiple connections in parallel
const fetchAllData = async () => {
  const [connections, userInfo, settings] = await Promise.all([
    fetchConnections(),
    fetchUserInfo(),
    fetchSettings()
  ]);
};
```

### Performance Metrics

**Target Metrics**:
- Sidebar load time: < 500ms
- Record fetch time: < 1s
- Form render time: < 200ms
- Save operation: < 2s

**Monitoring**:
```typescript
// Track performance
const startTime = performance.now();
await fetchConnections();
const endTime = performance.now();
console.log(`Fetch took ${endTime - startTime}ms`);

// Log to monitoring service
logger.info('Performance metric', {
  operation: 'fetchConnections',
  duration: endTime - startTime,
  userToken: userToken.substring(0, 8)
});
```

---

## Testing

### Unit Tests

**DynamicDatabaseItems Tests**:
```typescript
// src/components/user/__tests__/DynamicDatabaseItems.test.tsx
describe('DynamicDatabaseItems', () => {
  it('should fetch and render connections on mount', async () => {
    const mockConnections = [
      { id: 1, name: 'Test DB', type: 'NOCODB' }
    ];
    
    vi.spyOn(databaseConnectionsService, 'getUserConnections')
      .mockResolvedValue(mockConnections);
    
    render(<DynamicDatabaseItems />);
    
    await waitFor(() => {
      expect(screen.getByText('Test DB')).toBeInTheDocument();
    });
  });

  it('should handle click and navigate', async () => {
    const mockRecord = { id: 1, name: 'Test' };
    vi.spyOn(databaseConnectionsService, 'getUserRecord')
      .mockResolvedValue(mockRecord);
    
    const navigate = vi.fn();
    vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
    
    render(<DynamicDatabaseItems />);
    
    const item = await screen.findByText('Test DB');
    fireEvent.click(item);
    
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/database/1/edit/1');
    });
  });

  it('should display loading state', () => {
    vi.spyOn(databaseConnectionsService, 'getUserConnections')
      .mockImplementation(() => new Promise(() => {}));
    
    render(<DynamicDatabaseItems />);
    
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('should handle errors gracefully', async () => {
    vi.spyOn(databaseConnectionsService, 'getUserConnections')
      .mockRejectedValue(new Error('Network error'));
    
    render(<DynamicDatabaseItems />);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Erro')
      );
    });
  });
});
```

**Backend Tests**:
```javascript
// server/tests/routes/user-record.test.js
describe('GET /api/user/database-connections/:id/record', () => {
  it('should return user record when found', async () => {
    const response = await request(app)
      .get('/api/user/database-connections/1/record')
      .set('Authorization', 'Bearer validToken')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('id');
  });

  it('should return 404 when record not found', async () => {
    const response = await request(app)
      .get('/api/user/database-connections/999/record')
      .set('Authorization', 'Bearer validToken')
      .expect(404);
    
    expect(response.body.code).toBe('RECORD_NOT_FOUND');
  });

  it('should return 403 when user lacks access', async () => {
    const response = await request(app)
      .get('/api/user/database-connections/1/record')
      .set('Authorization', 'Bearer unauthorizedToken')
      .expect(403);
    
    expect(response.body.code).toBe('FORBIDDEN');
  });
});
```

### Integration Tests

**End-to-End Flow**:

```typescript
// cypress/e2e/dynamic-sidebar-navigation.cy.ts
describe('Dynamic Sidebar Navigation', () => {
  beforeEach(() => {
    cy.login('validUserToken');
  });

  it('should complete full navigation flow', () => {
    // 1. Verify sidebar shows connections
    cy.get('[data-testid="sidebar"]').within(() => {
      cy.contains('Teste Final').should('be.visible');
    });

    // 2. Click on connection
    cy.contains('Teste Final').click();

    // 3. Verify navigation to edit page
    cy.url().should('include', '/database/1/edit/');

    // 4. Verify form is loaded with data
    cy.get('input[name="companyName"]')
      .should('have.value', 'HeltonWzapi');

    // 5. Edit a field
    cy.get('input[name="companyName"]')
      .clear()
      .type('NewInboxName');

    // 6. Save changes
    cy.contains('Salvar Alterações').click();

    // 7. Verify success message
    cy.contains('Alterações salvas com sucesso!').should('be.visible');

    // 8. Reload and verify persistence
    cy.reload();
    cy.get('input[name="companyName"]')
      .should('have.value', 'NewInboxName');
  });

  it('should handle multiple connections', () => {
    cy.get('[data-testid="sidebar"]').within(() => {
      cy.contains('Teste Final').should('be.visible');
      cy.contains('MasterMegga').should('be.visible');
    });

    // Test first connection
    cy.contains('Teste Final').click();
    cy.url().should('include', '/database/1/edit/');
    cy.go('back');

    // Test second connection
    cy.contains('MasterMegga').click();
    cy.url().should('include', '/database/2/edit/');
  });

  it('should handle errors gracefully', () => {
    // Mock API error
    cy.intercept('GET', '/api/user/database-connections/1/record', {
      statusCode: 404,
      body: {
        success: false,
        code: 'RECORD_NOT_FOUND'
      }
    });

    cy.contains('Teste Final').click();
    cy.contains('Nenhum registro encontrado').should('be.visible');
  });
});
```

---

## Deployment

### Environment Variables

```bash
# Backend (.env)
PORT=3001
NODE_ENV=production
WUZAPI_BASE_URL=https://api.wuzapi.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
LOG_LEVEL=info

# Frontend (.env)
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_ADMIN_TOKEN=your_admin_token
```

### Build Process

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build frontend
npm run build

# Build Docker image
docker build -t wuzapi-manager:latest .

# Run Docker container
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  wuzapi-manager:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  wuzapi-manager:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WUZAPI_BASE_URL=https://api.wuzapi.com
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Migration Checklist

- [ ] Backup existing database
- [ ] Update environment variables
- [ ] Run database migrations (if any)
- [ ] Deploy new version
- [ ] Verify health checks pass
- [ ] Test dynamic sidebar functionality
- [ ] Monitor logs for errors
- [ ] Verify cache is working
- [ ] Test with multiple users
- [ ] Rollback plan ready

---

## Troubleshooting

### Common Issues

**Issue 1: Connections Not Appearing in Sidebar**

**Symptoms**:
- Sidebar shows no dynamic items
- Loading spinner never disappears

**Possible Causes**:
- No connections assigned to user
- API endpoint returning error
- Network connectivity issues

**Solutions**:

1. Check browser console for errors
2. Verify API endpoint is accessible: `curl -H "Authorization: Bearer {token}" http://localhost:3001/api/user/database-connections`
3. Check database for assigned connections
4. Verify user token is valid
5. Clear browser cache and reload

**Debug Commands**:
```bash
# Test API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/user/database-connections

# Check server logs
tail -f server/logs/app-$(date +%Y-%m-%d).log
```

---

**Issue 2: "Record Not Found" Error**

**Symptoms**:
- Error message: "Nenhum registro encontrado para sua conta"
- Clicking connection shows error toast

**Possible Causes**:
- User record doesn't exist in database
- user_link_field misconfigured
- Token mismatch

**Solutions**:
1. Verify record exists: Check database table for record with matching token
2. Verify user_link_field is correct in connection configuration
3. Check token value matches exactly (case-sensitive)
4. Create record if missing

**Debug Commands**:
```bash
# For NocoDB connection
curl -H "xc-token: YOUR_NOCODB_TOKEN" \
  "https://nocodb.example.com/api/v1/db/data/noco/PROJECT_ID/TABLE_ID?where=(apiToken,eq,USER_TOKEN)"
```

---

**Issue 3: Slow Performance**

**Symptoms**:
- Sidebar takes > 2 seconds to load
- Clicking connection has noticeable delay
- Form takes long to render

**Possible Causes**:
- Cache not working
- Slow database queries
- Network latency
- Large field mappings

**Solutions**:
1. Verify cache is enabled and working
2. Check database query performance
3. Optimize field mappings (reduce visible fields)
4. Enable compression on API responses
5. Use CDN for static assets

**Performance Monitoring**:
```typescript
// Add performance logging
const startTime = performance.now();
await fetchConnections();
const duration = performance.now() - startTime;

if (duration > 1000) {
  logger.warn('Slow connection fetch', { duration, userToken });
}
```

---

**Issue 4: Cache Not Invalidating**

**Symptoms**:
- Changes not reflected after save
- Old data appears after admin updates
- Stale connections in sidebar

**Possible Causes**:
- Cache invalidation not triggered
- TTL too long
- Browser cache interfering

**Solutions**:
1. Manually clear cache: `connectionCache.clear()`
2. Reduce TTL values for testing
3. Add cache-busting headers
4. Force refresh with Ctrl+Shift+R

**Debug Code**:
```typescript
// Check cache contents
console.log('Cache keys:', Array.from(connectionCache.keys()));

// Force invalidation
connectionCache.invalidatePattern(/^user-/);

// Disable cache temporarily
const CACHE_ENABLED = false;
if (!CACHE_ENABLED) {
  return await fetchFromAPI();
}
```

---

**Issue 5: Rate Limit Exceeded**

**Symptoms**:
- Error: "Too many requests"
- 429 status code
- Requests blocked

**Possible Causes**:
- Too many rapid clicks
- Polling too frequently
- Multiple tabs open

**Solutions**:
1. Implement debouncing on click handlers
2. Increase rate limit threshold
3. Add user feedback about rate limits
4. Use exponential backoff for retries

**Configuration**:
```javascript
// Adjust rate limiter
const userRecordLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,  // Increase from 30 to 50
  skipSuccessfulRequests: true  // Don't count successful requests
});
```

---

## Monitoring & Logging

### Key Metrics to Track

```typescript
interface Metrics {
  // Performance
  sidebarLoadTime: number;
  recordFetchTime: number;
  saveOperationTime: number;
  
  // Usage
  connectionsPerUser: number;
  clicksPerConnection: number;
  editSessionDuration: number;
  
  // Errors
  fetchErrors: number;
  saveErrors: number;
  authErrors: number;
  cacheHitRate: number;
}
```

### Logging Strategy

```typescript
// Structured logging
logger.info('User clicked connection', {
  userId: userToken.substring(0, 8),
  connectionId,
  connectionName,
  timestamp: new Date().toISOString()
});

logger.error('Failed to fetch user record', {
  userId: userToken.substring(0, 8),
  connectionId,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});

logger.warn('Slow query detected', {
  operation: 'fetchUserRecord',
  duration: 3500,
  threshold: 2000,
  connectionId
});
```

### Alerts Configuration

Set up alerts for:
- Error rate > 5% over 5 minutes
- Response time > 3 seconds (p95)
- Cache hit rate < 70%
- Authentication failures > 10/minute
- Database connection failures

---

## API Examples

### Example 1: Fetch User Connections

```bash
curl -X GET \
  -H "Authorization: Bearer abc123def456" \
  http://localhost:3001/api/user/database-connections
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Teste Final",
      "type": "NOCODB",
      "user_link_field": "apiToken",
      "field_mappings": [...]
    }
  ]
}
```

### Example 2: Fetch User Record

```bash
curl -X GET \
  -H "Authorization: Bearer abc123def456" \
  http://localhost:3001/api/user/database-connections/1/record
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "updated_at": "2025-11-04T20:51:09+00:00",
    "companyName": "Minha Empresa",
    "websiteUrl": "https://minhaempresa.com"
  },
  "metadata": {
    "connectionId": 1,
    "connectionName": "Teste Final"
  }
}
```

### Example 3: Update User Record

```bash
curl -X PUT \
  -H "Authorization: Bearer abc123def456" \
  -H "Content-Type: application/json" \
  -d '{"companyName": "NewName"}' \
  http://localhost:3001/api/user/database-connections/1/data/1
```

**Response**:
```json
{
  "success": true,
  "message": "Record updated successfully"
}
```

---

## Best Practices

### Frontend

1. **Always handle loading states**
   ```tsx
   {loading ? <Skeleton /> : <Content />}
   ```

2. **Provide user feedback**
   ```tsx
   toast.success('Saved!');
   toast.error('Failed to save');
   ```

3. **Validate before saving**
   ```tsx
   if (!isValid(record)) {
     toast.error('Please fill required fields');
     return;
   }
   ```

4. **Use TypeScript for type safety**
   ```tsx
   interface DatabaseConnection {
     id: number;
     name: string;
     // ...
   }
   ```

5. **Implement error boundaries**
   ```tsx
   <ErrorBoundary fallback={<ErrorPage />}>
     <DynamicDatabaseItems />
   </ErrorBoundary>
   ```

### Backend

1. **Always validate input**
   ```javascript
   if (!connectionId || isNaN(connectionId)) {
     return res.status(400).json({ error: 'Invalid connection ID' });
   }
   ```

2. **Use parameterized queries**
   ```javascript
   const query = 'SELECT * FROM ?? WHERE ?? = ?';
   const params = [table, field, value];
   ```

3. **Log important events**
   ```javascript
   logger.info('User record fetched', { userId, connectionId });
   ```

4. **Handle errors gracefully**
   ```javascript
   try {
     // operation
   } catch (error) {
     logger.error('Operation failed', { error: error.message });
     res.status(500).json({ error: 'Internal server error' });
   }
   ```

5. **Implement rate limiting**
   ```javascript
   app.use('/api/user/', rateLimiter);
   ```

---

## Changelog

### Version 1.0.0 (November 2025)

**Added**:
- Dynamic sidebar navigation for database connections
- Direct-to-edit functionality
- UserRecordService for multi-database support
- ConnectionCache for performance optimization
- Rate limiting on user record endpoints
- Comprehensive error handling
- Full test coverage

**Changed**:
- Removed static "Meu Banco" menu item
- Updated routing to support direct edit URLs
- Enhanced DatabaseConnectionsService with caching

**Deprecated**:
- `/meu-banco` route (redirects to `/dashboard`)
- Card-based database selection interface

---

## References

### Related Documentation

- [User Guide](./USER_DATABASE_NAVIGATION_GUIDE.md) - End-user documentation
- [API Documentation](./api/README.md) - Complete API reference
- [Development Guide](./DEVELOPMENT_GUIDE.md) - Setup and development
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

### External Resources

- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/)
- [NocoDB API](https://docs.nocodb.com/)
- [Supabase Documentation](https://supabase.com/docs)

---

**Document Version**: 1.1.0  
**Last Updated**: December 23, 2025  
**Authors**: WUZAPI Manager Development Team  
**Status**: Complete
