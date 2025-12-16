# Design Document

## Overview

Esta especificação de design detalha a implementação da navegação dinâmica na sidebar, substituindo o fluxo atual de múltiplos cliques por acesso direto aos formulários de edição de registros do usuário. A solução envolve modificações no frontend (React), backend (Express/Node.js), e na estrutura de dados para suportar carregamento dinâmico e caching eficiente.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Sidebar Component (Dynamic Menu Items)                │ │
│  │  - Fetches user connections on mount                   │ │
│  │  - Renders dynamic menu items                          │ │
│  │  - Handles click → direct-to-edit navigation           │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Record Edit Page                                      │ │
│  │  - Pre-loads record data                               │ │
│  │  - Renders form with field mappings                    │ │
│  │  - Handles save/update operations                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express/Node.js)                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  User Connections API                                  │ │
│  │  GET /api/user/database-connections                    │ │
│  │  - Returns connections assigned to user token          │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Direct Record Fetch API                               │ │
│  │  GET /api/user/database-connections/:id/record         │ │
│  │  - Fetches single record matching user token           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              External Databases (NocoDB, SQLite, etc.)       │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Login → Sidebar Mounts → Fetch User Connections → Render Dynamic Items
                                                              ↓
User Clicks "Teste Final" → Fetch User Record → Navigate to Edit Page
                                                              ↓
                                    Pre-load Form → User Edits → Save Changes
```


## Components and Interfaces

### Frontend Components

#### 1. DynamicSidebar Component

**Location:** `src/components/layout/DynamicSidebar.tsx`

**Purpose:** Gerencia a renderização dinâmica dos itens de menu baseados nas conexões do usuário.

**Props:**
```typescript
interface DynamicSidebarProps {
  userToken: string;
  onNavigate?: (connectionId: number) => void;
}
```

**State:**
```typescript
interface DynamicSidebarState {
  connections: DatabaseConnection[];
  loading: boolean;
  error: string | null;
  activeConnectionId: number | null;
}
```

**Key Methods:**
- `fetchUserConnections()`: Busca conexões atribuídas ao usuário
- `handleConnectionClick(connectionId)`: Gerencia navegação direct-to-edit
- `renderConnectionItem(connection)`: Renderiza item individual de menu

#### 2. DirectEditPage Component

**Location:** `src/pages/user/DirectEditPage.tsx`

**Purpose:** Página de edição que carrega automaticamente o registro do usuário.

**Props:**
```typescript
interface DirectEditPageProps {
  connectionId: number; // From URL params
}
```

**State:**
```typescript
interface DirectEditPageState {
  connection: DatabaseConnection | null;
  record: Record<string, any> | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
}
```

**Key Methods:**
- `fetchConnectionAndRecord()`: Busca conexão e registro do usuário
- `handleFieldChange(fieldName, value)`: Gerencia mudanças nos campos
- `handleSave()`: Salva alterações no registro
- `applyFieldMappings()`: Aplica configurações de visibilidade/editabilidade

### Backend APIs

#### 1. User Connections Endpoint

**Endpoint:** `GET /api/user/database-connections`

**Headers:**
```
Authorization: Bearer {userToken}
```

**Response:**
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
      "user_link_field": "apiToken",
      "field_mappings": [
        {
          "columnName": "chatwootInboxName",
          "label": "Nome do Inbox",
          "visible": true,
          "editable": true
        }
      ]
    }
  ]
}
```

#### 2. Direct Record Fetch Endpoint

**Endpoint:** `GET /api/user/database-connections/:id/record`

**Headers:**
```
Authorization: Bearer {userToken}
```

