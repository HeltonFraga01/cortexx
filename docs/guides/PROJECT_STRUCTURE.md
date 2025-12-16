# 📁 Estrutura do Projeto WUZAPI Manager

## 🗂️ Organização de Diretórios

```
wuzapi-manager/
├── 📄 Arquivos de Configuração Raiz
├── 📚 docs/                      # Documentação organizada
├── 🎨 src/                       # Frontend React
├── 🔧 server/                    # Backend Node.js
├── 🧪 cypress/                   # Testes E2E
├── 📜 scripts/                   # Scripts utilitários
├── 🎭 templates/                 # Templates de código
├── 🐳 Docker & Deploy
└── 🔒 Configurações de Segurança
```

## 📄 Arquivos Raiz Importantes

### Documentação Principal
```
README.md                        # Documentação principal do projeto
CHANGELOG.md                     # Changelog consolidado
CONTRIBUTING.md                  # Guia de contribuição
ESPECIFICACAO_PRODUTO.md         # Especificação do produto
WUZAPI_WEBHOOK_EVENTS.md         # Eventos do WUZAPI
PROJECT_STRUCTURE.md             # Este arquivo
```

### Configuração do Projeto
```
package.json                     # Dependências e scripts do frontend
package-lock.json                # Lock de dependências
tsconfig.json                    # Configuração TypeScript
vite.config.ts                   # Configuração Vite
vitest.config.ts                 # Configuração Vitest
tailwind.config.ts               # Configuração Tailwind CSS
postcss.config.js                # Configuração PostCSS
eslint.config.js                 # Configuração ESLint
components.json                  # Configuração shadcn/ui
```

### Docker & Deploy
```
Dockerfile                       # Dockerfile multi-stage otimizado
docker-compose.yml               # Compose para desenvolvimento
docker-swarm-stack.yml           # Stack para produção
deploy-multiarch.sh              # Script de build multi-arch
test-docker-v1.3.2.sh           # Script de teste Docker
.dockerignore                    # Arquivos ignorados no build
```

### Configuração de Ambiente
```
.env.example                     # Exemplo de variáveis de ambiente
.env.docker.example              # Exemplo para Docker
.env.production.example          # Exemplo para produção
```

### Git & Versionamento
```
.gitignore                       # Arquivos ignorados pelo Git
.gitmessage                      # Template de commit
.commitlintrc.json              # Configuração commitlint
.releaserc.json                 # Configuração semantic-release
```

### Segurança & Qualidade
```
.eslintignore                    # Arquivos ignorados pelo ESLint
```

## 📚 Estrutura de Documentação (docs/)

```
docs/
├── README.md                    # Índice da documentação
├── releases/                    # Changelogs e release notes
│   ├── CHANGELOG_v1.3.2.md     # Versão atual
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

## 🎨 Frontend (src/)

```
src/
├── components/                  # Componentes React
│   ├── admin/                  # Componentes admin
│   ├── user/                   # Componentes usuário
│   ├── ui/                     # Componentes shadcn/ui
│   ├── ui-custom/              # Componentes customizados
│   ├── shared/                 # Componentes compartilhados
│   ├── features/               # Componentes por feature
│   ├── wuzapi/                 # Componentes WUZAPI
│   └── disparador/             # Disparador de mensagens
├── pages/                      # Páginas principais
│   ├── AdminDashboard.tsx
│   ├── UserDashboard.tsx
│   ├── LoginPage.tsx
│   └── NotFound.tsx
├── contexts/                   # Contextos React
│   ├── AuthContext.tsx
│   ├── BrandingContext.tsx
│   └── WuzAPIContext.tsx
├── hooks/                      # Custom hooks
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── useBranding.ts
├── services/                   # Serviços API
│   ├── api-client.ts
│   ├── branding.ts
│   ├── wuzapi.ts
│   └── nocodb.ts
├── lib/                        # Utilitários core
│   ├── api.ts
│   ├── types.ts
│   ├── utils.ts
│   └── wuzapi-client.ts
├── types/                      # Definições de tipos
├── config/                     # Configurações
├── constants/                  # Constantes
├── utils/                      # Utilitários diversos
├── test/                       # Testes e mocks
├── App.tsx                     # Componente raiz
├── main.tsx                    # Entry point
└── index.css                   # Estilos globais
```

## 🔧 Backend (server/)

```
server/
├── routes/                     # Rotas Express
│   ├── adminRoutes.js
│   ├── userRoutes.js
│   ├── brandingRoutes.js
│   ├── databaseRoutes.js
│   ├── sessionRoutes.js
│   ├── webhookRoutes.js
│   ├── chatRoutes.js
│   └── index.js
├── middleware/                 # Middlewares
│   ├── corsHandler.js
│   ├── errorHandler.js
│   └── rateLimiter.js
├── validators/                 # Validadores
│   ├── adminValidator.js
│   └── sessionValidator.js
├── services/                   # Serviços
│   └── UserRecordService.js
├── utils/                      # Utilitários
│   ├── logger.js              # Winston logger
│   ├── wuzapiClient.js        # Cliente WUZAPI
│   ├── htmlSanitizer.js       # Sanitização HTML
│   └── metrics.js             # Métricas
├── migrations/                 # Migrações de banco
│   ├── 002_add_view_configuration.js
│   ├── 003_add_custom_home_html.js
│   ├── 004_add_messages_table.js
│   └── run-migrations.js
├── config/                     # Configurações
│   └── sqlite.js
├── tests/                      # Testes backend
│   ├── integration/
│   ├── routes/
│   └── services/
├── public/                     # Arquivos estáticos
├── logs/                       # Logs da aplicação
├── database.js                 # Abstração de banco
├── index.js                    # Entry point
├── healthcheck.js              # Health check
└── package.json                # Dependências backend
```

## 📜 Scripts (scripts/)

```
scripts/
├── generate.cjs                # Gerador de código
├── test-generate.cjs           # Teste do gerador
├── release.sh                  # Script de release
├── validate-commit.sh          # Validação de commits
├── generate-changelog.sh       # Geração de changelog
└── security-scan.sh            # Scan de segurança
```

## 🎭 Templates (templates/)

```
templates/
├── backend/                    # Templates backend
│   ├── route.template.js
│   ├── service.template.js
│   └── validator.template.js
└── frontend/                   # Templates frontend
    ├── component.template.tsx
    ├── page.template.tsx
    └── hook.template.ts
