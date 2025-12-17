---
inclusion: manual
---

# Docker Swarm Stack Configuration

Este modelo é a stack que funciona - não inventar nada diferente a menos que seja necessário.

**Regras:**
- Não mudar nada do docker-compose.yaml sem necessidade
- Não mudar nada do docker-compose.override.yaml
- Não mudar nada do docker-compose.prod.yaml

---

```yaml
version: "3.8"

services:
  cortexx:
    image: heltonfraga/cortexx:v1.5.47
    
    # Environment variables
    environment:
      - NODE_ENV=production
      - PORT=3001
      - WUZAPI_BASE_URL=https://wzapi.wasend.com.br
      - WUZAPI_ADMIN_TOKEN=${WUZAPI_ADMIN_TOKEN}
      - SESSION_SECRET=${SESSION_SECRET}
      - CORS_ORIGINS=https://cloudapi.wasend.com.br
      - WEBHOOK_BASE_URL=https://cloudapi.wasend.com.br
      - REQUEST_TIMEOUT=10000
      - TZ=America/Sao_Paulo
      # Supabase Configuration (PostgreSQL)
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      # Stripe Configuration (Payments)
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      # Node.js Optimizations
      - NODE_OPTIONS=--max-old-space-size=1024
      - UV_THREADPOOL_SIZE=4
      # S3 Storage Configuration
      - S3_ENABLED=true
      - S3_ENDPOINT=https://s3.wasend.com.br
      - S3_REGION=nyc3
      - S3_BUCKET=typebot
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
      - S3_FORCE_PATH_STYLE=true
      # S3 Upload Settings
      - S3_UPLOAD_MAX_SIZE=52428800
      - S3_PRESIGNED_URL_EXPIRY=3600
    
    # Deployment configuration
    deploy:
      replicas: 1  # Can be increased - database is external (Supabase)
      placement:
        constraints:
          - node.role == manager  # Run on manager node only
      restart_policy:
        condition: any
        delay: 5s
        window: 120s
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 10s
      resources:
        limits:
          cpus: '2.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
      labels:
        - traefik.enable=true
        - traefik.http.routers.cortexx.rule=Host(`cloudapi.wasend.com.br`)
        - traefik.http.routers.cortexx.entrypoints=websecure
        - traefik.http.routers.cortexx.tls.certresolver=leresolver
        - traefik.http.routers.cortexx-http.rule=Host(`cloudapi.wasend.com.br`)
        - traefik.http.routers.cortexx-http.entrypoints=web
        - traefik.http.routers.cortexx-http.middlewares=redirect-to-https
        - traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https
        - traefik.http.middlewares.redirect-to-https.redirectscheme.permanent=true
        - traefik.http.services.cortexx.loadbalancer.server.port=3001
        - traefik.http.services.cortexx.loadbalancer.healthcheck.path=/health
        - traefik.http.services.cortexx.loadbalancer.healthcheck.interval=30s
        - traefik.http.services.cortexx.loadbalancer.healthcheck.timeout=10s
        - traefik.http.services.cortexx.loadbalancer.sticky.cookie=true
        - traefik.http.services.cortexx.loadbalancer.sticky.cookie.name=cortexx_session
    
    # Ports (optional - Traefik handles routing)
    ports:
      - "3004:3001"
    
    # Volumes
    volumes:
      - cortexx-logs:/app/logs
    
    # Health check
    healthcheck:
      test: ["CMD", "node", "server/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 90s
    
    # Networks
    networks:
      - network_public

networks:
  network_public:
    external: true

volumes:
  cortexx-logs:
    external: true
    name: cortexx-logs
```

---

## Notas Importantes

1. **Banco de Dados**: O sistema usa Supabase (PostgreSQL hospedado externamente), não há necessidade de volumes para dados locais.

2. **Variáveis de Ambiente Sensíveis**: Use Docker secrets ou variáveis de ambiente do host para valores sensíveis como tokens e chaves.

3. **Escalabilidade**: Como o banco de dados é externo, é possível aumentar `replicas` se necessário.

4. **Pagamentos**: Integração com Stripe configurada via variáveis de ambiente.
