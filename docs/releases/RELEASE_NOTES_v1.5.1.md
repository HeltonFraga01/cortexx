# Release Notes - v1.5.1

**Data de Lançamento:** 2025-11-16  
**Tipo:** Patch Release  
**Compatibilidade:** 100% compatível com v1.5.0

---

## 🎯 Resumo

Versão focada em correções críticas de autenticação e proxy no ambiente Docker, garantindo que a aplicação funcione corretamente tanto em desenvolvimento quanto em produção containerizada.

---

## 🐛 Correções de Bugs

### 1. Autenticação Docker Proxy

**Problema Resolvido:** Após implementar melhorias de segurança com proxy de autenticação, a aplicação WUZAPI Manager falhava ao autenticar quando rodando no Docker.

**Causa Raiz:** 
- Variáveis de ambiente críticas faltando no Docker
- Falta de validação no startup
- Diferenças entre desenvolvimento e produção não documentadas

**Solução Implementada:**
- ✅ Criado arquivo `.env.docker` com TODAS as variáveis necessárias
- ✅ Validação automática de ambiente no startup
- ✅ Servidor falha rápido se configuração inválida
- ✅ Documentação completa das diferenças dev vs Docker

**Impacto:**
- Autenticação funciona perfeitamente em Docker
- Configuração validada antes do servidor iniciar
- Erros detectados imediatamente no startup
- Desenvolvimento e Docker são espelhos

**Arquivos Criados:**
- `.env.docker` - Configuração completa para Docker
- `server/utils/environmentValidator.js` - Validador de variáveis
- `server/utils/wuzapiConnectivityChecker.js` - Verificador de conectividade
- `scripts/docker-build-local.sh` - Script de build com validação
- `scripts/docker-run-local.sh` - Script de execução com health checks

**Arquivos Modificados:**
- `server/index.js` - Validação no startup
- `server/utils/logger.js` - Métodos de logging de autenticação
- `server/utils/securityLogger.js` - Logging detalhado de segurança
- `docker-compose.yml` - Usa `env_file: .env.docker`

### 2. Variáveis de Ambiente Faltantes

**Problema:** Variáveis críticas não estavam configuradas no ambiente Docker.

**Variáveis Adicionadas:**
- `WUZAPI_BASE_URL` - URL do serviço WUZAPI
- `WUZAPI_ADMIN_TOKEN` - Token de autenticação admin
- `SESSION_SECRET` - Secret para sessões
- `CORS_ORIGINS` - Origens permitidas para CORS

**Solução:**
- ✅ Todas as variáveis documentadas em `.env.docker`
- ✅ Validação automática no startup
- ✅ Mensagens de erro claras se faltando

---

## 🔧 Melhorias Técnicas

### 1. Validação de Ambiente

**Novo Componente:** `server/utils/environmentValidator.js`

**Funcionalidades:**
- Valida variáveis obrigatórias no startup
- Verifica formato e valores válidos
- Retorna erros detalhados se configuração inválida
- Previne servidor de iniciar com configuração incorreta

**Variáveis Validadas:**
```javascript
// Obrigatórias
WUZAPI_BASE_URL
CORS_ORIGINS
SESSION_SECRET
WUZAPI_ADMIN_TOKEN

// Opcionais com defaults
PORT (default: 3001)
NODE_ENV (default: development)
SQLITE_DB_PATH (default: ./wuzapi.db)
LOG_LEVEL (default: info)
```

### 2. Verificação de Conectividade WUZAPI

**Novo Componente:** `server/utils/wuzapiConnectivityChecker.js`

**Funcionalidades:**
- Verifica conectividade com serviço WUZAPI no startup
- Testa autenticação com token configurado
- Reporta status no health check
- Logs detalhados de conectividade

### 3. Logging Aprimorado

**Melhorias em `server/utils/logger.js`:**
- Novos métodos para logging de autenticação
- Sanitização automática de tokens em logs
- Contexto adicional (userId, endpoint, etc.)
- Níveis de log configuráveis

**Melhorias em `server/utils/securityLogger.js`:**
- Logging detalhado de eventos de segurança
- Sanitização de dados sensíveis
- Rastreamento de tentativas de autenticação
- Auditoria de acessos

