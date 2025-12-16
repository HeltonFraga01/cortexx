# 🔧 Troubleshooting Guide

Este guia contém soluções para problemas comuns encontrados no WUZAPI Manager.

## 🐳 Docker Swarm & Traefik

### Erro 404 "page not found" no Traefik

**Sintomas:**
- Contêiner está saudável (healthy) e rodando
- Health check interno retorna 200
- Acesso externo retorna `404 page not found` (texto simples)
- Logs do contêiner não mostram erros

**Causa:**
O Traefik não está reconhecendo as labels do serviço Docker Swarm. Isso pode acontecer quando:
- O serviço é atualizado mas o Traefik não recebe o evento de rede
- O Swarm "perde" eventos silenciosamente durante o deploy
- As labels foram adicionadas/modificadas mas não foram aplicadas

**Solução:**

1. **Usar o script de deploy automático** (recomendado):
```bash
./deploy.sh
```

O script `deploy.sh` automaticamente:
- Faz o deploy da stack
- Aguarda a inicialização do serviço
- Força a atualização do serviço com `--force`
- Verifica o status final

2. **Forçar atualização manual**:
```bash
docker service update --force wuzapi-manager_wuzapi-manager
```

3. **Verificar se o Traefik está configurado corretamente**:
```bash
# Verificar se o Traefik está em modo Swarm
docker service inspect traefik | grep -i swarm

# Deve mostrar: --providers.docker.swarmMode=true
```

4. **Verificar logs do Traefik**:
```bash
docker service logs traefik --tail 50
```

**Prevenção:**
- Sempre use `./deploy.sh` para deploys em produção
- Evite usar `docker stack deploy` diretamente
- Configure o Traefik com `--providers.docker.swarmMode=true`

---

### Serviço não inicia após deploy

**Sintomas:**
- `docker service ps` mostra status "Failed" ou "Rejected"
- Contêiner reinicia continuamente

**Diagnóstico:**
```bash
# Ver logs do serviço
docker service logs wuzapi-manager_wuzapi-manager --tail 100

# Ver tarefas com erros
docker service ps wuzapi-manager_wuzapi-manager --no-trunc
```

**Causas comuns:**

1. **Volumes não existem**:
```bash
# Criar volumes manualmente
docker volume create cloudapi-data
docker volume create cloudapi-logs
```

2. **Rede externa não existe**:
```bash
# Criar rede do Traefik
docker network create --driver overlay network_public
```

3. **Porta já em uso**:
```bash
# Verificar portas em uso
netstat -tulpn | grep 3004

# Alterar porta no docker-compose-swarm.yaml
ports:
  - "3005:3001"  # Usar porta diferente
```

4. **Variáveis de ambiente inválidas**:
- Verificar se `WUZAPI_BASE_URL` está acessível
- Verificar se `CORS_ORIGINS` está correto
- Verificar se tokens estão configurados

---

### Health check falhando

**Sintomas:**
- Serviço mostra status "unhealthy"
- Contêiner reinicia após 5 tentativas falhas

**Diagnóstico:**
```bash
# Executar health check manualmente dentro do contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) node server/healthcheck.js

# Ver logs do health check
docker service logs wuzapi-manager_wuzapi-manager | grep -i health
```

**Soluções:**

1. **Aumentar timeout do health check**:
```yaml
healthcheck:
  test: ["CMD", "node", "server/healthcheck.js"]
  interval: 30s
  timeout: 15s  # Aumentar de 10s para 15s
  retries: 5
  start_period: 120s  # Aumentar de 90s para 120s
```

2. **Verificar se o servidor está escutando na porta correta**:
```bash
# Dentro do contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) netstat -tulpn | grep 3001
```

3. **Verificar logs de inicialização**:
```bash
docker service logs wuzapi-manager_wuzapi-manager --since 5m
```

---

## 🔐 Autenticação

### Token de admin não funciona

**Sintomas:**
- Login retorna erro 401 ou 403
- Token parece correto mas não autentica

**Verificações:**

1. **Token está configurado no backend**:
```bash
# Verificar variável de ambiente
docker exec -it $(docker ps -q -f name=wuzapi-manager) env | grep ADMIN_TOKEN
```

2. **Token está correto no frontend**:
```bash
# Verificar .env
cat .env | grep VITE_ADMIN_TOKEN
```

3. **Formato do token**:
- Deve ser uma string sem espaços
- Não deve ter aspas ou caracteres especiais
- Deve ter pelo menos 16 caracteres

**Solução:**
```bash
# Gerar novo token seguro
openssl rand -base64 32

# Atualizar no backend (server/.env)
WUZAPI_ADMIN_TOKEN=seu-novo-token-aqui

# Atualizar no frontend (.env)
VITE_ADMIN_TOKEN=seu-novo-token-aqui

# Redeploy
./deploy.sh
```

---

### CORS bloqueando requisições

**Sintomas:**
- Erro no console: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Requisições funcionam no Postman mas não no navegador

**Solução:**

1. **Adicionar origem no backend**:
```bash
# No docker-compose-swarm.yaml
environment:
  - CORS_ORIGINS=https://seu-dominio.com,https://outro-dominio.com
```

2. **Verificar se a origem está correta**:
```bash
# Deve incluir protocolo (https://) e não ter barra no final
✅ https://cloudapi.wasend.com.br
❌ cloudapi.wasend.com.br
❌ https://cloudapi.wasend.com.br/
```

