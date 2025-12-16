# Relatório de Auditoria - Configuração de Ambiente e Gerenciamento de Segredos

**Data:** 07/11/2025  
**Auditor:** Kiro AI Security Audit  
**Sistema:** WuzAPI Dashboard  
**Escopo:** Tarefa 4 - Auditoria de Configuração de Ambiente e Gerenciamento de Segredos

---

## 📊 Resumo Executivo

Esta auditoria examinou a configuração de ambiente, gerenciamento de segredos, configuração Docker, CORS e logging do sistema WuzAPI Dashboard.

**Principais Descobertas:**
- ❌ **CRÍTICO:** Token admin hardcoded como fallback
- ⚠️ Token admin exposto no arquivo .env (não deve estar versionado)
- ✅ Uso adequado de variáveis de ambiente
- ✅ CORS bem configurado para produção
- ⚠️ Docker não especifica usuário não-root
- ✅ Tokens mascarados nos logs
- ⚠️ Documentação de variáveis incompleta

**Nível de Risco Geral:** ALTO (devido a token hardcoded)

---

## 4.1 Escaneamento de Segredos Hardcoded

### Descoberta: TOKEN ADMIN HARDCODED COMO FALLBACK

**Status:** ❌ CRÍTICO  
**Severidade:** ALTA  
**Requisito:** 3.1

#### Análise

O sistema possui um **token administrativo hardcoded** como valor de fallback em múltiplos arquivos, representando um risco crítico de segurança.

#### Evidências

**Token Hardcoded Encontrado:**

```javascript
// server/routes/landingPageRoutes.js - Linha 27
const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';

// server/routes/index.js - Linha 35
const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';

// server/index.js - Linha 518
const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
```

**Localizações:**
- ❌ `server/routes/landingPageRoutes.js` (3 ocorrências)
- ❌ `server/routes/index.js` (1 ocorrência)
- ❌ `server/index.js` (1 ocorrência)

**Token Exposto no .env:**
```properties
# .env - NÃO DEVE ESTAR NO REPOSITÓRIO
VITE_ADMIN_TOKEN=UeH7cZ2c1K3zVUBFi7SginSC
```


#### Impacto

**CRÍTICO:**
1. **Token Comprometido** - Token está exposto publicamente no código
2. **Acesso Administrativo** - Qualquer pessoa com o token tem acesso admin
3. **Sem Rotação** - Token hardcoded não pode ser facilmente rotacionado
4. **Múltiplos Pontos** - Token duplicado em 5 locais diferentes

#### Recomendações

**IMEDIATO (CRÍTICO):**

1. **Remover Token Hardcoded**
```javascript
// ANTES (INSEGURO)
const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';

// DEPOIS (SEGURO)
const adminToken = process.env.VITE_ADMIN_TOKEN;

if (!adminToken) {
  logger.error('VITE_ADMIN_TOKEN não configurado');
  throw new Error('Token administrativo não configurado');
}
```

2. **Rotacionar Token Imediatamente**
```bash
# Gerar novo token seguro
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Atualizar em TODAS as instâncias
# Atualizar .env (NÃO versionar)
# Atualizar docker-swarm-stack.yml
```

3. **Adicionar .env ao .gitignore**
```bash
# Verificar se .env está no .gitignore
grep "^\.env$" .gitignore || echo ".env" >> .gitignore

# Remover .env do histórico do Git (se versionado)
git rm --cached .env
git commit -m "Remove .env from version control"
```

4. **Aplicar em Todos os Arquivos**
```bash
# Arquivos a modificar:
- server/routes/landingPageRoutes.js (3 locais)
- server/routes/index.js (1 local)
- server/index.js (1 local)
```

---

## 4.2 Revisão de Configuração de Segurança Docker

### Descoberta: CONTAINER PODE RODAR COMO ROOT

**Status:** ⚠️ MÉDIA SEVERIDADE  
**Severidade:** MÉDIA  
**Requisito:** 3.2

#### Análise

A configuração Docker não especifica explicitamente um usuário não-root, o que pode permitir que o container rode com privilégios elevados.

#### Evidências

**Configuração Atual:**
```yaml
# docker-swarm-stack.yml
services:
  wuzapi-manager:
    image: heltonfraga/wuzapi-manager:v1.2.7-multiarch
    # ❌ Sem especificação de usuário
    environment:
      - NODE_ENV=production
      - PORT=3001
    ports:
      - "3001:3001"
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 1024M
        reservations:
          cpus: '0.25'
          memory: 128M
```

