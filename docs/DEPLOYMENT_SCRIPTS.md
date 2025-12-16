# 🚀 Deployment Scripts Guide

Guia completo dos scripts de deploy e diagnóstico do WUZAPI Manager.

---

## 📋 Scripts Disponíveis

### 1. Deploy Script (`deploy.sh`)

Script principal para deploy em Docker Swarm com registro automático no Traefik.

**Localização:** `./deploy.sh` (root) ou `./scripts/deploy-swarm.sh`

**Uso:**
```bash
# Via script direto
./deploy.sh

# Via npm
npm run deploy:production
npm run docker:deploy
```

**O que faz:**
1. ✅ Valida se o arquivo `docker-compose-swarm.yaml` existe
2. ✅ Faz deploy da stack no Docker Swarm
3. ✅ Aguarda 10 segundos para o serviço inicializar
4. ✅ Verifica se o serviço foi criado
5. ✅ Executa `docker service update --force` para registrar no Traefik
6. ✅ Aguarda 5 segundos para propagação
7. ✅ Exibe status final do serviço

**Saída esperada:**
```
🚀 Starting deployment of wuzapi-manager...
📦 Deploying stack...
Creating network wuzapi-network
Creating service wuzapi-manager_wuzapi-manager
⏳ Waiting for service to initialize (10 seconds)...
✅ Service found: wuzapi-manager_wuzapi-manager
🔄 Forcing service update to register with Traefik...
wuzapi-manager_wuzapi-manager
overall progress: 1 out of 1 tasks
verify: Service converged
⏳ Waiting for Traefik to register routes (5 seconds)...

✅ Deployment complete!

📊 Service Status:
NAME                                    CURRENT STATE       ERROR
wuzapi-manager_wuzapi-manager.1         Running 2 minutes

🌐 Service should be available at:
   https://cloudapi.wasend.com.br

💡 To check logs, run:
   docker service logs -f wuzapi-manager_wuzapi-manager

🔍 To troubleshoot issues, see:
   docs/TROUBLESHOOTING.md
```

---

### 2. Check Deployment Script (`check-deployment.sh`)

Script de diagnóstico completo para verificar o status do deploy.

**Localização:** `./scripts/check-deployment.sh`

**Uso:**
```bash
# Via script direto
./scripts/check-deployment.sh

# Via npm
npm run docker:check
```

**O que verifica:**
1. ✅ Existência do serviço
2. ✅ Status das replicas (1/1)
3. ✅ Tasks em execução e falhas
4. ✅ Labels do Traefik
5. ✅ Conectividade de rede (network_public)
6. ✅ Health check do contêiner
7. ✅ Acesso externo via HTTPS

**Saída esperada (sucesso):**
```
🔍 WUZAPI Manager Deployment Diagnostics
==========================================

1️⃣ Checking if service exists...
   ✅ Service found: wuzapi-manager_wuzapi-manager

2️⃣ Checking service replicas...
   Replicas: 1/1
   ✅ Service is running

3️⃣ Checking service tasks...
NAME                                    CURRENT STATE       ERROR
wuzapi-manager_wuzapi-manager.1         Running 5 minutes

   ✅ No failed tasks

4️⃣ Checking Traefik labels...
   ✅ Traefik labels found (12 labels)
   📋 Key labels:
   - Host: Host(`cloudapi.wasend.com.br`)
   - Port: 3001

5️⃣ Checking network connectivity...
   Networks: wuzapi-network network_public
   ✅ Connected to network_public (Traefik network)

6️⃣ Checking service health...
   Health status: healthy
   ✅ Service is healthy

7️⃣ Testing external access...
   URL: https://cloudapi.wasend.com.br/health
   HTTP Status: 200
   ✅ Service is accessible externally

==========================================
📊 Summary
==========================================

✅ All checks passed! Service is running correctly.

🌐 Access your service at:
   https://cloudapi.wasend.com.br
```

**Saída esperada (erro 404):**
```
7️⃣ Testing external access...
   URL: https://cloudapi.wasend.com.br/health
   HTTP Status: 404
   ❌ 404 Not Found - Traefik not routing correctly
   💡 Run: docker service update --force wuzapi-manager_wuzapi-manager

==========================================
📊 Summary
==========================================

⚠️  Some issues detected. Review the checks above.

🔧 Quick fixes:
   1. Force Traefik registration: docker service update --force wuzapi-manager_wuzapi-manager
   2. Check logs: docker service logs wuzapi-manager_wuzapi-manager --tail 50
   3. Redeploy: ./deploy.sh

📚 For detailed troubleshooting, see:
   docs/TROUBLESHOOTING.md
```

---

## 🔄 Workflow Recomendado

### Deploy Inicial