3. **Redeploy após mudanças**:
```bash
./deploy.sh
```

---

## 🗄️ Banco de Dados

### Erro "database is locked"

**Sintomas:**
- Operações de escrita falham com "database is locked"
- Múltiplas requisições simultâneas causam timeout

**Causa:**
SQLite em modo WAL pode ter problemas com múltiplas escritas simultâneas.

**Solução:**

1. **Verificar se WAL mode está ativo**:
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) sqlite3 /app/data/cloudapi.db "PRAGMA journal_mode;"
# Deve retornar: wal
```

2. **Aumentar timeout**:
```yaml
environment:
  - SQLITE_BUSY_TIMEOUT=10000  # Aumentar de 5000 para 10000
```

3. **Verificar permissões do volume**:
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) ls -la /app/data/
# Deve mostrar arquivos .db, .db-shm, .db-wal
```

---

### Migrações não executam

**Sintomas:**
- Tabelas não existem no banco
- Erro "no such table" ao acessar dados

**Diagnóstico:**
```bash
# Ver logs de migração
docker service logs wuzapi-manager_wuzapi-manager | grep -i migration

# Verificar tabelas no banco
docker exec -it $(docker ps -q -f name=wuzapi-manager) sqlite3 /app/data/cloudapi.db ".tables"
```

**Solução:**

1. **Executar migrações manualmente**:
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) node server/migrations/run-migrations.js
```

2. **Verificar permissões do diretório de migrações**:
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) ls -la server/migrations/
```

3. **Recriar banco (CUIDADO: perde dados)**:
```bash
# Backup primeiro
docker cp $(docker ps -q -f name=wuzapi-manager):/app/data/cloudapi.db ./backup.db

# Remover banco
docker exec -it $(docker ps -q -f name=wuzapi-manager) rm /app/data/cloudapi.db

# Reiniciar serviço (migrações rodam automaticamente)
docker service update --force wuzapi-manager_wuzapi-manager
```

---

## 🌐 Rede e Conectividade

### Não consegue acessar WUZAPI

**Sintomas:**
- Erro "ECONNREFUSED" ou "Network Error"
- Timeout ao tentar conectar com WUZAPI

**Verificações:**

1. **URL está correta**:
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) env | grep WUZAPI_BASE_URL
# Deve ser: https://wzapi.wasend.com.br (sem barra no final)
```

2. **WUZAPI está acessível**:
```bash
curl -I https://wzapi.wasend.com.br/health
# Deve retornar 200 OK
```

3. **DNS está resolvendo**:
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) nslookup wzapi.wasend.com.br
```

**Solução:**
```bash
# Testar conectividade de dentro do contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) curl -v https://wzapi.wasend.com.br/health
```

---

## 📊 Performance

### Alto uso de memória

**Sintomas:**
- Contêiner usando mais de 1GB de RAM
- OOM (Out of Memory) kills

**Diagnóstico:**
```bash
# Ver uso de recursos
docker stats $(docker ps -q -f name=wuzapi-manager)
```

**Solução:**

1. **Aumentar limite de memória**:
```yaml
resources:
  limits:
    memory: 2G  # Aumentar de 1G para 2G
```

2. **Otimizar Node.js**:
```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=1536  # Aumentar de 1024
```

3. **Verificar memory leaks**:
```bash
# Habilitar logs de memória
docker service logs wuzapi-manager_wuzapi-manager | grep -i "heap"
```

---

### Lentidão no banco de dados

**Sintomas:**
- Queries demoram mais de 1 segundo
- Timeout em operações de lista

**Solução:**

1. **Otimizar cache do SQLite**:
```yaml
environment:
  - SQLITE_CACHE_SIZE=16000  # Aumentar de 8000
```

2. **Verificar tamanho do banco**:
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) du -h /app/data/cloudapi.db
```

3. **Executar VACUUM** (compactar banco):
```bash
docker exec -it $(docker ps -q -f name=wuzapi-manager) sqlite3 /app/data/cloudapi.db "VACUUM;"
```

---

## 🔍 Logs e Debugging

### Habilitar logs detalhados

```bash
# Logs do serviço em tempo real
docker service logs -f wuzapi-manager_wuzapi-manager

# Logs com timestamp
docker service logs -f --timestamps wuzapi-manager_wuzapi-manager

# Últimas 100 linhas
docker service logs --tail 100 wuzapi-manager_wuzapi-manager

# Filtrar por erro
docker service logs wuzapi-manager_wuzapi-manager | grep -i error
```

### Acessar contêiner para debug

```bash
# Entrar no contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) sh

# Verificar processos
ps aux

# Verificar portas
netstat -tulpn

# Verificar arquivos
ls -la /app/data/
ls -la /app/logs/

# Testar health check
node server/healthcheck.js

# Sair
exit
```

---

## 📞 Suporte

Se o problema persistir após seguir este guia:

1. Colete informações de diagnóstico:
```bash
# Salvar logs
docker service logs wuzapi-manager_wuzapi-manager > logs.txt

# Salvar configuração
docker service inspect wuzapi-manager_wuzapi-manager > service-config.json

# Salvar status
docker service ps wuzapi-manager_wuzapi-manager > service-status.txt
```

2. Verifique a documentação completa em `docs/`

3. Entre em contato com o suporte técnico com os arquivos coletados
