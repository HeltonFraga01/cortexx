# Design Document - Release v1.5.1

## Overview

A versão v1.5.1 é um patch release focado em correções críticas de autenticação e proxy no ambiente Docker. O processo de release seguirá o padrão estabelecido em versões anteriores, utilizando o script `deploy-multiarch.sh` para build e publicação multi-arquitetura no Docker Hub.

## Architecture

### Release Workflow

```
1. Atualização de Versões
   ├── package.json → 1.5.1
   └── server/package.json → 1.5.1

2. Documentação
   ├── Release Notes → docs/releases/RELEASE_NOTES_v1.5.1.md
   └── Deploy Guide → DEPLOY_v1.5.1.md

3. Build Multi-Arquitetura
   ├── Verificar pré-requisitos (Docker, Buildx)
   ├── Criar/usar builder multiarch-builder
   ├── Build para linux/amd64
   ├── Build para linux/arm64
   └── Push automático para Docker Hub

4. Verificação
   ├── Pull da imagem publicada
   ├── Executar container de teste
   ├── Verificar health check
   └── Confirmar versão
```

### Docker Build Process

O processo utiliza Docker Buildx para builds multi-arquitetura:

```bash
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag heltonfraga/wuzapi-manager:v1.5.1 \
    --tag heltonfraga/wuzapi-manager:latest \
    --push \
    --progress=plain \
    .
```

## Components and Interfaces

### 1. Version Update Component

**Responsabilidade:** Atualizar versões nos arquivos package.json

**Arquivos Afetados:**
- `package.json` (raiz)
- `server/package.json`

**Método:**
- Usar `strReplace` para atualizar campo `"version"`
- Garantir consistência entre ambos os arquivos

### 2. Release Notes Component

**Responsabilidade:** Documentar mudanças da versão

**Arquivo:** `docs/releases/RELEASE_NOTES_v1.5.1.md`

**Estrutura:**
```markdown
# Release Notes - v1.5.1

## 🎯 Resumo
Patch release focado em correções de autenticação Docker

## 🐛 Correções de Bugs
### 1. Autenticação Docker Proxy
- Problema: Tokens não validavam corretamente
- Solução: Sincronização de variáveis de ambiente

### 2. Variáveis de Ambiente Faltantes
- Problema: WUZAPI_ADMIN_TOKEN e SESSION_SECRET ausentes
- Solução: Adicionadas ao .env.docker

## 🔧 Melhorias Técnicas
### 1. Validação de Ambiente
- Novo: environmentValidator.js
- Valida variáveis obrigatórias no startup

### 2. Logging Aprimorado
- Novo: securityLogger.js
- Logs sanitizados de autenticação

### 3. Health Check Melhorado
- Verifica conectividade WUZAPI
- Valida configuração completa

## 📝 Documentação
- DOCKER_AUTHENTICATION_FIX_SUMMARY.md
- DOCKER_AUTHENTICATION_TROUBLESHOOTING.md
- Scripts de build e verificação

## 🔄 Migração
100% compatível com v1.5.0
```

### 3. Deploy Guide Component

**Responsabilidade:** Guia passo-a-passo para deploy

**Arquivo:** `DEPLOY_v1.5.1.md`

**Estrutura:**
```markdown
# Deploy v1.5.1 - Guia de Execução

## ✅ Preparação Concluída
- Versões atualizadas
- Release notes criadas
- Mudanças incluídas

## 🚀 Passos para Deploy
1. Verificar Docker Desktop
2. Fazer Commit das Mudanças
3. Criar Tag da Versão
4. Build e Push da Imagem Docker
5. Verificar Imagem no Docker Hub

## 📦 Comandos de Deploy
- Docker Swarm
- Docker Compose
- Teste Local

## ✅ Checklist de Deploy
- Pré-Deploy
- Deploy
- Pós-Deploy

## 🔍 Verificação Pós-Deploy
- Verificar Logs
- Testar Health Check
- Testar Funcionalidades
- Verificar Versão

## 🐛 Troubleshooting
- Docker não está rodando
- Build falha
- Push falha
- Service update falha
```

### 4. Build Script Component

**Responsabilidade:** Executar build multi-arquitetura

**Script Existente:** `deploy-multiarch.sh`

