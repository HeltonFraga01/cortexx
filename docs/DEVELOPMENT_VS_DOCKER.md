# Desenvolvimento Local vs Docker

## O Problema

Você está certo! Existem **duas maneiras diferentes** de rodar a aplicação, e elas precisam estar sincronizadas.

## Diferenças Principais

### 1. Desenvolvimento Local (`npm run dev:full`)

**Como funciona:**
```bash
# Frontend
npm run dev          # Vite dev server na porta 5173

# Backend  
cd server && npm run dev  # Node.js na porta 3001
```

**Variáveis de ambiente:**
- Frontend: `.env` (raiz do projeto)
- Backend: `server/.env`

**Rede:**
- Tudo roda em `localhost`
- Frontend acessa backend via `http://localhost:3001`
- Backend acessa WUZAPI via internet

**Banco de dados:**
- SQLite em `data/wuzapi.db` (caminho absoluto no seu PC)

---

### 2. Docker (`docker-compose up`)

**Como funciona:**
```bash
# Tudo em um container
docker build  # Cria imagem com frontend + backend
docker run    # Roda container isolado
```

**Variáveis de ambiente:**
- **Problema:** Docker NÃO lê `.env` ou `server/.env` automaticamente!
- **Solução:** Precisa usar `.env.docker` ou passar via `docker-compose.yml`

**Rede:**
- Container isolado com IP próprio
- Frontend servido pelo backend (build estático)
- Backend precisa acessar WUZAPI pela internet
- **Problema comum:** Container não consegue resolver DNS ou acessar rede

**Banco de dados:**
- SQLite em `/app/data/wuzapi.db` (dentro do container)
- **Problema:** Se não montar volume, perde dados ao reiniciar

---

## Por Que Quebra no Docker?

### 1. Variáveis de Ambiente Faltando

**Desenvolvimento:**
```env
# server/.env (é lido automaticamente)
SESSION_SECRET=J3zThG3n1miWCleY2yM1XmNjXFtbuhX+TEcBOsEBHAM=
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
CORS_ORIGINS=http://localhost:5173,...
```

**Docker (ANTES da correção):**
```yaml
# docker-compose.yml
environment:
  - WUZAPI_BASE_URL=https://wzapi.wasend.com.br
  - CORS_ORIGINS=http://localhost,...
  # ❌ FALTA SESSION_SECRET!
  # ❌ Validador de ambiente vai FALHAR!
```

**Docker (DEPOIS da correção):**
```yaml
# docker-compose.yml
env_file:
  - .env.docker  # ✅ Carrega TODAS as variáveis
```

### 2. Caminhos de Arquivos Diferentes

**Desenvolvimento:**
```javascript
// server/.env
SQLITE_DB_PATH=/Users/heltonfraga/Documents/Develop/WaSendGO/data/wuzapi.db
```

**Docker:**
```javascript
// .env.docker
SQLITE_DB_PATH=/app/data/wuzapi.db  // Caminho DENTRO do container
```

### 3. Rede e DNS

**Desenvolvimento:**
- `localhost` funciona
- DNS do sistema operacional

**Docker:**
- `localhost` aponta para o próprio container
- DNS do Docker (pode ter problemas)
- Precisa acessar WUZAPI pela internet

---

## Solução: Manter Sincronizado

### Checklist de Variáveis Obrigatórias

Toda variável em `server/.env` **DEVE** estar em `.env.docker`:

- ✅ `NODE_ENV`
- ✅ `PORT`
- ✅ `WUZAPI_BASE_URL`
- ✅ `CORS_ORIGINS`
- ✅ `SESSION_SECRET` ⚠️ **CRÍTICO!**
- ✅ `SQLITE_DB_PATH`
- ✅ `LOG_LEVEL`

### Como Testar se Está Sincronizado

1. **Validar ambiente no startup:**
```javascript
// server/index.js (já implementado)
const { environmentValidator } = require('./utils/environmentValidator');
const isValid = environmentValidator.validateAndLog();

if (!isValid) {
  process.exit(1);  // Falha rápido se algo estiver faltando
}
```

2. **Testar localmente:**
```bash
npm run dev:full
curl http://localhost:3001/health
# Deve retornar: "configuration": { "valid": true }
```

3. **Testar no Docker:**
```bash
docker-compose up -d
docker-compose logs wuzapi-manager-dev
# Deve mostrar: "✅ Validação de ambiente concluída com sucesso"

curl http://localhost/health
# Deve retornar: "configuration": { "valid": true }
```

---

## Fluxo de Deploy Correto

### 1. Desenvolvimento
```bash
# Testar localmente primeiro
npm run dev:full

# Verificar health check
curl http://localhost:3001/health
```

### 2. Preparar Docker
```bash
# Copiar variáveis de ambiente
cp server/.env .env.docker

# Ajustar caminhos para Docker
# SQLITE_DB_PATH=/app/data/wuzapi.db
# CORS_ORIGINS=http://seu-dominio.com

# Gerar novo SESSION_SECRET para produção
openssl rand -base64 32
```

### 3. Build e Test
```bash
# Build da imagem
docker build -t wuzapi-manager .

# Testar localmente com Docker
docker-compose up -d

# Verificar logs
docker-compose logs -f wuzapi-manager-dev

# Verificar health check
curl http://localhost/health
```

### 4. Deploy
```bash
# Só fazer deploy se health check passar
docker-compose -f docker-compose.prod.yml up -d
```

---

## Debugging

### Se quebrar no Docker:

1. **Verificar logs:**
```bash
docker-compose logs wuzapi-manager-dev
```

2. **Entrar no container:**
```bash
docker-compose exec wuzapi-manager-dev sh
env | grep -E "SESSION_SECRET|WUZAPI|CORS"
```

3. **Testar health check:**
```bash
docker-compose exec wuzapi-manager-dev node server/healthcheck.js
```

4. **Verificar variáveis:**
```bash
# Deve mostrar TODAS as variáveis
docker-compose config
```

---

## Resumo

**Você está certo:** São dois ambientes diferentes que precisam estar sincronizados.

**Solução implementada:**
1. ✅ Validador de ambiente no startup (falha rápido se algo estiver errado)
2. ✅ `.env.docker` com todas as variáveis necessárias
3. ✅ `docker-compose.yml` usa `env_file` para carregar variáveis
4. ✅ Health check verifica configuração completa

**Agora:** Desenvolvimento e Docker são espelhos! Se funciona localmente, vai funcionar no Docker.
