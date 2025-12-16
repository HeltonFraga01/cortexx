# Monitoramento - WUZAPI Manager

Este documento descreve o sistema completo de monitoramento do WUZAPI Manager, incluindo logging, métricas, alertas e dashboards.

## 🔍 Visão Geral

O sistema de monitoramento inclui:

- **Logging estruturado** em formato JSON
- **Métricas Prometheus** para performance e negócio
- **Alertas automáticos** baseados em regras
- **Dashboards Grafana** para visualização
- **Health checks** robustos
- **Instrumentação** de APIs externas e banco de dados

## 📊 Componentes

### 1. Sistema de Logging

**Localização**: `server/utils/logger.js`

**Características**:
- Logs estruturados em JSON
- Múltiplos níveis: debug, info, warn, error, fatal
- Rotação automática diária
- Logs separados por tipo (geral, erro, acesso)
- Contexto enriquecido com metadados

**Configuração**:
```bash
# Variáveis de ambiente
LOG_LEVEL=info          # debug, info, warn, error, fatal
LOG_FORMAT=json         # json ou text
LOG_DIR=./logs          # Diretório dos logs
```

**Uso**:
```javascript
const { logger } = require('./utils/logger');

logger.info('Operação realizada', { userId: 123, action: 'create' });
logger.error('Falha na operação', { error: error.message, stack: error.stack });
logger.performance('database_query', 150, { table: 'users' });
logger.security('Login attempt', { ip: '192.168.1.1', success: false });
```

### 2. Sistema de Métricas

**Localização**: `server/utils/metrics.js`

**Tipos de Métricas**:
- **Contadores**: Requisições HTTP, erros, queries de banco
- **Histogramas**: Tempo de resposta, latência de APIs
- **Gauges**: Uso de memória, conexões ativas

**Métricas Coletadas**:
```
# HTTP
http_requests_total{method, route, status_code}
http_errors_total{method, route, status_code}
http_request_duration_ms{method, route}

# Banco de Dados
database_queries_total{operation, success}
database_query_duration_ms{operation}

# APIs Externas
wuzapi_requests_total{endpoint, success, status_code}
wuzapi_request_duration_ms{endpoint}
nocodb_requests_total{operation, success}

# Sistema
nodejs_memory_usage_bytes{type}
nodejs_process_uptime_seconds
```

**Endpoints**:
- `/metrics` - Métricas Prometheus
- `/metrics/summary` - Resumo em JSON

### 3. Sistema de Alertas

**Localização**: `server/utils/alerts.js`

**Regras Padrão**:
- Alta taxa de erro HTTP (>10%)
- Tempo de resposta alto (P95 >2s)
- Uso alto de memória (>85%)
- Falhas de banco de dados (>5%)
- Falhas integração WUZAPI (>15%)
- Aplicação não responsiva

**Canais de Notificação**:
- **Log**: Sempre ativo
- **Slack**: Se `SLACK_WEBHOOK_URL` configurado
- **Discord**: Se `DISCORD_WEBHOOK_URL` configurado
- **Email**: Se SMTP configurado

**Configuração**:
```bash
# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@company.com
SMTP_PASS=password
ALERT_EMAIL_TO=admin@company.com
```

### 4. Health Checks

**Endpoints**:
- `/health` - Health check básico
- `/health/detailed` - Health check detalhado com autenticação

**Verificações**:
- Status da aplicação
- Conectividade com banco de dados
- Uso de memória
- Integridade do banco SQLite
- Espaço em disco
- Conectividade com APIs externas

### 5. Instrumentação

**Banco de Dados** (`server/utils/database-instrumentation.js`):
- Métricas de performance para todas as queries
- Detecção de queries lentas
- Relatórios de saúde do banco

**APIs Externas** (`server/utils/external-api-instrumentation.js`):
- Instrumentação automática do Axios
- Métricas de latência e erro
- Sanitização de dados sensíveis

## 🚀 Configuração

### 1. Desenvolvimento Local

```bash
# Iniciar com monitoramento básico
npm run dev

# Iniciar com Prometheus e Grafana
docker-compose --profile monitoring up -d
```

### 2. Produção

```bash
# Deploy com monitoramento completo
./scripts/deploy.sh production v1.2.2

# Verificar status do monitoramento
curl http://localhost:3001/alerts/status
```

### 3. Configuração do Prometheus

**Arquivo**: `monitoring/prometheus.yml`

```yaml
scrape_configs:
  - job_name: 'wuzapi-manager'
    static_configs:
      - targets: ['localhost:3001']
    scrape_interval: 15s
    metrics_path: /metrics
```

### 4. Configuração do Grafana

**Datasource**: Configurado automaticamente via `monitoring/grafana/datasources/`

**Dashboards**: 
- Dashboard principal: `monitoring/grafana/dashboards/wuzapi-dashboard.json`
- Importar via UI do Grafana ou provisioning automático

## 📈 Dashboards

### Dashboard Principal

**Painéis Incluídos**:
- Taxa de requisições HTTP
- Taxa de erro HTTP
- Tempo de resposta (P50, P90, P95)
- Uso de memória
- Operações de banco de dados
- Integração WUZAPI

**Acesso**: http://grafana.localhost (desenvolvimento) ou URL configurada

### Métricas Customizadas