```bash
# 1. Build da imagem (se necessário)
npm run deploy:official

# 2. Deploy no Swarm
./deploy.sh

# 3. Verificar status
npm run docker:check

# 4. Ver logs (se necessário)
npm run docker:logs
```

### Atualização de Serviço

```bash
# 1. Build nova imagem
npm run deploy:official

# 2. Atualizar serviço
./deploy.sh

# 3. Verificar se atualizou
npm run docker:check
```

### Troubleshooting

```bash
# 1. Verificar diagnóstico completo
npm run docker:check

# 2. Se erro 404, forçar registro no Traefik
docker service update --force wuzapi-manager_wuzapi-manager

# 3. Verificar novamente
npm run docker:check

# 4. Ver logs detalhados
npm run docker:logs
```

---

## 🛠️ Comandos Úteis

### Status e Logs

```bash
# Status do serviço
npm run docker:status
docker service ps wuzapi-manager_wuzapi-manager

# Logs em tempo real
npm run docker:logs
docker service logs -f wuzapi-manager_wuzapi-manager

# Últimas 100 linhas de log
docker service logs --tail 100 wuzapi-manager_wuzapi-manager

# Logs com timestamp
docker service logs --timestamps wuzapi-manager_wuzapi-manager
```

### Inspeção

```bash
# Inspecionar serviço
docker service inspect wuzapi-manager_wuzapi-manager

# Ver labels do Traefik
docker service inspect wuzapi-manager_wuzapi-manager --format '{{json .Spec.Labels}}' | jq

# Ver configuração de rede
docker service inspect wuzapi-manager_wuzapi-manager --format '{{json .Spec.TaskTemplate.Networks}}'

# Ver variáveis de ambiente
docker service inspect wuzapi-manager_wuzapi-manager --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'
```

### Atualização Manual

```bash
# Forçar atualização (registra no Traefik)
docker service update --force wuzapi-manager_wuzapi-manager

# Atualizar imagem
docker service update --image heltonfraga/wuzapi-manager:v1.5.46 wuzapi-manager_wuzapi-manager

# Atualizar variável de ambiente
docker service update --env-add "NEW_VAR=value" wuzapi-manager_wuzapi-manager

# Escalar replicas (não recomendado - SQLite não suporta)
docker service scale wuzapi-manager_wuzapi-manager=1
```

### Remoção

```bash
# Remover stack completa
npm run docker:remove
docker stack rm wuzapi-manager

# Remover apenas o serviço
docker service rm wuzapi-manager_wuzapi-manager
```

---

## 🐛 Problemas Comuns

### Erro 404 após deploy

**Sintoma:** Serviço está rodando mas retorna 404

**Causa:** Traefik não registrou as rotas

**Solução:**
```bash
docker service update --force wuzapi-manager_wuzapi-manager
```

### Serviço não inicia

**Sintoma:** Replicas 0/1 ou reiniciando

**Diagnóstico:**
```bash
npm run docker:check
npm run docker:logs
```

**Soluções comuns:**
- Verificar se volumes existem
- Verificar se rede `network_public` existe
- Verificar variáveis de ambiente
- Verificar logs de erro

### Health check falhando

**Sintoma:** Status "unhealthy"

**Diagnóstico:**
```bash
# Ver logs do health check
docker service logs wuzapi-manager_wuzapi-manager | grep -i health

# Executar health check manualmente
docker exec -it $(docker ps -q -f name=wuzapi-manager) node server/healthcheck.js
```

**Solução:**
- Aumentar `start_period` no healthcheck
- Verificar se porta 3001 está respondendo
- Verificar logs de inicialização

---

## 📚 Referências

- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Guia completo de troubleshooting
- [DEPLOY.md](DEPLOY.md) - Guia geral de deploy
- [DOCKER_QUICK_START.md](../DOCKER_QUICK_START.md) - Quick start Docker
- [docker-compose-swarm.yaml](../docker-compose-swarm.yaml) - Configuração do Swarm

---

## 🔐 Segurança

**Importante:** Os scripts não expõem informações sensíveis, mas tome cuidado ao compartilhar logs:

```bash
# Remover informações sensíveis dos logs antes de compartilhar
docker service logs wuzapi-manager_wuzapi-manager | grep -v "TOKEN" | grep -v "SECRET"
```

---

## 💡 Dicas

1. **Sempre use `./deploy.sh`** ao invés de `docker stack deploy` direto
2. **Execute `npm run docker:check`** após cada deploy para validar
3. **Monitore logs** durante o primeiro minuto após deploy
4. **Documente mudanças** em variáveis de ambiente
5. **Faça backup** do banco de dados antes de atualizações importantes

---

**Última atualização:** Dezembro 2025  
**Versão:** 1.5.46
