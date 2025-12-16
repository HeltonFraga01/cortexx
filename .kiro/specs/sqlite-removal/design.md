# Design Document: SQLite Removal

## Overview

Este documento descreve o design técnico para remoção completa do SQLite do sistema WUZAPI Manager. Com a migração para Supabase concluída, o sistema agora opera exclusivamente com Supabase como backend de banco de dados.

A remoção envolve:
1. Exclusão de arquivos de código SQLite (database.js, sqlite.js, migrations)
2. Remoção de dependências npm (better-sqlite3, sqlite3)
3. Limpeza de configurações de ambiente
4. Atualização de documentação e steering files
5. Consolidação de serviços (renomear *ServiceSupabase.js)
6. Remoção de testes específicos do SQLite
7. Limpeza de arquivos de banco de dados

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    WUZAPI Manager (Após Remoção)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Frontend (React + TypeScript)                                          │
│  ├── @supabase/supabase-js client                                       │
│  ├── Realtime subscriptions                                             │
│  └── Generated TypeScript types                                         │
│                                                                          │
│  Backend (Node.js + Express)                                            │
│  ├── @supabase/supabase-js (service role)                              │
│  ├── SupabaseService.js (única abstração de DB)                        │
│  ├── Services consolidados (sem sufixo "Supabase")                     │
│  └── Auth middleware (JWT validation)                                   │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                         Supabase Platform                                │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL + Auth + Realtime + Storage                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Arquivos a Remover

```
server/
├── database.js                    # REMOVER - Abstração SQLite
├── config/
│   └── sqlite.js                  # REMOVER - Configurações SQLite
├── migrations/                    # ARQUIVAR - 81 arquivos de migração
│   ├── 002_add_view_configuration.js
│   ├── ... (79 arquivos)
│   └── run-migrations.js
└── services/
    └── DatabaseBackend.js         # REMOVER - Dual-write abstraction
```

### 2. Serviços a Consolidar

```javascript
// ANTES: Dois arquivos por serviço
server/services/
├── AccountService.js              # SQLite version
├── AccountServiceSupabase.js      # Supabase version
├── AgentService.js
├── AgentServiceSupabase.js
├── ChatService.js
├── ChatServiceSupabase.js
├── ConversationInboxService.js
├── ConversationInboxServiceSupabase.js
├── PlanService.js
└── PlanServiceSupabase.js

// DEPOIS: Um arquivo por serviço (Supabase)
server/services/
├── AccountService.js              # Renomeado de AccountServiceSupabase.js
├── AgentService.js                # Renomeado de AgentServiceSupabase.js
├── ChatService.js                 # Renomeado de ChatServiceSupabase.js
├── ConversationInboxService.js    # Renomeado de ConversationInboxServiceSupabase.js
└── PlanService.js                 # Renomeado de PlanServiceSupabase.js
```

### 3. Dependências a Remover

```json
// server/package.json - REMOVER
{
  "dependencies": {
    "better-sqlite3": "^9.x.x",  // REMOVER
    "sqlite3": "^5.x.x"          // REMOVER (se existir)
  }
}
```

### 4. Variáveis de Ambiente a Remover

```bash
# REMOVER de todos os .env* files
SQLITE_DB_PATH=...
SQLITE_WAL_MODE=...
SQLITE_TIMEOUT=...
SQLITE_CACHE_SIZE=...
SQLITE_SYNCHRONOUS=...
SQLITE_JOURNAL_MODE=...
USE_SUPABASE=...
DUAL_WRITE_MODE=...
DATABASE_BACKEND=...
```

## Data Models

Não há alterações nos modelos de dados - todos já estão no Supabase.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No SQLite Code References
*For any* JavaScript file in server/ directory, the file should not contain imports or requires of 'sqlite3', 'better-sqlite3', or '../database'.
**Validates: Requirements 1.5, 1.6**

### Property 2: No SQLite Environment Variables
*For any* .env.example file in the project, the file should not contain SQLITE_* environment variables or USE_SUPABASE/DUAL_WRITE_MODE flags.
**Validates: Requirements 3.1, 3.5**

### Property 3: No SQLite References in Steering Files
*For any* markdown file in .kiro/steering/, the file should not mention SQLite as a database option or configuration.
**Validates: Requirements 4.3**

### Property 4: No SQLite Test Dependencies
*For any* test file in server/, the file should not create temporary SQLite databases or import SQLite modules.
**Validates: Requirements 6.1, 6.2**

### Property 5: Single Service Implementation
*For any* service type (Account, Agent, Chat, ConversationInbox, Plan), there should be exactly one implementation file without "Supabase" suffix.
**Validates: Requirements 7.1, 7.4**

### Property 6: Consolidated Service Imports
*For any* route file in server/routes/, service imports should reference the consolidated service names without "Supabase" suffix.
**Validates: Requirements 7.3**

## Error Handling

A remoção do SQLite não introduz novos cenários de erro. O sistema já está operando com Supabase, então os erros existentes são tratados pelo SupabaseService.