**Pontos Positivos:**
- ✅ Limites de recursos configurados (CPU e memória)
- ✅ Health check implementado
- ✅ Restart policy configurado
- ✅ Volumes para persistência de dados
- ✅ Rede externa configurada

**Pontos de Melhoria:**
- ⚠️ Sem especificação de usuário não-root
- ⚠️ Porta 3001 exposta diretamente (deveria usar apenas Traefik)
- ⚠️ Sem read-only filesystem
- ⚠️ Sem capabilities drop

#### Recomendações

**CURTO PRAZO:**

1. **Adicionar Usuário Não-Root**
```yaml
services:
  wuzapi-manager:
    image: heltonfraga/wuzapi-manager:v1.2.7-multiarch
    user: "node:node"  # ADICIONAR
    # ou
    user: "1000:1000"  # UID:GID
```

2. **Remover Exposição Direta de Porta**
```yaml
# ANTES
ports:
  - "3001:3001"

# DEPOIS (usar apenas Traefik)
# Remover seção ports, deixar apenas labels do Traefik
```

3. **Adicionar Security Options**
```yaml
services:
  wuzapi-manager:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Se necessário para porta < 1024
```

4. **Configurar Read-Only Filesystem (onde possível)**
```yaml
services:
  wuzapi-manager:
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs  # Se logs forem escritos localmente
```

---

## 4.3 Auditoria de Configuração CORS

### Descoberta: CORS BEM CONFIGURADO

**Status:** ✅ CONFORME  
**Severidade:** N/A  
**Requisito:** 3.3

#### Análise

A configuração CORS está **bem implementada** com diferenciação entre desenvolvimento e produção, e validação adequada de origens.

#### Evidências

**Configuração de Produção:**
```javascript
// server/middleware/corsHandler.js
_getProductionConfig(corsOrigins) {
  let allowedOrigins = [];
  
  if (corsOrigins) {
    allowedOrigins = corsOrigins.split(',').map(origin => origin.trim());
  }
  
  // Se não há origens configuradas, bloquear todas
  if (allowedOrigins.length === 0) {
    logger.warn('Nenhuma origem CORS configurada - bloqueando cross-origin');
    allowedOrigins = false;
  }

  return {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    // ✅ Não permite '*'
  };
}
```

**Validação de Origem:**
```javascript
validateOrigin(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const origin = req.get('Origin');
  
  if (!isProduction) {
    return next(); // Desenvolvimento: permitir
  }
  
  if (!origin) {
    return next(); // Same-origin: permitir
  }
  
  const corsOrigins = process.env.CORS_ORIGINS;
  if (!corsOrigins) {
    // ✅ Bloqueia se não configurado
    return res.status(403).json({
      error: 'Origem não permitida'
    });
  }
  
  const allowedOrigins = corsOrigins.split(',').map(o => o.trim());
  if (!allowedOrigins.includes(origin)) {
    // ✅ Bloqueia origens não permitidas
    return res.status(403).json({
      error: 'Origem não permitida'
    });
  }
  
  next();
}
```

**Configuração Atual:**
```properties
# .env
CORS_ORIGINS=http://localhost:3000,http://localhost:4173,http://localhost:8080

# docker-swarm-stack.yml
CORS_ORIGINS=https://cloudapi.wasend.com.br
```

#### Pontos Fortes

1. ✅ **Whitelist de Origens** - Não usa '*' em produção
2. ✅ **Validação Explícita** - Middleware valida origens
3. ✅ **Logging** - Registra tentativas bloqueadas
4. ✅ **Credentials Seguro** - Apenas com origens específicas
5. ✅ **Métodos Restritos** - Lista específica de métodos HTTP
6. ✅ **Headers Controlados** - Apenas headers necessários

#### Recomendações

**OPCIONAL (Melhorias):**

1. **Adicionar Validação de Protocolo**
```javascript
validateOrigin(req, res, next) {
  // ...
  
  // Validar que origem usa HTTPS em produção
  if (isProduction && origin && !origin.startsWith('https://')) {
    logger.warn('Origem HTTP bloqueada em produção', { origin });
    return res.status(403).json({
      error: 'Apenas HTTPS permitido em produção'
    });
  }
  
  // ...
}
```

2. **Implementar Rate Limiting por Origem**
```javascript
const originRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.get('Origin') || req.ip
});
```

---

## 4.4 Verificação de Documentação de Variáveis de Ambiente

### Descoberta: DOCUMENTAÇÃO INCOMPLETA

**Status:** ⚠️ PARCIALMENTE CONFORME  
**Severidade:** BAIXA  
**Requisito:** 3.4

#### Análise

