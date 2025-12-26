# Runbook de Alertas

Este documento descreve os procedimentos de resposta para cada tipo de alerta do sistema.

## Visão Geral dos Alertas

| Alerta | Severidade | Threshold | Cooldown |
|--------|------------|-----------|----------|
| HIGH_ERROR_RATE | critical | > 1% erros 5xx | 5 min |
| HIGH_LATENCY | warning | P95 > 2s | 5 min |
| REDIS_UNAVAILABLE | critical | Conexão perdida | 5 min |
| SUPABASE_UNAVAILABLE | critical | Conexão perdida | 5 min |
| HIGH_MEMORY_USAGE | warning | > 80% | 5 min |

## Procedimentos de Resposta

### 1. HIGH_ERROR_RATE (Taxa de Erros Alta)

**Descrição**: Taxa de erros HTTP 5xx acima de 1% das requisições.

**Impacto**: Usuários podem estar recebendo erros ao usar a aplicação.

**Diagnóstico**:
```bash
# Verificar logs de erro recentes
npm run docker:logs | grep -i error

# Verificar métricas de erro
curl http://localhost:3000/metrics | grep http_requests_total

# Verificar health check
curl http://localhost:3000/health
```

**Ações**:
1. Verificar logs para identificar a causa raiz
2. Verificar se há problemas de conectividade com serviços externos (Supabase, WUZAPI, Redis)
3. Verificar se há picos de tráfego anormais
4. Se necessário, reiniciar o serviço: `docker service update --force wuzapi-manager`

**Escalação**: Se persistir por mais de 15 minutos, escalar para equipe de infraestrutura.

---

### 2. HIGH_LATENCY (Latência Alta)

**Descrição**: Percentil 95 de latência acima de 2 segundos.

**Impacto**: Experiência do usuário degradada, possíveis timeouts.

**Diagnóstico**:
```bash
# Verificar métricas de latência
curl http://localhost:3000/metrics | grep http_request_duration

# Verificar uso de CPU/memória
docker stats wuzapi-manager

# Verificar conexões Redis
redis-cli info clients
```

**Ações**:
1. Verificar se há queries lentas no Supabase
2. Verificar cache hit rate do Redis
3. Verificar se há operações bloqueantes
4. Considerar escalar recursos se necessário

**Escalação**: Se persistir por mais de 30 minutos, escalar para equipe de desenvolvimento.

---

### 3. REDIS_UNAVAILABLE (Redis Indisponível)

**Descrição**: Conexão com Redis perdida.

**Impacto**: Cache desabilitado, possível degradação de performance. Sistema continua funcionando com fallback.

**Diagnóstico**:
```bash
# Verificar status do Redis
docker ps | grep redis
redis-cli ping

# Verificar logs do Redis
docker logs redis

# Verificar conectividade
telnet redis 6379
```

**Ações**:
1. Verificar se o container Redis está rodando
2. Verificar se há problemas de memória no Redis
3. Reiniciar Redis se necessário: `docker restart redis`
4. Verificar configuração de conexão (host, porta, senha)

**Escalação**: Se não resolver em 10 minutos, escalar para equipe de infraestrutura.

---

### 4. SUPABASE_UNAVAILABLE (Supabase Indisponível)

**Descrição**: Conexão com Supabase perdida.

**Impacto**: **CRÍTICO** - Aplicação não funciona sem banco de dados.

**Diagnóstico**:
```bash
# Verificar health check
curl http://localhost:3000/health

# Verificar conectividade com Supabase
curl -I $SUPABASE_URL

# Verificar logs de erro
npm run docker:logs | grep -i supabase
```

**Ações**:
1. Verificar status do Supabase em https://status.supabase.com
2. Verificar se as credenciais estão corretas
3. Verificar se há problemas de rede/firewall
4. Verificar se o projeto Supabase está ativo

**Escalação**: Escalar imediatamente para equipe de infraestrutura.

---

### 5. HIGH_MEMORY_USAGE (Uso de Memória Alto)

**Descrição**: Uso de memória acima de 80%.

**Impacto**: Risco de OOM (Out of Memory), possível crash do serviço.

**Diagnóstico**:
```bash
# Verificar uso de memória
docker stats wuzapi-manager

# Verificar métricas de memória
curl http://localhost:3000/metrics | grep memory

# Verificar processos
docker exec wuzapi-manager ps aux
```

**Ações**:
1. Verificar se há memory leaks nos logs
2. Verificar se há muitas conexões abertas
3. Considerar reiniciar o serviço para liberar memória
4. Aumentar limite de memória se necessário

**Escalação**: Se uso > 90%, escalar imediatamente.

---

## Configuração de Alertas

### Webhook Discord/Slack

Configure a variável `ALERT_WEBHOOK_URL` com o URL do webhook:

```env
# Discord
ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/xxx/yyy

# Slack
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
```

### Customização de Thresholds

Os thresholds podem ser ajustados em `server/telemetry/alerts.js`:

```javascript
const ALERT_THRESHOLDS = {
  errorRatePercent: 1,      // Taxa de erro máxima (%)
  latencyP95Ms: 2000,       // Latência P95 máxima (ms)
  memoryUsagePercent: 80,   // Uso de memória máximo (%)
};
```

## Contatos de Escalação

| Nível | Responsável | Contato |
|-------|-------------|---------|
| L1 | Equipe de Suporte | suporte@empresa.com |
| L2 | Equipe de Desenvolvimento | dev@empresa.com |
| L3 | Equipe de Infraestrutura | infra@empresa.com |

## Histórico de Incidentes

Mantenha um registro de incidentes para análise posterior:

| Data | Alerta | Duração | Causa Raiz | Ação Tomada |
|------|--------|---------|------------|-------------|
| - | - | - | - | - |
