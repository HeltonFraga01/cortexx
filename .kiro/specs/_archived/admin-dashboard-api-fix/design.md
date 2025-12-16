# Design Document

## Overview

Este documento descreve o design da solução para corrigir os problemas de autenticação e carregamento de dados no painel administrativo. A solução envolve criar uma nova rota backend `/api/admin/dashboard-stats` que agrega dados de múltiplas fontes e retorna estatísticas do sistema de forma eficiente.

## Architecture

### Backend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard Flow                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  GET /api/admin/dashboard-stats                             │
│  ├─ requireAdmin middleware (valida sessão)                 │
│  ├─ Obtém token da sessão ou env                            │
│  ├─ Valida token com WuzAPI                                 │
│  └─ Agrega dados e retorna estatísticas                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Aggregation                          │
│  ├─ WuzAPI: Lista de usuários (/admin/users)               │
│  ├─ System: Uptime, versão, memória                        │
│  └─ Calculations: Total, conectados, logados               │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AdminOverview Component                   │
│  ├─ useEffect: Busca dados ao montar                       │
│  ├─ setInterval: Atualiza a cada 30s                       │
│  ├─ Loading state: Spinner durante carregamento            │
│  └─ Error handling: Toast em caso de erro                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Call (fetch)                          │
│  ├─ URL: /api/admin/dashboard-stats                        │
│  ├─ Method: GET                                             │
│  ├─ Headers: Content-Type: application/json                │
│  └─ Credentials: include (envia cookies de sessão)         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Route: `/api/admin/dashboard-stats`

**File:** `server/routes/adminRoutes.js`

**Endpoint:** `GET /api/admin/dashboard-stats`

**Middleware:** `requireAdmin` (já aplicado globalmente em `/api/admin`)

**Request:**
- Headers: Cookies de sessão (automático)
- Query params: Nenhum

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "systemStatus": "ok",
    "uptime": "2h 30m",
    "version": "1.0.0",
    "totalUsers": 5,
    "connectedUsers": 2,
    "loggedInUsers": 2,
    "activeConnections": 2,
    "memoryStats": {
      "heapUsed": 17256000,
      "heapTotal": 19595264,
      "rss": 59670528,
      "external": 3721595
    },
    "goroutines": 0,
    "users": [
      {
        "id": "...",
        "name": "...",
        "connected": true,
        "loggedIn": true,
        "jid": "...",
        "token": "..."
      }
    ]
  },
  "timestamp": "2025-11-16T15:40:04.328Z"
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": "Token de administrador inválido",
  "code": 401,
  "timestamp": "2025-11-16T15:40:04.328Z"
}
```

**Response (Error - 500):**
```json
{
  "success": false,
  "error": "Erro ao buscar estatísticas do sistema",
  "code": 500,
  "timestamp": "2025-11-16T15:40:04.328Z"
}
```

### Frontend Component: `AdminOverview`

**File:** `src/components/admin/AdminOverview.tsx`

**Props:** Nenhum

**State:**
```typescript
interface DashboardStats {
  systemStatus: string;
  uptime: string;
  version: string;
  totalUsers: number;
  connectedUsers: number;
  loggedInUsers: number;
  activeConnections: number;
  memoryStats: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  goroutines: number;
  users: WuzAPIUser[];
}

const [stats, setStats] = useState<DashboardStats | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Methods:**
- `fetchDashboardStats()`: Busca estatísticas da API
- `formatUptime(seconds: number)`: Formata uptime em formato legível
- `formatMemory(bytes: number)`: Formata memória em MB/GB

## Data Models

### DashboardStats (Backend)

```javascript
{
  systemStatus: String,      // "ok" | "degraded" | "error"
  uptime: String,            // Formato: "2h 30m 15s"
  version: String,           // Versão da aplicação
  totalUsers: Number,        // Total de usuários cadastrados
  connectedUsers: Number,    // Usuários com WhatsApp conectado
  loggedInUsers: Number,     // Usuários logados no sistema
  activeConnections: Number, // Conexões ativas
  memoryStats: {
    heapUsed: Number,       // Memória heap usada (bytes)
    heapTotal: Number,      // Memória heap total (bytes)
    rss: Number,            // Resident Set Size (bytes)
    external: Number        // Memória externa (bytes)
  },
  goroutines: Number,       // Número de goroutines (0 para Node.js)
  users: Array<WuzAPIUser>  // Lista completa de usuários
}
```

### WuzAPIUser (Shared)

```typescript
interface WuzAPIUser {
  id: string;
  name: string;
  token: string;
  connected: boolean;
  loggedIn: boolean;
  jid: string;
  webhook: string;
  events: string;
  expiration: number;
  qrcode: string;
  proxy_url: string;
  proxy_config: object;
  s3_config: object;
}
```

