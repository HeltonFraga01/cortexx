# Design: Performance & Security Fixes + Redis Cache

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Frontend  │───▶│   Backend   │───▶│      Supabase       │ │
│  │  (React)    │    │  (Express)  │    │    (PostgreSQL)     │ │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘ │
│                            │                                    │
│                            ▼                                    │
│                     ┌─────────────┐                            │
│                     │    Redis    │                            │
│                     │   (Cache)   │                            │
│                     └─────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Configuração Docker - Redis

### docker-compose.yml (adições)

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: wuzapi-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-defaultpass}
    volumes:
      - redis_data:/data
    networks:
      - wuzapi-network
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-defaultpass}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 256M

volumes:
  redis_data:
```

### Variáveis de Ambiente

```env
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0
REDIS_CACHE_TTL=300
```

## 2. Backend - Serviço de Cache Redis

### Estrutura de Arquivos

```
server/
├── services/
│   └── CacheService.js      # Abstração de cache Redis
├── middleware/
│   └── cacheMiddleware.js   # Middleware de cache para rotas
└── utils/
    └── redisClient.js       # Cliente Redis singleton
```

### redisClient.js

```javascript
const Redis = require('ioredis');
const { logger } = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  connect() {
    if (this.client) return this.client;

    const config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    this.client = new Redis(config);

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.error('Redis connection error', { error: err.message });
    });

    return this.client;
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.warn('Redis GET error', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    if (!this.isConnected) return false;
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.warn('Redis SET error', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.warn('Redis DEL error', { key, error: error.message });
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.isConnected) return false;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      logger.warn('Redis invalidatePattern error', { pattern, error: error.message });
      return false;
    }
  }
}

module.exports = new RedisClient();
```

### CacheService.js

```javascript
const redisClient = require('../utils/redisClient');
const { logger } = require('../utils/logger');

class CacheService {
  static CACHE_KEYS = {
    PLANS: (tenantId) => `plans:${tenantId}`,
    TENANT_INFO: (subdomain) => `tenant:${subdomain}`,
    BRANDING: (tenantId) => `branding:${tenantId}`,
  };

  static TTL = {
    PLANS: 300,        // 5 minutos
    TENANT_INFO: 600,  // 10 minutos
    BRANDING: 300,     // 5 minutos
  };

  static async getOrSet(key, ttl, fetchFn) {
    // Tentar buscar do cache
    const cached = await redisClient.get(key);
    if (cached) {
      logger.debug('Cache HIT', { key });
      return { data: cached, fromCache: true };
    }

    // Cache miss - buscar dados
    logger.debug('Cache MISS', { key });
    const data = await fetchFn();
    
    // Salvar no cache (fire and forget)
    redisClient.set(key, data, ttl);
    
    return { data, fromCache: false };
  }

  static async invalidate(key) {
    return redisClient.del(key);
  }

  static async invalidateTenantCache(tenantId) {
    await redisClient.invalidatePattern(`*:${tenantId}`);
  }
}

module.exports = CacheService;
```

### cacheMiddleware.js

```javascript
const CacheService = require('../services/CacheService');
const { logger } = require('../utils/logger');

function cacheMiddleware(keyGenerator, ttl = 300) {
  return async (req, res, next) => {
    const cacheKey = keyGenerator(req);
    
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
    } catch (error) {
      logger.warn('Cache middleware error', { error: error.message });
    }

    // Interceptar res.json para cachear resposta
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200 && data.success !== false) {
        redisClient.set(cacheKey, data, ttl);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

module.exports = { cacheMiddleware };
```

## 3. Frontend - Correção de Requisições Duplicadas

### queryClient.ts (atualizado)

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutos
      gcTime: 10 * 60 * 1000,        // 10 minutos (antigo cacheTime)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      retryDelay: 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Deduplicação global
queryClient.setDefaultOptions({
  queries: {
    structuralSharing: true,
  },
});
```

### Hooks com deduplicação

```typescript
// useAdminPlans.ts
export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: fetchPlans,
    staleTime: 5 * 60 * 1000,
    // Evita refetch quando já tem dados
    refetchOnMount: (query) => query.state.data === undefined,
  });
}
```

## 4. Correção do Badge Component

### badge.tsx (corrigido)

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div 
        ref={ref} 
        className={cn(badgeVariants({ variant }), className)} 
        {...props} 
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
```

## 5. Otimização do Critical Path

### Prefetch em AdminLayout.tsx

```typescript
import { useQueryClient } from '@tanstack/react-query';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Prefetch dados críticos
    queryClient.prefetchQuery({
      queryKey: ['admin', 'plans'],
      queryFn: fetchPlans,
    });
  }, [queryClient]);

  return (
    // ...
  );
}
```

### Lazy Loading de Componentes

```typescript
// App.tsx ou routes
const PlanForm = lazy(() => import('@/components/admin/PlanForm'));
const PlanList = lazy(() => import('@/components/admin/PlanList'));

// Uso com Suspense
<Suspense fallback={<LoadingSkeleton />}>
  <PlanForm />
</Suspense>
```

## 6. Invalidação de Cache

### Estratégia de Invalidação

| Evento | Cache a Invalidar |
|--------|-------------------|
| Criar/Editar/Deletar Plano | `plans:{tenantId}` |
| Atualizar Branding | `branding:{tenantId}` |
| Atualizar Tenant | `tenant:{subdomain}` |

### Exemplo de Invalidação

```javascript
// adminPlanRoutes.js
router.post('/', requireAdmin, async (req, res) => {
  try {
    const plan = await PlanService.create(req.body);
    
    // Invalidar cache
    const tenantId = req.context?.tenantId;
    if (tenantId) {
      await CacheService.invalidate(CacheService.CACHE_KEYS.PLANS(tenantId));
    }
    
    res.json({ success: true, data: plan });
  } catch (error) {
    // ...
  }
});
```

## 7. Health Check do Redis

### Adicionar ao /health endpoint

```javascript
// server/index.js - health check
let redisStatus = 'disabled';
try {
  const redisClient = require('./utils/redisClient');
  if (redisClient.isConnected) {
    const pong = await redisClient.client.ping();
    redisStatus = pong === 'PONG' ? 'connected' : 'error';
  }
} catch (error) {
  redisStatus = 'error';
}

// Incluir no response
healthResponse.redis = {
  status: redisStatus,
  host: process.env.REDIS_HOST || 'not configured',
};
```

## Diagrama de Fluxo - Cache

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Backend │────▶│  Redis   │     │ Supabase │
└──────────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
                      │                │                │
                      │  1. Check      │                │
                      │─────────────▶  │                │
                      │                │                │
                      │  2a. HIT       │                │
                      │◀───────────────│                │
                      │                │                │
                      │  2b. MISS      │                │
                      │◀───────────────│                │
                      │                │                │
                      │  3. Query      │                │
                      │────────────────┼───────────────▶│
                      │                │                │
                      │  4. Response   │                │
                      │◀───────────────┼────────────────│
                      │                │                │
                      │  5. Cache SET  │                │
                      │───────────────▶│                │
                      │                │                │
```

## Considerações de Segurança

1. **Redis não exposto externamente** - Apenas na rede Docker interna
2. **Senha obrigatória** - Configurada via REDIS_PASSWORD
3. **Dados sensíveis** - Não cachear tokens, senhas ou dados PII
4. **TTL curto** - Máximo 10 minutos para dados de configuração
