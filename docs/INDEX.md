# Índice de Documentação - WUZAPI Manager

Este diretório contém toda a documentação técnica do projeto, organizada por categoria.

---

## 📋 Documentação Principal

### Configuração
- **[CONFIGURATION.md](CONFIGURATION.md)** - Guia completo de configuração de variáveis de ambiente
- **[DOCKER.md](DOCKER.md)** - Configuração Docker
- **[DOCKER_DATABASE_CONFIG.md](DOCKER_DATABASE_CONFIG.md)** - Configuração de banco de dados Docker

### Desenvolvimento
- **[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)** - Guia de desenvolvimento
- **[QUALITY_CHECKLIST.md](QUALITY_CHECKLIST.md)** - Checklist de qualidade
- **[CLI_GENERATOR_GUIDE.md](CLI_GENERATOR_GUIDE.md)** - Gerador de código CLI

### Troubleshooting
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - 🔧 Guia completo de solução de problemas (Docker, Traefik, Auth, DB, Performance)
- **[TRAEFIK_404_FIX.md](TRAEFIK_404_FIX.md)** - ⚡ Fix rápido para erro 404 do Traefik (30 segundos)
- **[TRAEFIK_404_FLOWCHART.md](TRAEFIK_404_FLOWCHART.md)** - 🔀 Fluxograma de decisão para erro 404

---

## 🔌 API

Localização: `api/`

- **[README.md](api/README.md)** - Visão geral da API
- **[openapi.yaml](api/openapi.yaml)** - Especificação OpenAPI
- **[error-codes.md](api/error-codes.md)** - Códigos de erro
- **[examples.md](api/examples.md)** - Exemplos de uso
- **[MESSAGE_VARIATIONS_API.md](api/MESSAGE_VARIATIONS_API.md)** - API de variações de mensagem
- **[PHONE_VALIDATION.md](api/PHONE_VALIDATION.md)** - Sistema de validação de telefone

---

## 🚀 Deploy

- **[DEPLOY.md](DEPLOY.md)** - Guia geral de deploy
- **[DEPLOYMENT_SCRIPTS.md](DEPLOYMENT_SCRIPTS.md)** - 🚀 Guia completo dos scripts de deploy e diagnóstico
- **[DOCKER_SWARM_CHEATSHEET.md](DOCKER_SWARM_CHEATSHEET.md)** - 📋 Cheat sheet de comandos Docker Swarm
- **[NETWORK_ARCHITECTURE.md](NETWORK_ARCHITECTURE.md)** - 🌐 Arquitetura de rede (rede única)
- **[DOCKER_QUICK_START.md](../DOCKER_QUICK_START.md)** - Quick start Docker (raiz)

---

## 📚 Guias

Localização: `guides/`

- **[ESPECIFICACAO_PRODUTO.md](guides/ESPECIFICACAO_PRODUTO.md)** - Especificação do produto
- **[PROJECT_STRUCTURE.md](guides/PROJECT_STRUCTURE.md)** - Estrutura do projeto
- **[QUICK_REFERENCE.md](guides/QUICK_REFERENCE.md)** - Referência rápida
- **[WUZAPI_WEBHOOK_EVENTS.md](guides/WUZAPI_WEBHOOK_EVENTS.md)** - Eventos de webhook WUZAPI
- **[TESTE_IMPORTACAO_CONTATOS.md](guides/TESTE_IMPORTACAO_CONTATOS.md)** - Testes de importação

---

## 🔗 Integrações

### NocoDB
Localização: `nocodb/`

- **[README.md](nocodb/README.md)** - Visão geral
- **[integration-guide.md](nocodb/integration-guide.md)** - Guia de integração
- **[configuration-guide.md](nocodb/configuration-guide.md)** - Configuração
- **[crud-operations-guide.md](nocodb/crud-operations-guide.md)** - Operações CRUD
- **[field-mapping-guide.md](nocodb/field-mapping-guide.md)** - Mapeamento de campos

### WUZAPI
Localização: `wuzapi/`

