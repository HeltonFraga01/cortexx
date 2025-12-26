# Design Document: Supabase Database Integration

## Overview

This design extends the existing Database Navigation system to support native Supabase connections. The integration follows the established patterns for NocoDB while leveraging Supabase's unique capabilities. The architecture maintains backward compatibility with existing connection types while adding a new `SUPABASE` type with dedicated service modules.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + TypeScript)                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  DatabaseConnectionForm.tsx                                              │
│  ├── Supabase Configuration Section (new)                               │
│  │   ├── Project URL input                                              │
│  │   ├── API Key type selector (service_role / anon)                    │
│  │   ├── API Key input (masked)                                         │
│  │   └── Dynamic table/column selectors                                 │
│  └── Existing tabs (Connection, Advanced)                               │
│                                                                          │
│  database-connections.ts (service)                                       │
│  ├── testSupabaseConnection()                                           │
│  ├── getSupabaseTables()                                                │
│  └── getSupabaseColumns()                                               │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         Backend (Node.js + Express)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  server/services/SupabaseConnectionService.js (new)                     │
│  ├── createClient(url, key) - Creates isolated Supabase client          │
│  ├── listTables(connection) - Lists tables from public schema           │
│  ├── getTableColumns(connection, tableName) - Gets column metadata      │
│  ├── fetchRecords(connection, options) - Fetches paginated records      │
│  ├── createRecord(connection, data) - Inserts new record                │
│  ├── updateRecord(connection, id, data) - Updates existing record       │
│  ├── deleteRecord(connection, id) - Deletes record                      │
│  └── testConnection(connection) - Validates connection                  │
│                                                                          │
│  server/routes/databaseRoutes.js                                        │
│  └── Extended to handle SUPABASE type                                   │
│                                                                          │
│  server/routes/userRoutes.js                                            │
│  └── Extended for user data operations with SUPABASE                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### DatabaseConnectionForm.tsx (Modified)

Extends the existing form to include Supabase-specific configuration:

```typescript
// New state for Supabase
const [supabaseTables, setSupabaseTables] = useState<SupabaseTable[]>([]);
const [supabaseColumns, setSupabaseColumns] = useState<SupabaseColumn[]>([]);
const [loadingSupabaseTables, setLoadingSupabaseTables] = useState(false);
const [selectedSupabaseTable, setSelectedSupabaseTable] = useState<string>('');

// Supabase-specific form fields
interface SupabaseFormData {
  supabase_url: string;
  supabase_key: string;
  supabase_key_type: 'service_role' | 'anon';
  supabase_table: string;
}
```

### Backend Services

#### SupabaseConnectionService.js (New)

```javascript
/**
 * Service for managing external Supabase connections
 * Handles CRUD operations on external Supabase projects
 */
class SupabaseConnectionService {
  /**
   * Create an isolated Supabase client for external connection
   * @param {string} url - Supabase project URL
   * @param {string} key - API key (service_role or anon)
   * @returns {SupabaseClient} Configured Supabase client
   */
  static createClient(url, key) {}

  /**
   * List all tables from the public schema
   * @param {Object} connection - Database connection config
   * @returns {Promise<Array>} List of tables with metadata
   */
  static async listTables(connection) {}

  /**
   * Get column metadata for a specific table
   * @param {Object} connection - Database connection config
   * @param {string} tableName - Name of the table
   * @returns {Promise<Array>} List of columns with types and constraints
   */
  static async getTableColumns(connection, tableName) {}

  /**
   * Fetch records with pagination and filtering
   * @param {Object} connection - Database connection config
   * @param {Object} options - Query options (page, limit, filters)
   * @returns {Promise<Object>} Paginated records with count
   */
  static async fetchRecords(connection, options) {}

  /**
   * Create a new record
   * @param {Object} connection - Database connection config
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
   */
  static async createRecord(connection, data) {}

  /**
   * Update an existing record
   * @param {Object} connection - Database connection config
   * @param {string} id - Record ID
   * @param {Object} data - Updated fields
   * @returns {Promise<Object>} Updated record
   */
  static async updateRecord(connection, id, data) {}

  /**
   * Delete a record
   * @param {Object} connection - Database connection config
   * @param {string} id - Record ID
   * @returns {Promise<void>}
   */
  static async deleteRecord(connection, id) {}

  /**
   * Test connection validity
   * @param {Object} connection - Database connection config
   * @returns {Promise<Object>} Test result with status and details
   */
  static async testConnection(connection) {}
}
```

