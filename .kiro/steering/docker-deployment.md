---
inclusion: fileMatch
fileMatchPattern: ['Dockerfile*', 'docker-compose*.yml', '**/deploy*.sh', 'scripts/docker-*.sh']
---

# Docker & Deployment Rules

## Critical Constraints (NEVER VIOLATE)

**SQLite**:
- `replicas: 1` ONLY (multiple replicas cause database locks)
- `SQLITE_WAL_MODE=true` REQUIRED
- `node.role == manager` constraint REQUIRED
- Volume at `/app/data` REQUIRED for persistence

**Multi-Architecture**:
- ALWAYS build for `linux/amd64,linux/arm64`
- ALWAYS use `docker buildx` (never plain `docker build`)
- NEVER push single-architecture images

**Integrated Build**:
- Frontend built inside Docker image (multi-stage)
- Backend serves frontend from `/app/dist`
- Single container for both frontend + backend
- Traefik handles SSL/TLS termination

## Build Command

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  --tag heltonfraga/cortexx:VERSION \
  --tag heltonfraga/cortexx:latest --push .
```

Or: `npm run deploy:official`

## Dockerfile Multi-Stage Pattern

| Stage | Purpose | Key Details |
|-------|---------|------------|
| base | Node 20 Alpine + build tools | python3, make, g++, sqlite |
| frontend-deps | Install all deps | Including dev dependencies |
| backend-deps | Install production deps | Production only |
| frontend-builder | Build frontend | `npm run build:production` |
| production | Final image | Non-root user (nodejs:nodejs, 1001:1001), health check, init system |

**Production Stage**:
- Backend node_modules (from stage 3)
- Frontend dist (from stage 4)
- Owned dirs: `/app/data`, `/app/logs`
- Health check: `node server/healthcheck.js`
- Init: tini + dumb-init
- CMD: `dumb-init node server/index.js`

## Docker Swarm Configuration

**Deploy**:
```yaml
deploy:
  replicas: 1  # ONLY 1 for SQLite
  placement:
    constraints: [node.role == manager]
  restart_policy:
    condition: any  # Restart on ANY termination (including SIGTERM)
    delay: 5s
    window: 120s
    # NO max_attempts - unlimited restarts
```

**Volumes (External)**:
```yaml
# Service volumes
volumes:
  - chatmodel-data:/app/data  # Database (required)
  - chatmodel-logs:/app/logs  # Logs (optional)

# Volume definitions (at root level)
volumes:
  chatmodel-data:
    external: true
  chatmodel-logs:
    external: true
```

**Health Check (Resilient)**:
```yaml
healthcheck:
  test: ["CMD", "node", "server/healthcheck.js"]
  interval: 30s
  timeout: 10s
  retries: 5        # More retries before marking unhealthy
  start_period: 90s # Longer startup grace period
```

**Environment**:
- `NODE_ENV=production`
- `PORT=3001`
- `WUZAPI_BASE_URL` - WUZAPI endpoint
- `CORS_ORIGINS` - Comma-separated origins
- `SQLITE_DB_PATH=/app/data/wuzapi.db`
- `SQLITE_WAL_MODE=true` REQUIRED
- `SQLITE_CACHE_SIZE=4000`

## Validation Checklist

**Health Check** (`GET /health`): Must return 200 with `{"status": "healthy", "database": {"status": "connected"}}`

**Logs Must Show**:
- SQLite initialized with WAL mode
- Migrations executed successfully
- Server listening on port 3001
- No permission errors

**Test Endpoints**:
- `GET /health` - Health status
- `GET /` - Frontend HTML
- `GET /api/session/status` - Session API
- `GET /api/admin/users` - Admin API (with token)

**Verify Single Process**:
```bash
docker exec $(docker ps -q -f name=cortexx) ps aux
# Must show ONLY 1 node process
```

## Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "exec format error" | Wrong architecture | Use `docker buildx` with `--platform linux/amd64,linux/arm64` |
| "database is locked" | Multiple replicas or WAL disabled | Ensure `replicas: 1` and `SQLITE_WAL_MODE=true` |
| "EACCES: permission denied" | Volume permissions | `docker exec ... chown -R nodejs:nodejs /app/data` |
| Frontend not loading | Build missing | Verify `COPY --from=frontend-builder` in Dockerfile |
| Health check fails | Timeout too short | Use `start_period: 90s` and `retries: 5` |
| Container not restarting | Wrong restart policy | Use `condition: any` (not `on-failure`) |
| Container stops after SIGTERM | Limited restart attempts | Remove `max_attempts` from restart_policy |

## Key Commands

| Task | Command |
|------|---------|
| Deploy | `npm run deploy:official` (build + push) |
| Deploy to Swarm | `npm run deploy:production` |
| Monitor | `npm run docker:status` |
| View Logs | `npm run docker:logs` |
| Update Service | `docker service update --image heltonfraga/cortexx:vX.Y.Z cortexx_cortexx` |

## Deployment Success Criteria

- Multi-arch image in registry
- Health check returns 200 OK
- Frontend loads, APIs respond
- Only 1 SQLite connection (verify with `ps aux`)
- No critical errors in logs
- Volumes persisting data
- Traefik routing + SSL/TLS working
