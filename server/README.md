# WUZAPI Manager - Backend Server

Backend em Node.js com Express e SQLite para gerenciar configurações de banco de dados do WUZAPI Manager.

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

O servidor usa **SQLite** com o arquivo `wuzapi.db` criado automaticamente na pasta `server/`.

### Estrutura da Tabela `database_connections`

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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Configuração

### Variáveis de Ambiente
Crie um arquivo `.env` na pasta `server/` (opcional):

```env
PORT=3001
DB_PATH=./wuzapi.db
```

### CORS
O servidor está configurado para aceitar requisições de qualquer origem. Em produção, configure adequadamente.

## 📝 Logs

O servidor registra todas as requisições no console:
```
2024-01-01T12:00:00.000Z - GET /api/database-connections
2024-01-01T12:00:01.000Z - POST /api/database-connections
```

## 🛠️ Desenvolvimento

### Estrutura de Arquivos
```
server/
├── index.js          # Servidor Express principal
├── database.js       # Classe para gerenciar SQLite
├── package.json      # Dependências e scripts
├── wuzapi.db         # Banco SQLite (criado automaticamente)
└── README.md         # Esta documentação
```

### Dependências
- **express**: Framework web
- **sqlite3**: Driver SQLite
- **cors**: Middleware CORS
- **body-parser**: Parser de requisições
- **nodemon**: Auto-reload em desenvolvimento

## 🔒 Segurança

⚠️ **Importante para Produção:**
- Configure CORS adequadamente
- Use HTTPS
- Implemente autenticação/autorização
- Valide todas as entradas
- Use variáveis de ambiente para configurações sensíveis

## 🐛 Troubleshooting

### Erro "ECONNREFUSED"
- Verifique se o servidor está rodando na porta 3001
- Execute `npm run dev` na pasta `server/`

### Erro de Permissão SQLite
- Verifique permissões da pasta `server/`
- O arquivo `wuzapi.db` deve ser criável/editável

### Porta em Uso
- Mude a porta no arquivo `.env` ou use:
```bash
PORT=3002 npm run dev
```