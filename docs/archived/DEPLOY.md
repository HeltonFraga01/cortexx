# Deploy Automatizado - WUZAPI Manager

Este documento descreve o sistema de deploy automatizado do WUZAPI Manager, incluindo configuração, execução e troubleshooting.

## ⚠️ IMPORTANTE: Autenticação Docker

**ANTES DE FAZER DEPLOY**, certifique-se de que a autenticação está configurada corretamente:

### Variáveis Obrigatórias

O Docker requer **TODAS** estas variáveis em `.env.docker`:

```bash
# Obrigatórias
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
CORS_ORIGINS=http://seu-dominio.com
SESSION_SECRET=<gerar com: openssl rand -base64 32>
WUZAPI_ADMIN_TOKEN=<seu token admin>

# Recomendadas
SQLITE_DB_PATH=/app/data/wuzapi.db
SQLITE_WAL_MODE=true
LOG_LEVEL=info
```

### Validação Automática

O servidor **não iniciará** se alguma variável obrigatória estiver faltando. Você verá:

```
❌ Validação de ambiente falhou
💡 Dica: Verifique se todas as variáveis estão configuradas em .env.docker
```

### Documentação Adicional

- **Diferenças Dev vs Docker:** `docs/DEVELOPMENT_VS_DOCKER.md`
- **Troubleshooting:** `docs/DOCKER_AUTHENTICATION_TROUBLESHOOTING.md`
- **Resumo da Correção:** `docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md`

---

## 🚀 Visão Geral

O sistema de deploy automatizado inclui:

- **Scripts automatizados** para deploy, rollback e verificações
- **Validações pré-deploy** com testes e verificações de segurança
- **Validação de ambiente** no startup (falha rápido se configuração inválida)
- **Rollback automático** em caso de falha
- **Verificações pós-deploy** abrangentes
- **Integração CI/CD** com GitHub Actions
- **Monitoramento** e alertas integrados

## 📋 Pré-requisitos

### Software Necessário

- Docker 20.10+
- Docker Compose 2.0+
- jq (para parsing JSON)
- curl (para verificações HTTP)
- Git (para versionamento)

### Recursos Mínimos

- **Development**: 1 CPU, 512MB RAM, 2GB disco
- **Staging**: 1 CPU, 1GB RAM, 5GB disco  
- **Production**: 2 CPU, 2GB RAM, 10GB disco

## 🛠️ Configuração Inicial

### 1. Configurar Ambiente

```bash
# Configurar ambiente de deploy
./scripts/setup-deploy.sh production

# Para staging
./scripts/setup-deploy.sh staging

# Para development
./scripts/setup-deploy.sh development
```

### 2. Configurar Variáveis de Ambiente

Edite o arquivo de configuração do ambiente:

```bash
vi deploy/secrets/.env.production
```

Variáveis obrigatórias:
```bash
# Aplicação
NODE_ENV=production
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
CORS_ORIGINS=https://cloudapi.wasend.com.br

# Banco de dados
SQLITE_DB_PATH=/app/data/wuzapi.db

# Segurança (configure valores únicos)
ADMIN_TOKEN=seu-token-admin-seguro
JWT_SECRET=seu-jwt-secret-seguro
```

### 3. Configurar Docker Swarm (Produção)

```bash
# Inicializar Swarm
docker swarm init

# Criar network externa
docker network create --driver overlay network_public
```

## 🚢 Deploy Manual

### Deploy Básico

```bash
# Deploy em produção
./scripts/deploy.sh production v1.2.2

# Deploy com rollback automático
./scripts/deploy.sh production v1.2.2 --auto-rollback

# Deploy pulando testes (não recomendado)
./scripts/deploy.sh staging latest --skip-tests

# Simular deploy (dry run)
./scripts/deploy.sh development --dry-run
```

### Opções Disponíveis

- `--auto-rollback`: Rollback automático em caso de falha
- `--skip-tests`: Pular execução de testes
- `--force`: Forçar deploy mesmo com avisos
- `--dry-run`: Simular deploy sem executar

