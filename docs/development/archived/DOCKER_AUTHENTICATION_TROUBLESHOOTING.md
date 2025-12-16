# Docker Authentication Troubleshooting Guide

## Quick Diagnosis

```bash
# 1. Check health endpoint
curl http://localhost:3001/health | jq .

# 2. Check container logs
docker logs wuzapi-manager-local --tail 50

# 3. Check environment variables
docker exec wuzapi-manager-local env | grep -E "WUZAPI|SESSION|CORS"

# 4. Verify deployment
./scripts/verify-docker-deployment.sh
```

---

## Common Issues

### 1. Authentication Fails with "Invalid credentials"

**Symptoms:**
```json
{
  "error": "Invalid credentials",
  "code": "INVALID_CREDENTIALS"
}
```

**Causes:**
- Missing `WUZAPI_ADMIN_TOKEN` in `.env.docker`
- Token mismatch between `.env.docker` and request
- WUZAPI service unavailable

**Solutions:**
```bash
# Check if token is set
docker exec wuzapi-manager-local env | grep WUZAPI_ADMIN_TOKEN

# Verify token in .env.docker
grep WUZAPI_ADMIN_TOKEN .env.docker

# Test with correct token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_ADMIN_TOKEN", "role": "admin"}'
```

---

### 2. Configuration Validation Fails

**Symptoms:**
```json
{
  "configuration": {
    "valid": false,
    "errors": ["Missing required environment variable: SESSION_SECRET"]
  }
}
```

**Causes:**
- Missing required variables in `.env.docker`
- Invalid variable format

**Solutions:**
```bash
# Check all required variables
cat .env.docker | grep -E "WUZAPI_BASE_URL|CORS_ORIGINS|SESSION_SECRET|WUZAPI_ADMIN_TOKEN"

# Generate new SESSION_SECRET
openssl rand -base64 32

# Update .env.docker and restart
docker-compose -f docker-compose.local.yml restart
```

---

### 3. Database Connection Fails

**Symptoms:**
```json
{
  "database": {
    "status": "error",
    "error": "SQLITE_CANTOPEN"
  }
}
```

**Causes:**
- Volume not mounted correctly
- Permission issues
- Database file corrupted

**Solutions:**
```bash
# Check volume mounts
docker inspect wuzapi-manager-local | grep -A10 Mounts

# Check permissions
docker exec wuzapi-manager-local ls -lh /app/data/

# Fix permissions
docker exec wuzapi-manager-local chown -R nodejs:nodejs /app/data

# Verify WAL mode
docker exec wuzapi-manager-local sqlite3 /app/data/wuzapi.db "PRAGMA journal_mode;"
```

---

### 4. WUZAPI Connection Fails

**Symptoms:**
```json
{
  "wuzapi": {
    "status": "error",
    "error": "Connection timeout"
  }
}
```

**Causes:**
- Network connectivity issues
- WUZAPI service down
- Firewall blocking requests

**Solutions:**
```bash
# Test connectivity from container
docker exec wuzapi-manager-local curl -s https://wzapi.wasend.com.br/health

# Check DNS resolution
docker exec wuzapi-manager-local nslookup wzapi.wasend.com.br

# Verify WUZAPI_BASE_URL
docker exec wuzapi-manager-local env | grep WUZAPI_BASE_URL
```

---

### 5. Container Won't Start

**Symptoms:**
```bash
docker ps -a
# Shows container as "Exited"
```

**Causes:**
- Validation failure on startup
- Port already in use
- Missing dependencies

**Solutions:**
```bash
# Check logs for error
docker logs wuzapi-manager-local

# Check if port is in use
lsof -i :3001

# Remove and recreate
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up -d
```

---

### 6. Sessions Not Persisting

**Symptoms:**
- Login works but session lost on next request
- Cookies not being set

**Causes:**
- Session store not configured
- Cookie settings incorrect
- CORS issues

**Solutions:**
```bash
# Check session store
docker exec wuzapi-manager-local ls -lh /app/data/sessions.db

# Check sessions table
docker exec wuzapi-manager-local sqlite3 /app/data/sessions.db "SELECT COUNT(*) FROM sessions;"

# Verify CORS settings
curl -v http://localhost:3001/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN", "role": "admin"}'
```

---

## Diagnostic Commands

### Container Status
```bash
# List containers
docker ps -a

# Check health
docker inspect wuzapi-manager-local | jq '.[0].State.Health'

# View logs
docker logs -f wuzapi-manager-local

# Enter container
docker exec -it wuzapi-manager-local sh
```

### Database Checks
```bash
# Check database file
docker exec wuzapi-manager-local ls -lh /app/data/wuzapi.db

# Check WAL mode
docker exec wuzapi-manager-local sqlite3 /app/data/wuzapi.db "PRAGMA journal_mode;"

# Check tables
docker exec wuzapi-manager-local sqlite3 /app/data/wuzapi.db ".tables"

# Check sessions
docker exec wuzapi-manager-local sqlite3 /app/data/sessions.db "SELECT COUNT(*) FROM sessions;"
```

### Network Checks
```bash
# Test health endpoint
curl http://localhost:3001/health | jq .

# Test authentication
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN", "role": "admin"}' | jq .

# Test WUZAPI connectivity
docker exec wuzapi-manager-local curl -s https://wzapi.wasend.com.br/health
```

---

## Log Analysis

### Look for These Patterns

**Successful Startup:**
```
✅ Validação de ambiente concluída com sucesso
✅ Banco de dados SQLite inicializado com sucesso
🚀 WUZAPI Manager Server rodando na porta 3001
```

**Authentication Success:**
```
"message":"Login successful"
"userId":"admin"
"role":"admin"
```

**Authentication Failure:**
```
"message":"Login failed"
"reason":"Invalid admin token"
```

**Configuration Errors:**
```
"message":"Environment validation failed"
"errors":["Missing required environment variable: ..."]
```

---

## Recovery Procedures

### Complete Reset
```bash
# Stop and remove everything
docker-compose -f docker-compose.local.yml down -v

# Remove data (CAUTION: loses all data)
rm -rf data/* logs/*

# Rebuild and start
docker-compose -f docker-compose.local.yml up -d --build

# Verify
./scripts/verify-docker-deployment.sh
```

### Soft Reset (Keep Data)
```bash
# Restart container
docker-compose -f docker-compose.local.yml restart

# Or recreate without losing data
docker-compose -f docker-compose.local.yml up -d --force-recreate
```

---

## Getting Help

If issues persist:

1. **Collect diagnostic information:**
```bash
# Save logs
docker logs wuzapi-manager-local > docker-logs.txt

# Save health check
curl http://localhost:3001/health > health-check.json

# Save environment (sanitized)
docker exec wuzapi-manager-local env | grep -v SECRET > environment.txt
```

2. **Check documentation:**
- `docs/DEVELOPMENT_VS_DOCKER.md`
- `docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md`

3. **Run verification script:**
```bash
./scripts/verify-docker-deployment.sh
```

---

## Prevention

### Before Deployment Checklist

- [ ] All required variables in `.env.docker`
- [ ] `SESSION_SECRET` generated with `openssl rand -base64 32`
- [ ] `WUZAPI_ADMIN_TOKEN` matches your admin token
- [ ] `CORS_ORIGINS` includes your domain
- [ ] Health check passes locally
- [ ] Authentication tested with real tokens
- [ ] Database persists after restart

### Monitoring

```bash
# Watch logs
docker logs -f wuzapi-manager-local

# Monitor health
watch -n 5 'curl -s http://localhost:3001/health | jq .'

# Check resources
docker stats wuzapi-manager-local
```