## Error Handling

### Backend Error Scenarios

1. **Token Inválido (401)**
   - Causa: Token da sessão não é válido na WuzAPI
   - Resposta: `{ success: false, error: "Token de administrador inválido", code: 401 }`
   - Log: `logger.warn('Token administrativo inválido', { ... })`

2. **WuzAPI Indisponível (503)**
   - Causa: Timeout ou erro na comunicação com WuzAPI
   - Resposta: `{ success: false, error: "Serviço WuzAPI temporariamente indisponível", code: 503 }`
   - Log: `logger.error('WuzAPI indisponível', { ... })`

3. **Erro Interno (500)**
   - Causa: Exceção não tratada no processamento
   - Resposta: `{ success: false, error: "Erro ao buscar estatísticas do sistema", code: 500 }`
   - Log: `logger.error('Erro ao buscar dashboard stats', { ... })`

### Frontend Error Handling

1. **Erro de Rede**
   - Exibir toast: "Erro ao carregar dados do sistema"
   - Manter último estado válido se disponível
   - Retry automático após 30 segundos

2. **Erro 401 (Não Autorizado)**
   - Exibir toast: "Sessão expirada. Faça login novamente"
   - Redirecionar para página de login após 3 segundos

3. **Erro 503 (Serviço Indisponível)**
   - Exibir toast: "Serviço temporariamente indisponível"
   - Retry automático após 30 segundos

## Testing Strategy

### Backend Tests

**File:** `server/routes/adminRoutes.test.js`

1. **Test: Rota retorna estatísticas com token válido**
   - Setup: Mock WuzAPI retornando lista de usuários
   - Action: GET /api/admin/dashboard-stats com sessão válida
   - Assert: Status 200, dados corretos no response

2. **Test: Rota retorna 401 sem sessão válida**
   - Setup: Requisição sem sessão
   - Action: GET /api/admin/dashboard-stats
   - Assert: Status 401, mensagem de erro apropriada

3. **Test: Rota retorna 503 quando WuzAPI está indisponível**
   - Setup: Mock WuzAPI retornando erro de timeout
   - Action: GET /api/admin/dashboard-stats com sessão válida
   - Assert: Status 503, mensagem de erro apropriada

4. **Test: Estatísticas são calculadas corretamente**
   - Setup: Mock WuzAPI com 5 usuários (2 conectados, 3 desconectados)
   - Action: GET /api/admin/dashboard-stats
   - Assert: totalUsers=5, connectedUsers=2, loggedInUsers=2

### Frontend Tests

**File:** `src/components/admin/AdminOverview.test.tsx`

1. **Test: Componente exibe loading state inicialmente**
   - Setup: Render componente
   - Assert: Spinner visível

2. **Test: Componente exibe estatísticas após carregamento**
   - Setup: Mock API retornando dados válidos
   - Action: Render componente, aguardar carregamento
   - Assert: Cards com estatísticas visíveis

3. **Test: Componente exibe erro quando API falha**
   - Setup: Mock API retornando erro 500
   - Action: Render componente, aguardar carregamento
   - Assert: Toast de erro exibido

4. **Test: Componente atualiza dados a cada 30 segundos**
   - Setup: Mock API, mock setInterval
   - Action: Render componente, avançar timer 30s
   - Assert: API chamada novamente

## Performance Considerations

### Caching Strategy

- **Backend Cache:** Cachear resposta da WuzAPI por 30 segundos
- **Cache Key:** `admin-dashboard-stats`
- **Cache Invalidation:** Automática após 30 segundos
- **Benefit:** Reduz carga na WuzAPI, melhora tempo de resposta

### Memory Optimization

- **Frontend:** Limpar interval ao desmontar componente
- **Backend:** Não armazenar dados de usuários em memória além do cache
- **Logging:** Usar níveis apropriados (INFO para sucesso, WARN para erros recuperáveis)

## Security Considerations

1. **Autenticação:** Sempre validar sessão com middleware `requireAdmin`
2. **Autorização:** Verificar que o token da sessão é válido na WuzAPI
3. **Dados Sensíveis:** Não expor tokens de usuários no response (apenas IDs)
4. **Rate Limiting:** Aplicar rate limiting na rota (já implementado globalmente)
5. **CORS:** Validar origem das requisições (já implementado)

## Migration Path

1. **Fase 1:** Criar rota `/api/admin/dashboard-stats` no backend
2. **Fase 2:** Atualizar componente `AdminOverview` para usar nova rota
3. **Fase 3:** Remover código de fallback antigo (WuzAPIService direto)
4. **Fase 4:** Adicionar testes unitários e de integração
5. **Fase 5:** Monitorar logs e métricas em produção