## 🔄 Rollback

### Rollback Manual

```bash
# Rollback para versão específica
./scripts/rollback.sh production v1.2.0

# Rollback interativo (lista versões disponíveis)
./scripts/rollback.sh production
```

### Rollback Automático

O rollback automático é executado quando:

- Health check falha após deploy
- Taxa de erro alta detectada
- Performance degradada
- Verificações pós-deploy falham

## ✅ Verificações Pós-Deploy

### Executar Verificações

```bash
# Verificações completas
./scripts/post-deploy-check.sh production

# Verificações para staging
./scripts/post-deploy-check.sh staging wuzapi.staging.com
```

### Tipos de Verificações

1. **Conectividade**
   - Health check endpoint
   - HTTPS (produção)
   - Redirecionamento HTTP→HTTPS
   - Tempo de resposta

2. **Serviços**
   - Status do Docker Swarm/Compose
   - Containers em execução
   - Ausência de falhas

3. **Aplicação**
   - API endpoints funcionais
   - Arquivos estáticos
   - Métricas disponíveis

4. **Banco de Dados**
   - Arquivo de banco existe
   - Banco acessível
   - Integridade dos dados
   - Espaço em disco

5. **Performance**
   - Tempo de resposta médio
   - Uso de memória
   - CPU utilização

6. **Segurança**
   - Headers de segurança
   - Certificado SSL válido
   - Informações sensíveis não expostas

7. **Logs**
   - Ausência de erros críticos
   - Logs sendo gerados
   - Conectividade com banco

8. **Monitoramento**
   - Métricas Prometheus
   - Health check detalhado

## 🤖 CI/CD com GitHub Actions

### Configuração

O workflow está em `.github/workflows/deploy.yml` e é acionado por:

- **Push para `main`**: Deploy em produção
- **Push para `develop`**: Deploy em staging
- **Tags `v*`**: Deploy em produção com release
- **Workflow manual**: Deploy customizado

### Secrets Necessários

Configure no GitHub:

```bash
# Docker Registry
DOCKER_USERNAME=seu-usuario-docker
DOCKER_PASSWORD=sua-senha-docker

# Deploy remoto (se necessário)
DOCKER_HOST=tcp://servidor:2376
DOCKER_CERT_PATH=/path/to/certs
DOCKER_TLS_VERIFY=1

# Notificações
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### Workflow Manual

```bash
# Via GitHub UI
Actions → Deploy WUZAPI Manager → Run workflow

# Via CLI (gh)
gh workflow run deploy.yml -f environment=production -f version=v1.2.2
```

## 📊 Monitoramento

### Métricas de Deploy

- **Duração do deploy**
- **Taxa de sucesso**
- **Frequência de rollback**
- **Tempo de verificação**

### Alertas Configurados

- Deploy falhou
- Rollback executado
- Health check falhou
- Performance degradada

### Dashboards

- **Grafana**: Métricas de aplicação e infraestrutura
- **Prometheus**: Coleta de métricas
- **Logs**: Agregação e análise

## 🔧 Troubleshooting

### Problemas Comuns

#### Deploy Falha

```bash
# Verificar logs do deploy
tail -f logs/deploy/deploy-$(date +%Y%m%d).log

# Verificar status dos serviços
docker service ls
docker service logs wuzapi_wuzapi-manager

# Verificar configuração
docker stack config -c docker-swarm-stack.yml
```

#### Health Check Falha

```bash
# Testar health check manualmente
curl -v http://cloudapi.wasend.com.br/health

# Verificar logs da aplicação
docker service logs wuzapi_wuzapi-manager --tail 100

# Executar health check interno
docker exec <container-id> node server/healthcheck.js
```

#### Rollback Necessário

```bash
# Listar versões disponíveis
docker service inspect wuzapi_wuzapi-manager --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'

# Executar rollback
./scripts/rollback.sh production v1.2.0

# Verificar rollback
./scripts/post-deploy-check.sh production
```

#### Banco de Dados Corrompido

```bash
# Verificar integridade
docker exec <container-id> sqlite3 /app/data/wuzapi.db "PRAGMA integrity_check;"

