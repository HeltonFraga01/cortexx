# Design Document

## Overview

Este documento descreve o design para corrigir vulnerabilidades de segurança no sistema de Database Connections. As mudanças são projetadas para serem minimamente invasivas, mantendo total compatibilidade com o frontend existente que usa `backendApi` com autenticação baseada em sessão.

### Principais Mudanças

1. Adicionar middleware de autenticação às rotas `/api/database-connections`
2. Implementar mascaramento de credenciais nas respostas da API
3. Criar validador robusto para dados de conexão
4. Remover token hardcoded do middleware de autenticação
5. Melhorar logging de segurança
6. Limpar logs de debug em produção

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   Admin Pages   │    │   User Pages    │                     │
│  │  (Databases)    │    │ (DB Navigation) │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────────────────────────────┐                    │
│  │           backendApi (session-based)     │                    │
│  └─────────────────────┬───────────────────┘                    │
└────────────────────────┼────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Middleware Stack                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │    │
│  │  │  CORS    │→ │  Session │→ │  Rate    │→ │  Auth   │ │    │
│  │  │          │  │          │  │  Limiter │  │ (Admin) │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              /api/database-connections                   │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │
│  │  │  Validator   │→ │   Routes     │→ │  Sanitizer   │  │    │
│  │  │ (Input)      │  │  (CRUD)      │  │ (Output)     │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    database.js                           │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │  Credential Storage (unmasked, internal only)    │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Middleware de Autenticação (Modificação)

**Arquivo:** `server/middleware/auth.js`

```javascript
// Remover fallback de token hardcoded
function requireAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.VITE_ADMIN_TOKEN;
  
  // NOVO: Rejeitar se token não configurado
  if (!adminToken) {
    logger.error('VITE_ADMIN_TOKEN not configured');
    return res.status(500).json({ 
      error: 'Server configuration error',
      code: 'ADMIN_TOKEN_NOT_CONFIGURED'
    });
  }
  
  // ... resto da lógica
}
```

### 2. Validador de Conexões (Novo)

**Arquivo:** `server/validators/databaseConnectionValidator.js`

```javascript
/**
 * Valida dados de conexão de banco de dados
 * @param {Object} data - Dados da conexão
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConnectionData(data) {
  const errors = [];
  
  // Validar nome
  if (!data.name || data.name.length < 1 || data.name.length > 100) {
    errors.push('Nome deve ter entre 1 e 100 caracteres');
  }
  
  // Validar tipo
  const validTypes = ['POSTGRES', 'MYSQL', 'NOCODB', 'API', 'SQLITE'];
  if (!validTypes.includes(data.type)) {
    errors.push(`Tipo deve ser um de: ${validTypes.join(', ')}`);
  }
  
  // Validar host
  if (!isValidHost(data.host)) {
    errors.push('Host deve ser uma URL válida ou localhost');
  }
  
  // Validar porta
  if (data.port && (data.port < 1 || data.port > 65535)) {
    errors.push('Porta deve estar entre 1 e 65535');
  }
  
  return { valid: errors.length === 0, errors };
}
```

### 3. Sanitizador de Respostas (Novo)

**Arquivo:** `server/utils/credentialSanitizer.js`

```javascript
const MASK = '********';

/**
 * Mascara credenciais sensíveis em uma conexão
 * @param {Object} connection - Dados da conexão
 * @returns {Object} Conexão com credenciais mascaradas
 */
function sanitizeConnection(connection) {
  if (!connection) return connection;
  
  return {
    ...connection,
    password: connection.password ? MASK : null,
    nocodb_token: connection.nocodb_token ? MASK : null
  };
}

/**
 * Mascara credenciais em array de conexões
 * @param {Array} connections - Array de conexões
 * @returns {Array} Conexões com credenciais mascaradas
 */
function sanitizeConnections(connections) {
  return connections.map(sanitizeConnection);
}
```

### 4. Rotas de Database (Modificação)

**Arquivo:** `server/routes/databaseRoutes.js`

```javascript
const { requireAdmin } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { validateConnectionData } = require('../validators/databaseConnectionValidator');
const { sanitizeConnection, sanitizeConnections } = require('../utils/credentialSanitizer');

// Aplicar middleware a todas as rotas
router.use(adminLimiter);
router.use(requireAdmin);

// GET / - Listar conexões (com mascaramento)
router.get('/', async (req, res) => {
  const connections = await db.getAllConnections();
  res.json({
    success: true,
    data: sanitizeConnections(connections),
    count: connections.length
  });
});
```

## Data Models

### DatabaseConnection (Sem alterações na estrutura)

