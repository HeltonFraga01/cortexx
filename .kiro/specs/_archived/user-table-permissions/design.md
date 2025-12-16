# Design Document

## Overview

Este documento descreve o design técnico para um sistema de permissões de acesso a tabelas do banco de dados SQLite via API REST. O sistema permite controle granular de operações CRUD (Create, Read, Update, Delete) em tabelas do banco de dados, com autenticação baseada em tokens de usuário existentes e interface administrativa para gerenciamento de permissões.

**Principais Objetivos:**
- Expor tabelas SQLite via API REST genérica
- Controle de permissões por usuário e tabela
- Validação automática de permissões em cada request
- Interface admin para configuração visual
- Auditoria completa de operações
- Proteção contra SQL injection e rate limiting

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Frontend UI   │
│  (Admin/User)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         Express API Layer               │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ Admin Routes │  │  User Routes    │ │
│  │ /api/admin/  │  │  /api/tables/   │ │
│  └──────┬───────┘  └────────┬────────┘ │
│         │                   │          │
│         ▼                   ▼          │
│  ┌──────────────────────────────────┐  │
│  │  Permission Validation Middleware│  │
│  └──────────────┬───────────────────┘  │
│                 │                      │
└─────────────────┼──────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Database Layer (database.js)       │
│  ┌────────────────┐  ┌───────────────┐ │
│  │ Permissions    │  │ Generic Table │ │
│  │ Repository     │  │ Operations    │ │
│  └────────────────┘  └───────────────┘ │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         SQLite Database                 │
│  ┌──────────────────┐  ┌─────────────┐ │
│  │ table_permissions│  │ User Tables │ │
│  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────┘
```

### Component Interaction Flow

**Admin Permission Configuration:**
```
Admin UI → POST /api/admin/table-permissions
  → Validate Admin Token
  → Create Permission Record
  → Return Success
```

**User Table Access:**
```
User Request → GET /api/tables/:tableName
  → Validate User Token
  → Check Permission (read)
  → Execute Query
  → Return Data
```

## Components and Interfaces

### 1. Database Schema

#### New Table: `table_permissions`

```sql
CREATE TABLE IF NOT EXISTS table_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  can_read BOOLEAN DEFAULT 0,
  can_write BOOLEAN DEFAULT 0,
  can_delete BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, table_name)
);

CREATE INDEX idx_table_permissions_user_id ON table_permissions(user_id);
CREATE INDEX idx_table_permissions_table_name ON table_permissions(table_name);
```

### 2. Backend Routes

#### Admin Routes (`server/routes/adminTablePermissionsRoutes.js`)

```javascript
// Gerenciamento de permissões (Admin apenas)
POST   /api/admin/table-permissions      // Criar permissão
GET    /api/admin/table-permissions      // Listar todas permissões
GET    /api/admin/table-permissions/:id  // Obter permissão específica
PUT    /api/admin/table-permissions/:id  // Atualizar permissão
DELETE /api/admin/table-permissions/:id  // Remover permissão

// Listagem de tabelas disponíveis
GET    /api/admin/tables                 // Listar tabelas do banco
GET    /api/admin/tables/:tableName      // Obter schema de tabela
```

#### User Routes (`server/routes/userTableAccessRoutes.js`)

```javascript
// Operações CRUD genéricas em tabelas
GET    /api/tables/:tableName            // Listar registros (com paginação/filtros)
GET    /api/tables/:tableName/:id        // Obter registro específico
POST   /api/tables/:tableName            // Criar novo registro
PUT    /api/tables/:tableName/:id        // Atualizar registro
DELETE /api/tables/:tableName/:id        // Deletar registro
```

### 3. Middleware

#### Permission Validation Middleware (`server/middleware/permissionValidator.js`)

```javascript
/**
 * Valida se o usuário tem permissão para a operação solicitada
 */
