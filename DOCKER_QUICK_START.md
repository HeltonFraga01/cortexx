# 🐳 Docker Quick Start

Guia rápido para executar o WUZAPI Manager com Docker.

## Pré-requisitos

- Docker 20.10+
- Docker Compose 2.0+

## Início Rápido

### 1. Configurar Variáveis de Ambiente

```bash
# Copiar arquivos de exemplo
cp .env.docker.example .env.docker

# Editar com suas configurações
nano .env.docker
```

### 2. Executar com Docker Compose

```bash
# Desenvolvimento local
docker-compose -f docker-compose.local.yml up -d

# Produção
docker-compose up -d
```

### 3. Verificar Status

```bash
# Ver logs
docker-compose logs -f

# Health check
curl http://localhost:3000/health
```

## Serviços Incluídos

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| `wuzapi-manager` | 3000 | Aplicação principal |
| `redis` | 6379 | Cache (opcional) |

## Redis Cache

O Redis é usado para cache de endpoints frequentes, melhorando a performance.

### Configuração

```env
# .env.docker
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_segura
REDIS_ENABLED=true
REDIS_CACHE_TTL=300
```

### Endpoints com Cache

| Endpoint | TTL | Descrição |
|----------|-----|-----------|
| `/api/admin/plans` | 5 min | Lista de planos |
| `/api/public/tenant-info` | 10 min | Info do tenant |
| `/api/branding/public` | 5 min | Configuração de branding |

### Fallback Gracioso

Se o Redis não estiver disponível, a aplicação continua funcionando normalmente, apenas sem cache.

## Comandos Úteis

```bash
# Parar serviços
docker-compose down

# Rebuild
docker-compose build --no-cache

# Ver logs do Redis
docker-compose logs redis

# Acessar Redis CLI
docker-compose exec redis redis-cli
```

## Health Check

O endpoint `/health` retorna o status de todos os serviços:

```json
{
  "status": "healthy",
  "timestamp": "2025-12-25T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": {
      "status": "connected",
      "host": "redis:6379"
    }
  }
}
```

## Troubleshooting

### Redis não conecta

1. Verificar se o serviço está rodando: `docker-compose ps`
2. Verificar logs: `docker-compose logs redis`
3. Testar conexão: `docker-compose exec redis redis-cli ping`

### Aplicação não inicia

1. Verificar variáveis de ambiente: `docker-compose config`
2. Verificar logs: `docker-compose logs wuzapi-manager`
3. Verificar health: `curl http://localhost:3000/health`