```typescript
interface DatabaseConnection {
  id: number;
  name: string;                    // 1-100 caracteres
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE';
  host: string;                    // URL válida ou localhost
  port: number;                    // 1-65535
  database: string;
  username: string;
  password: string;                // Armazenado criptografado, retornado mascarado
  table_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  assigned_users: string;          // JSON array
  nocodb_token?: string;           // Armazenado criptografado, retornado mascarado
  nocodb_project_id?: string;
  nocodb_table_id?: string;
  user_link_field?: string;
  field_mappings: string;          // JSON array
  view_configuration?: string;     // JSON object
  default_view_mode: 'list' | 'single';
  created_at: string;
  updated_at: string;
}
```

### Formato de Resposta da API (Mantido)

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  count?: number;
  timestamp?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Authentication Enforcement
*For any* request to `/api/database-connections` endpoints, if the request does not have a valid admin session, the response status code should be 401 Unauthorized.
**Validates: Requirements 1.1**

### Property 2: Authenticated Access Success
*For any* request to `/api/database-connections` endpoints with a valid admin session, the response should have success=true or a specific error related to the operation (not authentication).
**Validates: Requirements 1.2**

### Property 3: Credential Masking Consistency
*For any* database connection returned by the API (list or single), if the connection has a password or nocodb_token stored, the returned value should be exactly '********' (8 asterisks).
**Validates: Requirements 2.1, 2.2, 2.3, 6.2**

### Property 4: Credential Storage Round-Trip
*For any* database connection created with a password, storing then retrieving the connection should return masked credentials externally, but internal operations should have access to the real credentials.
**Validates: Requirements 2.4**

### Property 5: Input Validation - Name Length
*For any* string used as connection name, if the length is less than 1 or greater than 100, the validation should fail with an appropriate error message.
**Validates: Requirements 3.1**

### Property 6: Input Validation - Type Enum
*For any* string used as connection type, if it is not one of ['POSTGRES', 'MYSQL', 'NOCODB', 'API', 'SQLITE'], the validation should fail.
**Validates: Requirements 3.2**

### Property 7: Input Validation - Port Range
*For any* number used as connection port, if it is less than 1 or greater than 65535, the validation should fail.
**Validates: Requirements 3.4**

### Property 8: Password Preservation on Update
*For any* connection update that does not include a password field, the existing password should be preserved unchanged in the database.
**Validates: Requirements 6.3**

### Property 9: Response Structure Consistency
*For any* API response from database connection endpoints, the response should contain a 'success' boolean field and either 'data' (on success) or 'error' (on failure).
**Validates: Requirements 6.4**

### Property 10: Security Log Credential Safety
*For any* log entry generated by the system, the log content should never contain actual password or token values (only masked versions or no credential data).
**Validates: Requirements 5.3**

## Error Handling

### Códigos de Erro

| Código | HTTP Status | Descrição |
|--------|-------------|-----------|
| AUTH_REQUIRED | 401 | Sessão não encontrada |
| FORBIDDEN | 403 | Usuário não é admin |
| ADMIN_TOKEN_NOT_CONFIGURED | 500 | Token admin não configurado |
| VALIDATION_ERROR | 400 | Dados de entrada inválidos |
| CONNECTION_NOT_FOUND | 404 | Conexão não encontrada |
| RATE_LIMIT_EXCEEDED | 429 | Limite de requisições excedido |

### Tratamento de Erros

```javascript
// Formato padrão de erro
{
  success: false,
  error: 'Mensagem de erro legível',
  code: 'ERROR_CODE',
  timestamp: '2025-11-28T12:00:00.000Z'
}
```

## Testing Strategy

### Dual Testing Approach

O sistema será testado usando tanto testes unitários quanto testes baseados em propriedades (property-based testing).

### Unit Tests

- Testes específicos para cada endpoint
- Testes de integração com middleware de autenticação
- Testes de edge cases (conexão não encontrada, dados inválidos)

### Property-Based Tests

**Framework:** fast-check (já instalado no projeto)

**Configuração:** Mínimo de 100 iterações por propriedade

Os testes de propriedade verificarão:

1. **Autenticação**: Todas as requisições sem sessão válida retornam 401
2. **Mascaramento**: Todas as credenciais retornadas são mascaradas consistentemente
3. **Validação**: Todas as entradas inválidas são rejeitadas com erros apropriados
4. **Preservação**: Updates parciais preservam dados não fornecidos
5. **Estrutura**: Todas as respostas seguem o formato padrão

### Test File Structure

```
server/tests/
├── database-routes.test.js           # Unit tests
├── database-routes.property.test.js  # Property-based tests
└── validators/
    └── databaseConnectionValidator.test.js
```

### Property Test Annotations

Cada teste de propriedade deve ser anotado com:
```javascript
/**
 * **Feature: database-security-fixes, Property 1: Authentication Enforcement**
 * **Validates: Requirements 1.1**
 */
```
