# Sistema de Versionamento e Changelog

Este documento descreve o sistema automatizado de versionamento semântico e geração de changelog implementado no WUZAPI Manager.

## 📋 Visão Geral

O projeto utiliza:
- **Versionamento Semântico (SemVer)**: Versões no formato `MAJOR.MINOR.PATCH`
- **Conventional Commits**: Padronização de mensagens de commit
- **Changelog Automático**: Geração baseada nos commits
- **Release Automatizado**: Scripts e workflows para releases

## 🔧 Conventional Commits

### Formato

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Tipos Suportados

| Tipo | Descrição | Incrementa |
|------|-----------|------------|
| `feat` | Nova funcionalidade | MINOR |
| `fix` | Correção de bug | PATCH |
| `perf` | Melhoria de performance | PATCH |
| `docs` | Documentação | - |
| `style` | Formatação, espaços | - |
| `refactor` | Refatoração de código | - |
| `test` | Testes | - |
| `build` | Sistema de build | - |
| `ci` | Integração contínua | - |
| `chore` | Manutenção | - |
| `revert` | Reverter commit | PATCH |

### Breaking Changes

Para indicar mudanças que quebram compatibilidade:

```bash
feat!: remove deprecated API endpoints

BREAKING CHANGE: The old API endpoints have been removed.
```

Incrementa a versão **MAJOR**.

### Exemplos

```bash
# Nova funcionalidade
feat(auth): add OAuth2 integration

# Correção de bug
fix(api): resolve database connection timeout

# Breaking change
feat!: redesign user authentication system

BREAKING CHANGE: The authentication flow has been completely redesigned.
Users will need to re-authenticate after this update.

# Com escopo
fix(ui): resolve mobile responsive issues
docs(api): update endpoint documentation
test(auth): add integration tests for login flow
```

## 🚀 Scripts de Release

### 1. Script Principal de Release

```bash
# Release automático (determina versão baseada nos commits)
npm run release

# Ou diretamente
./scripts/release.sh
```

**O que faz:**
- Analisa commits desde a última tag
- Determina automaticamente o tipo de versão (major/minor/patch)
- Gera changelog automático
- Atualiza `package.json`
- Cria commit e tag de release

### 2. Validação de Commits

```bash
# Validar último commit
npm run validate:commits:last

# Validar todos os commits
npm run validate:commits:all

# Validar commits desde uma tag
./scripts/validate-commit.sh --since v1.2.0
```

### 3. Geração de Changelog

```bash
# Gerar changelog incremental
npm run changelog:generate

# Gerar changelog completo
./scripts/generate-changelog.sh --full

# Preview sem salvar
./scripts/generate-changelog.sh --preview

# Desde uma tag específica
./scripts/generate-changelog.sh --since v1.2.0
```

## 📝 Formato do Changelog

O changelog é gerado automaticamente no formato:

```markdown
# Changelog

## [1.3.0] - 2025-11-06

### 🚨 BREAKING CHANGES
- Remove deprecated API endpoints ([abc123](https://github.com/repo/commit/abc123))

### ✨ Features
- **auth**: Add OAuth2 integration ([def456](https://github.com/repo/commit/def456))
- Add user dashboard ([ghi789](https://github.com/repo/commit/ghi789))

### 🐛 Bug Fixes
- **api**: Resolve database connection timeout ([jkl012](https://github.com/repo/commit/jkl012))

### 📚 Documentation
- Update installation guide ([mno345](https://github.com/repo/commit/mno345))

---

## [1.2.1] - 2025-11-05
...
```

## 🔄 Workflow de Release

### 1. Desenvolvimento

```bash
# Fazer commits seguindo conventional commits
git commit -m "feat(ui): add user profile page"
git commit -m "fix(auth): resolve login validation issue"
git commit -m "docs: update API documentation"
```

### 2. Validação

```bash
# Validar commits antes do release
npm run validate:commits:all

# Executar testes
npm test
npm run lint
```

### 3. Release Manual

```bash
# Gerar release automático
npm run release

# Revisar mudanças
git show HEAD
git show v1.3.0

# Push se estiver satisfeito
git push origin main --tags
```

### 4. Release Automatizado (GitHub Actions)

O workflow `.github/workflows/release.yml` executa automaticamente:

1. **Validação**: Commits, testes, lint
2. **Determinação**: Se release é necessário
3. **Geração**: Nova versão e changelog
4. **Publicação**: GitHub Release e Docker image
5. **Notificação**: Resumo do release