```

## 🧪 Testes (cypress/)

```
cypress/
├── e2e/                        # Testes E2E
│   ├── admin/
│   ├── user/
│   └── auth/
├── fixtures/                   # Dados de teste
├── support/                    # Comandos customizados
└── cypress.config.ts           # Configuração Cypress
```

## 🐳 Docker & Deploy

```
deploy/                         # Arquivos de deploy
nginx/                          # Configuração Nginx
monitoring/                     # Configuração monitoramento
  ├── prometheus.yml
  └── grafana/
```

## 🔒 Configurações de Segurança

```
.github/                        # GitHub Actions
  └── workflows/
security-reports/               # Relatórios de segurança
```

## 📦 Diretórios Gerados (Ignorados pelo Git)

```
node_modules/                   # Dependências Node.js
dist/                          # Build do frontend
data/                          # Dados SQLite
logs/                          # Logs da aplicação
backups/                       # Backups do banco
.vite/                         # Cache Vite
.serena/                       # Cache Serena
```

## 🎯 Arquivos Importantes por Tarefa

### Desenvolvimento Frontend
- `src/App.tsx` - Rotas principais
- `src/pages/` - Páginas da aplicação
- `src/components/` - Componentes reutilizáveis
- `vite.config.ts` - Configuração de build

### Desenvolvimento Backend
- `server/index.js` - Entry point
- `server/routes/` - Definição de rotas
- `server/database.js` - Acesso ao banco
- `server/utils/logger.js` - Logging

### Deploy
- `Dockerfile` - Build da imagem
- `docker-swarm-stack.yml` - Deploy produção
- `deploy-multiarch.sh` - Build multi-arch
- `docs/deployment/` - Guias de deploy

### Testes
- `vitest.config.ts` - Testes unitários
- `cypress.config.ts` - Testes E2E
- `src/test/` - Mocks e utilitários

### Documentação
- `README.md` - Documentação principal
- `docs/` - Documentação organizada
- `CONTRIBUTING.md` - Guia de contribuição

## 🔍 Convenções de Nomenclatura

### Componentes React
- PascalCase: `UserDashboard.tsx`, `MessageForm.tsx`
- Hooks: `use` prefix: `useAuth.ts`, `useBranding.ts`

### Backend
- camelCase: `adminRoutes.js`, `userService.js`
- Middlewares: `Handler` suffix: `corsHandler.js`

### Testes
- `.test.tsx` ou `.spec.tsx`: `UserDashboard.test.tsx`
- `.integration.test.tsx`: Testes de integração

### Documentação
- UPPERCASE: `README.md`, `CHANGELOG.md`
- Prefixos: `DEPLOY_`, `FIX_`, `CHANGELOG_`

## 📝 Notas

- Sempre use `@/` para imports do frontend (alias para `src/`)
- Backend usa CommonJS, frontend usa ES modules
- SQLite em modo WAL para melhor concorrência
- Docker multi-stage para otimização de build
- Documentação organizada por categoria em `docs/`

---

**Última atualização**: 09/11/2024  
**Versão**: v1.3.2