**Funcionalidades:**
- Verificação de pré-requisitos
- Criação/uso de builder multi-arch
- Build para múltiplas plataformas
- Push automático para Docker Hub
- Verificação de imagens no registry

**Não requer modificações** - script já está otimizado

### 5. Verification Component

**Responsabilidade:** Verificar imagem publicada

**Comandos:**
```bash
# Pull da imagem
docker pull heltonfraga/wuzapi-manager:v1.5.1

# Executar container de teste
docker run -d \
  --name wuzapi-test \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e WUZAPI_BASE_URL=http://wuzapi:8080 \
  -e WUZAPI_ADMIN_TOKEN=test-token \
  -e SESSION_SECRET=test-secret \
  heltonfraga/wuzapi-manager:v1.5.1

# Aguardar inicialização
sleep 30

# Verificar health check
curl http://localhost:3001/health

# Verificar versão
docker exec wuzapi-test node -e "console.log(require('./server/package.json').version)"

# Limpar
docker stop wuzapi-test
docker rm wuzapi-test
```

## Data Models

### Version Data

```typescript
interface VersionInfo {
  version: string;        // "1.5.1"
  releaseDate: string;    // "2025-11-16"
  type: "patch" | "minor" | "major";
  compatibility: string;  // "100% compatível com v1.5.0"
}
```

### Release Notes Data

```typescript
interface ReleaseNotes {
  version: string;
  date: string;
  type: string;
  summary: string;
  bugFixes: BugFix[];
  improvements: Improvement[];
  documentation: string[];
  migration: MigrationInfo;
}

interface BugFix {
  title: string;
  problem: string;
  solution: string;
  impact: string;
  files: string[];
}

interface Improvement {
  title: string;
  description: string;
  files: string[];
}

interface MigrationInfo {
  compatibility: string;
  breaking: boolean;
  steps: string[];
  rollback: string;
}
```

### Docker Image Data

```typescript
interface DockerImage {
  name: string;           // "heltonfraga/wuzapi-manager"
  tags: string[];         // ["v1.5.1", "latest"]
  platforms: string[];    // ["linux/amd64", "linux/arm64"]
  size: {
    compressed: string;   // "~200MB"
    uncompressed: string; // "~600MB"
  };
  metadata: {
    version: string;
    description: string;
    maintainer: string;
  };
}
```

## Error Handling

### Build Errors

**Cenário:** Build falha por falta de recursos ou erro de compilação

**Tratamento:**
```bash
# Script deploy-multiarch.sh já trata com:
docker buildx build ... || {
    log_error "Falha no build da imagem"
    exit 1
}
```

**Ações:**
- Verificar logs de build
- Verificar espaço em disco
- Verificar sintaxe do Dockerfile
- Tentar rebuild limpo

### Push Errors

**Cenário:** Push falha por autenticação ou rede

**Tratamento:**
```bash
# Verificar autenticação antes do push
if ! docker info | grep -q "Username:"; then
    log_error "Não logado no Docker Hub"
    echo "Execute: docker login"
    exit 1
fi
```

**Ações:**
- Verificar login: `docker login`
- Verificar conectividade de rede
- Verificar permissões no Docker Hub
- Tentar push manual

### Verification Errors

**Cenário:** Health check falha após deploy

**Tratamento:**
```bash
# Verificar health check com timeout
timeout 60 curl http://localhost:3001/health || {
    log_error "Health check falhou"
    docker logs wuzapi-test
    exit 1
}
```

**Ações:**
- Verificar logs do container
- Verificar variáveis de ambiente
- Verificar conectividade WUZAPI
- Verificar portas expostas

## Testing Strategy

### Pre-Release Testing

**Objetivo:** Garantir que a versão está pronta para release

**Testes:**
1. ✅ Verificar que todas as mudanças estão commitadas
2. ✅ Verificar que versões estão atualizadas
3. ✅ Verificar que documentação está completa
4. ✅ Verificar que Docker está rodando

### Build Testing

**Objetivo:** Garantir que o build funciona para todas as plataformas

**Testes:**
1. ✅ Build para linux/amd64 completa sem erros
2. ✅ Build para linux/arm64 completa sem erros
3. ✅ Tags criadas corretamente (v1.5.1 e latest)
4. ✅ Push para Docker Hub bem-sucedido

