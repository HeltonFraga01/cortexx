# 🚀 EXECUTAR BUILD AGORA - v1.5.47

## ✅ Status: Preparado para Build

Todos os arquivos já foram atualizados para v1.5.47.

---

## 📋 PASSO A PASSO

### 1️⃣ Iniciar Docker Desktop

```bash
# macOS - Abrir Docker Desktop
open -a Docker

# Aguardar até Docker estar pronto (ícone na barra de menu)
# Verificar se está rodando:
docker info
```

**Aguarde até ver:** "Server Version: ..."

---

### 2️⃣ Login no Docker Hub

```bash
docker login
```

**Credenciais:**
- Username: `heltonfraga`
- Password: [seu token de acesso do Docker Hub]

**Verificar login:**
```bash
docker info | grep Username
# Deve mostrar: Username: heltonfraga
```

---

### 3️⃣ Executar Build Multi-Arquitetura

```bash
# No diretório do projeto, executar:
npm run deploy:official
```

**Quando perguntar "Deseja continuar? (y/n)":**
- Digite: `y` + Enter

**Tempo estimado:** 5-10 minutos

---

## 📊 O que o Build Faz

1. ✅ Verifica pré-requisitos (Docker, Buildx)
2. ✅ Configura builder multi-arquitetura
3. ✅ Build para linux/amd64 e linux/arm64
4. ✅ Push para Docker Hub
5. ✅ Verifica imagens no registry
6. ✅ Exibe informações finais

---

## ✅ Saída Esperada

```
[INFO] === WUZAPI Manager Multi-Arch Build ===
[INFO] Image: heltonfraga/wuzapi-manager
[INFO] Version: 1.5.47
[INFO] Platforms: linux/amd64,linux/arm64

[SUCCESS] Pré-requisitos verificados
[WARNING] Há mudanças não commitadas no repositório
Deseja continuar? (y/n) y

[INFO] Iniciando build multi-arquitetura...
[+] Building 300.5s (45/45) FINISHED
 => pushing heltonfraga/wuzapi-manager:v1.5.47
 => pushing heltonfraga/wuzapi-manager:latest

[SUCCESS] Build concluído com sucesso!
[SUCCESS] ✓ Imagem linux/amd64 disponível
[SUCCESS] ✓ Imagem linux/arm64 disponível

[SUCCESS] === Deploy Concluído ===
[INFO] Imagem publicada: heltonfraga/wuzapi-manager:v1.5.47
```

---

## 🎯 Após Build Bem-Sucedido

### 1. Verificar no Docker Hub

Acesse: https://hub.docker.com/r/heltonfraga/wuzapi-manager/tags

Deve mostrar:
- ✅ Tag `v1.5.47`
- ✅ Tag `latest`
- ✅ Ambas com suporte a amd64 e arm64

### 2. Deploy em Produção

```bash
# Deploy no Swarm (com fix automático do Traefik)
./deploy.sh

# Verificar status
npm run docker:check

# Ver logs
npm run docker:logs

# Testar acesso
curl -I https://cloudapi.wasend.com.br/health
```

---

## 🐛 Se Algo Der Errado

### Docker não inicia
```bash
# Reiniciar Docker Desktop
killall Docker && open -a Docker
```

### Build falha
```bash
# Ver logs detalhados
docker buildx build --platform linux/amd64,linux/arm64 \
  --tag heltonfraga/wuzapi-manager:v1.5.47 \
  --progress=plain \
  .
```

### Push falha
```bash
# Verificar autenticação
docker logout
docker login

# Tentar novamente
npm run deploy:official
```

---

## 📝 Checklist Final

Após build:

- [ ] Build concluído sem erros
- [ ] Imagens no Docker Hub (v1.5.47 + latest)
- [ ] Ambas arquiteturas (amd64 + arm64)
- [ ] Deploy executado (`./deploy.sh`)
- [ ] Diagnóstico OK (`npm run docker:check`)
- [ ] Health check retorna 200
- [ ] Acesso externo funciona

---

## 🚀 COMANDO ÚNICO

Se Docker já está rodando e você está logado:

```bash
npm run deploy:official
```

Pressione `y` quando perguntar.

Aguarde 5-10 minutos.

Pronto! ✨

---

**Versão:** v1.5.47  
**Data:** 2025-12-13  
**Status:** ⏳ Aguardando execução do build
