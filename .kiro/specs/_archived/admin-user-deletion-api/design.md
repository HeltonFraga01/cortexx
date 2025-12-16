# Design Document

## Overview

Esta implementação adiciona dois endpoints DELETE ao módulo de rotas administrativas existente para permitir a remoção de usuários. Os endpoints seguirão o mesmo padrão arquitetural dos endpoints existentes, utilizando os mesmos middlewares de validação, sistema de logging e estrutura de resposta.

## Architecture

### API Endpoints
```
DELETE /api/admin/users/:userId      -> Remove usuário do banco de dados
DELETE /api/admin/users/:userId/full -> Remove usuário completamente
```

### Request Flow
```
Client Request → Middleware Validation → WuzAPI Call → Response/Logging
```

### Integration Points
- **AdminRoutes**: Adicionar novos endpoints ao router existente
- **AdminValidator**: Usar validação de token existente
- **WuzAPIClient**: Usar cliente existente para chamadas de remoção
- **ErrorHandler**: Usar tratamento de erro existente
- **Logger**: Usar sistema de logging existente

## Components and Interfaces

### 1. DELETE /api/admin/users/:userId

**Request Structure:**
```typescript
interface DeleteUserRequest {
  params: {
    userId: string;
  };
  headers: {
    authorization: string; // Admin token
  };
}
```

**Response Structure:**
```typescript
interface DeleteUserResponse {
  success: boolean;
  code: number;
  message?: string;
  timestamp: string;
}
```

**Middleware Chain:**
1. `errorHandler.validateAdminTokenFormat` - Validar formato do token
2. Custom validation - Validar formato do userId
3. `adminValidator.validateAdminToken` - Validar token na WuzAPI
4. Business logic - Executar remoção via WuzAPI

### 2. DELETE /api/admin/users/:userId/full

**Request/Response Structure:** Idêntica ao endpoint anterior

**Diferença:** Chama método `deleteUserFull` ao invés de `deleteUser`

## Data Models

### WuzAPI Integration

**Existing WuzAPIClient Methods:**
```javascript
// Já implementados no utils/wuzapiClient.js
await wuzapiClient.deleteUser(userId);      // Remove do banco
await wuzapiClient.deleteUserFull(userId);  // Remove completamente
```

**Expected WuzAPI Responses:**
```javascript
// Sucesso
{ success: true }

// Erro
{ success: false, error: "Error message" }
```

## Error Handling

### Error Scenarios and Responses

**1. Invalid userId format (400)**
```json
{
  "success": false,
  "error": "ID do usuário é obrigatório e deve ser uma string válida",
  "code": 400,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**2. Invalid admin token (401)**
```json
{
  "success": false,
  "error": "Token administrativo inválido ou expirado",
  "code": 401,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**3. User not found (404)**
```json
{
  "success": false,
  "error": "Usuário não encontrado ou já foi removido",
  "code": 404,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**4. WuzAPI error (502)**
```json
{
  "success": false,
  "error": "Erro na comunicação com o serviço WuzAPI",
  "code": 502,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**5. Internal server error (500)**
```json
{
  "success": false,
  "error": "Erro interno do servidor",
  "code": 500,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Implementation Details

### Route Handler Structure

```javascript
router.delete('/users/:userId', 
  // Middleware chain
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      // 1. Validate userId format
      // 2. Validate admin token
      // 3. Call WuzAPI deletion method
      // 4. Handle response and logging
      // 5. Return appropriate response
    } catch (error) {
      // Error handling and logging
    }
  }
);
```

### Validation Logic

**UserId Validation:**
```javascript
const userId = req.params.userId;
if (!userId || typeof userId !== 'string' || userId.trim() === '') {
  return res.status(400).json({
    success: false,
    error: 'ID do usuário é obrigatório e deve ser uma string válida',
    code: 400,
    timestamp: new Date().toISOString()
  });
}
```

**Admin Token Validation:**
```javascript
const validationResult = await adminValidator.validateAdminToken(token);
if (!validationResult.isValid) {
  return errorHandler.handleValidationError(validationResult, req, res);
}
```

### WuzAPI Integration

**Database Deletion:**
```javascript
const wuzapiClient = require('../utils/wuzapiClient');
const result = await wuzapiClient.deleteUser(userId);

if (!result.success) {
  throw new Error(`WuzAPI deletion failed: ${result.error}`);
}
```

**Full Deletion:**
```javascript
const result = await wuzapiClient.deleteUserFull(userId);

if (!result.success) {
  throw new Error(`WuzAPI full deletion failed: ${result.error}`);
}
```

## Logging Strategy

### Success Logging
```javascript
logger.info('Usuário removido com sucesso', {
  url: req.url,
  method: req.method,
  user_id: userId,
  deletion_type: fullDelete ? 'complete' : 'database',
  response_time_ms: Date.now() - startTime,
  user_agent: req.get('User-Agent'),
  ip: req.ip
});
```

### Error Logging
```javascript
logger.error('Erro na remoção de usuário', {
  url: req.url,
  method: req.method,
  user_id: userId,
  deletion_type: fullDelete ? 'complete' : 'database',
  error_message: error.message,
  error_stack: error.stack,
  response_time_ms: Date.now() - startTime,
  user_agent: req.get('User-Agent'),
  ip: req.ip
});
```

## Security Considerations

### Authentication & Authorization
- **Admin Token Required**: Todos os endpoints requerem token administrativo válido
- **Token Validation**: Usar middleware existente para validação de formato e autenticidade
- **Request Logging**: Registrar IP e User-Agent para auditoria

### Input Validation
- **UserId Sanitization**: Validar formato e tipo do userId
- **SQL Injection Prevention**: WuzAPIClient já trata sanitização
- **Rate Limiting**: Usar limitação existente do servidor

### Audit Trail
- **Operation Logging**: Registrar todas as tentativas de remoção
- **Error Tracking**: Logs detalhados para troubleshooting
- **Performance Monitoring**: Tempo de resposta para cada operação

## Testing Strategy

### Unit Tests
- **Route Handler Logic**: Testar validação, chamadas WuzAPI e respostas
- **Error Scenarios**: Testar todos os cenários de erro identificados
- **Middleware Integration**: Testar integração com middlewares existentes

### Integration Tests
- **End-to-End Flow**: Testar fluxo completo de remoção
- **WuzAPI Integration**: Testar comunicação com WuzAPI (mocked)
- **Database State**: Verificar estado após remoção

### Error Testing
- **Invalid Inputs**: Testar com userIds inválidos
- **Network Failures**: Simular falhas na comunicação com WuzAPI
- **Authentication Failures**: Testar com tokens inválidos

## Performance Considerations

### Response Time
- **Target**: < 2 segundos para operações normais
- **Timeout**: Usar timeout existente do WuzAPIClient
- **Monitoring**: Registrar tempo de resposta em logs

### Resource Usage
- **Memory**: Operações stateless, sem acúmulo de memória
- **CPU**: Operações simples, baixo uso de CPU
- **Network**: Uma chamada HTTP por operação

## Compatibility

### Backward Compatibility
- **Existing Endpoints**: Não afeta endpoints existentes
- **Client Integration**: Frontend já implementado e compatível
- **API Versioning**: Usar mesma versão da API existente

### Future Extensibility
- **Batch Operations**: Estrutura permite extensão para remoção em lote
- **Soft Delete**: Pode ser estendido para soft delete no futuro
- **Audit Enhancements**: Logs podem ser estendidos para auditoria avançada