# Restaurar backup
ls -la backups/
./scripts/rollback.sh production v1.2.0
# Seguir prompts para restaurar backup do banco
```

### Logs Importantes

```bash
# Logs de deploy
tail -f logs/deploy/deploy-*.log

# Logs da aplicação
docker service logs wuzapi_wuzapi-manager -f

# Logs do sistema
journalctl -u docker -f

# Logs do Traefik
docker service logs traefik_traefik -f
```

### Comandos de Diagnóstico

```bash
# Status geral
docker system df
docker system events --since 1h

# Recursos utilizados
docker stats

# Network connectivity
docker network ls
docker network inspect network_public

# Volumes
docker volume ls
docker volume inspect wuzapi-manager-logs
```

## 📈 Otimizações

### Performance de Deploy

- **Build cache**: Usar cache do Docker para builds mais rápidos
- **Parallel jobs**: Executar testes e build em paralelo
- **Image layers**: Otimizar layers do Dockerfile
- **Registry proximity**: Usar registry próximo ao ambiente

### Segurança

- **Secrets management**: Usar Docker secrets ou external vault
- **Image scanning**: Verificar vulnerabilidades antes do deploy
- **Network isolation**: Isolar serviços em networks dedicadas
- **Resource limits**: Configurar limits para prevenir DoS

### Monitoramento

- **Structured logging**: Logs em formato JSON
- **Distributed tracing**: Rastreamento de requests
- **Custom metrics**: Métricas específicas da aplicação
- **Alerting rules**: Regras de alerta personalizadas

## 🔐 Segurança

### Boas Práticas Implementadas

- **Non-root containers**: Containers executam como usuário não-root
- **Secrets encryption**: Secrets criptografados em repouso
- **Network segmentation**: Isolamento de rede entre serviços
- **Image scanning**: Verificação de vulnerabilidades
- **Access control**: Controle de acesso baseado em roles

### Configurações de Segurança

```yaml
# Headers de segurança (Traefik)
- "traefik.http.middlewares.security-headers.headers.customrequestheaders.X-Frame-Options=DENY"
- "traefik.http.middlewares.security-headers.headers.customrequestheaders.X-Content-Type-Options=nosniff"

# Resource limits
resources:
  limits:
    cpus: '1.0'
    memory: 512M
```

## 📚 Referências

### Arquivos de Configuração

- `deploy/config.yml`: Configuração principal
- `docker-swarm-stack.yml`: Configuração de produção
- `docker-compose.yml`: Configuração de desenvolvimento
- `.github/workflows/deploy.yml`: Pipeline CI/CD

### Scripts

- `scripts/deploy.sh`: Deploy principal
- `scripts/rollback.sh`: Rollback
- `scripts/post-deploy-check.sh`: Verificações
- `scripts/setup-deploy.sh`: Configuração inicial

### Documentação Adicional

- [Docker Documentation](docs/DOCKER.md)
- [Architecture Overview](README-ARCHITECTURE.md)
- [API Documentation](docs/API.md)

---

Para suporte adicional, consulte os logs de deploy ou abra uma issue no repositório.

---


## 🐳 Docker Local Testing (Novo)

### Scripts de Teste Local

Para testar o Docker localmente antes do deploy:

#### 1. Build Local
```bash
./scripts/docker-build-local.sh [tag]
```

**O que faz:**
- Valida ambiente (`.env.docker` existe e tem variáveis obrigatórias)
- Build da imagem Docker
- Verifica se imagem foi criada
- Gera `build-info.txt` com detalhes

#### 2. Run Local
```bash
./scripts/docker-run-local.sh [tag]
```

**O que faz:**
- Para container existente (se houver)
- Inicia novo container com `.env.docker`
- Aguarda health check (até 90s)
- Verifica endpoint `/health`
- Mostra logs iniciais e comandos úteis

#### 3. Docker Compose Local
```bash
docker-compose -f docker-compose.local.yml up -d
```

**O que faz:**
- Inicia stack completa (backend + volumes)
- Usa `.env.docker` para variáveis
- Health check automático
- Rede isolada para testes

#### 4. Verificar Deployment
```bash
./scripts/verify-docker-deployment.sh [host]
```

**O que faz:**
- Testa health endpoint
- Testa autenticação (admin)
- Verifica database
- Verifica WUZAPI connectivity
- Valida configuração

### Fluxo de Teste Recomendado

```bash
# 1. Configurar variáveis
cp .env.docker.example .env.docker
# Editar .env.docker com valores corretos