**Query Parameters:**
- None (user token is extracted from Authorization header)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "created_at": "2025-10-30T11:30:40+00:00",
    "updated_at": "2025-11-04T20:51:09+00:00",
    "chatwootInboxName": "HeltonWzapi",
    "chatwootBaseUrl": "https://chat.wasend.com.br",
    "apiToken": "01K7MXQ1..."
  },
  "metadata": {
    "connectionId": 1,
    "connectionName": "Teste Final",
    "tableName": "my7kpxstrt02976"
  }
}
```

**Error Response (No Record Found):**
```json
{
  "success": false,
  "error": "No record found for this user",
  "code": "RECORD_NOT_FOUND",
  "suggestion": "Contact administrator to create a record for your account"
}
```


## Data Models

### DatabaseConnection (Extended)

```typescript
interface DatabaseConnection {
  id: number;
  name: string;
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  assignedUsers: string[]; // Array of user tokens
  
  // NocoDB specific
  nocodb_token?: string;
  nocodb_project_id?: string;
  nocodb_table_id?: string;
  
  // User linking
  user_link_field: string; // Campo que vincula ao usuário (ex: "apiToken")
  
  // Field mappings
  field_mappings: FieldMapping[];
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

interface FieldMapping {
  columnName: string;
  label: string;
  visible: boolean;
  editable: boolean;
}
```

### UserRecord (Generic)

```typescript
interface UserRecord {
  id: number | string;
  [key: string]: any; // Dynamic fields based on table schema
}
```

### SidebarMenuItem

```typescript
interface SidebarMenuItem {
  id: number;
  type: 'static' | 'dynamic';
  label: string;
  icon: React.ComponentType;
  path?: string; // For static items
  connectionId?: number; // For dynamic items
  onClick?: () => void;
  active: boolean;
}
```

## Error Handling

### Error Types

```typescript
enum DatabaseNavigationError {
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_FIELD_MAPPING = 'INVALID_FIELD_MAPPING',
  DATABASE_ERROR = 'DATABASE_ERROR'
}
```

### Error Handling Strategy

1. **CONNECTION_NOT_FOUND**: Exibir toast de erro e redirecionar para dashboard
2. **RECORD_NOT_FOUND**: Exibir mensagem com opção de criar novo registro
3. **UNAUTHORIZED**: Limpar token e redirecionar para login
4. **NETWORK_ERROR**: Exibir toast com botão "Tentar Novamente"
5. **INVALID_FIELD_MAPPING**: Log de erro e usar fallback (todos campos visíveis/editáveis)
6. **DATABASE_ERROR**: Exibir toast de erro genérico e log detalhado no console

### Error Recovery

```typescript
class ErrorRecoveryService {
  static async retryWithBackoff(
    fn: () => Promise<any>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
}
```


## Testing Strategy

### Unit Tests

#### Frontend Components

**DynamicSidebar.test.tsx**
```typescript
describe('DynamicSidebar', () => {
  it('should fetch and render user connections on mount', async () => {
    // Mock API response
    // Render component
    // Assert connections are displayed
  });

  it('should handle click and navigate to edit page', async () => {
    // Mock navigation
    // Click on connection item
    // Assert navigation was called with correct params
  });

  it('should display loading state while fetching connections', () => {
    // Mock delayed API response
    // Assert loading spinner is visible
  });

  it('should display error message when fetch fails', async () => {
    // Mock API error
    // Assert error toast is displayed
  });

  it('should not render "Meu Banco" static item', () => {
    // Render component
    // Assert "Meu Banco" is not in the DOM
  });
});
```

**DirectEditPage.test.tsx**
```typescript
describe('DirectEditPage', () => {
  it('should fetch and display user record on mount', async () => {
    // Mock API response with record data
    // Render component
    // Assert form fields are populated
  });

  it('should apply field mappings correctly', () => {
    // Mock connection with field mappings
    // Render component
    // Assert hidden fields are not visible
    // Assert readonly fields are disabled
  });

  it('should handle save operation successfully', async () => {
    // Mock save API
    // Fill form and click save
    // Assert success toast is displayed
  });

  it('should display error when record not found', async () => {
    // Mock API error RECORD_NOT_FOUND
    // Assert error message with create option is displayed
  });
});
```

#### Backend APIs

**userConnectionsRoutes.test.js**
```javascript
describe('GET /api/user/database-connections', () => {
  it('should return connections assigned to user token', async () => {
    // Create test connections
    // Make request with user token
    // Assert correct connections are returned
  });

  it('should return empty array when user has no connections', async () => {
    // Make request with token that has no connections
    // Assert empty array is returned
  });

  it('should return 401 when token is invalid', async () => {
    // Make request with invalid token
    // Assert 401 status
  });
});

describe('GET /api/user/database-connections/:id/record', () => {
  it('should return user record when found', async () => {
    // Create test record
    // Make request
    // Assert record is returned
  });

  it('should return 404 when record not found', async () => {
    // Make request for non-existent record
    // Assert 404 status with RECORD_NOT_FOUND error
  });

  it('should filter by user_link_field correctly', async () => {
    // Create multiple records
    // Make request
    // Assert only user's record is returned
  });
});
```

### Integration Tests

**Dynamic Navigation Flow**
```typescript
describe('Dynamic Navigation Integration', () => {
  it('should complete full flow: login → sidebar → edit → save', async () => {
    // 1. Login as user
    // 2. Assert sidebar shows user connections
    // 3. Click on connection
    // 4. Assert edit page loads with record data
    // 5. Edit a field
    // 6. Save changes
    // 7. Assert success and data is persisted
  });

  it('should handle multiple connections correctly', async () => {
    // Login as user with multiple connections
    // Assert all connections appear in sidebar
    // Click on each connection
    // Assert correct record is loaded for each
  });
});
```

### End-to-End Tests

**User Journey**
```typescript
describe('User Database Navigation E2E', () => {
  it('should allow user to edit their record via sidebar', async () => {
    // Navigate to login page
    // Enter credentials
    // Wait for sidebar to load
    // Click on "Teste Final" in sidebar
    // Wait for edit page to load
    // Verify form is populated
    // Change "chatwootInboxName" field
    // Click save button
    // Verify success message
    // Refresh page
    // Verify changes persisted
  });
});
```


## Implementation Details

### Frontend Implementation

#### 1. Sidebar Refactoring

**Current Structure (to be removed):**
```tsx
// src/components/layout/Sidebar.tsx
<SidebarItem icon={Database} label="Meu Banco" path="/meu-banco" />
```

**New Structure:**
```tsx
// src/components/layout/Sidebar.tsx
import { DynamicDatabaseItems } from './DynamicDatabaseItems';

export const Sidebar = () => {
  const { userToken } = useAuth();
  
  return (
    <nav className="sidebar">
      <SidebarItem icon={LayoutDashboard} label="Dashboard" path="/dashboard" />
      <SidebarItem icon={MessageSquare} label="Mensagens" path="/messages" />
      
      {/* Dynamic database connections */}
      <DynamicDatabaseItems userToken={userToken} />
      
      <SidebarItem icon={Settings} label="Configurações" path="/settings" />
    </nav>
  );
};
```

#### 2. DynamicDatabaseItems Component

```tsx
// src/components/layout/DynamicDatabaseItems.tsx
import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { databaseConnectionsService } from '@/services/database-connections';
import { toast } from 'sonner';

export const DynamicDatabaseItems = ({ userToken }: { userToken: string }) => {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
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
      console.error('Failed to fetch user connections:', error);
      toast.error('Erro ao carregar conexões de banco de dados');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionClick = async (connection: DatabaseConnection) => {
    if (!connection.id) return;
    
    setActiveId(connection.id);
    
    try {
      // Fetch user's record directly
      const record = await databaseConnectionsService.getUserRecord(
        userToken,
        connection.id
      );
      
      if (!record) {
        toast.error('Nenhum registro encontrado para sua conta');
        return;
      }
      
      // Navigate directly to edit page
      navigate(`/database/${connection.id}/edit/${record.id}`);
      
    } catch (error) {
      console.error('Failed to fetch user record:', error);
      toast.error('Erro ao carregar seus dados');
    } finally {
      setActiveId(null);
    }
  };

  if (loading) {
    return (
      <div className="sidebar-section">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-700 rounded mb-2"></div>
        </div>
      </div>
    );
  }

  if (connections.length === 0) {
    return null; // Don't show anything if no connections
  }

  return (
    <div className="sidebar-section">
      {connections.map((connection) => (
        <button
          key={connection.id}
          onClick={() => handleConnectionClick(connection)}
          disabled={activeId === connection.id}
          className={`sidebar-item ${activeId === connection.id ? 'loading' : ''}`}
        >
          <Database className="sidebar-icon" />
          <span>{connection.name}</span>
          {activeId === connection.id && (
            <Loader2 className="ml-auto animate-spin" size={16} />
          )}
        </button>
      ))}
    </div>
  );
};
```

#### 3. DirectEditPage Component

```tsx
// src/pages/user/DirectEditPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { databaseConnectionsService } from '@/services/database-connections';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export const DirectEditPage = () => {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { userToken } = useAuth();
  const navigate = useNavigate();
  
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (connectionId) {
      fetchData();
    }
  }, [connectionId, userToken]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch connection details
      const conn = await databaseConnectionsService.getConnectionById(
        Number(connectionId)
      );
      
