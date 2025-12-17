# WUZAPI Manager - Backend Server

Backend em Node.js com Express e Supabase (PostgreSQL) para gerenciar configurações de banco de dados do WUZAPI Manager.

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

O servidor rodará na porta **3001** por padrão.

## 📊 Endpoints da API

### Health Check
- `GET /health` - Verificar se o servidor está rodando

### Database Connections
- `GET /api/database-connections` - Listar todas as conexões
- `GET /api/database-connections/:id` - Buscar conexão por ID
- `POST /api/database-connections` - Criar nova conexão
- `PUT /api/database-connections/:id` - Atualizar conexão
- `PATCH /api/database-connections/:id/status` - Atualizar apenas status
- `DELETE /api/database-connections/:id` - Deletar conexão

## 🗄️ Banco de Dados

O servidor usa **Supabase** (PostgreSQL hospedado) como banco de dados principal.

### Configuração do Supabase

Configure as seguintes variáveis de ambiente:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Estrutura da Tabela `database_connections`

```sql
CREATE TABLE database_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔧 Configuração

### Variáveis de Ambiente
Crie um arquivo `.env` na pasta `server/`:

```env
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WUZAPI_BASE_URL=https://your-wuzapi-instance.com
CORS_ORIGINS=http://localhost:5173
SESSION_SECRET=your-session-secret
```

### CORS
O servidor está configurado para aceitar requisições das origens definidas em `CORS_ORIGINS`. Em produção, configure adequadamente.

## 📝 Logs

O servidor usa logging estruturado via `utils/logger.js`:
```
2024-01-01T12:00:00.000Z [INFO] GET /api/database-connections
2024-01-01T12:00:01.000Z [INFO] POST /api/database-connections
```

## 🛠️ Desenvolvimento

### Estrutura de Arquivos
```
server/
├── index.js              # Servidor Express principal
├── database.js           # Camada de compatibilidade (usa SupabaseService)
├── services/
│   └── SupabaseService.js # Abstração do banco de dados
├── routes/               # Endpoints HTTP
├── middleware/           # Autenticação, CORS, etc.
├── utils/                # Logger, validadores, etc.
├── package.json          # Dependências e scripts
└── README.md             # Esta documentação
```

### Dependências Principais
- **express**: Framework web
- **@supabase/supabase-js**: Cliente Supabase
- **cors**: Middleware CORS
- **helmet**: Segurança HTTP
- **winston**: Logging estruturado

## 🔒 Segurança

⚠️ **Importante para Produção:**
- Configure CORS adequadamente
- Use HTTPS
- Implemente autenticação/autorização
- Valide todas as entradas
- Use variáveis de ambiente para configurações sensíveis
- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend

## 🐛 Troubleshooting

### Erro "ECONNREFUSED"
- Verifique se o servidor está rodando na porta 3001
- Execute `npm run dev` na pasta `server/`

### Erro de Conexão Supabase
- Verifique se `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estão configurados
- Verifique se o projeto Supabase está ativo

### Porta em Uso
- Mude a porta no arquivo `.env` ou use:
```bash
PORT=3002 npm run dev
```
