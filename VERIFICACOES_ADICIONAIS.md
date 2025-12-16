# Verificações Adicionais - Troubleshooting Avançado

## Se a solução principal não funcionar, verifique:

---

## 1. Verificar se o Build do Frontend Está Funcionando

### No seu ambiente local:

```bash
# Limpar e rebuildar
rm -rf dist/
npm run build:production

# Verificar se o dist foi criado
ls -la dist/

# Deve mostrar:
# - index.html
# - assets/ (com arquivos .js e .css)
# - favicon.ico
```

**Se o `dist/` não for criado:**
- Há erro no build do Vite
- Verifique `npm run build:production` para erros

---

## 2. Verificar se o Dockerfile Está Copiando Corretamente

### Testar build local:

```bash
# Build apenas para sua arquitetura (mais rápido)
docker build -t cortexx-test .

# Verificar se o dist existe na imagem
docker run --rm cortexx-test ls -la /app/dist/

# Deve listar os arquivos do frontend
```

**Se `/app/dist` não existir na imagem:**
- O estágio `frontend-builder` falhou
- Verifique os logs do build Docker

---

## 3. Verificar Logs Detalhados do Container

### No servidor:

```bash
# Logs completos desde o início
docker service logs cortexx_cortexx --no-trunc

# Procure especificamente por:
grep -i "dist" 
grep -i "servindo"
grep -i "static"
grep -i "error"
```

**Mensagens importantes:**

✅ **Sucesso:**
```
✅ Servindo arquivos estáticos do build React: /app/dist
✅ Cortexx Server rodando na porta 3001
```

❌ **Problema:**
```
⚠️ Diretório dist/ não encontrado. Execute "npm run build"
❌ Build do frontend não encontrado
```

---

## 4. Verificar Permissões no Container

```bash
# Acessar o container
docker exec -it $(docker ps -q -f name=cortexx) sh

# Dentro do container:
ls -la /app/
ls -la /app/dist/
cat /app/dist/index.html | head -20

# Verificar usuário
whoami  # Deve ser: nodejs

# Verificar permissões
ls -la /app/dist/index.html
# Deve ser legível pelo usuário nodejs
```

---

## 5. Testar Servidor Node Diretamente

### Dentro do container:

```bash
docker exec $(docker ps -q -f name=cortexx) sh -c "
  cd /app/server && 
  node -e \"
    const fs = require('fs');
    const path = require('path');
    const distPath = path.join(__dirname, '../dist');
    console.log('Dist path:', distPath);
    console.log('Exists:', fs.existsSync(distPath));
    if (fs.existsSync(distPath)) {
      console.log('Files:', fs.readdirSync(distPath));
    }
  \"
"
```

---

## 6. Verificar Variáveis de Ambiente

```bash
# Ver todas as env vars do container
docker exec $(docker ps -q -f name=cortexx) env | grep -E "NODE_ENV|PORT|SQLITE"

# Deve mostrar:
# NODE_ENV=production
# PORT=3001
# SQLITE_DB_PATH=/app/data/cloudapi.db
```

---

## 7. Verificar Health Check

```bash
# Ver status do health check
docker service inspect cortexx_cortexx \
  --format='{{json .Spec.TaskTemplate.ContainerSpec.Healthcheck}}' | jq

# Executar health check manualmente
docker exec $(docker ps -q -f name=cortexx) node server/healthcheck.js

# Deve retornar exit code 0 e JSON
```

---

## 8. Verificar Traefik Routing

### Ver configuração do Traefik:

```bash
# Labels do serviço
docker service inspect cortexx_cortexx \
  --format='{{range $key, $value := .Spec.Labels}}{{$key}}={{$value}}{{"\n"}}{{end}}' \
  | grep traefik

# Deve incluir:
# traefik.enable=true
# traefik.http.routers.cortexx.rule=Host(`cloudapi.wasend.com.br`)
# traefik.http.services.cortexx.loadbalancer.server.port=3001
```

### Ver logs do Traefik:

```bash
# Encontrar container do Traefik
docker ps | grep traefik

# Ver logs
docker logs $(docker ps -q -f name=traefik) --tail 100 | grep cortexx

# Procure por erros de roteamento
```

---

## 9. Testar Conectividade Interna

```bash
# Do servidor, testar porta publicada
curl -v http://localhost:3004/health

# Se funcionar: problema é no Traefik
# Se não funcionar: problema é no container
```

---

## 10. Verificar Imagem no Docker Hub

### Verificar se a imagem foi realmente atualizada:

```bash
# Ver digest da imagem local
docker images --digests | grep cortexx

# Ver digest no Docker Hub
docker manifest inspect heltonfraga/cortexx:v1.5.47 | grep digest

# Forçar pull da imagem
docker pull heltonfraga/cortexx:v1.5.47

# Ver quando foi criada
docker inspect heltonfraga/cortexx:v1.5.47 | grep Created
```

---

## 11. Rebuild Completo (Última Opção)

Se nada funcionar, rebuild completo:

```bash
# 1. No seu computador - limpar tudo
rm -rf dist/
rm -rf node_modules/
rm -rf server/node_modules/
npm install
cd server && npm install && cd ..

# 2. Build do frontend
npm run build:production

# 3. Verificar dist
ls -la dist/

# 4. Build Docker (sem cache)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag heltonfraga/cortexx:v1.5.47 \
  --tag heltonfraga/cortexx:latest \
  --no-cache \
  --push \
  .

# 5. No servidor - remover e recriar
docker service rm cortexx_cortexx
docker stack deploy -c docker-compose-swarm.yaml cortexx

# 6. Aguardar 2 minutos
sleep 120

# 7. Testar
curl https://cloudapi.wasend.com.br/health
```

---

## 12. Verificar Cloudflare

Se tudo funcionar localmente mas não via domínio:

```bash
# Testar DNS
nslookup cloudapi.wasend.com.br

# Testar sem Cloudflare (direto no servidor)
curl -H "Host: cloudapi.wasend.com.br" http://IP_DO_SERVIDOR/health

# Verificar se Cloudflare está em modo proxy (laranja)
# Deve estar em modo proxy para SSL funcionar
```

---

## Resumo de Diagnóstico

Execute esta sequência para diagnóstico completo:

```bash
#!/bin/bash

echo "=== 1. Verificar serviço ==="
docker service ps cortexx_cortexx

echo -e "\n=== 2. Verificar dist no container ==="
docker exec $(docker ps -q -f name=cortexx) ls -la /app/dist/

echo -e "\n=== 3. Testar health interno ==="
docker exec $(docker ps -q -f name=cortexx) wget -qO- http://localhost:3001/health

echo -e "\n=== 4. Testar porta publicada ==="
curl -s http://localhost:3004/health

echo -e "\n=== 5. Testar via Traefik ==="
curl -s https://cloudapi.wasend.com.br/health

echo -e "\n=== 6. Ver últimos logs ==="
docker service logs --tail 20 cortexx_cortexx
```

Salve como `diagnose-full.sh`, execute e me envie o resultado.