### Post-Release Testing

**Objetivo:** Garantir que a imagem publicada funciona

**Testes:**
1. ✅ Pull da imagem do Docker Hub
2. ✅ Container inicia sem erros
3. ✅ Health check retorna 200 OK
4. ✅ Versão reportada é 1.5.1
5. ✅ Autenticação funciona corretamente
6. ✅ Conectividade WUZAPI funciona

### Integration Testing

**Objetivo:** Garantir que a aplicação funciona em ambiente real

**Testes:**
1. ✅ Deploy em Docker Swarm
2. ✅ Verificar logs sem erros
3. ✅ Testar login admin
4. ✅ Testar login usuário
5. ✅ Testar envio de mensagem
6. ✅ Testar webhook

## Implementation Notes

### Ordem de Execução

1. **Atualizar Versões** (manual ou script)
   - Modificar package.json
   - Modificar server/package.json

2. **Criar Release Notes** (manual)
   - Documentar mudanças da v1.5.1
   - Seguir formato estabelecido

3. **Criar Deploy Guide** (manual)
   - Documentar processo de deploy
   - Incluir comandos e checklist

4. **Commit e Tag** (manual)
   ```bash
   git add .
   git commit -m "chore: release v1.5.1"
   git tag -a v1.5.1 -m "Release v1.5.1"
   git push origin main
   git push origin v1.5.1
   ```

5. **Build e Push** (automatizado)
   ```bash
   ./deploy-multiarch.sh v1.5.1
   ```

6. **Verificar** (manual)
   ```bash
   docker pull heltonfraga/wuzapi-manager:v1.5.1
   # Executar testes de verificação
   ```

### Variáveis de Ambiente Críticas

Para testes locais da imagem, estas variáveis são obrigatórias:

```bash
NODE_ENV=production
WUZAPI_BASE_URL=http://wuzapi:8080
WUZAPI_ADMIN_TOKEN=<token>
SESSION_SECRET=<secret>
PORT=3001
```

### Compatibilidade

- ✅ 100% compatível com v1.5.0
- ✅ Sem mudanças no banco de dados
- ✅ Sem mudanças na API
- ✅ Sem breaking changes
- ✅ Rollback seguro para v1.5.0 se necessário

### Performance Considerations

- Build multi-arch leva ~5-10 minutos
- Push para Docker Hub leva ~2-5 minutos
- Total do processo: ~15-20 minutos
- Imagem comprimida: ~200MB
- Imagem descomprimida: ~600MB

### Security Considerations

- Tokens sanitizados em logs
- Variáveis de ambiente validadas no startup
- Health check não expõe informações sensíveis
- Imagem roda como usuário não-root (nodejs:1001)

## Design Decisions

### 1. Usar Script Existente

**Decisão:** Utilizar `deploy-multiarch.sh` sem modificações

**Razão:** Script já está otimizado e testado em releases anteriores

**Alternativa Rejeitada:** Criar novo script específico para v1.5.1

### 2. Manter Formato de Release Notes

**Decisão:** Seguir formato estabelecido em v1.4.9

**Razão:** Consistência e familiaridade para usuários

**Alternativa Rejeitada:** Criar novo formato mais detalhado

### 3. Tag Semântica

**Decisão:** Usar formato "v1.5.1" (com prefixo "v")

**Razão:** Consistência com tags anteriores e convenção Git

**Alternativa Rejeitada:** Usar "1.5.1" sem prefixo

### 4. Build Automático com Push

**Decisão:** Build e push em um único comando

**Razão:** Reduz erros e simplifica processo

**Alternativa Rejeitada:** Build e push separados

### 5. Verificação Manual

**Decisão:** Verificação pós-deploy manual

**Razão:** Permite inspeção detalhada e troubleshooting

**Alternativa Rejeitada:** Verificação totalmente automatizada

## References

- **Script de Build:** `deploy-multiarch.sh`
- **Dockerfile:** `Dockerfile`
- **Release Anterior:** `DEPLOY_v1.4.9.md`
- **Release Notes Anterior:** `docs/releases/RELEASE_NOTES_v1.4.9.md`
- **Documentação Docker:** `docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md`