### API Endpoints

#### New/Modified Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/database-connections/:id/test-supabase` | Test Supabase connection |
| GET | `/api/database-connections/:id/supabase/tables` | List Supabase tables |
| GET | `/api/database-connections/:id/supabase/columns/:table` | Get table columns |
| GET | `/api/user/database-connections/:id/data` | Fetch records (extended for Supabase) |
| POST | `/api/user/database-connections/:id/data` | Create record (extended for Supabase) |
| PUT | `/api/user/database-connections/:id/data/:recordId` | Update record (extended for Supabase) |
| DELETE | `/api/user/database-connections/:id/data/:recordId` | Delete record (extended for Supabase) |

## Data Models

### Database Connection (Extended)

```typescript
interface DatabaseConnection {
  id?: number;
  name: string;
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SUPABASE'; // Added SUPABASE
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  assignedUsers?: string[];
  
  // Existing NocoDB fields
  nocodb_token?: string;
  nocodb_project_id?: string;
  nocodb_table_id?: string;
  
  // New Supabase fields
  supabase_url?: string;
  supabase_key?: string;
  supabase_key_type?: 'service_role' | 'anon';
  supabase_table?: string;
  
  // Common fields
  user_link_field?: string;
  fieldMappings?: FieldMapping[];
  default_view_mode?: 'list' | 'single';
  viewConfiguration?: ViewConfiguration;
  created_at?: string;
  updated_at?: string;
}
```

### Supabase Table Metadata

```typescript
interface SupabaseTable {
  name: string;
  schema: string;
  rowCount?: number;
  rlsEnabled: boolean;
  comment?: string;
}

interface SupabaseColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  defaultValue?: string;
  comment?: string;
}
```

### PostgreSQL to UI Type Mapping