# 2. Build
./scripts/docker-build-local.sh

# 3. Run
./scripts/docker-run-local.sh

# 4. Verificar
./scripts/verify-docker-deployment.sh

# 5. Testar autenticação
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "SEU_ADMIN_TOKEN", "role": "admin"}'

# 6. Se tudo OK, fazer deploy
./scripts/deploy.sh production
```

---

## 🔧 Troubleshooting Docker

### Problema: Autenticação Falha

**Sintoma:**
```json
{"error": "Invalid credentials"}
```

**Solução:**
```bash
# Verificar se WUZAPI_ADMIN_TOKEN está definido
docker exec wuzapi-manager-local env | grep WUZAPI_ADMIN_TOKEN

# Adicionar ao .env.docker se faltando
echo "WUZAPI_ADMIN_TOKEN=seu_token_aqui" >> .env.docker

# Reiniciar
docker-compose -f docker-compose.local.yml restart
```

### Problema: Validação de Ambiente Falha

**Sintoma:**
```
❌ Validação de ambiente falhou
Missing required environment variable: SESSION_SECRET
```

**Solução:**
```bash
# Gerar SESSION_SECRET
openssl rand -base64 32

# Adicionar ao .env.docker
echo "SESSION_SECRET=<valor_gerado>" >> .env.docker

# Reiniciar
docker-compose -f docker-compose.local.yml restart
```

### Problema: Database Não Conecta

**Sintoma:**
```json
{"database": {"status": "error"}}
```

**Solução:**
```bash
# Verificar volume
docker inspect wuzapi-manager-local | grep -A10 Mounts

# Verificar permissões
docker exec wuzapi-manager-local ls -lh /app/data/

# Corrigir permissões
docker exec wuzapi-manager-local chown -R nodejs:nodejs /app/data
```

### Mais Troubleshooting

Ver documentação completa: `docs/DOCKER_AUTHENTICATION_TROUBLESHOOTING.md`

---

## 📚 Documentação Adicional

### Autenticação Docker
- `docs/DEVELOPMENT_VS_DOCKER.md` - Diferenças entre desenvolvimento e Docker
- `docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md` - Resumo da correção de autenticação
- `docs/DOCKER_AUTHENTICATION_TROUBLESHOOTING.md` - Guia completo de troubleshooting

### Scripts
- `scripts/docker-build-local.sh` - Build para testes locais
- `scripts/docker-run-local.sh` - Execução local com validação
- `scripts/docker-build-production.sh` - Build multi-arch para produção
- `scripts/verify-docker-deployment.sh` - Verificação de deployment

### Configuração
- `.env.docker` - Variáveis de ambiente para Docker
- `docker-compose.local.yml` - Compose para testes locais
- `docker-compose.swarm.yml` - Compose para Docker Swarm

---

## ✅ Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Todas as variáveis em `.env.docker` configuradas
- [ ] `SESSION_SECRET` gerado com `openssl rand -base64 32`
- [ ] `WUZAPI_ADMIN_TOKEN` configurado corretamente
- [ ] `CORS_ORIGINS` inclui domínio de produção
- [ ] Testado localmente com `docker-compose.local.yml`
- [ ] Health check passa: `./scripts/verify-docker-deployment.sh`
- [ ] Autenticação testada com tokens reais
- [ ] Database persiste após restart
- [ ] Logs não mostram erros de configuração
- [ ] Backup do banco de dados atual (se houver)

---

**Última atualização:** 16 de Novembro de 2025  
**Correção de autenticação Docker:** Implementada e testada