## 🛠️ Configuração

### Git Hooks (Opcional)

Para validar commits automaticamente:

```bash
# Configurar template de commit
git config commit.template .gitmessage

# Hook de commit-msg (opcional)
echo '#!/bin/sh
./scripts/validate-commit.sh --last' > .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

### Configuração do Projeto

Arquivos de configuração:

- `.commitlintrc.json` - Regras de commit lint
- `.releaserc.json` - Configuração do semantic-release
- `.gitmessage` - Template de mensagem de commit
- `scripts/release.sh` - Script principal de release
- `scripts/validate-commit.sh` - Validador de commits
- `scripts/generate-changelog.sh` - Gerador de changelog

## 📊 Versionamento Semântico

### Regras de Incremento

| Mudança | Versão | Exemplo |
|---------|--------|---------|
| Breaking changes | MAJOR | 1.2.3 → 2.0.0 |
| Novas funcionalidades | MINOR | 1.2.3 → 1.3.0 |
| Correções de bugs | PATCH | 1.2.3 → 1.2.4 |

### Determinação Automática

O script analisa os commits e determina automaticamente:

```bash
# Commits analisados:
feat: add user dashboard          # → MINOR
fix: resolve login issue          # → PATCH  
feat!: redesign authentication    # → MAJOR (breaking)

# Resultado: MAJOR increment (devido ao breaking change)
```

## 🔍 Troubleshooting

### Problemas Comuns

**1. Commit não segue padrão**
```bash
# Erro
❌ Commit inválido: abc123
❌ Mensagem: Add new feature

# Solução
git commit --amend -m "feat: add new feature"
```

**2. Nenhum commit para release**
```bash
# Aviso
⚠️ Nenhum commit novo desde a última tag (v1.2.0)

# Solução: Fazer commits ou usar release manual
```

**3. Conflito de versão**
```bash
# Verificar versão atual
grep version package.json

# Resetar se necessário
git reset --hard HEAD~1
git tag -d v1.3.0
```

### Comandos Úteis

```bash
# Ver histórico de tags
git tag -l --sort=-version:refname

# Ver commits desde última tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Ver diferenças entre versões
git diff v1.2.0..v1.3.0

# Reverter release
git reset --hard HEAD~1
git tag -d v1.3.0
```

## 📚 Referências

- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)

## 🎯 Próximos Passos

1. **Configurar Git Hooks** para validação automática
2. **Integrar com CI/CD** para releases automáticos
3. **Configurar Notifications** para releases
4. **Documentar Processo** para a equipe
5. **Treinar Desenvolvedores** em conventional commits


---

## 📝 Recent Changes

### Version 1.5.0 (January 2025) - Message Variations System

#### ✨ New Features

**Message Variation Humanizer**
- Added message variation system with `|` delimiter syntax
- Real-time validation with visual feedback
- Preview panel with multiple sample generation
- Variation statistics and tracking
- Export functionality (JSON/CSV)
- Template system integration with `has_variations` flag
- Bulk campaign support with individual variation processing

**Backend Services**
- `VariationParser` - Parse and validate variation syntax
- `RandomSelector` - Cryptographically secure random selection
- `TemplateProcessor` - End-to-end processing with LRU cache
- `VariationTracker` - Usage tracking and statistics

**API Endpoints**
- `POST /api/user/messages/validate-variations` - Validate syntax
- `POST /api/user/messages/preview-variations` - Generate previews
- `GET /api/user/campaigns/:id/variation-stats` - Get statistics
- `GET /api/user/campaigns/:id/variation-stats/export` - Export data

**Frontend Components**
- `MessageVariationEditor` - Editor with real-time validation
- `VariationPreviewPanel` - Expandable preview panel
- `VariationStatsCard` - Statistics with charts

**Performance Optimizations**
- LRU cache for template parsing (1000 entries, 1h TTL)
- Database indexes for variation queries
- Async processing for bulk campaigns
- Cache hit rate monitoring

**Documentation**
- User guide for message variations
- API documentation
- Practical examples
- Integration guides

#### 🐛 Bug Fixes
- Fixed validation callback type mismatch in CampaignBuilder
- Improved error handling with toast notifications
- Fixed preview panel token authentication

#### 🔧 Technical Details
- Database migration 008 with `message_variations` table
- Indexes: campaign_id, user_id, sent_at
- Compatible with existing variable system `{{variable}}`
- Winston logger integration
- Comprehensive error handling

---