O arquivo `.env.example` está **desatualizado** e não documenta todas as variáveis de ambiente usadas no código.

#### Evidências

**Variáveis Documentadas (.env.example):**
```properties
VITE_API_URL=https://wzapi.wasend.com.br
VITE_ADMIN_TOKEN=seu_token_admin_aqui
VITE_DEV_MODE=true
SQLITE_DB_PATH=./server/wuzapi.db
SQLITE_WAL_MODE=true
SQLITE_TIMEOUT=5000
```

**Variáveis Usadas no Código (mas não documentadas):**
```javascript
// Encontradas via grep process.env
- REQUEST_TIMEOUT (usado em wuzapiClient.js)
- CORS_ORIGINS (usado em corsHandler.js)
- NODE_ENV (usado em múltiplos arquivos)
- PORT (usado em index.js)
- LOG_LEVEL (usado em logger.js)
- LOG_FORMAT (usado em logger.js)
- LOG_DIR (usado em logger.js)
- MONITORING_TOKEN (usado em monitoring.js)
- NOCODB_TIMEOUT (usado em UserRecordService.js)
- SLACK_WEBHOOK_URL (usado em alerts.js)
- DISCORD_WEBHOOK_URL (usado em alerts.js)
- SMTP_HOST (usado em alerts.js)
- ALERT_EMAIL_TO (usado em alerts.js)
- SQLITE_CACHE_SIZE (usado em docker-swarm-stack.yml)
- SQLITE_SYNCHRONOUS (usado em docker-swarm-stack.yml)
- SQLITE_JOURNAL_MODE (usado em docker-swarm-stack.yml)
```

**Inconsistências:**
- ❌ `.env` usa `VITE_WUZAPI_BASE_URL`
- ❌ `.env.example` usa `VITE_API_URL`
- ❌ Código usa `WUZAPI_BASE_URL` (sem VITE_)

#### Recomendações

**CURTO PRAZO:**

1. **Criar .env.example Completo**
```properties
# ============================================
# WUZAPI Manager - Variáveis de Ambiente
# ============================================

# ----------------
# API Configuration
# ----------------
# URL base da API WUZAPI externa
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
VITE_WUZAPI_BASE_URL=https://wzapi.wasend.com.br

# Timeout para requisições HTTP (em milissegundos)
REQUEST_TIMEOUT=10000

# ----------------
# Authentication
# ----------------
# Token de administrador da WUZAPI (NUNCA versionar o valor real)
VITE_ADMIN_TOKEN=seu_token_admin_aqui_NUNCA_VERSIONAR

# Token para acesso ao endpoint de monitoramento (opcional)
MONITORING_TOKEN=seu_token_monitoring_aqui

# ----------------
# Server Configuration
# ----------------
# Ambiente de execução (development, production, test)
NODE_ENV=development

# Porta do servidor backend
PORT=3001

# Origens permitidas para CORS (separadas por vírgula)
CORS_ORIGINS=http://localhost:3000,http://localhost:4173

# ----------------
# Database Configuration (SQLite)
# ----------------
# Caminho do arquivo do banco de dados
SQLITE_DB_PATH=./server/wuzapi.db

# Habilitar modo WAL (Write-Ahead Logging)
SQLITE_WAL_MODE=true

# Timeout para operações de banco (em milissegundos)
SQLITE_TIMEOUT=5000

# Tamanho do cache (em páginas, -8000 = 8MB)
SQLITE_CACHE_SIZE=8000

# Modo de sincronização (OFF, NORMAL, FULL)
SQLITE_SYNCHRONOUS=NORMAL

# Modo de journal (DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF)
SQLITE_JOURNAL_MODE=WAL

# ----------------
# External Database Configuration (opcional)
# ----------------
# Timeout para requisições NocoDB (em milissegundos)
NOCODB_TIMEOUT=15000

# ----------------
# Logging Configuration
# ----------------
# Nível de log (debug, info, warn, error)
LOG_LEVEL=info

# Formato de log (json, text)
LOG_FORMAT=json

# Diretório para arquivos de log
LOG_DIR=./logs

# ----------------
# Alerting Configuration (opcional)
# ----------------
# Webhook do Slack para alertas
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Webhook do Discord para alertas
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR/WEBHOOK/URL

# Configuração SMTP para alertas por email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@example.com
SMTP_PASS=sua_senha_smtp
ALERT_EMAIL_TO=admin@example.com

# ----------------
# Development Configuration
# ----------------
# Habilitar modo de desenvolvimento
VITE_DEV_MODE=true

# Nome da aplicação (fallback quando branding não configurado)
VITE_APP_NAME=WhatsApp Manager
```