### Possíveis Problemas Durante Remoção

1. **Imports quebrados**: Arquivos que ainda importam database.js
   - Solução: Atualizar para usar SupabaseService

2. **Testes falhando**: Testes que dependem de SQLite
   - Solução: Remover ou refatorar para usar mocks/Supabase

3. **Variáveis de ambiente faltando**: Código que lê SQLITE_*
   - Solução: Remover referências ou usar valores padrão Supabase

## Testing Strategy

### Verificação Pós-Remoção

A estratégia de teste foca em verificar que:
1. Nenhum código SQLite permanece no projeto
2. Todos os testes passam sem dependências SQLite
3. O sistema funciona corretamente apenas com Supabase

### Property-Based Testing Framework

**Framework:** fast-check (JavaScript)

```javascript
// Configuração: mínimo 100 iterações
fc.configureGlobal({ numRuns: 100 });
```

### Test Structure

```
server/
└── tests/
    └── cleanup/
        ├── no-sqlite-code.test.js      # Property 1
        ├── no-sqlite-env.test.js       # Property 2
        ├── no-sqlite-steering.test.js  # Property 3
        ├── no-sqlite-tests.test.js     # Property 4
        ├── single-service.test.js      # Property 5
        └── consolidated-imports.test.js # Property 6
```

### Verification Script

```javascript
// server/scripts/verify-sqlite-removal.js
const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function verifySQLiteRemoval() {
  const errors = [];
  
  // 1. Check no SQLite files exist
  const sqliteFiles = [
    'server/database.js',
    'server/config/sqlite.js',
    'server/services/DatabaseBackend.js'
  ];
  
  for (const file of sqliteFiles) {
    if (fs.existsSync(file)) {
      errors.push(`SQLite file still exists: ${file}`);
    }
  }
  
  // 2. Check no SQLite imports in JS files
  const jsFiles = await glob('server/**/*.js', { ignore: ['**/node_modules/**'] });
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes("require('sqlite3')") || 
        content.includes("require('better-sqlite3')") ||
        content.includes("require('../database')") ||
        content.includes("require('./database')")) {
      errors.push(`SQLite import found in: ${file}`);
    }
  }
  
  // 3. Check package.json
  const pkg = JSON.parse(fs.readFileSync('server/package.json', 'utf8'));
  if (pkg.dependencies?.['better-sqlite3'] || pkg.dependencies?.['sqlite3']) {
    errors.push('SQLite dependency still in package.json');
  }
  
  // 4. Check .env.example files
  const envFiles = await glob('**/.env*.example', { ignore: ['**/node_modules/**'] });
  for (const file of envFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('SQLITE_')) {
      errors.push(`SQLite env var found in: ${file}`);
    }
  }
  
  return errors;
}
```

### Unit Test Examples

```javascript
// server/tests/cleanup/no-sqlite-code.test.js
describe('SQLite Removal Verification', () => {
  it('should not have database.js file', () => {
    expect(fs.existsSync('server/database.js')).toBe(false);
  });
  
  it('should not have sqlite.js config', () => {
    expect(fs.existsSync('server/config/sqlite.js')).toBe(false);
  });
  
  it('should not have DatabaseBackend.js', () => {
    expect(fs.existsSync('server/services/DatabaseBackend.js')).toBe(false);
  });
  
  it('should not have SQLite dependencies in package.json', () => {
    const pkg = require('../../package.json');
    expect(pkg.dependencies?.['better-sqlite3']).toBeUndefined();
    expect(pkg.dependencies?.['sqlite3']).toBeUndefined();
  });
});
```

### Property Test Examples

```javascript
// **Feature: sqlite-removal, Property 1: No SQLite Code References**
describe('No SQLite Code References', () => {
  it('should not have SQLite imports in any JS file', async () => {
    const jsFiles = await glob('server/**/*.js', { ignore: ['**/node_modules/**'] });
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...jsFiles),
        async (filePath) => {
          const content = fs.readFileSync(filePath, 'utf8');
          const hasSQLiteImport = 
            content.includes("require('sqlite3')") ||
            content.includes("require('better-sqlite3')") ||
            content.includes("require('../database')") ||
            content.includes("require('./database')");
          return !hasSQLiteImport;
        }
      ),
      { numRuns: jsFiles.length }
    );
  });
});

// **Feature: sqlite-removal, Property 5: Single Service Implementation**
describe('Single Service Implementation', () => {
  it('should have exactly one implementation per service', async () => {
    const serviceTypes = ['Account', 'Agent', 'Chat', 'ConversationInbox', 'Plan'];
    
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...serviceTypes),
        async (serviceType) => {
          const pattern = `server/services/${serviceType}Service*.js`;
          const files = await glob(pattern);
          
          // Should have exactly one file, without "Supabase" suffix
          return files.length === 1 && 
                 !files[0].includes('Supabase');
        }
      ),
      { numRuns: serviceTypes.length }
    );
  });
});
```