async function validateTablePermission(req, res, next) {
  const userToken = req.headers.authorization;
  const tableName = req.params.tableName;
  const operation = getOperationFromMethod(req.method); // read, write, delete
  
  // 1. Validar token e obter userId
  const userId = await validateUserToken(userToken);
  
  // 2. Buscar permissões do usuário para a tabela
  const permission = await getTablePermission(userId, tableName);
  
  // 3. Verificar se tem permissão para a operação
  if (!hasPermission(permission, operation)) {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      code: 'PERMISSION_DENIED'
    });
  }
  
  // 4. Anexar informações ao request
  req.userId = userId;
  req.permission = permission;
  
  next();
}
```

### 4. Database Layer Extensions

#### Permission Repository (`server/database.js` - novos métodos)

```javascript
// Gerenciamento de permissões
async createTablePermission(userId, tableName, permissions)
async getTablePermission(userId, tableName)
async getUserTablePermissions(userId)
async updateTablePermission(permissionId, permissions)
async deleteTablePermission(permissionId)
async getAllTablePermissions()

// Operações genéricas em tabelas
async getAvailableTables()
async getTableSchema(tableName)
async queryTable(tableName, options) // com paginação, filtros, ordenação
async insertRecord(tableName, data)
async updateRecord(tableName, id, data)
async deleteRecord(tableName, id)
```

### 5. Frontend Components

#### Admin Components (`src/components/admin/`)

**TablePermissionsManager.tsx**
- Lista todas as permissões configuradas
- Formulário para criar/editar permissões
- Seleção de usuário, tabela e operações permitidas
- Ações de editar/deletar permissões

**AvailableTablesList.tsx**
- Lista todas as tabelas disponíveis no banco
- Exibe schema de cada tabela
- Permite selecionar tabela para configurar permissões

#### User Components (`src/components/user/`)

**GenericTableView.tsx**
- Visualização genérica de dados de tabela
- Paginação, filtros e ordenação
- Ações de CRUD baseadas em permissões
- Formulário dinâmico para criar/editar registros

### 6. Services

#### Permission Service (`src/services/table-permissions.ts`)

```typescript
interface TablePermission {
  id: number;
  userId: string;
  tableName: string;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

// Admin operations
export async function createPermission(data: CreatePermissionRequest): Promise<TablePermission>
export async function getPermissions(): Promise<TablePermission[]>
export async function updatePermission(id: number, data: UpdatePermissionRequest): Promise<TablePermission>
export async function deletePermission(id: number): Promise<void>

// Table operations
export async function getAvailableTables(): Promise<TableInfo[]>
export async function getTableSchema(tableName: string): Promise<TableSchema>
```

#### Generic Table Service (`src/services/generic-table.ts`)

```typescript
interface QueryOptions {
  limit?: number;
  offset?: number;
  where?: Record<string, any>;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export async function queryTable(tableName: string, options?: QueryOptions): Promise<any[]>
export async function getRecord(tableName: string, id: number): Promise<any>
export async function createRecord(tableName: string, data: Record<string, any>): Promise<any>
export async function updateRecord(tableName: string, id: number, data: Record<string, any>): Promise<any>
export async function deleteRecord(tableName: string, id: number): Promise<void>
```

## Data Models

### TablePermission Model

```typescript
interface TablePermission {
  id: number;
  userId: string;              // ID do usuário (obtido via token)
  tableName: string;           // Nome da tabela no SQLite
  canRead: boolean;            // Permissão de leitura
  canWrite: boolean;           // Permissão de escrita (create/update)
  canDelete: boolean;          // Permissão de exclusão
  createdAt: string;
  updatedAt: string;
}
```


### TableInfo Model

```typescript
interface TableInfo {
  name: string;                // Nome da tabela
  rowCount: number;            // Número de registros
  columns: ColumnInfo[];       // Informações das colunas
}

interface ColumnInfo {
  name: string;
  type: string;                // INTEGER, TEXT, REAL, BLOB, NULL
  notNull: boolean;
  defaultValue: any;
  primaryKey: boolean;
}
```

### QueryResult Model

```typescript
interface QueryResult<T = any> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}
```

### Error Codes

```typescript
// Autenticação
'INVALID_TOKEN'           // Token inválido ou expirado
'MISSING_TOKEN'           // Token não fornecido

// Permissões
'PERMISSION_DENIED'       // Sem permissão para operação
'TABLE_NOT_ALLOWED'       // Tabela não permitida para usuário

// Validação
'INVALID_TABLE_NAME'      // Nome de tabela inválido
'INVALID_COLUMN_NAME'     // Nome de coluna inválido
'VALIDATION_ERROR'        // Erro de validação de dados
'DUPLICATE_PERMISSION'    // Permissão já existe

// Operações
'TABLE_NOT_FOUND'         // Tabela não encontrada
'RECORD_NOT_FOUND'        // Registro não encontrado
'SQL_INJECTION_DETECTED'  // Tentativa de SQL injection detectada

// Sistema
'DATABASE_ERROR'          // Erro interno do banco
'RATE_LIMIT_EXCEEDED'     // Limite de requisições excedido
```

### Error Handling Strategy

**Backend:**
```javascript
try {
  // Operação
  res.json({ success: true, data })
} catch (error) {
  logger.error('Erro na operação', { error: error.message, userId, tableName })
  
  // Mapear erro para código apropriado
  const errorCode = mapErrorToCode(error)
  const statusCode = getStatusCodeForError(errorCode)
  
  res.status(statusCode).json({
    success: false,
    error: error.message,
    code: errorCode,
    timestamp: new Date().toISOString()
  })
}
```

**Frontend:**
```typescript
try {
  const data = await queryTable(tableName, options)
  // Processar dados
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    toast.error('Você não tem permissão para acessar esta tabela')
  } else if (error.code === 'RATE_LIMIT_EXCEEDED') {
    toast.error('Muitas requisições. Aguarde um momento.')
  } else {
    toast.error('Erro ao carregar dados')
  }
}
```

## Testing Strategy

### Unit Tests

**Backend:**
```javascript
// server/tests/services/tablePermissions.test.js
describe('Table Permissions Service', () => {
  test('should create permission successfully', async () => {
    const permission = await createTablePermission('user123', 'customers', {
      canRead: true,
      canWrite: true,
      canDelete: false
    })
    expect(permission.userId).toBe('user123')
    expect(permission.canRead).toBe(true)
  })
  
  test('should prevent duplicate permissions', async () => {
    await createTablePermission('user123', 'customers', { canRead: true })
    await expect(
      createTablePermission('user123', 'customers', { canRead: true })
    ).rejects.toThrow('DUPLICATE_PERMISSION')
  })
})

