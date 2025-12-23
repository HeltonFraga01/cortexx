# WUZAPI Manager - Backend Server

Backend em Node.js com Express e Supabase (PostgreSQL) para o WUZAPI Manager.

## 🚀 Instalação e Execução

### 1. Instalar Dependências
```bash
cd server
npm install
```

### 2. Executar em Desenvolvimento
```bash
npm run dev
```

### 3. Executar em Produção
```bash
npm start
```

O servidor rodará na porta **3000** por padrão.

## 🗄️ Banco de Dados

O servidor usa **Supabase** (PostgreSQL hospedado) como banco de dados exclusivo.

### Configuração do Supabase

Configure as seguintes variáveis de ambiente:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### Abstração de Banco de Dados

Todas as operações de banco de dados são feitas através do `SupabaseService`:

```javascript
const SupabaseService = require('./services/SupabaseService');

// Operações básicas
const { data, error } = await SupabaseService.getById('table', id);
const { data, error } = await SupabaseService.getMany('table', { filter: value });
const { data, error } = await SupabaseService.insert('table', data);
const { data, error } = await SupabaseService.update('table', id, data);
const { data, error } = await SupabaseService.delete('table', id);

// Queries customizadas
const { data, error } = await SupabaseService.queryAsAdmin('table', (query) =>
  query.select('*').eq('field', value).order('created_at', { ascending: false })
);
```

## 🔧 Configuração

### Variáveis de Ambiente
Crie um arquivo `.env` na pasta `server/`:

```env
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
WUZAPI_BASE_URL=https://your-wuzapi-instance.com
CORS_ORIGINS=http://localhost:5173
SESSION_SECRET=your-session-secret
LOG_LEVEL=debug
```

## 📁 Estrutura de Arquivos

```
server/
├── index.js                    # Servidor Express principal
├── services/
│   ├── SupabaseService.js      # Abstração do banco de dados (OBRIGATÓRIO)
│   ├── AccountService.js       # Gerenciamento de contas
│   ├── AgentService.js         # Gerenciamento de agentes
│   ├── BotService.js           # Gerenciamento de bots
│   ├── ChatService.js          # Serviço de chat
│   ├── InboxService.js         # Gerenciamento de inboxes
│   ├── PlanService.js          # Planos de assinatura
│   ├── QuotaService.js         # Controle de quotas
│   ├── SubscriptionService.js  # Assinaturas de usuários
│   ├── TeamService.js          # Gerenciamento de times
│   └── ...                     # Outros serviços
├── routes/                     # Endpoints HTTP
│   ├── adminRoutes.js          # Rotas admin
│   ├── userRoutes.js           # Rotas de usuário
│   ├── agentRoutes.js          # Rotas de agentes
│   └── ...                     # Outras rotas
├── middleware/                 # Middlewares
│   ├── auth.js                 # Autenticação
│   ├── rateLimiter.js          # Rate limiting
│   └── ...                     # Outros middlewares
├── validators/                 # Validação de entrada
├── utils/                      # Utilitários
│   ├── logger.js               # Logging estruturado
│   └── wuzapiClient.js         # Cliente WUZAPI
├── webhooks/                   # Handlers de webhooks
├── migrations/                 # Migrações Supabase
├── scripts/                    # Scripts utilitários
└── tests/                      # Testes
```

## 🔒 Regras de Desenvolvimento

### Abstrações Obrigatórias

**NUNCA bypass estas camadas:**

| Camada | Módulo Obrigatório | Proibido |
|--------|-------------------|----------|
| Database | `services/SupabaseService.js` | Cliente Supabase direto |
| Logging | `utils/logger.js` | `console.log/error` |
| WUZAPI | `utils/wuzapiClient.js` | `fetch()` direto |

### Padrão de Rotas

```javascript
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

router.get('/endpoint', authenticate, async (req, res) => {
  try {
    const { data, error } = await SupabaseService.getMany('table', { 
      user_id: req.user.id 
    });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Operation failed', { 
      error: error.message, 
      userId: req.user?.id,
      endpoint: '/endpoint'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Padrão de Serviços

```javascript
const SupabaseService = require('./SupabaseService');
const { logger } = require('../utils/logger');

class MyService {
  constructor() {
    // Sem parâmetro db - usa SupabaseService diretamente
  }

  async getById(id) {
    const { data, error } = await SupabaseService.getById('my_table', id);
    if (error) throw error;
    return data;
  }
}

module.exports = MyService;
```

## 📝 Logging

O servidor usa logging estruturado via `utils/logger.js`:

```javascript
const { logger } = require('./utils/logger');

logger.info('Operation completed', { userId, action });
logger.error('Operation failed', { error: error.message, userId, endpoint });
logger.debug('Debug info', { data });
logger.warn('Warning', { issue });
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes específicos
npm test -- --grep "ServiceName"
```

## 🔒 Segurança

⚠️ **Importante para Produção:**
- Configure CORS adequadamente
- Use HTTPS
- Implemente autenticação/autorização
- Valide todas as entradas com Zod
- Use variáveis de ambiente para configurações sensíveis
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Aplique rate limiting em endpoints sensíveis

## 🐛 Troubleshooting

### Erro de Conexão Supabase
- Verifique se `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão configurados
- Verifique se o projeto Supabase está ativo
- Execute `npm run dev` e verifique os logs

### Porta em Uso
```bash
PORT=3001 npm run dev
```

### Verificar Health
```bash
curl http://localhost:3000/health
```