### 4. Health Check Melhorado

**Endpoint:** `GET /health`

**Verificações Adicionadas:**
```json
{
  "status": "ok",
  "configuration": {
    "valid": true,
    "errors": [],
    "warnings": []
  },
  "database": {
    "status": "connected"
  },
  "wuzapi": {
    "status": "connected"
  },
  "session_store": {
    "status": "connected"
  }
}
```

**Benefícios:**
- Diagnóstico completo do sistema
- Detecta problemas de configuração
- Verifica todas as dependências
- Útil para monitoramento e troubleshooting

### 5. Scripts de Build e Execução

**Novo:** `scripts/docker-build-local.sh`
- Build local com validação
- Verifica pré-requisitos
- Cria imagem otimizada
- Reporta tamanho e layers

**Novo:** `scripts/docker-run-local.sh`
- Execução local com health checks
- Monta volumes corretamente
- Aguarda inicialização completa
- Testa conectividade

---

## 📝 Documentação

### Novos Documentos

1. **`docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md`**
   - Resumo completo da correção
   - Problema, solução e testes
   - Comparação dev vs Docker
   - Guia de uso e troubleshooting

2. **`docs/DOCKER_AUTHENTICATION_TROUBLESHOOTING.md`**
   - Guia completo de troubleshooting
   - Problemas comuns e soluções
   - Comandos de diagnóstico
   - Verificação passo-a-passo

3. **`docs/DEVELOPMENT_VS_DOCKER.md`**
   - Diferenças entre ambientes
   - Configuração específica de cada
   - Quando usar cada ambiente
   - Troubleshooting específico

4. **`.env.docker`**
   - Arquivo de configuração completo
   - Todas as variáveis necessárias
   - Comentários explicativos
   - Valores de exemplo

---

## 📊 Estatísticas

### Arquivos Criados
- **Utilitários:** 2 arquivos (environmentValidator.js, wuzapiConnectivityChecker.js)
- **Scripts:** 2 arquivos (docker-build-local.sh, docker-run-local.sh)
- **Configuração:** 1 arquivo (.env.docker)
- **Documentação:** 3 arquivos
- **Total:** 8 arquivos novos

### Arquivos Modificados
- **Backend:** 3 arquivos (index.js, logger.js, securityLogger.js)
- **Docker:** 1 arquivo (docker-compose.yml)
- **Total:** 4 arquivos modificados

### Bugs Corrigidos
- **Críticos:** 2 (autenticação Docker, variáveis faltantes)
- **Impacto:** Alta prioridade - bloqueava uso em produção

### Melhorias Implementadas
- **Validação:** Ambiente validado no startup
- **Logging:** Logs sanitizados e detalhados
- **Health Check:** Verificação completa do sistema
- **Scripts:** Automação de build e execução
- **Documentação:** Guias completos de uso e troubleshooting

---

## 🔄 Migração

### Compatibilidade

✅ **100% compatível** com v1.5.0
- Sem mudanças no banco de dados
- Sem mudanças na API
- Sem mudanças em variáveis de ambiente existentes
- Sem breaking changes
- Apenas adições de validação e logging

### Atualização

#### Docker Swarm
```bash
# Atualizar serviço existente (rolling update, zero downtime)
docker service update --image heltonfraga/wuzapi-manager:v1.5.1 wuzapi-manager_wuzapi-manager

# Verificar status do update
docker service ps wuzapi-manager_wuzapi-manager

# Verificar logs
docker service logs wuzapi-manager_wuzapi-manager -f --tail 100
```

#### Docker Compose
```bash
# Atualizar docker-compose.yml com a nova versão
# image: heltonfraga/wuzapi-manager:v1.5.1

# Depois executar:
docker-compose pull
docker-compose up -d

# Verificar logs
docker-compose logs -f --tail 100
```

#### Teste Local
```bash
# Pull da imagem
docker pull heltonfraga/wuzapi-manager:v1.5.1

# Executar localmente
docker run -d \
  --name wuzapi-manager-test \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  -e WUZAPI_BASE_URL=http://wuzapi:8080 \
  -e WUZAPI_ADMIN_TOKEN=seu-token-admin \
  -e SESSION_SECRET=seu-secret \
  -e CORS_ORIGINS=http://localhost:8080 \
  heltonfraga/wuzapi-manager:v1.5.1

# Verificar logs
docker logs -f wuzapi-manager-test

# Testar health check
curl http://localhost:8080/health

# Limpar
docker stop wuzapi-manager-test
docker rm wuzapi-manager-test
```

