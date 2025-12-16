# Guia de Configuração - WUZAPI Manager

Este documento explica a estrutura de configuração do WUZAPI Manager e como as variáveis de ambiente são organizadas.

---

## Estrutura de Arquivos

O projeto usa **arquivos de configuração separados** para frontend e backend:

```
.
├── .env                    # Frontend (Vite) - Desenvolvimento
├── .env.production         # Frontend (Vite) - Produção
├── .env.example            # Frontend - Exemplo
└── server/
    ├── .env                # Backend (Express) - Desenvolvimento
    └── .env.example        # Backend - Exemplo
```

---

## Frontend (.env)

**Usado por:** Vite (build do frontend)  
**Prefixo obrigatório:** `VITE_`

### Variáveis Disponíveis

```bash
# URL da API WUZAPI externa
VITE_WUZAPI_BASE_URL=https://wzapi.wasend.com.br

# Token de administrador (opcional)
VITE_ADMIN_TOKEN=seu_token_aqui

# Modo de desenvolvimento
VITE_DEV_MODE=true

# Nome da aplicação (fallback)
VITE_APP_NAME=WhatsApp Manager
```

### Importante

- Apenas variáveis com prefixo `VITE_` são expostas ao frontend
- Nunca coloque informações sensíveis aqui (são públicas no bundle)
- O token admin pode ser configurado via interface

---

## Backend (server/.env)

**Usado por:** Express (servidor Node.js)  
**Prefixo:** Nenhum

### Variáveis Disponíveis

```bash
# Servidor
NODE_ENV=development
PORT=3001

# API WUZAPI
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
REQUEST_TIMEOUT=10000

# CORS - Origens permitidas
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:4173,http://localhost:8080

# Banco de dados SQLite
SQLITE_DB_PATH=../data/wuzapi.db
SQLITE_WAL_MODE=true
SQLITE_TIMEOUT=5000
SQLITE_CACHE_SIZE=2000
SQLITE_SYNCHRONOUS=NORMAL

# Logging
LOG_LEVEL=info
```

---

## Ambientes

### Desenvolvimento

**Frontend:**
- Arquivo: `.env`
- Vite dev server: `http://localhost:5173`

**Backend:**
- Arquivo: `server/.env`
- Express server: `http://localhost:3001`

**CORS:**
- Inclui todas as portas de desenvolvimento: 5173, 3000, 4173, 8080

**Banco de dados:**
- Caminho: `./data/wuzapi.db` (relativo à raiz do projeto)

### Produção

**Frontend:**
- Arquivo: `.env.production`
- Build estático servido pelo backend

**Backend:**
- Variáveis de ambiente do sistema (Docker/OS)
- Não usa arquivo `.env` em produção

**CORS:**
- Apenas domínio de produção: `https://seu-dominio.com`

**Banco de dados:**
- Caminho: `/app/data/wuzapi.db` (dentro do container Docker)

---

## Variáveis Críticas

### CORS_ORIGINS

**Problema anterior:** Valores diferentes entre `.env` e `server/.env`

**Solução:**
- `.env` (frontend): Não precisa de CORS_ORIGINS (não é usado)
- `server/.env` (backend): Contém todas as portas de desenvolvimento

**Desenvolvimento:**
```bash
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:4173,http://localhost:8080
```

**Produção:**
```bash
CORS_ORIGINS=https://seu-dominio.com
```

### SQLITE_DB_PATH

**Problema anterior:** Valores inconsistentes entre ambientes

**Solução:**

| Ambiente | Arquivo | Valor | Contexto |
|----------|---------|-------|----------|
| Dev Frontend | `.env` | ❌ Removido | Não usado pelo frontend |
| Dev Backend | `server/.env` | `../data/wuzapi.db` | Relativo ao dir `server/` |
| Produção | Sistema | `/app/data/wuzapi.db` | Caminho absoluto no Docker |

**Explicação:**
- Backend sempre acessa o banco via `server/.env`
- Em dev: `../data/wuzapi.db` sobe um nível do dir `server/`
- Em prod: `/app/data/wuzapi.db` é o caminho absoluto no container

---

## Configuração Inicial

### 1. Desenvolvimento Local

```bash
# 1. Copiar arquivos de exemplo
cp .env.example .env
cp server/.env.example server/.env

# 2. Ajustar valores (se necessário)
# - VITE_WUZAPI_BASE_URL: URL da sua instância WUZAPI
# - VITE_ADMIN_TOKEN: Token de admin (ou configure via UI)

# 3. Criar diretório de dados
mkdir -p data

# 4. Iniciar servidores
npm run dev:full
```

### 2. Produção (Docker)

```bash
# Variáveis de ambiente via docker-compose.yml ou sistema
docker run -e NODE_ENV=production \
           -e PORT=3001 \
           -e SQLITE_DB_PATH=/app/data/wuzapi.db \
           -e CORS_ORIGINS=https://seu-dominio.com \
           -v ./data:/app/data \
           wuzapi-manager
```

---

## Troubleshooting

### Erro de CORS

**Sintoma:** Frontend não consegue acessar backend

**Solução:**
1. Verifique `CORS_ORIGINS` em `server/.env`
2. Certifique-se de incluir a porta do Vite: `http://localhost:5173`
3. Reinicie o servidor backend

### Erro de Banco de Dados

**Sintoma:** `SQLITE_CANTOPEN` ou arquivo não encontrado

**Solução:**
1. Verifique `SQLITE_DB_PATH` em `server/.env`
2. Certifique-se que o diretório `data/` existe
3. Verifique permissões de escrita

### Variáveis não carregadas

**Sintoma:** Variáveis aparecem como `undefined`

**Solução Frontend:**
- Variáveis devem ter prefixo `VITE_`
- Reinicie o Vite dev server

**Solução Backend:**
- Verifique se `server/.env` existe
- Reinicie o servidor Express

---

## Boas Práticas

1. ✅ **Nunca commite arquivos `.env`** (já estão no `.gitignore`)
2. ✅ **Use `.env.example`** como template
3. ✅ **Documente variáveis novas** neste arquivo
4. ✅ **Separe frontend e backend** (arquivos diferentes)
5. ✅ **Use variáveis de sistema** em produção
6. ❌ **Não coloque secrets** em variáveis `VITE_*` (são públicas)
7. ❌ **Não duplique variáveis** entre arquivos

---

## Referências

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Node.js dotenv](https://github.com/motdotla/dotenv)
- [Docker Environment Variables](https://docs.docker.com/compose/environment-variables/)

---

**Última atualização:** 2025-11-14  
**Versão:** 1.0.0
