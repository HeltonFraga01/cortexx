# 🚀 Docker Swarm Cheat Sheet - WUZAPI Manager

Referência rápida de comandos para gerenciar o WUZAPI Manager no Docker Swarm.

---

## 📦 Deploy

```bash
# Deploy completo (recomendado - inclui fix do Traefik)
./deploy.sh
npm run deploy:production

# Deploy manual (sem fix automático)
docker stack deploy -c docker-compose-swarm.yaml wuzapi-manager

# Build e deploy
npm run deploy:official  # Build imagem
./deploy.sh              # Deploy
```

---

## 🔍 Status e Diagnóstico

```bash
# Diagnóstico completo (recomendado)
npm run docker:check
./scripts/check-deployment.sh

# Status do serviço
npm run docker:status
docker service ps wuzapi-manager_wuzapi-manager

# Status detalhado
docker service ps wuzapi-manager_wuzapi-manager --no-trunc

# Listar todos os serviços
docker service ls

# Inspecionar serviço
docker service inspect wuzapi-manager_wuzapi-manager

# Ver replicas
docker service ls --filter "name=wuzapi-manager"
```

---

## 📋 Logs

```bash
# Logs em tempo real
npm run docker:logs
docker service logs -f wuzapi-manager_wuzapi-manager

# Últimas 100 linhas
docker service logs --tail 100 wuzapi-manager_wuzapi-manager

# Logs com timestamp
docker service logs --timestamps wuzapi-manager_wuzapi-manager

# Logs desde um tempo específico
docker service logs --since 5m wuzapi-manager_wuzapi-manager
docker service logs --since 2024-12-13T10:00:00 wuzapi-manager_wuzapi-manager

# Filtrar logs por erro
docker service logs wuzapi-manager_wuzapi-manager | grep -i error
docker service logs wuzapi-manager_wuzapi-manager | grep -i "health"
```

---

## 🔄 Atualização

```bash
# Forçar atualização (fix do Traefik 404)
docker service update --force wuzapi-manager_wuzapi-manager

# Atualizar imagem
docker service update --image heltonfraga/wuzapi-manager:v1.5.46 wuzapi-manager_wuzapi-manager

# Atualizar variável de ambiente
docker service update --env-add "NEW_VAR=value" wuzapi-manager_wuzapi-manager
docker service update --env-rm "OLD_VAR" wuzapi-manager_wuzapi-manager

# Atualizar múltiplas variáveis
docker service update \
  --env-add "VAR1=value1" \
  --env-add "VAR2=value2" \
  wuzapi-manager_wuzapi-manager

# Rollback para versão anterior
docker service rollback wuzapi-manager_wuzapi-manager
```

---

## 🔧 Configuração

```bash
# Ver labels do Traefik
docker service inspect wuzapi-manager_wuzapi-manager \
  --format '{{json .Spec.Labels}}' | jq

# Ver variáveis de ambiente
docker service inspect wuzapi-manager_wuzapi-manager \
  --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | jq

# Ver redes
docker service inspect wuzapi-manager_wuzapi-manager \
  --format '{{json .Spec.TaskTemplate.Networks}}'

# Ver porta configurada
docker service inspect wuzapi-manager_wuzapi-manager \
  --format '{{range $key, $value := .Spec.Labels}}{{if eq $key "traefik.http.services.wuzapi-manager.loadbalancer.server.port"}}{{$value}}{{end}}{{end}}'

# Ver host configurado
docker service inspect wuzapi-manager_wuzapi-manager \
  --format '{{range $key, $value := .Spec.Labels}}{{if eq $key "traefik.http.routers.wuzapi-manager.rule"}}{{$value}}{{end}}{{end}}'
```

---

## 🐳 Contêiner

```bash
# Listar contêineres do serviço
docker ps -f "name=wuzapi-manager"

# Entrar no contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) sh

# Executar comando no contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) node server/healthcheck.js
docker exec -it $(docker ps -q -f name=wuzapi-manager) env | grep WUZAPI

# Ver processos no contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) ps aux

# Ver portas no contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) netstat -tulpn

# Health check manual
docker inspect $(docker ps -q -f name=wuzapi-manager) \
  --format '{{.State.Health.Status}}'
```

---

## 🗄️ Volumes

```bash
# Listar volumes
docker volume ls | grep cloudapi

# Inspecionar volume
docker volume inspect cloudapi-data
docker volume inspect cloudapi-logs

# Ver tamanho dos volumes
docker system df -v | grep cloudapi

# Backup do banco de dados
docker cp $(docker ps -q -f name=wuzapi-manager):/app/data/cloudapi.db ./backup-$(date +%Y%m%d).db

# Restaurar banco de dados
docker cp ./backup.db $(docker ps -q -f name=wuzapi-manager):/app/data/cloudapi.db
docker service update --force wuzapi-manager_wuzapi-manager
```

---

## 🌐 Rede

```bash
# Listar redes
docker network ls | grep network_public

# Inspecionar rede
docker network inspect network_public

# Ver serviços na rede
docker network inspect network_public \
  --format '{{range .Containers}}{{.Name}} {{end}}'

# Verificar rede do serviço
docker service inspect wuzapi-manager_wuzapi-manager \
  --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}} {{end}}'

# Testar conectividade
docker exec -it $(docker ps -q -f name=wuzapi-manager) ping -c 3 traefik
docker exec -it $(docker ps -q -f name=wuzapi-manager) nslookup cloudapi.wasend.com.br
```

---

## 🧹 Limpeza