### Rollback

Se necessário, voltar para v1.5.0:

```bash
docker service update --image heltonfraga/wuzapi-manager:v1.5.0 wuzapi-manager_wuzapi-manager
```

---

## ✅ Testes Recomendados

### Startup e Configuração

1. **Validação de Ambiente**
   - [ ] Servidor inicia sem erros
   - [ ] Logs mostram "✅ Validação de ambiente concluída com sucesso"
   - [ ] Todas as variáveis obrigatórias presentes
   - [ ] Servidor falha se variável crítica faltando

2. **Health Check**
   - [ ] `/health` retorna 200 OK
   - [ ] Configuração reportada como válida
   - [ ] Database status: connected
   - [ ] WUZAPI status: connected
   - [ ] Session store status: connected

### Autenticação

1. **Login Admin**
   - [ ] Login com token admin funciona
   - [ ] Sessão criada corretamente
   - [ ] Token sanitizado em logs
   - [ ] Acesso a rotas admin permitido

2. **Login User**
   - [ ] Login com token user funciona
   - [ ] Dados do usuário carregados do WUZAPI
   - [ ] Sessão criada corretamente
   - [ ] Acesso a rotas user permitido

3. **Rejeição de Token Inválido**
   - [ ] Token inválido rejeitado
   - [ ] Mensagem de erro apropriada
   - [ ] Tentativa logada corretamente
   - [ ] Sem exposição de informações sensíveis

### Funcionalidades Gerais

- [ ] Dashboard carrega normalmente
- [ ] Envio de mensagens funciona
- [ ] Webhooks funcionam
- [ ] Integrações funcionam
- [ ] SQLite WAL mode ativo
- [ ] Dados persistem após restart
- [ ] Logs não mostram erros críticos

---

## 🎯 Próximas Versões

### v1.6.0 (Planejado)

- Sistema de agendamento de mensagens
- Variações de mensagem (humanização)
- Cores dinâmicas de tema
- Melhorias de responsividade mobile
- Dashboard de analytics

---

## 📞 Suporte

### Documentação

- **Índice:** `docs/INDEX.md`
- **Release Notes:** `docs/releases/RELEASE_NOTES_v1.5.1.md`
- **Configuração:** `docs/CONFIGURATION.md`
- **Deployment:** `DEPLOY_v1.5.1.md`
- **Docker Auth Fix:** `docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md`
- **Troubleshooting:** `docs/DOCKER_AUTHENTICATION_TROUBLESHOOTING.md`

### Logs Úteis

```bash
# Logs gerais
docker service logs wuzapi-manager_wuzapi-manager --tail 200

# Logs de erro
docker service logs wuzapi-manager_wuzapi-manager 2>&1 | grep -i error

# Logs de autenticação
docker service logs wuzapi-manager_wuzapi-manager 2>&1 | grep -i "auth\|login\|token"

# Logs de validação
docker service logs wuzapi-manager_wuzapi-manager 2>&1 | grep -i "validat\|environment"

# Logs de WUZAPI
docker service logs wuzapi-manager_wuzapi-manager 2>&1 | grep -i wuzapi
```

### Comandos Úteis

```bash
# Status do serviço
docker service ps wuzapi-manager_wuzapi-manager

# Inspecionar serviço
docker service inspect wuzapi-manager_wuzapi-manager

# Verificar variáveis de ambiente
docker exec $(docker ps -q -f name=wuzapi-manager) env | grep -E "WUZAPI|SESSION|CORS"

# Verificar health check
docker exec $(docker ps -q -f name=wuzapi-manager) curl -s http://localhost:3001/health

# Restart
docker service update --force wuzapi-manager_wuzapi-manager
```

---

## 👥 Contribuidores

- Helton Fraga (@heltonfraga)
- Kiro AI Assistant

---

**Status:** ✅ Pronto para Produção  
**Recomendação:** Atualização recomendada para todos os usuários, especialmente aqueles usando Docker