2. **Criar Documentação de Variáveis**
```markdown
# docs/ENVIRONMENT_VARIABLES.md

## Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição | Exemplo | Padrão |
|----------|-----------|---------|--------|
| `WUZAPI_BASE_URL` | URL da API WuzAPI | `https://wzapi.wasend.com.br` | - |
| `VITE_ADMIN_TOKEN` | Token administrativo | `abc123...` | ❌ SEM PADRÃO |

### Opcionais

| Variável | Descrição | Exemplo | Padrão |
|----------|-----------|---------|--------|
| `PORT` | Porta do servidor | `3001` | `3001` |
| `NODE_ENV` | Ambiente | `production` | `development` |
...
```

---

## 4.5 Revisão de Logging para Exposição de Dados Sensíveis

### Descoberta: TOKENS MASCARADOS ADEQUADAMENTE

**Status:** ✅ CONFORME  
**Severidade:** N/A  
**Requisito:** 3.5

#### Análise

O sistema implementa **mascaramento adequado** de tokens e dados sensíveis nos logs.

#### Evidências

**Mascaramento de Tokens:**
```javascript
// server/validators/sessionValidator.js
_maskToken(token) {
  if (!token || typeof token !== 'string') {
    return 'INVALID_TOKEN';
  }
  
  if (token.length <= 8) {
    return token.substring(0, 4) + '...';
  }
  
  return token.substring(0, 8) + '...';  // ✅ Apenas 8 primeiros caracteres
}

// Uso nos logs
logger.info('Token validado', {
  token_prefix: this._maskToken(token)  // ✅ Mascarado
});
```

**Exemplos de Logs Seguros:**
```javascript
// ✅ BOM - Token mascarado
logger.info('Validação de token', {
  token_prefix: userToken.substring(0, 8) + '...'
});

// ✅ BOM - Webhook mascarado
logger.info('Webhook configurado', {
  webhook: webhook.substring(0, 20) + '...'
});

// ✅ BOM - Sem dados sensíveis
logger.info('Usuário autenticado', {
  userId: userId,
  connected: true
});
```

#### Pontos Fortes

1. ✅ **Tokens Mascarados** - Apenas primeiros 8 caracteres logados
2. ✅ **Função Centralizada** - `_maskToken()` reutilizada
3. ✅ **Webhooks Mascarados** - URLs truncadas nos logs
4. ✅ **Sem Senhas** - Nenhuma senha logada
5. ✅ **Logging Estruturado** - JSON format facilita análise

#### Recomendações

**OPCIONAL (Melhorias):**

1. **Criar Utilitário de Mascaramento Centralizado**
```javascript
// server/utils/maskSensitiveData.js
class SensitiveDataMasker {
  maskToken(token) {
    if (!token || typeof token !== 'string') return 'INVALID';
    return token.substring(0, 8) + '...';
  }
  
  maskEmail(email) {
    if (!email || !email.includes('@')) return 'INVALID';
    const [user, domain] = email.split('@');
    return `${user.substring(0, 2)}***@${domain}`;
  }
  