```bash
# Remover stack completa
npm run docker:remove
docker stack rm wuzapi-manager

# Remover apenas o serviço
docker service rm wuzapi-manager_wuzapi-manager

# Limpar imagens antigas
docker image prune -a --filter "until=24h"

# Limpar volumes não utilizados (CUIDADO!)
docker volume prune

# Limpar tudo não utilizado
docker system prune -a --volumes
```

---

## 🔐 Segurança

```bash
# Ver secrets (se configurados)
docker secret ls

# Ver configs (se configurados)
docker config ls

# Scan de vulnerabilidades na imagem
docker scan heltonfraga/wuzapi-manager:v1.5.46

# Ver usuário do contêiner
docker exec -it $(docker ps -q -f name=wuzapi-manager) whoami
docker exec -it $(docker ps -q -f name=wuzapi-manager) id
```

---

## 📊 Monitoramento

```bash
# Uso de recursos em tempo real
docker stats $(docker ps -q -f name=wuzapi-manager)

# Uso de recursos (snapshot)
docker stats --no-stream $(docker ps -q -f name=wuzapi-manager)

# Eventos do Swarm
docker events --filter "service=wuzapi-manager_wuzapi-manager"

# Tasks do serviço (incluindo falhas)
docker service ps wuzapi-manager_wuzapi-manager --no-trunc

# Histórico de tasks
docker service ps wuzapi-manager_wuzapi-manager --filter "desired-state=shutdown"
```

---

## 🧪 Testes

```bash
# Testar health check
curl -I http://localhost:3004/health
curl -I https://cloudapi.wasend.com.br/health

# Testar API
curl -X GET https://cloudapi.wasend.com.br/api/health \
  -H "Content-Type: application/json"

# Testar com verbose
curl -v https://cloudapi.wasend.com.br/health

# Testar DNS
nslookup cloudapi.wasend.com.br
dig cloudapi.wasend.com.br

# Testar porta
telnet cloudapi.wasend.com.br 443
nc -zv cloudapi.wasend.com.br 443
```

---

## 🚨 Troubleshooting

```bash
# Fix rápido para erro 404 do Traefik
docker service update --force wuzapi-manager_wuzapi-manager

# Ver erros recentes
docker service logs wuzapi-manager_wuzapi-manager --tail 50 | grep -i error

# Ver tasks com erro
docker service ps wuzapi-manager_wuzapi-manager --filter "desired-state=shutdown"

# Ver último erro de task
docker service ps wuzapi-manager_wuzapi-manager --no-trunc | grep -i error

# Reiniciar serviço
docker service update --force wuzapi-manager_wuzapi-manager

# Redeploy completo
docker stack rm wuzapi-manager
sleep 30
./deploy.sh
```

---

## 📈 Escala (Arquitetura Single-Instance)

```bash
# Ver replicas atuais
docker service ls --filter "name=wuzapi-manager"

# Escalar (NÃO RECOMENDADO - arquitetura single-instance)
# docker service scale wuzapi-manager_wuzapi-manager=2

# Manter sempre em 1 replica
docker service scale wuzapi-manager_wuzapi-manager=1
```

---

## 🔄 Stack Management

```bash
# Listar stacks
docker stack ls

# Listar serviços da stack
docker stack services wuzapi-manager

# Listar tasks da stack
docker stack ps wuzapi-manager

# Remover stack
docker stack rm wuzapi-manager
```

---

## 💡 Aliases Úteis

Adicione ao seu `~/.bashrc` ou `~/.zshrc`:

```bash
# WUZAPI Manager aliases
alias wuzapi-deploy='./deploy.sh'
alias wuzapi-check='npm run docker:check'
alias wuzapi-logs='docker service logs -f wuzapi-manager_wuzapi-manager'
alias wuzapi-status='docker service ps wuzapi-manager_wuzapi-manager'
alias wuzapi-fix='docker service update --force wuzapi-manager_wuzapi-manager'
alias wuzapi-shell='docker exec -it $(docker ps -q -f name=wuzapi-manager) sh'
alias wuzapi-health='curl -I https://cloudapi.wasend.com.br/health'
alias wuzapi-stats='docker stats $(docker ps -q -f name=wuzapi-manager)'
```

---

## 📚 Referências Rápidas

| Comando | Descrição |
|---------|-----------|
| `./deploy.sh` | Deploy com fix do Traefik |
| `npm run docker:check` | Diagnóstico completo |
| `npm run docker:logs` | Logs em tempo real |
| `docker service update --force` | Fix erro 404 |
| `docker service ps` | Status do serviço |
| `docker service logs` | Ver logs |
| `docker exec -it` | Entrar no contêiner |
| `docker service inspect` | Ver configuração |
| `docker stack rm` | Remover stack |

---

## 🎯 Comandos Mais Usados

```bash
# Top 5 comandos do dia a dia
./deploy.sh                                    # 1. Deploy
npm run docker:check                           # 2. Verificar status
npm run docker:logs                            # 3. Ver logs
docker service update --force wuzapi-manager   # 4. Fix Traefik
docker service ps wuzapi-manager               # 5. Status rápido
```

---

## 📖 Documentação Completa

- [DEPLOYMENT_SCRIPTS.md](DEPLOYMENT_SCRIPTS.md) - Scripts de deploy
- [TRAEFIK_404_FIX.md](TRAEFIK_404_FIX.md) - Fix erro 404
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Troubleshooting completo
- [DOCKER_QUICK_START.md](../DOCKER_QUICK_START.md) - Quick start

---

**Última atualização:** Dezembro 2025  
**Versão:** 1.5.46
