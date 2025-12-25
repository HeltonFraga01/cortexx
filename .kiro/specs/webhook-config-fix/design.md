# Design Document: Webhook Config Fix

## Overview

Este documento descreve a solução para corrigir o problema de salvamento de configuração de webhook no WUZAPI Manager. O problema ocorre porque o middleware de autenticação prioriza o JWT do Supabase e tenta obter o token WUZAPI do contexto da inbox ativa, ignorando o token explicitamente passado no header.

A solução modifica a ordem de prioridade no middleware para:
1. **Primeiro**: Usar o token do header `token` se presente e não-vazio
2. **Segundo**: Usar o token do contexto da inbox ativa (via JWT)
3. **Terceiro**: Usar o token da sessão (legacy)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
│  UserInboxEditPage.tsx                                          │
│  ├── handleSaveWebhook()                                        │
│  │   └── wuzapi.setWebhook(token, webhook, events)              │
│  └── WebhookConfigCard                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/webhook
                              │ Headers: { token: wuzapiToken, Authorization: Bearer jwt }
                              │ Body: { webhook, events, subscribe }
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                 │
│  webhookRoutes.js                                               │
│  ├── verifyUserTokenWithInbox (middleware)                      │
│  │   ├── 1. Check header 'token' (PRIORITY) ◄── FIX             │
│  │   ├── 2. Validate JWT + Load inbox context                   │
│  │   └── 3. Fallback to session token                           │
│  └── POST /webhook handler                                      │
│      └── axios.post(WUZAPI/webhook, { webhookURL, Subscribe })  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /webhook
                              │ Headers: { Token: wuzapiToken }
                              │ Body: { webhookURL, Subscribe }
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         WUZAPI                                  │
│  External WhatsApp API                                          │
│  └── Saves webhook configuration for the token's instance       │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Modified Component: verifyUserTokenWithInbox Middleware

**Localização**: `server/routes/webhookRoutes.js`

**Interface Atual**:
```javascript
const verifyUserTokenWithInbox = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Se tem JWT, usar inboxContextMiddleware para obter token da inbox correta
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // ... tenta obter token do contexto
  }
  
  // Fallback: Tentar obter token do header 'token' (legacy)
  const tokenHeader = req.headers.token;
  if (tokenHeader) {
    req.userToken = tokenHeader;
    return next();
  }
  // ...
}
```

**Interface Proposta**:
```javascript
const verifyUserTokenWithInbox = async (req, res, next) => {
  // PRIORIDADE 1: Token explícito no header (para operações específicas de inbox)
  const tokenHeader = req.headers.token;
  if (tokenHeader && tokenHeader.trim()) {
    req.userToken = tokenHeader.trim();
    req.tokenSource = 'header';
    logger.debug('Using token from header', {
      tokenPreview: req.userToken.substring(0, 8) + '...',
      path: req.path
    });
    return next();
  }
  
  // PRIORIDADE 2: JWT + Contexto da inbox ativa
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // ... tenta obter token do contexto
    if (req.context?.wuzapiToken) {
      req.userToken = req.context.wuzapiToken;
      req.tokenSource = 'context';
      return next();
    }
  }
  
  // PRIORIDADE 3: Token da sessão (legacy)
  if (req.session?.userToken) {
    req.userToken = req.session.userToken;
    req.tokenSource = 'session';
    return next();
  }
  
  // Nenhum token encontrado
  return res.status(401).json({
    success: false,
    error: {
      code: 'NO_WUZAPI_TOKEN',
      message: 'Token WUZAPI não fornecido'
    }
  });
}
```

### Unchanged Components

- **Frontend**: `src/services/wuzapi.ts` - Já envia o token no header corretamente
- **Frontend**: `src/components/user/UserInboxEditPage.tsx` - Já passa o token correto
- **Backend**: POST /webhook handler - Já transforma corretamente para WUZAPI

## Data Models

Não há alterações em modelos de dados. A mudança é apenas no fluxo de autenticação.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token Header Priority

*For any* requisição de webhook com header `token` não-vazio, o middleware SHALL usar esse token para `req.userToken`, independente da presença de JWT ou contexto de inbox.

**Validates: Requirements 1.1, 4.1, 4.2, 4.3**

### Property 2: Context Fallback

*For any* requisição de webhook sem header `token` (ou com header vazio), mas com JWT válido e contexto de inbox disponível, o middleware SHALL usar o token do contexto da inbox ativa.

**Validates: Requirements 1.2, 6.1, 6.2**

### Property 3: Token Validation

*For any* token obtido (do header, contexto ou sessão), o middleware SHALL verificar que não está vazio antes de prosseguir. Se nenhum token válido for encontrado, SHALL retornar erro 401.

**Validates: Requirements 2.1, 2.2**

### Property 4: Response Format Consistency

*For any* resposta de sucesso do endpoint de webhook, a resposta SHALL conter `{ success: true, data: { ... } }`. Para erros, SHALL conter `{ success: false, error: "...", message: "..." }`.

**Validates: Requirements 5.1, 5.2**

## Error Handling

| Cenário | Código HTTP | Código de Erro | Mensagem |
|---------|-------------|----------------|----------|
| Nenhum token encontrado | 401 | NO_WUZAPI_TOKEN | Token WUZAPI não fornecido |
| Token inválido no WUZAPI | 401 | WUZAPI_UNAUTHORIZED | Token WUZAPI inválido ou expirado |
| WUZAPI indisponível | 503 | WUZAPI_UNAVAILABLE | Serviço WUZAPI indisponível |
| Erro interno | 500 | INTERNAL_ERROR | Erro interno ao processar webhook |

## Testing Strategy

### Unit Tests

1. **Middleware Token Priority**
   - Testar que header `token` tem prioridade sobre JWT
   - Testar fallback para contexto quando sem header
   - Testar fallback para sessão quando sem contexto

2. **Token Validation**
   - Testar rejeição de tokens vazios
   - Testar rejeição de tokens com apenas whitespace

3. **Response Format**
   - Testar formato de resposta de sucesso
   - Testar formato de resposta de erro

### Property-Based Tests

Usar Vitest com fast-check para testes de propriedade:

1. **Property 1**: Gerar combinações aleatórias de headers (token presente/ausente, JWT presente/ausente) e verificar que o token correto é usado
2. **Property 2**: Gerar requisições sem header token e verificar fallback para contexto
3. **Property 3**: Gerar tokens aleatórios (incluindo vazios) e verificar validação
4. **Property 4**: Gerar respostas e verificar formato consistente

### Integration Tests

1. Testar fluxo completo: Frontend → Backend → WUZAPI (mock)
2. Testar que webhook é salvo corretamente no WUZAPI
3. Testar que GET retorna a configuração salva

## Notes

- A mudança é retrocompatível - o fluxo existente (JWT + contexto) continua funcionando
- O header `token` já é usado em outras partes do sistema, então não há breaking change
- Logs de debug ajudarão a diagnosticar problemas futuros
