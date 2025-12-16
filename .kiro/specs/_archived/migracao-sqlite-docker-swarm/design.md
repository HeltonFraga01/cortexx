# Design Document: SQLite Migration and Docker Swarm Standardization

## Overview

This design document outlines the architectural transformation of the WUZApi Admin application from a PostgreSQL-based external database system to an embedded SQLite solution with Docker Swarm standardization. The migration addresses connection complexity issues while maintaining data integrity and improving deployment reliability.

### Current Architecture Issues
- PostgreSQL running in separate container causing network connectivity issues
- Complex database connection management with retry logic
- External database dependency creating deployment complexity
- Over-engineered solution for low-volume configuration data

### Target Architecture Benefits
- Embedded SQLite database eliminating network dependencies
- Simplified deployment with single container architecture
- Persistent data storage through Docker volumes
- Standardized Docker Swarm deployment pattern

## Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Swarm Cluster                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                Manager Node                         │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │           WUZApi Manager Container          │   │   │
│  │  │                                             │   │   │
│  │  │  ┌─────────────┐  ┌─────────────────────┐  │   │   │
│  │  │  │   Frontend  │  │      Backend        │  │   │   │
│  │  │  │   (React)   │  │    (Node.js)        │  │   │   │
│  │  │  └─────────────┘  └─────────────────────┘  │   │   │
│  │  │                           │                 │   │   │
│  │  │                           ▼                 │   │   │
│  │  │                  ┌─────────────────┐       │   │   │
│  │  │                  │ SQLite Database │       │   │   │
│  │  │                  │   (Embedded)    │       │   │   │
│  │  │                  └─────────────────┘       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                           │                         │   │
│  │                           ▼                         │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │            Docker Volume                    │   │   │
│  │  │         /app/data/wuzapi.db                 │   │   │
│  │  │        (Persistent Storage)                 │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Database Architecture Transformation

#### Before (PostgreSQL)
```
WUZApi Container ──network──> PostgreSQL Container
     │                              │
     │                              ▼
     ▼                        PostgreSQL Volume
Application Logic              (External Storage)
```

#### After (SQLite)
```
WUZApi Container
     │
     ├── Application Logic
     ├── SQLite Database (Embedded)
     │
     ▼
Docker Volume (Persistent Storage)
```

## Components and Interfaces

### 1. Database Layer Refactoring

#### Current PostgreSQL Implementation
- **File**: `server/database.js`
- **Driver**: `pg` (PostgreSQL driver)
- **Connection**: Network-based with connection pooling
- **Schema**: PostgreSQL-specific SQL with JSONB types

#### New SQLite Implementation
- **File**: `server/database.js` (refactored)
- **Driver**: `sqlite3`
- **Connection**: File-based, single connection
- **Schema**: SQLite-compatible SQL with JSON text storage

#### Database Class Interface
```javascript
class Database {
  constructor(dbPath = '/app/data/wuzapi.db')
  async query(sql, params)
  async initTables()
  async getAllConnections()
  async getConnectionById(id)
  async createConnection(data)
  async updateConnection(id, data)
  async deleteConnection(id)
  async updateConnectionStatus(id, status)
  async close()
}
```

### 2. Docker Configuration Components

#### Volume Configuration
```yaml
volumes:
  wuzapi-data:
    driver: local
```

#### Service Configuration
```yaml
services:
  wuzapi-manager:
    volumes:
      - wuzapi-data:/app/data
    deploy:
      placement:
        constraints:
          - node.role == manager
```

### 3. Environment Configuration

#### Database Connection Variables
```bash
# SQLite Configuration
SQLITE_DB_PATH=/app/data/wuzapi.db
SQLITE_ENABLE_WAL=true
SQLITE_TIMEOUT=30000
```

## Data Models

### Database Schema Migration

#### PostgreSQL Schema (Current)
```sql
CREATE TABLE database_connections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('POSTGRES', 'MYSQL', 'NOCODB', 'API')),
  host TEXT NOT NULL,
  port INTEGER DEFAULT 5432,
  database_name TEXT,
  username TEXT,
  password TEXT,
  table_name TEXT,
  status TEXT DEFAULT 'disconnected' CHECK(status IN ('connected', 'disconnected', 'error')),
  assigned_users JSONB DEFAULT '[]',
  nocodb_token TEXT,
  nocodb_project_id TEXT,
  nocodb_table_id TEXT,
  user_link_field TEXT,
  field_mappings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### SQLite Schema (Target)
```sql
CREATE TABLE database_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('POSTGRES', 'MYSQL', 'NOCODB', 'API')),
  host TEXT NOT NULL,
  port INTEGER DEFAULT 5432,
  database_name TEXT,
  username TEXT,
  password TEXT,
  table_name TEXT,
  status TEXT DEFAULT 'disconnected' CHECK(status IN ('connected', 'disconnected', 'error')),
  assigned_users TEXT DEFAULT '[]',
  nocodb_token TEXT,
  nocodb_project_id TEXT,
  nocodb_table_id TEXT,
  user_link_field TEXT,
  field_mappings TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Key Schema Changes
1. **Primary Key**: `SERIAL` → `INTEGER PRIMARY KEY AUTOINCREMENT`
2. **JSON Storage**: `JSONB` → `TEXT` (with JSON.parse/stringify handling)
3. **Timestamps**: `TIMESTAMPTZ` → `DATETIME`
4. **Default Values**: PostgreSQL functions → SQLite equivalents