// server/tests/middleware/permissionValidator.test.js
describe('Permission Validator Middleware', () => {
  test('should allow read operation with read permission', async () => {
    const req = mockRequest({ method: 'GET', params: { tableName: 'customers' } })
    const res = mockResponse()
    const next = jest.fn()
    
    await validateTablePermission(req, res, next)
    
    expect(next).toHaveBeenCalled()
  })
  
  test('should deny write operation without write permission', async () => {
    const req = mockRequest({ method: 'POST', params: { tableName: 'customers' } })
    const res = mockResponse()
    const next = jest.fn()
    
    await validateTablePermission(req, res, next)
    
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
```

**Frontend:**
```typescript
// src/services/table-permissions.test.ts
describe('Table Permissions Service', () => {
  test('should fetch permissions list', async () => {
    const permissions = await getPermissions()
    expect(Array.isArray(permissions)).toBe(true)
  })
  
  test('should create permission', async () => {
    const permission = await createPermission({
      userId: 'user123',
      tableName: 'customers',
      canRead: true,
      canWrite: false,
      canDelete: false
    })
    expect(permission.id).toBeDefined()
  })
})
```

### Integration Tests

```javascript
// server/tests/integration/tableAccess.test.js
describe('Table Access Integration', () => {
  let adminToken, userToken, permissionId
  
  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase()
    adminToken = await getAdminToken()
    userToken = await getUserToken()
  })
  
  test('admin creates permission for user', async () => {
    const response = await request(app)
      .post('/api/admin/table-permissions')
      .set('Authorization', adminToken)
      .send({
        userId: 'testuser',
        tableName: 'test_table',
        canRead: true,
        canWrite: true,
        canDelete: false
      })
    
    expect(response.status).toBe(201)
    permissionId = response.body.data.id
  })
  
  test('user can read from allowed table', async () => {
    const response = await request(app)
      .get('/api/tables/test_table')
      .set('Authorization', userToken)
    
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.data)).toBe(true)
  })
  
  test('user cannot delete without permission', async () => {
    const response = await request(app)
      .delete('/api/tables/test_table/1')
      .set('Authorization', userToken)
    
    expect(response.status).toBe(403)
    expect(response.body.code).toBe('PERMISSION_DENIED')
  })
})
```

### Security Tests

```javascript
// server/tests/security/sqlInjection.test.js
describe('SQL Injection Protection', () => {
  test('should reject malicious table name', async () => {
    const response = await request(app)
      .get('/api/tables/users; DROP TABLE users--')
      .set('Authorization', userToken)
    
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_TABLE_NAME')
  })
  
  test('should sanitize query parameters', async () => {
    const response = await request(app)
      .get('/api/tables/customers')
      .query({ where: "1=1 OR '1'='1" })
      .set('Authorization', userToken)
    
    expect(response.status).toBe(400)
    expect(response.body.code).toBe('SQL_INJECTION_DETECTED')
  })
})
```

### Performance Tests

```javascript
// server/tests/performance/tableQueries.test.js
describe('Table Query Performance', () => {
  test('should handle large result sets efficiently', async () => {
    const startTime = Date.now()
    
    const response = await request(app)
      .get('/api/tables/large_table')
      .query({ limit: 1000 })
      .set('Authorization', userToken)
    
    const duration = Date.now() - startTime
    
    expect(response.status).toBe(200)
    expect(duration).toBeLessThan(2000) // Menos de 2 segundos
  })
  
  test('should respect rate limits', async () => {
    const requests = Array(101).fill(null).map(() =>
      request(app)
        .get('/api/tables/customers')
        .set('Authorization', userToken)
    )
    
    const responses = await Promise.all(requests)
    const rateLimited = responses.filter(r => r.status === 429)
    
    expect(rateLimited.length).toBeGreaterThan(0)
  })
})
```

## Security Considerations

### SQL Injection Prevention

**1. Parameterized Queries:**
```javascript
// ✅ CORRETO - Usar parâmetros
const sql = 'SELECT * FROM ?? WHERE id = ?'
await db.query(sql, [tableName, id])

