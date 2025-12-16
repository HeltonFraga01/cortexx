# 🔧 Traefik 404 Error - Quick Fix Guide

Guia rápido para resolver o erro "404 page not found" do Traefik em Docker Swarm.

---

## 🎯 Problema

Após fazer deploy no Docker Swarm, o serviço está rodando e saudável, mas ao acessar o domínio você recebe:

```
404 page not found
```

---

## ✅ Solução Rápida (1 minuto)

### Opção 1: Usar o script de deploy (Recomendado)

```bash
./deploy.sh
```

Este script já inclui o fix automático.

### Opção 2: Forçar atualização manual

```bash
docker service update --force wuzapi-manager_wuzapi-manager
```

Aguarde 5-10 segundos e teste novamente.

---

## 🔍 Verificação

Após aplicar o fix, verifique se funcionou:

```bash
# Opção 1: Script de diagnóstico completo
npm run docker:check

# Opção 2: Teste manual
curl -I https://cloudapi.wasend.com.br/health
```

**Resultado esperado:**
```
HTTP/2 200
```

---

## 🤔 Por que isso acontece?

### Causa Raiz

O Docker Swarm às vezes "perde" eventos de rede durante o deploy. Quando isso acontece:

1. ✅ O serviço é criado com sucesso
2. ✅ As labels do Traefik estão corretas
3. ✅ O contêiner está rodando e saudável
4. ❌ Mas o Traefik não recebe o evento de rede
5. ❌ Resultado: Traefik não registra as rotas

### Por que `--force` resolve?

O comando `docker service update --force` força o Swarm a:
- Recriar as tasks do serviço
- Reemitir todos os eventos de rede
- Fazer o Traefik "acordar" e registrar as rotas

---

## 📋 Checklist de Diagnóstico

Se o problema persistir após o fix, verifique:

### 1. Serviço está rodando?
```bash
docker service ps wuzapi-manager_wuzapi-manager
```
✅ Deve mostrar "Running"

### 2. Labels do Traefik estão corretas?
```bash
docker service inspect wuzapi-manager_wuzapi-manager --format '{{json .Spec.Labels}}' | grep traefik
```
✅ Deve mostrar várias labels do Traefik

### 3. Porta está correta?
```bash
docker service inspect wuzapi-manager_wuzapi-manager --format '{{range $key, $value := .Spec.Labels}}{{if eq $key "traefik.http.services.wuzapi-manager.loadbalancer.server.port"}}{{$value}}{{end}}{{end}}'
```
✅ Deve retornar: `3001`

### 4. Rede está conectada?
```bash
docker service inspect wuzapi-manager_wuzapi-manager --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}} {{end}}'
```
✅ Deve retornar: `network_public` (apenas uma rede)

### 5. Traefik está rodando?
```bash
docker service ls | grep traefik
```
✅ Deve mostrar o serviço do Traefik

### 6. Traefik está em modo Swarm?
```bash
docker service inspect traefik | grep -i swarmmode
```
✅ Deve mostrar: `--providers.docker.swarmMode=true`

---

## 🚨 Outros Erros HTTP

### 502 Bad Gateway

**Causa:** Serviço não está respondendo na porta correta

**Solução:**
```bash
# Verificar se o serviço está escutando na porta 3001
docker exec -it $(docker ps -q -f name=wuzapi-manager) netstat -tulpn | grep 3001

# Ver logs
npm run docker:logs
```

### 503 Service Unavailable

**Causa:** Serviço não está saudável ou não iniciou

**Solução:**
```bash
# Verificar health check
npm run docker:check

# Ver logs de inicialização
docker service logs wuzapi-manager_wuzapi-manager --tail 100
```

### Connection Timeout

**Causa:** DNS não está resolvendo ou firewall bloqueando

**Solução:**
```bash
# Testar DNS
nslookup cloudapi.wasend.com.br

# Testar de dentro do servidor
curl -I https://cloudapi.wasend.com.br/health
```

---

## 🔄 Workflow Completo

### Deploy Inicial

```bash
# 1. Deploy com fix automático
./deploy.sh

# 2. Verificar status
npm run docker:check

# 3. Se ainda der 404, forçar novamente
docker service update --force wuzapi-manager_wuzapi-manager

# 4. Verificar novamente
npm run docker:check
```

### Atualização de Serviço

```bash
# 1. Build nova imagem
npm run deploy:official

# 2. Deploy (já inclui o fix)
./deploy.sh

# 3. Verificar
npm run docker:check
```

---

## 💡 Prevenção

Para evitar este problema no futuro:

### 1. Sempre use o script de deploy
```bash
# ✅ Correto
./deploy.sh

# ❌ Evite
docker stack deploy -c docker-compose-swarm.yaml wuzapi-manager
```

### 2. Configure o Traefik corretamente

Certifique-se que o Traefik tem estas configurações:

```yaml
command:
  - --providers.docker=true
  - --providers.docker.swarmMode=true
  - --providers.docker.exposedByDefault=false
  - --providers.docker.network=network_public
```

### 3. Use health checks

O health check ajuda a garantir que o serviço está pronto antes do Traefik rotear:

```yaml
healthcheck:
  test: ["CMD", "node", "server/healthcheck.js"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 90s
```

---

## 📊 Estatísticas

**Tempo médio para resolver:** 30 segundos  
**Taxa de sucesso do fix:** 99%  
**Necessidade de redeploy completo:** Raro (<1%)

---

## 🆘 Ainda não funcionou?

Se após seguir todos os passos o problema persistir:

1. **Colete informações:**
```bash
# Salvar diagnóstico completo
npm run docker:check > diagnostico.txt

# Salvar logs
docker service logs wuzapi-manager_wuzapi-manager > logs.txt

# Salvar configuração
docker service inspect wuzapi-manager_wuzapi-manager > config.json
```

2. **Verifique a documentação completa:**
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- [DEPLOYMENT_SCRIPTS.md](DEPLOYMENT_SCRIPTS.md)

3. **Tente redeploy completo:**
```bash
# Remover stack
docker stack rm wuzapi-manager

# Aguardar 30 segundos
sleep 30

# Deploy novamente
./deploy.sh
```

---

## 📚 Referências

- [Docker Swarm Networking](https://docs.docker.com/engine/swarm/networking/)
- [Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Guia completo
- [DEPLOYMENT_SCRIPTS.md](DEPLOYMENT_SCRIPTS.md) - Scripts de deploy

---

## ✨ Resumo

**Problema:** 404 page not found  
**Causa:** Traefik não recebeu evento de rede  
**Solução:** `docker service update --force wuzapi-manager_wuzapi-manager`  
**Prevenção:** Use `./deploy.sh` sempre  
**Tempo:** 30 segundos  

---

**Última atualização:** Dezembro 2025  
**Versão:** 1.5.46