      if (!conn) {
        toast.error('Conexão não encontrada');
        navigate('/dashboard');
        return;
      }
      
      setConnection(conn);
      
      // Fetch user's record
      const userRecord = await databaseConnectionsService.getUserRecord(
        userToken,
        Number(connectionId)
      );
      
      if (!userRecord) {
        toast.error('Nenhum registro encontrado para sua conta');
        return;
      }
      
      setRecord(userRecord);
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!connection?.id || !record?.id) return;
    
    try {
      setSaving(true);
      
      await databaseConnectionsService.updateUserTableRecord(
        userToken,
        connection.id,
        record.id,
        record
      );
      
      toast.success('Alterações salvas com sucesso!');
      
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!connection || !record) {
    return <ErrorState />;
  }

  return (
    <div className="edit-page">
      <header>
        <h1>Editar Registro - {connection.name}</h1>
        <div className="metadata">
          <span>Tipo: {connection.type}</span>
          <span>Tabela: {connection.table_name}</span>
          <span>Vínculo: {connection.user_link_field}</span>
        </div>
      </header>
      
      <RecordForm
        connection={connection}
        record={record}
        onRecordChange={setRecord}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
};
```


### Backend Implementation

#### 1. New API Endpoint - Get User Record

```javascript
// server/index.js

