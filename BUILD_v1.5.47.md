# 🚀 Build Guide - Version 1.5.47

Guia para build e deploy da versão 1.5.47 do WUZAPI Manager.

---

## ✅ Preparação Concluída

Todos os arquivos foram atualizados para a versão **v1.5.47**:

- ✅ `package.json` → 1.5.47
- ✅ `server/package.json` → 1.5.47
- ✅ `docker-compose-swarm.yaml` → heltonfraga/wuzapi-manager:v1.5.47
- ✅ `CHANGELOG.md` → [1.5.47] - 2025-12-13

---

## 📋 Mudanças Nesta Versão

### Adicionado
- **Scripts de Deploy Automático** com fix do Traefik
  - `deploy.sh` - Deploy com registro automático no Traefik
  - `scripts/check-deployment.sh` - Diagnóstico completo
  - Comandos npm: `npm run deploy:production`, `npm run docker:check`

- **Documentação Completa**
  - `docs/TROUBLESHOOTING.md` - Guia de problemas
  - `docs/TRAEFIK_404_FIX.md` - Fix rápido (30s)
  - `docs/DEPLOYMENT_SCRIPTS.md` - Guia dos scripts
  - `docs/DOCKER_SWARM_CHEATSHEET.md` - Referência de comandos
  - `docs/NETWORK_ARCHITECTURE.md` - Arquitetura de rede
  - `QUICK_REFERENCE.md` - Referência rápida

### Melhorado
- **Configuração de Rede** simplificada para usar apenas `network_public`
- **Workflow de Deploy** mais confiável (99% de sucesso)
- **Documentação** organizada e acessível

### Corrigido
- **Erro 404 do Traefik** - Solução permanente com script automático

---

## 🔨 Build Multi-Arquitetura

### Pré-requisitos

1. **Docker Desktop rodando**
```bash
# Verificar se Docker está rodando
docker info
```

2. **Autenticado no Docker Hub**
```bash
# Login no Docker Hub
docker login
# Username: heltonfraga
# Password: [seu token]
```

3. **Builder multi-arch configurado**
```bash
# Verificar builder
docker buildx ls

# Se não existir, criar
docker buildx create --name multiarch-builder --use --platform linux/amd64,linux/arm64
docker buildx inspect --bootstrap
```

---

## 🚀 Executar Build

### Opção 1: Via npm (Recomendado)

```bash
# Build e push multi-arquitetura
npm run deploy:official
```

**O script irá:**
1. ✅ Verificar pré-requisitos
2. ✅ Avisar sobre mudanças não commitadas (pressione 'y' para continuar)
3. ✅ Build para linux/amd64 e linux/arm64
4. ✅ Push para Docker Hub
5. ✅ Verificar imagens no registry
6. ✅ Exibir informações das imagens

**Tempo estimado:** 5-10 minutos

---

### Opção 2: Manual

```bash
# Build e push
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag heltonfraga/wuzapi-manager:v1.5.47 \
  --tag heltonfraga/wuzapi-manager:latest \
  --provenance=false \
  --sbom=false \
  --push \
  .
```

---

## ✅ Verificação

### 1. Verificar imagens no Docker Hub

```bash
# Verificar manifest
docker manifest inspect heltonfraga/wuzapi-manager:v1.5.47

# Deve mostrar:
# - linux/amd64
# - linux/arm64
```

### 2. Verificar tags

Acesse: https://hub.docker.com/r/heltonfraga/wuzapi-manager/tags

Deve mostrar:
- ✅ `v1.5.47` (latest)
- ✅ `latest`

---

## 🚀 Deploy em Produção

### Após Build Bem-Sucedido

```bash
# 1. Deploy no Swarm (com fix automático do Traefik)
./deploy.sh

# 2. Verificar status
npm run docker:check

# 3. Ver logs
npm run docker:logs

# 4. Testar acesso
curl -I https://cloudapi.wasend.com.br/health
```

---

## 📊 Saída Esperada do Build