**Criar métricas de negócio**:
```javascript
const { metrics } = require('./utils/metrics');

// Incrementar contador
metrics.incrementCounter('user_registrations_total', { source: 'web' });

// Observar duração
metrics.observeHistogram('message_processing_duration_ms', 150);

// Definir gauge
metrics.setGauge('active_users', 42);
```

## 🚨 Alertas

### Configuração de Alertas

**Arquivo**: `monitoring/prometheus/rules/wuzapi-alerts.yml`

**Grupos de Alertas**:
- **wuzapi-manager**: Alertas técnicos
- **wuzapi-manager-business**: Alertas de negócio
- **wuzapi-manager-infrastructure**: Alertas de infraestrutura

### Testando Alertas

```bash
# Via API
curl -X POST http://localhost:3001/alerts/test/high_http_error_rate \
  -H "Authorization: Bearer monitoring-token"

# Via interface
# Acesse /alerts/status para ver status dos alertas
```

### Configuração de Notificações

**Slack**:
```bash
export SLACK_WEBHOOK_URL="YOUR_SLACK_WEBHOOK_URL_HERE"
```

**Discord**:
```bash
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/000000000000000000/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

## 🔧 Troubleshooting

### Problemas Comuns

#### Métricas não aparecem no Prometheus

```bash
# Verificar endpoint de métricas
curl http://localhost:3001/metrics

# Verificar configuração do Prometheus
docker-compose logs prometheus

# Verificar conectividade
curl http://prometheus.localhost:9090/targets
```

#### Alertas não disparam

```bash
# Verificar regras de alerta
curl http://prometheus.localhost:9090/api/v1/rules

# Testar alerta manualmente
curl -X POST http://localhost:3001/alerts/test/high_memory_usage

# Verificar logs do sistema de alertas
tail -f logs/app-$(date +%Y-%m-%d).log | grep -i alert
```

#### Logs não são gerados

```bash
# Verificar configuração de logging
echo $LOG_LEVEL $LOG_FORMAT $LOG_DIR

# Verificar permissões do diretório
ls -la logs/

# Testar logging manualmente
curl http://localhost:3001/health
tail -f logs/access-$(date +%Y-%m-%d).log
```

#### Dashboard não carrega dados

```bash
# Verificar datasource do Grafana
curl http://grafana.localhost:3000/api/datasources

# Verificar queries do dashboard
# Acesse Grafana > Dashboard > Panel > Edit > Query

# Verificar conectividade Grafana-Prometheus
docker-compose logs grafana
```

### Comandos de Diagnóstico

```bash
# Status geral do monitoramento
curl http://localhost:3001/alerts/status

# Resumo das métricas
curl http://localhost:3001/metrics/summary

# Health check detalhado
curl http://localhost:3001/health/detailed

# Histórico de alertas
curl http://localhost:3001/alerts/history?limit=10

# Informações do sistema
curl http://localhost:3001/system
```

## 📊 Análise de Performance

### Identificar Gargalos

**Queries Lentas**:
```bash
# Via API
curl http://localhost:3001/metrics/summary | jq '.histograms | to_entries | map(select(.key | contains("database"))) | sort_by(.value.p95) | reverse'

# Via logs
grep "Slow database query" logs/app-*.log
```

**APIs Externas Lentas**:
```bash
# Via métricas
curl http://localhost:3001/metrics | grep wuzapi_request_duration

# Via logs
grep "Slow external API" logs/app-*.log
```

**Alto Uso de Memória**:
```bash
# Via métricas
curl http://localhost:3001/metrics | grep nodejs_memory

# Via health check
curl http://localhost:3001/health/detailed | jq '.process.memory'
```

### Otimização Baseada em Métricas

**Identificar Endpoints Mais Usados**:
```bash
curl http://localhost:3001/metrics | grep http_requests_total | sort -k2 -nr
```

**Analisar Padrões de Erro**:
```bash
curl http://localhost:3001/metrics | grep http_errors_total
```

**Monitorar Tendências**:
- Use Grafana para visualizar tendências ao longo do tempo
- Configure alertas para mudanças significativas
- Analise correlações entre diferentes métricas

## 🔐 Segurança

### Proteção de Endpoints

**Token de Monitoramento**:
```bash
export MONITORING_TOKEN="secure-monitoring-token-123"
```

**Endpoints Protegidos**:
- `/metrics/summary`
- `/alerts/status`
- `/alerts/history`
- `/alerts/test/*`
- `/health/detailed`
- `/system`

### Sanitização de Dados

**Logs**:
- Tokens e senhas são automaticamente removidos
- IPs são mascarados em produção
- Dados sensíveis são truncados

**Métricas**:
- URLs são sanitizadas (query params sensíveis removidos)
- Headers de autenticação não são expostos
- Dados de payload não são incluídos

## 📚 Referências

### Documentação Relacionada

- [Deploy Automatizado](DEPLOY.md)
- [Configuração Docker](DOCKER.md)
- [Arquitetura do Sistema](../README-ARCHITECTURE.md)

### Ferramentas Externas

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Node.js Monitoring Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

### Métricas de Referência

**SLIs Recomendados**:
- **Disponibilidade**: >99.9%
- **Latência P95**: <2000ms
- **Taxa de Erro**: <1%
- **Throughput**: Baseado no uso esperado

**SLOs Sugeridos**:
- Health check responde em <500ms
- APIs externas respondem em <5s
- Uso de memória <80%
- Espaço em disco >20% livre

---

Para suporte adicional com monitoramento, consulte os logs da aplicação ou abra uma issue no repositório.