  maskUrl(url) {
    if (!url) return 'INVALID';
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}/***`;
    } catch {
      return url.substring(0, 20) + '...';
    }
  }
  
  maskPhone(phone) {
    if (!phone) return 'INVALID';
    return phone.substring(0, 4) + '***' + phone.substring(phone.length - 2);
  }
}

module.exports = new SensitiveDataMasker();
```

2. **Adicionar Sanitização Automática no Logger**
```javascript
// server/utils/logger.js
log(level, message, metadata = {}) {
  // Sanitizar metadata automaticamente
  const sanitized = this.sanitizeMetadata(metadata);
  
  // ... resto do código
}

sanitizeMetadata(metadata) {
  const sensitive = ['password', 'token', 'secret', 'apiKey'];
  const sanitized = { ...metadata };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '***REDACTED***';
    }
  }
  
  return sanitized;
}
```

---

## 📊 Resumo de Descobertas

### Problemas Críticos

1. ❌ **Token admin hardcoded como fallback** (4.1)
   - Severidade: ALTA
   - Impacto: Acesso administrativo comprometido
   - Esforço: 1 hora

2. ❌ **Token admin no arquivo .env** (4.1)
   - Severidade: ALTA
   - Impacto: Credenciais expostas se versionado
   - Esforço: 30 minutos

### Problemas de Média Prioridade

3. ⚠️ **Container pode rodar como root** (4.2)
   - Severidade: MÉDIA
   - Impacto: Privilégios elevados desnecessários
   - Esforço: 1 hora

4. ⚠️ **Documentação de variáveis incompleta** (4.4)
   - Severidade: BAIXA
   - Impacto: Dificuldade de configuração
   - Esforço: 2 horas

### Pontos Fortes

5. ✅ **CORS bem configurado** (4.3)
6. ✅ **Tokens mascarados nos logs** (4.5)
7. ✅ **Uso de variáveis de ambiente** (4.1)

---

## 🎯 Plano de Ação

### Fase 1: IMEDIATO (Hoje)

**Prioridade:** 🔴 CRÍTICA

- [ ] Remover token hardcoded de todos os arquivos
- [ ] Gerar novo token administrativo
- [ ] Atualizar .env com novo token
- [ ] Adicionar .env ao .gitignore
- [ ] Remover .env do histórico Git (se versionado)
- [ ] Atualizar docker-swarm-stack.yml com novo token
- [ ] Fazer deploy com novo token

**Tempo Estimado:** 1-2 horas

### Fase 2: Curto Prazo (Esta Semana)

**Prioridade:** 🟡 ALTA

- [ ] Adicionar usuário não-root no Docker
- [ ] Remover exposição direta de porta 3001
- [ ] Adicionar security options no Docker
- [ ] Criar .env.example completo
- [ ] Criar documentação de variáveis
- [ ] Testar configuração Docker atualizada

**Tempo Estimado:** 3-4 horas

### Fase 3: Médio Prazo (Este Mês)

**Prioridade:** 🟢 MÉDIA

- [ ] Implementar utilitário de mascaramento centralizado
- [ ] Adicionar sanitização automática no logger
- [ ] Implementar validação de protocolo HTTPS no CORS
- [ ] Adicionar rate limiting por origem
- [ ] Configurar read-only filesystem no Docker

**Tempo Estimado:** 4-6 horas

---

## 📋 Checklist de Segurança

### Gerenciamento de Segredos
- [ ] Sem segredos hardcoded
- [x] Uso de variáveis de ambiente
- [ ] .env no .gitignore
- [ ] .env não versionado
- [ ] Tokens rotacionados regularmente

### Configuração Docker
- [x] Limites de recursos configurados
- [x] Health check implementado
- [ ] Usuário não-root especificado
- [ ] Security options configuradas
- [ ] Capabilities mínimas

### CORS
- [x] Whitelist de origens
- [x] Validação de origem
- [x] Credentials seguro
- [x] Logging de tentativas
- [ ] Validação de protocolo HTTPS

### Logging
- [x] Tokens mascarados
- [x] Sem senhas logadas
- [x] Logging estruturado
- [ ] Sanitização automática
- [x] Níveis de log apropriados

### Documentação
- [ ] .env.example completo
- [ ] Documentação de variáveis
- [ ] Exemplos de configuração
- [ ] Guia de deployment

---

## 🔗 Código de Correção

### Remover Token Hardcoded

**Arquivos a Modificar:**

1. `server/routes/landingPageRoutes.js`
2. `server/routes/index.js`
3. `server/index.js`

**Mudança:**
```javascript
// ANTES (INSEGURO) ❌
const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';

// DEPOIS (SEGURO) ✅
const adminToken = process.env.VITE_ADMIN_TOKEN;

if (!adminToken) {
  logger.error('❌ VITE_ADMIN_TOKEN não configurado - acesso administrativo desabilitado');
  return res.status(500).json({
    success: false,
    error: 'Configuração de servidor inválida',
    code: 'MISSING_ADMIN_TOKEN'
  });
}
```

### Atualizar Docker para Usuário Não-Root

**Arquivo:** `docker-swarm-stack.yml`

```yaml
services:
  wuzapi-manager:
    image: heltonfraga/wuzapi-manager:v1.2.7-multiarch
    user: "node:node"  # ADICIONAR ESTA LINHA
    security_opt:      # ADICIONAR ESTAS LINHAS
      - no-new-privileges:true
    cap_drop:
      - ALL
    # ... resto da configuração
```

---

## ✅ Conclusão

O sistema possui **boas práticas** de uso de variáveis de ambiente e CORS, mas tem uma **vulnerabilidade crítica**: token administrativo hardcoded.

**Prioridade Máxima:** Remover token hardcoded e rotacionar credenciais (1-2 horas).

**Status da Auditoria:** ✅ COMPLETA  
**Próxima Ação:** Remover token hardcoded IMEDIATAMENTE  
**Responsável:** Equipe de Desenvolvimento Backend  
**Prazo:** HOJE

---

*Fim do Relatório de Auditoria de Ambiente e Segredos*
