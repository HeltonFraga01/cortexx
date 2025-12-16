# 📚 Documentação WUZAPI Manager

Documentação técnica e guias do projeto WUZAPI Manager.

## 📁 Estrutura

### 📦 [releases/](./releases/)
Changelogs e notas de lançamento de cada versão.

- `CHANGELOG_v1.3.2.md` - Versão atual (Bug fix: edição de registros)
- `CHANGELOG-v1.3.0.md` - Versão 1.3.0
- `RELEASE_NOTES_v1.3.1.md` - Notas da versão 1.3.1
- `RELEASE_NOTES_v1.2.9.md` - Notas da versão 1.2.9

### 🚀 [deployment/](./deployment/)
Guias de deploy e comandos úteis.

- `DEPLOY_v1.3.2_SUCCESS.md` - Guia de deploy v1.3.2
- `RESUMO_DEPLOY_v1.3.2.md` - Resumo executivo do deploy
- `COMANDOS_RAPIDOS_v1.3.2.md` - Comandos úteis para operação
- `DEPLOY_GUIDE_v1.3.1.md` - Guia de deploy v1.3.1
- `BUILD_AND_DEPLOY_v1.3.1.md` - Build e deploy v1.3.1

### 🔧 [development/](./development/)
Documentação técnica para desenvolvedores.

- `FIX_EDIT_RECORD_BUG.md` - Correção do bug de edição de registros
- `IMPLEMENTATION_COMPLETE_SUMMARY.md` - Resumo de implementações
- `CHANGELOG_MESSAGES_MODERNIZATION.md` - Modernização de mensagens
- `CHANGELOG_USER_DASHBOARD.md` - Mudanças no dashboard
- `CHANGELOG_USER_SETTINGS_MODERNIZATION.md` - Modernização de configurações

### 📦 [archived/](./archived/)
Documentação obsoleta mantida para referência histórica.

## 🔗 Links Rápidos

### Para Usuários
- [README Principal](../README.md) - Visão geral do projeto
- [Guia de Deploy](./deployment/DEPLOY_v1.3.2_SUCCESS.md) - Como fazer deploy
- [Comandos Rápidos](./deployment/COMANDOS_RAPIDOS_v1.3.2.md) - Comandos úteis

### Para Desenvolvedores
- [Contribuindo](../CONTRIBUTING.md) - Como contribuir
- [Especificação do Produto](../ESPECIFICACAO_PRODUTO.md) - Requisitos e funcionalidades
- [Webhook Events](../WUZAPI_WEBHOOK_EVENTS.md) - Eventos do WUZAPI
- [Correções Recentes](./development/FIX_EDIT_RECORD_BUG.md) - Últimas correções

### Para DevOps
- [Docker Build](../deploy-multiarch.sh) - Script de build multi-arch
- [Teste Docker](../test-docker-v1.3.2.sh) - Script de teste
- [Docker Compose](../docker-compose.yml) - Configuração local
- [Swarm Stack](../docker-swarm-stack.yml) - Configuração produção

## 📋 Versão Atual

**v1.3.2** - Bug Fix Release

### Principais Mudanças
- ✅ Correção: Edição de registros específicos
- ✅ Nova rota backend para buscar registro por ID
- ✅ Cache implementado para performance
- ✅ Funciona em tabela, calendário e kanban

### Docker
```bash
docker pull heltonfraga/wuzapi-manager:v1.3.2
```

## 🗂️ Organização de Arquivos

```
docs/
├── README.md                    # Este arquivo
├── releases/                    # Changelogs e release notes
│   ├── CHANGELOG_v1.3.2.md
│   ├── CHANGELOG-v1.3.0.md
│   ├── RELEASE_NOTES_v1.3.1.md
│   └── RELEASE_NOTES_v1.2.9.md
├── deployment/                  # Guias de deploy
│   ├── DEPLOY_v1.3.2_SUCCESS.md
│   ├── RESUMO_DEPLOY_v1.3.2.md
│   ├── COMANDOS_RAPIDOS_v1.3.2.md
│   ├── DEPLOY_GUIDE_v1.3.1.md
│   └── BUILD_AND_DEPLOY_v1.3.1.md
├── development/                 # Documentação técnica
│   ├── FIX_EDIT_RECORD_BUG.md
│   ├── IMPLEMENTATION_COMPLETE_SUMMARY.md
│   ├── CHANGELOG_MESSAGES_MODERNIZATION.md
│   ├── CHANGELOG_USER_DASHBOARD.md
│   └── CHANGELOG_USER_SETTINGS_MODERNIZATION.md
└── archived/                    # Documentação obsoleta
    ├── BUILD_INSTRUCTIONS.md
    ├── ARQUIVOS-OFICIAIS.md
    ├── DEPLOY-OFICIAL.md
    ├── DEPLOY-SERVIDOR.md
    └── COMANDOS_SERVIDOR.md
```

## 🔍 Encontrando Informações

### Preciso fazer deploy
→ [deployment/DEPLOY_v1.3.2_SUCCESS.md](./deployment/DEPLOY_v1.3.2_SUCCESS.md)

### Preciso de comandos rápidos
→ [deployment/COMANDOS_RAPIDOS_v1.3.2.md](./deployment/COMANDOS_RAPIDOS_v1.3.2.md)

### Quero entender uma correção
→ [development/FIX_EDIT_RECORD_BUG.md](./development/FIX_EDIT_RECORD_BUG.md)

### Quero ver o histórico de mudanças
→ [releases/CHANGELOG_v1.3.2.md](./releases/CHANGELOG_v1.3.2.md)

### Quero contribuir
→ [../CONTRIBUTING.md](../CONTRIBUTING.md)

## 📝 Convenções

### Nomenclatura de Arquivos
- `CHANGELOG_*.md` - Mudanças detalhadas de uma versão
- `RELEASE_NOTES_*.md` - Notas de lançamento para usuários
- `DEPLOY_*.md` - Guias de deploy
- `FIX_*.md` - Documentação de correções específicas
- `IMPLEMENTATION_*.md` - Documentação de implementações

### Versionamento
Seguimos [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.x.x) - Mudanças incompatíveis
- **MINOR** (x.3.x) - Novas funcionalidades compatíveis
- **PATCH** (x.x.2) - Correções de bugs

## 🤝 Contribuindo com a Documentação

1. Mantenha a documentação atualizada
2. Use markdown para formatação
3. Inclua exemplos práticos
4. Adicione links para referências
5. Mantenha a estrutura organizada

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/heltonfraga/wuzapi-manager/issues)
- **Discussões**: [GitHub Discussions](https://github.com/heltonfraga/wuzapi-manager/discussions)
- **Email**: suporte@wasend.com.br

---

**Última atualização**: 09/11/2024  
**Versão**: v1.3.2