- **[README.md](wuzapi/README.md)** - Visão geral
- **[integration-guide.md](wuzapi/integration-guide.md)** - Guia de integração
- **[documentacao-completa-api.md](wuzapi/documentacao-completa-api.md)** - Documentação completa
- **[guia-pratico-implementacao.md](wuzapi/guia-pratico-implementacao.md)** - Guia prático
- **[troubleshooting.md](wuzapi/troubleshooting.md)** - Solução de problemas

---

## 📦 Releases

Localização: `releases/`

Notas de release por versão:
- **[RELEASE_NOTES_v1.5.10.md](releases/RELEASE_NOTES_v1.5.10.md)** - v1.5.10
- **[RELEASE_NOTES_v1.5.9.md](releases/RELEASE_NOTES_v1.5.9.md)** - v1.5.9
- **[RELEASE_NOTES_v1.5.8.md](releases/RELEASE_NOTES_v1.5.8.md)** - v1.5.8
- **[RELEASE_NOTES_v1.5.1.md](releases/RELEASE_NOTES_v1.5.1.md)** - v1.5.1
- **[RELEASE_NOTES_v1.5.0.md](releases/RELEASE_NOTES_v1.5.0.md)** - v1.5.0

---

## 🎨 Frontend

- **[FRONTEND_COMPONENTS_GUIDE.md](FRONTEND_COMPONENTS_GUIDE.md)** - Guia de componentes
- **[FRONTEND_DOMAIN_ORGANIZATION_GUIDE.md](FRONTEND_DOMAIN_ORGANIZATION_GUIDE.md)** - Organização por domínio
- **[DESIGN_SYSTEM_GUIDE.md](DESIGN_SYSTEM_GUIDE.md)** - Design system
- **[THEME_COLORS.md](THEME_COLORS.md)** - Cores e temas
- **[ACCESSIBILITY_GUIDE.md](ACCESSIBILITY_GUIDE.md)** - Acessibilidade (consolidado)

---

## 🔧 Backend

- **[BACKEND_ROUTES_GUIDE.md](BACKEND_ROUTES_GUIDE.md)** - Guia de rotas
- **[BACKEND_ENDPOINT_TEMPLATES_GUIDE.md](BACKEND_ENDPOINT_TEMPLATES_GUIDE.md)** - Templates de endpoints
- **[BACKEND_DATA_INTEGRATIONS_GUIDE.md](BACKEND_DATA_INTEGRATIONS_GUIDE.md)** - Integrações de dados

---

## 📖 Exemplos

Localização: `examples/`

- **[README.md](examples/README.md)** - Índice de exemplos
- **[message-variations-examples.md](examples/message-variations-examples.md)** - Variações de mensagem
- **[exemplo-integracao-externa.md](examples/exemplo-integracao-externa.md)** - Integração externa
- **[exemplo-notificacoes.md](examples/exemplo-notificacoes.md)** - Notificações
- **[tutorial-grupos.md](examples/tutorial-grupos.md)** - Tutorial de grupos

---

## 📁 Arquivos Arquivados

Localização: `development/archived/`

Documentação histórica de correções já aplicadas:
- Docker authentication fixes
- Cookie fixes
- Cleanup summaries

---

## 🔍 Como Usar Esta Documentação

### Para Desenvolvedores Novos
1. Comece com [README.md](../README.md) na raiz do projeto
2. Leia [CONFIGURATION.md](CONFIGURATION.md) para configurar seu ambiente
3. Consulte [PROJECT_STRUCTURE.md](guides/PROJECT_STRUCTURE.md) para entender a organização

### Para Configuração
1. [CONFIGURATION.md](CONFIGURATION.md) - Guia completo de variáveis de ambiente
2. [QUICK_REFERENCE.md](guides/QUICK_REFERENCE.md) - Comandos rápidos

### Para API
1. [api/README.md](api/README.md) - Visão geral da API
2. [api/PHONE_VALIDATION.md](api/PHONE_VALIDATION.md) - Validação de telefone
3. [api/examples.md](api/examples.md) - Exemplos de uso

### Para Releases
1. [CHANGELOG.md](../CHANGELOG.md) - Changelog principal (raiz do projeto)
2. `releases/` - Notas de release detalhadas por versão

---

**Última atualização:** 2025-12-04  
**Versão:** 1.5.21
