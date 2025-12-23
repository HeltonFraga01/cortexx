# 🚀 Referência Rápida - WUZAPI Manager

## 📖 Documentação Essencial

### 🎯 Começando
- [README Principal](./README.md) - Visão geral do projeto
- [Estrutura do Projeto](./PROJECT_STRUCTURE.md) - Organização completa
- [Guia de Contribuição](./CONTRIBUTING.md) - Como contribuir

### 🚀 Deploy & Operação
- [Deploy v1.3.2](./docs/deployment/DEPLOY_v1.3.2_SUCCESS.md) - Guia completo
- [Comandos Rápidos](./docs/deployment/COMANDOS_RAPIDOS_v1.3.2.md) - Referência
- [Resumo Deploy](./docs/deployment/RESUMO_DEPLOY_v1.3.2.md) - Executivo

### 🔧 Desenvolvimento
- [Guia de Desenvolvimento](./docs/DEVELOPMENT_GUIDE.md) - Setup e workflow
- [Correção de Bugs](./docs/development/FIX_EDIT_RECORD_BUG.md) - Última correção
- [Gerador CLI](./docs/CLI_GENERATOR_GUIDE.md) - Geração de código

### 📦 Releases
- [Changelog v1.3.2](./docs/releases/CHANGELOG_v1.3.2.md) - Versão atual
- [Release Notes](./docs/releases/RELEASE_NOTES_v1.3.1.md) - Notas

## 🐳 Docker

### Build Multi-Arquitetura
```bash
./deploy-multiarch.sh v1.3.2
```

### Pull da Imagem
```bash
docker pull heltonfraga/wuzapi-manager:v1.3.2
```

### Deploy no Swarm
```bash
docker service update --image heltonfraga/wuzapi-manager:v1.3.2 wuzapi-manager_wuzapi-manager
```

### Teste Local
```bash
./test-docker-v1.3.2.sh
```

## 🔍 Comandos Úteis

### Logs
```bash
docker service logs wuzapi-manager_wuzapi-manager -f
```

### Health Check
```bash
curl http://localhost:3001/health
```

### Status do Serviço
```bash
docker service ps wuzapi-manager_wuzapi-manager
```

### Backup do Banco
```bash
docker exec $(docker ps -q -f name=wuzapi-manager) \
  sqlite3 /app/data/wuzapi.db ".backup /app/data/backup-$(date +%Y%m%d).db"
```

## 🛠️ Desenvolvimento

### Instalar Dependências
```bash
npm install
npm run server:install
```

### Desenvolvimento Local
```bash
npm run dev:full
```

### Build de Produção
```bash
npm run build:production
```

### Testes
```bash
npm run test:run          # Testes unitários
npm run test:e2e          # Testes E2E
cd server && npm test     # Testes backend
```

### Gerar Código
```bash
npm run generate component admin/NewComponent
npm run generate route newRoute
npm run generate hook useNewHook
```

## 📚 Documentação por Categoria

### API
- [API README](./docs/api/README.md)
- [Códigos de Erro](./docs/api/error-codes.md)
- [Exemplos](./docs/api/examples.md)

### NocoDB
- [Guia de Integração](./docs/nocodb/integration-guide.md)
- [Configuração](./docs/nocodb/configuration-guide.md)
- [CRUD Operations](./docs/nocodb/crud-operations-guide.md)

### WUZAPI
- [Guia de Integração](./docs/wuzapi/integration-guide.md)
- [Comparação Evolution API](./docs/wuzapi/evolution-api-comparison.md)
- [Troubleshooting](./docs/wuzapi/troubleshooting.md)

### Exemplos
- [Integração Externa](./docs/examples/exemplo-integracao-externa.md)
- [Notificações](./docs/examples/exemplo-notificacoes.md)
- [Tela Administrativa](./docs/examples/exemplo-tela-administrativa.md)

## 🔐 Segurança

### Scan de Segurança
```bash
npm run security:scan
```

### Audit
```bash
npm audit
```

### Lint de Segurança
```bash
npm run lint:security
```

## 📊 Monitoramento

### Métricas
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

### Logs
```bash
# Logs da aplicação
tail -f logs/app-$(date +%Y-%m-%d).log

# Logs de erro
tail -f logs/error-$(date +%Y-%m-%d).log
```

## 🆘 Troubleshooting

### Problemas Comuns
- [Troubleshooting Geral](./docs/TROUBLESHOOTING.md)
- [WUZAPI Troubleshooting](./docs/wuzapi/troubleshooting.md)
- [FAQ](./docs/FAQ.md)

### Rollback
```bash
docker service update --image heltonfraga/wuzapi-manager:v1.3.1 wuzapi-manager_wuzapi-manager
```

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/heltonfraga/wuzapi-manager/issues)
- **Discussões**: [GitHub Discussions](https://github.com/heltonfraga/wuzapi-manager/discussions)

## 🔗 Links Importantes

- [Especificação do Produto](./ESPECIFICACAO_PRODUTO.md)
- [Webhook Events](./WUZAPI_WEBHOOK_EVENTS.md)
- [Changelog](./CHANGELOG.md)
- [Organização Concluída](./ORGANIZACAO_CONCLUIDA.md)

---

**Versão**: v1.3.2  
**Última atualização**: 09/11/2024
