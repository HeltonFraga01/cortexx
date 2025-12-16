# 📜 Scripts Directory

Coleção de scripts de automação para o WUZAPI Manager.

---

## 🚀 Deploy Scripts

### `deploy-swarm.sh`
Script principal de deploy para Docker Swarm com registro automático no Traefik.

**Uso:**
```bash
./scripts/deploy-swarm.sh
# ou via alias
./deploy.sh
# ou via npm
npm run deploy:production
```

**Funcionalidades:**
- ✅ Deploy da stack no Docker Swarm
- ✅ Validação de arquivos e serviços
- ✅ Registro automático no Traefik (`--force`)
- ✅ Exibição de status e informações úteis

**Documentação:** [docs/DEPLOYMENT_SCRIPTS.md](../docs/DEPLOYMENT_SCRIPTS.md)

---

### `check-deployment.sh`
Script de diagnóstico completo para verificar o status do deploy.

**Uso:**
```bash
./scripts/check-deployment.sh
# ou via npm
npm run docker:check
```

**Verifica:**
- ✅ Existência e status do serviço
- ✅ Replicas e tasks
- ✅ Labels do Traefik
- ✅ Conectividade de rede
- ✅ Health checks
- ✅ Acesso externo via HTTPS

**Documentação:** [docs/DEPLOYMENT_SCRIPTS.md](../docs/DEPLOYMENT_SCRIPTS.md)

---

## 🏗️ Build Scripts

### `deploy-multiarch.sh`
Build e push de imagens Docker multi-arquitetura (amd64/arm64).

**Uso:**
```bash
./deploy-multiarch.sh
# ou via npm
npm run deploy:official
```

**Funcionalidades:**
- ✅ Build para múltiplas arquiteturas
- ✅ Push para Docker Hub
- ✅ Versionamento automático

---

## 🔄 Release Scripts

### `release.sh`
Automação de releases com semantic versioning.

**Uso:**
```bash
./scripts/release.sh
# ou via npm
npm run release
```

**Funcionalidades:**
- ✅ Validação de commits convencionais
- ✅ Geração de changelog
- ✅ Bump de versão
- ✅ Tag e push automático

---

### `generate-changelog.sh`
Geração de changelog baseado em commits convencionais.

**Uso:**
```bash
./scripts/generate-changelog.sh
# ou via npm
npm run changelog:generate
```

---

### `validate-commit.sh`
Validação de mensagens de commit.

**Uso:**
```bash
# Validar último commit
./scripts/validate-commit.sh --last

# Validar todos os commits
./scripts/validate-commit.sh --all
```

---

## 🔒 Security Scripts

### `security-scan.sh`
Scan completo de segurança (dependências, código, secrets).

**Uso:**
```bash
./scripts/security-scan.sh
# ou via npm
npm run security:scan
```

**Verifica:**
- ✅ Vulnerabilidades em dependências
- ✅ Secrets hardcoded no código
- ✅ Problemas de segurança no código
- ✅ Configurações inseguras

---

### `security-audit-quick.sh`
Auditoria rápida de segurança.

**Uso:**
```bash
./scripts/security-audit-quick.sh
# ou via npm
npm run security:quick
```

---

## 🎨 Generator Scripts

### `generate.cjs`
Gerador de código (componentes, rotas, hooks, serviços).

**Uso:**
```bash
# Ver ajuda
npm run generate:help

# Gerar componente
npm run generate component admin/UserList

# Gerar rota
npm run generate route users

# Gerar hook
npm run generate hook useAuth

# Gerar serviço
npm run generate service user
```

**Documentação:** [docs/CLI_GENERATOR_GUIDE.md](../docs/CLI_GENERATOR_GUIDE.md)

---

### `update-landing-page.cjs`
Atualização da landing page com dados do sistema.

**Uso:**
```bash
npm run landing:update
```

---

## 📊 Utility Scripts

### `test-generate.cjs`
Testes do gerador de código.

**Uso:**
```bash
npm run generate:test
```

---

## 🔧 Server Scripts

Localizados em `server/scripts/`:

### `migrate-users-to-default-plan.js`
Migração de usuários para plano padrão.

**Uso:**
```bash
npm run migrate:subscriptions
```

---

## 📝 Convenções

### Permissões
Todos os scripts `.sh` devem ter permissão de execução:
```bash
chmod +x scripts/*.sh
```

### Nomenclatura
- **Deploy/Build:** `deploy-*.sh`
- **Verificação:** `check-*.sh`
- **Segurança:** `security-*.sh`
- **Release:** `release*.sh`, `*-changelog.sh`, `validate-*.sh`
- **Geração:** `generate*.cjs`, `*-generate.cjs`

### Documentação
Cada script deve ter:
- Comentário de cabeçalho explicando o propósito
- Seção de uso no README
- Link para documentação detalhada (se aplicável)

---

## 🚦 Status dos Scripts

| Script | Status | Testes | Documentação |
|--------|--------|--------|--------------|
| `deploy-swarm.sh` | ✅ Estável | ✅ | ✅ |
| `check-deployment.sh` | ✅ Estável | ✅ | ✅ |
| `deploy-multiarch.sh` | ✅ Estável | ✅ | ✅ |
| `release.sh` | ✅ Estável | ✅ | ✅ |
| `generate-changelog.sh` | ✅ Estável | ✅ | ✅ |
| `validate-commit.sh` | ✅ Estável | ✅ | ✅ |
| `security-scan.sh` | ✅ Estável | ✅ | ✅ |
| `security-audit-quick.sh` | ✅ Estável | ✅ | ✅ |
| `generate.cjs` | ✅ Estável | ✅ | ✅ |
| `update-landing-page.cjs` | ✅ Estável | ✅ | ✅ |

---

## 📚 Documentação Relacionada

- [DEPLOYMENT_SCRIPTS.md](../docs/DEPLOYMENT_SCRIPTS.md) - Guia completo de deploy
- [TRAEFIK_404_FIX.md](../docs/TRAEFIK_404_FIX.md) - Fix rápido para erro 404
- [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) - Solução de problemas
- [CLI_GENERATOR_GUIDE.md](../docs/CLI_GENERATOR_GUIDE.md) - Gerador de código

---

## 🤝 Contribuindo

Ao adicionar novos scripts:

1. Adicione comentários de cabeçalho
2. Torne o script executável (`chmod +x`)
3. Adicione entrada neste README
4. Adicione comando no `package.json` (se aplicável)
5. Crie documentação detalhada (se necessário)
6. Adicione testes (se aplicável)

---

**Última atualização:** Dezembro 2025  
**Versão:** 1.5.46