```typescript
const PG_TYPE_MAP: Record<string, UIInputType> = {
  // Text types
  'text': 'text',
  'varchar': 'text',
  'character varying': 'text',
  'char': 'text',
  'character': 'text',
  'name': 'text',
  
  // Numeric types
  'integer': 'number',
  'int': 'number',
  'int4': 'number',
  'bigint': 'number',
  'int8': 'number',
  'smallint': 'number',
  'int2': 'number',
  'numeric': 'number',
  'decimal': 'number',
  'real': 'number',
  'float4': 'number',
  'double precision': 'number',
  'float8': 'number',
  
  // Boolean
  'boolean': 'checkbox',
  'bool': 'checkbox',
  
  // Date/Time
  'date': 'date',
  'timestamp': 'datetime',
  'timestamp without time zone': 'datetime',
  'timestamptz': 'datetime',
  'timestamp with time zone': 'datetime',
  'time': 'time',
  'time without time zone': 'time',
  'timetz': 'time',
  'time with time zone': 'time',
  
  // JSON
  'json': 'json',
  'jsonb': 'json',
  
  // UUID
  'uuid': 'uuid',
  
  // Arrays
  'ARRAY': 'array',
  '_text': 'array',
  '_int4': 'array',
  '_uuid': 'array',
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Form displays Supabase fields when type is SUPABASE

*For any* form state where the connection type is set to 'SUPABASE', the form SHALL render the Supabase-specific configuration fields (supabase_url, supabase_key, supabase_key_type) and hide the standard database fields (host, port, username, password for direct DB).

**Validates: Requirements 1.1, 7.1**

### Property 2: Invalid credentials produce descriptive errors

*For any* invalid Supabase URL or API key combination, the system SHALL return an error response containing a descriptive message that indicates the specific validation failure (invalid URL format, authentication failed, permission denied, etc.).

**Validates: Requirements 1.5, 5.4**

### Property 3: Both key types are accepted and handled correctly

*For any* valid Supabase connection configuration, the system SHALL accept both 'service_role' and 'anon' as valid key types and store them appropriately in the supabase_key_type field.

**Validates: Requirements 1.6**

### Property 4: Table metadata includes required fields

*For any* table returned by the listTables operation, the table metadata object SHALL contain at minimum: name (string), rlsEnabled (boolean), and optionally rowCount (number) and comment (string).

**Validates: Requirements 2.2**

### Property 5: Table metadata caching

*For any* sequence of listTables calls within a 10-minute window for the same connection, the second and subsequent calls SHALL return cached data without making additional API requests to Supabase.

**Validates: Requirements 2.4**

### Property 6: Column metadata includes type and constraints

*For any* column returned by the getTableColumns operation, the column metadata SHALL include: name, dataType, isNullable, isPrimaryKey, and isForeignKey. If isForeignKey is true, foreignKeyTable SHALL also be present.

**Validates: Requirements 3.1, 3.2, 3.4**

### Property 7: PostgreSQL type mapping completeness

*For any* valid PostgreSQL data type string, the type mapping function SHALL return a valid UI input type from the set: 'text', 'number', 'checkbox', 'date', 'datetime', 'time', 'json', 'uuid', 'array', 'select'. Unknown types SHALL default to 'text'.

**Validates: Requirements 3.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8**

### Property 8: Record fetching respects user filter and pagination

*For any* fetchRecords call with a user_link_field configured, the resulting query SHALL include a filter condition matching the current user's identifier, AND the results SHALL be limited to the specified page size with correct offset calculation.

**Validates: Requirements 4.1, 4.2**

### Property 9: Partial updates only send modified fields

*For any* updateRecord call, the data sent to Supabase SHALL contain only the fields that differ from the original record, not the entire record object.

**Validates: Requirements 4.4**

### Property 10: Connection status reflects test results

*For any* connection test operation, the connection status SHALL be updated to 'connected' if the test succeeds, 'error' if it fails, and 'testing' during the test execution.

**Validates: Requirements 5.5**

### Property 11: Isolated clients for external connections

*For any* two different Supabase connections (different URLs or keys), the createClient function SHALL return distinct client instances that do not share state or configuration.

**Validates: Requirements 6.3**

### Property 12: URL format validation

*For any* string input as Supabase URL, the validation function SHALL return true only if the URL matches the pattern `https://*.supabase.co` or `https://*.supabase.in` or is a valid custom domain URL starting with `https://`.

**Validates: Requirements 7.3**

### Property 13: Load Tables button enablement

*For any* form state, the "Load Tables" button SHALL be enabled if and only if both supabase_url and supabase_key fields are non-empty and the URL passes format validation.

**Validates: Requirements 7.4**

### Property 14: Field mappings preservation on edit

*For any* existing connection being edited, loading the connection data SHALL preserve all existing fieldMappings, and saving without modifying mappings SHALL not alter them.

**Validates: Requirements 7.6**

### Property 15: Error capture and logging

*For any* failed Supabase API call, the system SHALL capture the error code, message, and operation context, and log this information with sufficient detail for debugging.

**Validates: Requirements 9.1, 9.5**

### Property 16: Error message translation

*For any* known Supabase error code (e.g., 'PGRST301', '42501', '23505'), the system SHALL translate it to a user-friendly message in the configured locale.

**Validates: Requirements 9.2**

### Property 17: Circuit breaker activation

*For any* connection that experiences 5 consecutive failures within a 1-minute window, subsequent requests SHALL be blocked for 30 seconds before allowing retry.

