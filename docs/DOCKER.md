# Docker - WUZAPI Manager

Este documento descreve como usar Docker com o WUZAPI Manager, incluindo desenvolvimento local e deploy em produção.

## 🐳 Visão Geral

O WUZAPI Manager utiliza uma arquitetura Docker otimizada com:

- **Multi-stage build** para imagens menores e builds mais rápidos
- **Health checks robustos** com verificações múltiplas
- **Traefik** como reverse proxy e load balancer
- **Supabase** como banco de dados (PostgreSQL hospedado)
- **Monitoramento** com Prometheus e Grafana (opcional)

## 📋 Pré-requisitos

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM disponível
- 5GB espaço em disco

## 🚀 Desenvolvimento Local

### Usando Docker Compose

```bash
# Clonar repositório
git clone <repository-url>
cd wuzapi-manager

# Iniciar todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps

# Ver logs
docker-compose logs -f wuzapi-manager-dev
```

### Acessar Aplicação

- **WUZAPI Manager**: http://wuzapi.localhost
- **Traefik Dashboard**: http://traefik.localhost:8080
- **Prometheus** (opcional): http://prometheus.localhost
- **Grafana** (opcional): http://grafana.localhost

### Configurar DNS Local

Adicione ao seu `/etc/hosts` (Linux/Mac) ou `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1 wuzapi.localhost
127.0.0.1 traefik.localhost
127.0.0.1 prometheus.localhost
127.0.0.1 grafana.localhost
```

## 🏗️ Build da Imagem

### Build Manual

```bash
# Build básico
docker build -t wuzapi-manager .

# Build com tag específica
docker build -t heltonfraga/wuzapi-manager:v1.2.2 .

# Build com cache otimizado
export DOCKER_BUILDKIT=1
docker build --cache-from heltonfraga/wuzapi-manager:latest -t wuzapi-manager .
```

### Build Automatizado

```bash
# Usar script otimizado
./scripts/docker-build.sh

# Build e push para registry
./scripts/docker-build.sh v1.2.2 --push

# Build com tag latest
./scripts/docker-build.sh --push
```

## 🚢 Deploy em Produção

### Docker Swarm

```bash
# Inicializar Swarm (se necessário)
docker swarm init

# Criar network externa
docker network create --driver overlay network_public

# Deploy da stack
docker stack deploy -c docker-swarm-stack.yml wuzapi

# Verificar serviços
docker service ls
docker service logs wuzapi_wuzapi-manager
```

### Configurações de Produção

O arquivo `docker-swarm-stack.yml` inclui:

- **Traefik** com SSL automático (Let's Encrypt)
- **Health checks** robustos
- **Resource limits** otimizados
- **Restart policies** configuradas
- **Rolling updates** com rollback automático

## 📊 Monitoramento

### Ativar Monitoramento

```bash
# Iniciar com Prometheus e Grafana
docker-compose --profile monitoring up -d

# Verificar métricas
curl http://localhost:3001/metrics
```

### Dashboards Grafana

- **Login**: admin / admin123
- **Dashboards** pré-configurados para:
  - Métricas da aplicação
  - Métricas do Traefik
  - Métricas do sistema

## 🔧 Configurações Avançadas

### Variáveis de Ambiente

```bash
# Aplicação
NODE_ENV=production
PORT=3001
WUZAPI_BASE_URL=https://wzapi.wasend.com.br

# Supabase (PostgreSQL)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Node.js Otimizado
NODE_OPTIONS=--max-old-space-size=512
UV_THREADPOOL_SIZE=4
```

### Volumes Persistentes

```yaml
volumes:
  # Dados da aplicação
  - wuzapi-data:/app/data
  
  # Logs
  - wuzapi-logs:/app/logs
  
  # Certificados SSL (Traefik)
  - traefik-letsencrypt:/letsencrypt
```

### Resource Limits

```yaml
resources:
  limits:
    cpus: '1.0'
    memory: 512M
  reservations:
    cpus: '0.5'
    memory: 256M
```

## 🔍 Health Checks

### Health Check Customizado

O health check verifica:

- **HTTP Server** - Resposta da API `/health`
- **Database** - Conectividade com Supabase
- **Memory Usage** - Uso de memória dentro dos limites
- **Disk Space** - Acesso ao diretório de dados

### Executar Health Check Manual

```bash
# Dentro do container
docker exec <container-id> node server/healthcheck.js

# Verificar status
docker inspect <container-id> | grep Health -A 10
```

## 🛠️ Troubleshooting

### Problemas Comuns

#### Container não inicia

```bash
# Verificar logs
docker-compose logs wuzapi-manager-dev

# Verificar recursos
docker stats

# Verificar health check
docker inspect <container-id> | grep Health -A 10
```

#### Banco de dados não acessível

```bash
# Verificar variáveis de ambiente
docker exec -it <container-id> env | grep SUPABASE

# Verificar conectividade
docker exec -it <container-id> curl -s https://your-project.supabase.co/rest/v1/
```

#### Traefik não roteia

```bash
# Verificar labels
docker inspect <container-id> | grep -A 20 Labels

# Verificar network
docker network ls
docker network inspect wuzapi-network

# Verificar Traefik dashboard
curl http://traefik.localhost:8080/api/http/routers
```

### Comandos Úteis

```bash
# Limpar recursos Docker
docker system prune -a

# Verificar uso de espaço
docker system df

# Backup completo
docker run --rm -v wuzapi-data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/wuzapi-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restaurar backup
docker run --rm -v wuzapi-data:/data -v $(pwd)/backup:/backup alpine tar xzf /backup/wuzapi-backup-YYYYMMDD.tar.gz -C /data
```

## 📈 Otimizações

### Build Performance

- **Multi-stage build** reduz tamanho da imagem final
- **Cache layers** otimizado para dependências
- **BuildKit** para builds paralelos
- **.dockerignore** otimizado

### Runtime Performance

- **Alpine Linux** como base (imagem menor)
- **Non-root user** para segurança
- **Init system** (tini/dumb-init) para handling de sinais
- **Resource limits** configurados

### Monitoramento

- **Prometheus metrics** expostas em `/metrics`
- **Health checks** com múltiplas verificações
- **Structured logging** para análise
- **Grafana dashboards** pré-configurados

## 🔐 Segurança

### Boas Práticas Implementadas

- **Non-root user** (nodejs:1001)
- **Read-only filesystem** onde possível
- **Security headers** via Traefik
- **Resource limits** para prevenir DoS
- **Health checks** para detectar problemas

### Configurações SSL

```yaml
# Traefik SSL automático
- traefik.http.routers.wuzapi.tls.certresolver=leresolver
- traefik.http.routers.wuzapi.tls=true
```

## 📚 Referências

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/)

---

Para mais informações, consulte a [documentação principal](../README.md) ou abra uma issue no repositório.