// ❌ ERRADO - Concatenação de strings
const sql = `SELECT * FROM ${tableName} WHERE id = ${id}`
```

**2. Table/Column Name Validation:**
```javascript
function validateIdentifier(name) {
  // Apenas letras, números e underscore
  // Deve começar com letra ou underscore
  const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
  
  if (!pattern.test(name)) {
    throw new Error('INVALID_IDENTIFIER')
  }
  
  // Verificar contra lista de palavras reservadas
  const reserved = ['SELECT', 'DROP', 'DELETE', 'INSERT', 'UPDATE']
  if (reserved.includes(name.toUpperCase())) {
    throw new Error('RESERVED_KEYWORD')
  }
  
  return name
}
```

**3. Input Sanitization:**
```javascript
function sanitizeQueryParams(params) {
  const sanitized = {}
  
  for (const [key, value] of Object.entries(params)) {
    // Validar chave
    validateIdentifier(key)
    
    // Sanitizar valor
    if (typeof value === 'string') {
      // Remover caracteres perigosos
      sanitized[key] = value.replace(/[;'"\\]/g, '')
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}
```

### Authentication & Authorization

**1. Token Validation:**
```javascript
async function validateUserToken(token) {
  if (!token) {
    throw new Error('MISSING_TOKEN')
  }
  
  // Validar formato
  if (token.length < 10) {
    throw new Error('INVALID_TOKEN')
  }
  
  // Validar com WuzAPI
  const userId = await wuzapiClient.validateToken(token)
  
  if (!userId) {
    throw new Error('INVALID_TOKEN')
  }
  
  return userId
}
```

**2. Permission Checks:**
```javascript
async function checkPermission(userId, tableName, operation) {
  const permission = await db.getTablePermission(userId, tableName)
  
  if (!permission) {
    logger.warn('Permission denied - no permission record', { userId, tableName })
    return false
  }
  
  const hasPermission = {
    'read': permission.canRead,
    'write': permission.canWrite,
    'delete': permission.canDelete
  }[operation]
  
  if (!hasPermission) {
    logger.warn('Permission denied', { userId, tableName, operation })
  }
  
  return hasPermission
}
```

### Rate Limiting

**Configuration:**
```javascript
// Read operations: 100 req/min
const readRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { code: 'RATE_LIMIT_EXCEEDED', error: 'Too many read requests' }
})

// Write operations: 50 req/min
const writeRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { code: 'RATE_LIMIT_EXCEEDED', error: 'Too many write requests' }
})