// GET /api/user/database-connections/:id/record - Buscar registro único do usuário
app.get('/api/user/database-connections/:id/record', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;
    
    logger.info('📊 Solicitação de registro único do usuário:', { 
      connectionId: id, 
      userToken: userToken.substring(0, 8) + '...' 
    });
    
    // Buscar configuração da conexão
    const connection = await db.getConnectionById(parseInt(id));
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
        code: 'CONNECTION_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }
    
    // Verificar se o usuário tem acesso a esta conexão
    if (!connection.assignedUsers || !connection.assignedUsers.includes(userToken)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this connection',
        code: 'UNAUTHORIZED',
        timestamp: new Date().toISOString()
      });
    }
    
    // Buscar o registro do usuário usando o campo de vínculo
    const userLinkField = connection.user_link_field || connection.userLinkField;
    
    if (!userLinkField) {
      return res.status(400).json({
        success: false,
        error: 'User link field not configured for this connection',
        code: 'INVALID_CONFIGURATION',
        timestamp: new Date().toISOString()
      });
    }
    
    // Buscar dados baseado no tipo de banco
    let record = null;
    
    if (connection.type === 'NOCODB') {
      record = await fetchNocoDBUserRecord(connection, userLinkField, userToken);
    } else if (connection.type === 'SQLITE') {
      record = await fetchSQLiteUserRecord(connection, userLinkField, userToken);
    } else {
      // Outros tipos de banco
      record = await fetchGenericUserRecord(connection, userLinkField, userToken);
    }
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'No record found for this user',
        code: 'RECORD_NOT_FOUND',
        suggestion: 'Contact administrator to create a record for your account',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: record,
      metadata: {
        connectionId: parseInt(id),
        connectionName: connection.name,
        tableName: connection.table_name,
        userLinkField: userLinkField
      }
    });
    
  } catch (error) {
    logger.error('❌ Erro ao buscar registro do usuário:', { 
      connectionId: req.params.id, 
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function para buscar registro no NocoDB
async function fetchNocoDBUserRecord(connection, userLinkField, userToken) {
  const axios = require('axios');
  
  try {
    const api = axios.create({
      baseURL: connection.host,
      headers: {
        'xc-token': connection.nocodb_token || connection.password,
      },
      timeout: 10000,
    });
    
    const response = await api.get(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
      {
        params: {
          where: `(${userLinkField},eq,${userToken})`,
          limit: 1
        }
      }
    );
    
    const records = response.data.list || response.data.data || [];
    return records.length > 0 ? records[0] : null;
    
  } catch (error) {
    logger.error('❌ Erro ao buscar registro no NocoDB:', error.message);
    throw error;
  }
}

// Helper function para buscar registro no SQLite
async function fetchSQLiteUserRecord(connection, userLinkField, userToken) {
  // Implementação usando o database.js existente
  const query = `
    SELECT * FROM ${connection.table_name}
    WHERE ${userLinkField} = ?
    LIMIT 1
  `;
  
  const records = await db.query(query, [userToken]);
  return records.length > 0 ? records[0] : null;
}

// Helper function genérica para outros tipos de banco
async function fetchGenericUserRecord(connection, userLinkField, userToken) {
  // Implementação genérica que pode ser expandida
  throw new Error('Database type not yet supported for direct record fetch');
}
```

#### 2. Service Layer Enhancement

```javascript
// server/services/userRecordService.js

class UserRecordService {
  constructor(db) {
    this.db = db;
  }

  async getUserRecord(connectionId, userToken) {
    const connection = await this.db.getConnectionById(connectionId);
    
    if (!connection) {
      throw new Error('Connection not found');
    }
    
    // Verificar acesso
    if (!this.hasAccess(connection, userToken)) {
      throw new Error('Access denied');
    }
    
    // Buscar registro
    const userLinkField = connection.user_link_field || connection.userLinkField;
    
    switch (connection.type) {
      case 'NOCODB':
        return await this.fetchNocoDBRecord(connection, userLinkField, userToken);
      case 'SQLITE':
        return await this.fetchSQLiteRecord(connection, userLinkField, userToken);
      case 'POSTGRES':
      case 'MYSQL':
        return await this.fetchSQLRecord(connection, userLinkField, userToken);
      default:
        throw new Error(`Unsupported database type: ${connection.type}`);
    }
  }

  hasAccess(connection, userToken) {
    return connection.assignedUsers && 
           connection.assignedUsers.includes(userToken);
  }

  async fetchNocoDBRecord(connection, userLinkField, userToken) {
    // Implementação NocoDB
  }

  async fetchSQLiteRecord(connection, userLinkField, userToken) {
    // Implementação SQLite
  }

  async fetchSQLRecord(connection, userLinkField, userToken) {
    // Implementação SQL genérica
  }
}

module.exports = UserRecordService;
```


### Caching Strategy

#### Frontend Caching

```typescript
// src/services/cache/connectionCache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ConnectionCache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  set<T>(key: string, data: T, ttl: number = 300000): void {
    // Default TTL: 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
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

  clear(): void {
    this.cache.clear();
  }
}

export const connectionCache = new ConnectionCache();

// Usage in service
export class DatabaseConnectionsService {
  async getUserConnections(userToken: string): Promise<DatabaseConnection[]> {
    const cacheKey = `user-connections:${userToken}`;
    
    // Try cache first
    const cached = connectionCache.get<DatabaseConnection[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from API
    const connections = await this.fetchUserConnectionsFromAPI(userToken);
    
    // Cache for 5 minutes
    connectionCache.set(cacheKey, connections, 300000);
    
    return connections;
  }

  async getUserRecord(userToken: string, connectionId: number): Promise<any> {
    const cacheKey = `user-record:${userToken}:${connectionId}`;
    
    // Try cache first
    const cached = connectionCache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from API
    const record = await this.fetchUserRecordFromAPI(userToken, connectionId);
    
    // Cache for 2 minutes
    connectionCache.set(cacheKey, record, 120000);
    
    return record;
  }

  async updateUserTableRecord(
    userToken: string,
    connectionId: number,
    recordId: string,
    data: Record<string, any>
  ): Promise<any> {
    // Update via API
    const result = await this.updateRecordViaAPI(userToken, connectionId, recordId, data);
    
    // Invalidate cache for this record
    connectionCache.invalidate(`user-record:${userToken}:${connectionId}`);
    
    return result;
  }
}
```

### Route Configuration

```typescript
// src/routes/index.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { DirectEditPage } from '@/pages/user/DirectEditPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* User routes */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/messages" element={<Messages />} />
      
      {/* Direct edit route for database connections */}
      <Route 
        path="/database/:connectionId/edit/:recordId" 
        element={<DirectEditPage />} 
      />
      
      {/* Redirect old "Meu Banco" route to dashboard */}
      <Route path="/meu-banco" element={<Navigate to="/dashboard" replace />} />
      
      <Route path="/settings" element={<Settings />} />
      
      {/* Admin routes */}
      <Route path="/admin/*" element={<AdminRoutes />} />
    </Routes>
  );
};
```

### Performance Optimizations

#### 1. Lazy Loading

```typescript
// src/components/layout/DynamicDatabaseItems.tsx

import { lazy, Suspense } from 'react';

const DynamicDatabaseItemsImpl = lazy(() => 
  import('./DynamicDatabaseItemsImpl').then(module => ({
    default: module.DynamicDatabaseItemsImpl
  }))
);

export const DynamicDatabaseItems = (props: DynamicDatabaseItemsProps) => {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DynamicDatabaseItemsImpl {...props} />
    </Suspense>
  );
};
```

#### 2. Debounced Fetching

```typescript
// src/hooks/useDebouncedFetch.ts