### Data Migration Strategy

#### Migration Process Flow
```
1. Export PostgreSQL Data → JSON Format
2. Transform Data Structure → SQLite Compatible
3. Create SQLite Schema → New Database File
4. Import Transformed Data → SQLite Database
5. Validate Data Integrity → Verification Queries
6. Update Application Configuration → Environment Variables
```

## Error Handling

### Database Connection Error Handling

#### SQLite-Specific Error Scenarios
1. **File Permission Errors**: Database file not writable
2. **Disk Space Issues**: Insufficient storage for database operations
3. **File Corruption**: SQLite database file corruption
4. **Concurrent Access**: Multiple processes accessing database

#### Error Handling Implementation
```javascript
class SQLiteDatabase {
  async handleError(error, operation) {
    const errorMap = {
      'SQLITE_BUSY': 'Database is locked, retrying...',
      'SQLITE_CORRUPT': 'Database file is corrupted',
      'SQLITE_CANTOPEN': 'Cannot open database file',
      'SQLITE_PERM': 'Permission denied accessing database file'
    };
    
    logger.error(`SQLite Error in ${operation}:`, errorMap[error.code] || error.message);
    
    // Implement retry logic for transient errors
    if (error.code === 'SQLITE_BUSY') {
      return this.retryOperation(operation);
    }
    
    throw error;
  }
}
```

### Docker Volume Error Handling

#### Volume Mount Issues
1. **Volume Not Found**: Docker volume doesn't exist
2. **Permission Issues**: Container cannot write to volume
3. **Node Constraint Violations**: Service scheduled on wrong node

#### Monitoring and Alerts
```yaml
healthcheck:
  test: ["CMD", "test", "-w", "/app/data"]
  interval: 30s
  timeout: 10s
  retries: 3
```

## Testing Strategy

### Unit Testing

#### Database Layer Tests
```javascript
describe('SQLite Database', () => {
  test('should create database connection', async () => {
    const db = new Database(':memory:');
    await db.initTables();
    expect(db).toBeDefined();
  });
  
  test('should perform CRUD operations', async () => {
    // Test create, read, update, delete operations
  });
  
  test('should handle JSON data correctly', async () => {
    // Test JSON serialization/deserialization
  });
});
```

#### Migration Tests
```javascript
describe('Data Migration', () => {
  test('should migrate PostgreSQL data to SQLite', async () => {
    // Test data migration process
  });
  
  test('should preserve data integrity', async () => {
    // Verify all data is correctly migrated
  });
});
```

### Integration Testing

#### Docker Swarm Deployment Tests
1. **Volume Persistence**: Verify data survives container restarts
2. **Node Constraints**: Confirm service runs on manager node only
3. **Health Checks**: Validate application health monitoring
4. **Service Discovery**: Test internal service communication

#### End-to-End Testing
1. **Application Functionality**: All features work with SQLite
2. **Data Consistency**: Database operations maintain integrity
3. **Performance**: Response times within acceptable limits
4. **Backup/Restore**: Data backup and recovery procedures

### Performance Testing

#### SQLite Performance Benchmarks
1. **Query Performance**: Compare SQLite vs PostgreSQL query times
2. **Concurrent Access**: Test multiple simultaneous connections
3. **Database Size**: Monitor performance with growing data
4. **Memory Usage**: Track application memory consumption

#### Load Testing Scenarios
```javascript
// Example load test configuration
const loadTest = {
  concurrent_users: 50,
  test_duration: '5m',
  scenarios: [
    'create_database_connection',
    'update_connection_status',
    'query_all_connections'
  ]
};
```

## Implementation Phases

### Phase 1: Database Layer Refactoring
1. Create new SQLite database class
2. Implement schema migration scripts
3. Update all database queries for SQLite compatibility
4. Add comprehensive error handling

### Phase 2: Data Migration
1. Create PostgreSQL data export utility
2. Implement data transformation logic
3. Create SQLite import utility
4. Validate migrated data integrity

### Phase 3: Docker Configuration Update
1. Remove PostgreSQL service from docker-stack.yml
2. Add volume configuration for SQLite persistence
3. Update environment variables
4. Add node placement constraints

### Phase 4: Documentation and Testing
1. Update README.md with new architecture
2. Create deployment guides
3. Implement comprehensive test suite
4. Performance validation and optimization

## Security Considerations

### SQLite Security
1. **File Permissions**: Restrict database file access to application user
2. **Backup Encryption**: Encrypt database backups
3. **Access Control**: Implement application-level access controls
4. **Audit Logging**: Log all database operations

### Docker Security
1. **Volume Security**: Secure volume mount points
2. **Container Isolation**: Proper container security context
3. **Network Security**: Minimal network exposure
4. **Secret Management**: Secure handling of sensitive configuration

## Monitoring and Observability

### Database Monitoring
1. **Database Size**: Monitor SQLite file growth
2. **Query Performance**: Track slow queries
3. **Error Rates**: Monitor database errors
4. **Backup Status**: Verify regular backups

### Application Monitoring
1. **Health Checks**: Container and application health
2. **Resource Usage**: CPU, memory, disk utilization
3. **Service Availability**: Uptime monitoring
4. **Performance Metrics**: Response times and throughput