```
[INFO] === WUZAPI Manager Multi-Arch Build ===
[INFO] Image: heltonfraga/wuzapi-manager
[INFO] Version: 1.5.47
[INFO] Platforms: linux/amd64,linux/arm64

[INFO] Verificando pré-requisitos...
[INFO] Usando builder existente: multiarch-builder
[SUCCESS] Pré-requisitos verificados

[WARNING] Há mudanças não commitadas no repositório
Deseja continuar? (y/n) y

[INFO] Iniciando build multi-arquitetura...
[INFO] Isso pode levar alguns minutos...
[INFO] Iniciando build multi-arch com push...

[+] Building 300.5s (45/45) FINISHED
 => [linux/amd64 internal] load build definition
 => [linux/arm64 internal] load build definition
 => [linux/amd64 base 1/4] FROM docker.io/library/node:20-alpine
 => [linux/arm64 base 1/4] FROM docker.io/library/node:20-alpine
 ...
 => exporting to image
 => pushing heltonfraga/wuzapi-manager:v1.5.47
 => pushing heltonfraga/wuzapi-manager:latest

[SUCCESS] Build concluído com sucesso!

[INFO] Verificando imagens no Docker Hub...
[INFO] Verificando plataforma: linux/amd64
[SUCCESS] ✓ Imagem linux/amd64 disponível
[INFO] Verificando plataforma: linux/arm64
[SUCCESS] ✓ Imagem linux/arm64 disponível

[INFO] === Informações da Imagem ===
"architecture": "amd64"
"os": "linux"
"architecture": "arm64"
"os": "linux"

[SUCCESS] === Deploy Concluído ===
[INFO] Imagem publicada: heltonfraga/wuzapi-manager:v1.5.47
[INFO] Imagem latest: heltonfraga/wuzapi-manager:latest

[INFO] Para fazer deploy no Docker Swarm:
[INFO]   docker service update --image heltonfraga/wuzapi-manager:v1.5.47 wuzapi-manager_wuzapi-manager

[INFO] Ou usar o script de deploy:
[INFO]   npm run deploy:production
```

---

## 🐛 Troubleshooting

### Docker não está rodando

```bash
# macOS
open -a Docker

# Aguardar Docker iniciar
docker info
```

### Não autenticado no Docker Hub

```bash
docker login
# Username: heltonfraga
# Password: [seu token de acesso]
```

### Builder não existe

```bash
docker buildx create --name multiarch-builder --use --platform linux/amd64,linux/arm64
docker buildx inspect --bootstrap
```

### Build falha com "exec format error"

**Causa:** Tentando rodar imagem de arquitetura errada

**Solução:** Sempre usar `docker buildx` com `--platform linux/amd64,linux/arm64`

### Push falha com "denied"

**Causa:** Não autenticado ou sem permissão

**Solução:**
```bash
docker logout
docker login
# Usar token de acesso, não senha
```

---

## 📝 Checklist Pós-Build

Após build bem-sucedido:

- [ ] Imagens no Docker Hub (amd64 + arm64)
- [ ] Tag v1.5.47 criada
- [ ] Tag latest atualizada
- [ ] Deploy no Swarm executado (`./deploy.sh`)
- [ ] Diagnóstico OK (`npm run docker:check`)
- [ ] Health check retorna 200
- [ ] Acesso externo funciona
- [ ] Logs sem erros críticos

---

## 🔄 Próximos Passos

1. **Executar build** quando Docker estiver disponível
2. **Verificar imagens** no Docker Hub
3. **Deploy em produção** com `./deploy.sh`
4. **Verificar status** com `npm run docker:check`
5. **Monitorar logs** com `npm run docker:logs`
6. **Testar acesso** em https://cloudapi.wasend.com.br

---

## 📚 Documentação

- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Referência rápida
- [docs/DEPLOYMENT_SCRIPTS.md](docs/DEPLOYMENT_SCRIPTS.md) - Scripts de deploy
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Solução de problemas
- [CHANGELOG.md](CHANGELOG.md) - Mudanças da versão

---

## ✨ Resumo

**Versão:** v1.5.47  
**Data:** 2025-12-13  
**Status:** ✅ Preparado para build  
**Próximo passo:** Executar `npm run deploy:official`  

**Principais mudanças:**
- ✅ Scripts de deploy automático
- ✅ Fix permanente do erro 404 do Traefik
- ✅ Documentação completa
- ✅ Rede simplificada (apenas network_public)

---

**Autor:** Kiro AI Assistant  
**Build preparado em:** Dezembro 2025