import { useEffect, useRef } from 'react';

export const useDebouncedFetch = (
  fetchFn: () => Promise<void>,
  delay: number = 300
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      fetchFn();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchFn, delay]);
};
```

#### 3. Optimistic Updates

```typescript
// src/pages/user/DirectEditPage.tsx

const handleSave = async () => {
  if (!connection?.id || !record?.id) return;
  
  // Store original record for rollback
  const originalRecord = { ...record };
  
  try {
    setSaving(true);
    
    // Optimistically update UI
    toast.success('Salvando alterações...');
    
    // Make API call
    await databaseConnectionsService.updateUserTableRecord(
      userToken,
      connection.id,
      record.id,
      record
    );
    
    toast.success('Alterações salvas com sucesso!');
    
  } catch (error) {
    // Rollback on error
    setRecord(originalRecord);
    console.error('Failed to save:', error);
    toast.error('Erro ao salvar alterações');
  } finally {
    setSaving(false);
  }
};
```


## Security Considerations

### 1. Token Validation

```typescript
// Ensure user token is validated on every request
// Backend should verify token belongs to an active session
// Frontend should handle 401 responses by redirecting to login

// server/middleware/verifyUserToken.js
const verifyUserToken = async (req, res, next) => {
  let userToken = null;
  
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers.token;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
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
  
  // Validate token with WUZAPI
  try {
    const isValid = await validateTokenWithWuzAPI(userToken);
    if (!isValid) {
      return res.status(401).json({
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    return res.status(401).json({
      error: 'Erro ao validar token',
      code: 'VALIDATION_ERROR'
    });
  }
  
  req.userToken = userToken;
  next();
};
```

### 2. Access Control

```typescript
// Verify user has access to requested connection
// Check assignedUsers array before returning data

const checkConnectionAccess = (connection, userToken) => {
  if (!connection.assignedUsers || !Array.isArray(connection.assignedUsers)) {
    return false;
  }
  
  return connection.assignedUsers.includes(userToken);
};
```

### 3. SQL Injection Prevention

```typescript
// Always use parameterized queries
// Never concatenate user input into SQL strings

// BAD - Vulnerable to SQL injection
const query = `SELECT * FROM ${tableName} WHERE ${fieldName} = '${userToken}'`;

// GOOD - Safe parameterized query
const query = `SELECT * FROM ?? WHERE ?? = ?`;
const params = [tableName, fieldName, userToken];
```

### 4. XSS Prevention

```typescript
// Sanitize all user input before rendering
// Use React's built-in XSS protection
// Avoid dangerouslySetInnerHTML

import DOMPurify from 'dompurify';

const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
};
```

### 5. Rate Limiting

```javascript
// server/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const userRecordLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to user record endpoint
app.get('/api/user/database-connections/:id/record', 
  userRecordLimiter, 
  verifyUserToken, 
  async (req, res) => {
    // Handler code
  }
);
```

## Migration Strategy

### Phase 1: Preparation (Week 1)

1. Create new API endpoints without breaking existing functionality
2. Implement backend service layer for user record fetching
3. Add comprehensive logging for debugging
4. Write unit tests for new backend endpoints

### Phase 2: Frontend Development (Week 2)

1. Create DynamicDatabaseItems component
2. Create DirectEditPage component
3. Implement caching layer
4. Add error handling and loading states
5. Write unit tests for new components

### Phase 3: Integration (Week 3)

1. Integrate DynamicDatabaseItems into Sidebar
2. Update routing configuration
3. Add redirect from old "/meu-banco" route
4. Test end-to-end flow
5. Fix any integration issues

### Phase 4: Testing & Refinement (Week 4)

1. Conduct thorough QA testing
2. Test with multiple users and connections
3. Test error scenarios
4. Performance testing and optimization
5. Accessibility testing

### Phase 5: Deployment (Week 5)

1. Deploy to staging environment
2. Conduct user acceptance testing
3. Fix any issues found in staging
4. Deploy to production
5. Monitor for issues

### Rollback Plan

If critical issues are discovered after deployment:

1. Revert to previous version via Docker image rollback
2. Re-enable old "Meu Banco" route temporarily
3. Investigate and fix issues
4. Redeploy when ready

## Monitoring and Observability

### Metrics to Track

```typescript
// Track key metrics for monitoring
interface NavigationMetrics {
  // Performance
  sidebarLoadTime: number;
  recordFetchTime: number;
  formRenderTime: number;
  
  // Usage
  connectionsPerUser: number;
  clicksPerConnection: number;
  editSessionDuration: number;
  
  // Errors
  fetchErrors: number;
  saveErrors: number;
  authErrors: number;
}
```

### Logging Strategy

```typescript
// Log important events for debugging
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
```

### Alerts

Set up alerts for:
- High error rates (> 5% of requests)
- Slow response times (> 3 seconds)
- Authentication failures (> 10 per minute)
- Database connection failures

## Documentation Updates

### User Documentation

Create user guide covering:
1. How to access database connections from sidebar
2. How to edit records
3. What to do if no connections appear
4. How to contact admin for access

### Developer Documentation

Update technical docs with:
1. New API endpoints and their usage
2. Component architecture
3. Caching strategy
4. Error handling patterns
5. Testing guidelines

## Success Criteria

The implementation will be considered successful when:

1. ✅ "Meu Banco" menu item is completely removed
2. ✅ User connections appear dynamically in sidebar
3. ✅ Clicking a connection navigates directly to edit page
4. ✅ Edit page loads in < 2 seconds
5. ✅ No intermediate pages (cards, tables) are shown
6. ✅ All existing functionality continues to work
7. ✅ Error handling provides clear feedback
8. ✅ Performance is equal or better than current implementation
9. ✅ All tests pass (unit, integration, e2e)
10. ✅ User feedback is positive