**Validates: Requirements 9.4**

### Property 18: API key masking in responses

*For any* API response containing connection details, the supabase_key field SHALL be masked to show only the last 4 characters (e.g., "****abcd") or be completely omitted.

**Validates: Requirements 10.2, 10.4**

### Property 19: Service role key restriction

*For any* data operation (create, update, delete) initiated by a non-admin user, the system SHALL NOT use a service_role key even if one is configured; it SHALL use the anon key or reject the operation if only service_role is available.

**Validates: Requirements 10.3**

### Property 20: Credential access audit logging

*For any* access to stored Supabase credentials (for connection testing, data operations, etc.), the system SHALL log the access event with: timestamp, user/admin ID, operation type, and connection ID (but NOT the actual credential value).

**Validates: Requirements 10.5**

## Error Handling

### Error Categories

| Category | HTTP Status | Error Code | User Message |
|----------|-------------|------------|--------------|
| Invalid URL | 400 | INVALID_SUPABASE_URL | "URL do Supabase inválida. Use o formato: https://seu-projeto.supabase.co" |
| Auth Failed | 401 | SUPABASE_AUTH_FAILED | "Falha na autenticação. Verifique sua API key." |
| Permission Denied | 403 | SUPABASE_PERMISSION_DENIED | "Permissão negada. A API key não tem acesso a este recurso." |
| Table Not Found | 404 | SUPABASE_TABLE_NOT_FOUND | "Tabela não encontrada no projeto Supabase." |
| RLS Violation | 403 | SUPABASE_RLS_VIOLATION | "Acesso negado pela política de segurança (RLS)." |
| Connection Timeout | 504 | SUPABASE_TIMEOUT | "Tempo limite excedido ao conectar ao Supabase." |
| Rate Limited | 429 | SUPABASE_RATE_LIMITED | "Muitas requisições. Aguarde alguns segundos." |
| Unknown Error | 500 | SUPABASE_UNKNOWN_ERROR | "Erro inesperado ao comunicar com Supabase." |

### Retry Strategy

```javascript
const RETRY_CONFIG = {
  maxRetries: 1,
  retryDelay: 1000, // 1 second
  retryableErrors: ['SUPABASE_TIMEOUT', 'SUPABASE_RATE_LIMITED'],
};
```

### Circuit Breaker Configuration

```javascript
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  failureWindow: 60000, // 1 minute
  resetTimeout: 30000, // 30 seconds
};
```

## Testing Strategy

### Unit Tests

Unit tests will verify individual functions and components in isolation:

1. **Type Mapping Function**: Test that all PostgreSQL types map to correct UI types
2. **URL Validation**: Test various URL formats (valid Supabase URLs, invalid URLs, edge cases)
3. **Credential Masking**: Test that API keys are properly masked in all scenarios
4. **Error Translation**: Test that known error codes produce correct user messages
5. **Query Builder**: Test that user filters and pagination are correctly applied

### Property-Based Tests

Property-based tests will use fast-check to verify properties across many generated inputs:

1. **Property 7 (Type Mapping)**: Generate random PostgreSQL type strings and verify mapping
2. **Property 12 (URL Validation)**: Generate random URL strings and verify validation logic
3. **Property 18 (Key Masking)**: Generate random API keys and verify masking output
4. **Property 9 (Partial Updates)**: Generate random record pairs and verify diff calculation

### Integration Tests

Integration tests will verify the full flow with mocked Supabase responses:

1. **Connection Flow**: Test complete connection setup from form to saved connection
2. **CRUD Operations**: Test create, read, update, delete with mocked Supabase client
3. **Error Handling**: Test error scenarios with mocked failure responses
4. **Caching**: Test that table metadata is cached and invalidated correctly

### Test Configuration

- **Framework**: Vitest for frontend, Node test runner for backend
- **Property Testing Library**: fast-check
- **Minimum Iterations**: 100 per property test
- **Coverage Target**: 80% for new code