// Delete operations: 20 req/min
const deleteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { code: 'RATE_LIMIT_EXCEEDED', error: 'Too many delete requests' }
})
```

### Audit Logging

**Log Format:**
```javascript
logger.info('Table operation', {
  operation: 'read',
  userId: 'user123',
  tableName: 'customers',
  recordId: 456,
  success: true,
  duration: 45,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  timestamp: new Date().toISOString()
})
```

**Failed Permission Attempts:**
```javascript
logger.warn('Permission denied', {
  userId: 'user123',
  tableName: 'sensitive_data',
  operation: 'delete',
  reason: 'no_delete_permission',
  ip: req.ip,
  timestamp: new Date().toISOString()
})
```

## Performance Optimizations

### Database Indexes

```sql
-- Índices para performance de queries
CREATE INDEX idx_table_permissions_user_id ON table_permissions(user_id);
CREATE INDEX idx_table_permissions_table_name ON table_permissions(table_name);
CREATE INDEX idx_table_permissions_composite ON table_permissions(user_id, table_name);
```

### Caching Strategy

**Permission Cache:**
```javascript
const permissionCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

async function getCachedPermission(userId, tableName) {
  const cacheKey = `${userId}:${tableName}`
  const cached = permissionCache.get(cacheKey)
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.permission
  }
  
  const permission = await db.getTablePermission(userId, tableName)
  
  permissionCache.set(cacheKey, {
    permission,
    timestamp: Date.now()
  })
  
  return permission
}
```

### Query Optimization

**Pagination:**
```javascript
// Sempre usar LIMIT e OFFSET
const limit = Math.min(parseInt(req.query.limit) || 50, 1000)
const offset = parseInt(req.query.offset) || 0

const sql = `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`
const { rows } = await db.query(sql, [limit, offset])
```

**Selective Columns:**
```javascript
// Permitir seleção de colunas específicas
const columns = req.query.columns 
  ? req.query.columns.split(',').map(validateIdentifier)
  : ['*']

const sql = `SELECT ${columns.join(', ')} FROM ${tableName}`
```

## Deployment Considerations

### Environment Variables

```bash
# Rate Limiting
TABLE_API_READ_RATE_LIMIT=100
TABLE_API_WRITE_RATE_LIMIT=50
TABLE_API_DELETE_RATE_LIMIT=20

# Query Limits
DEFAULT_RECORDS_LIMIT=50
MAX_RECORDS_PER_REQUEST=1000

# Cache
PERMISSION_CACHE_TTL=300000  # 5 minutos em ms

# Logging
LOG_TABLE_OPERATIONS=true
LOG_PERMISSION_DENIALS=true
```

### Migration Script

```javascript
// server/migrations/004_add_table_permissions.js
module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS table_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        can_read BOOLEAN DEFAULT 0,
        can_write BOOLEAN DEFAULT 0,
        can_delete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, table_name)
      )
    `)
    
    await db.query(`
      CREATE INDEX idx_table_permissions_user_id 
      ON table_permissions(user_id)
    `)
    
    await db.query(`
      CREATE INDEX idx_table_permissions_table_name 
      ON table_permissions(table_name)
    `)
  },
  
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS table_permissions')
  }
}
```

### Monitoring

**Metrics to Track:**
- Request rate per endpoint
- Permission denial rate
- Average query duration
- Cache hit rate
- Error rate by type

**Alerts:**
- High permission denial rate (possible attack)
- Slow queries (> 2 seconds)
- High error rate
- Rate limit exceeded frequently

## Future Enhancements

### Phase 2 Features

1. **Row-Level Security:**
   - Filtrar registros baseado em condições
   - Ex: usuário só vê seus próprios registros

2. **Column-Level Permissions:**
   - Controlar acesso a colunas específicas
   - Ex: ocultar campos sensíveis

3. **Permission Templates:**
   - Templates pré-configurados (read-only, full-access, etc.)
   - Aplicar em lote para múltiplos usuários

4. **Audit Dashboard:**
   - Visualização de logs de acesso
   - Relatórios de uso por usuário/tabela

5. **API Key Management:**
   - Gerar API keys para acesso programático
   - Rotação automática de keys

6. **Webhook Notifications:**
   - Notificar sobre mudanças em tabelas
   - Integração com sistemas externos
