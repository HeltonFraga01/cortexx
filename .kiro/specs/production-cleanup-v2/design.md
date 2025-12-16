# Design Document - Production Cleanup v2

## Overview

Este documento descreve o design para a limpeza e organização profissional do projeto WUZAPI Manager para produção. O objetivo é eliminar código legado, remover arquivos não utilizados, consolidar documentação e garantir uma estrutura de projeto limpa e profissional.

## Architecture

A limpeza será organizada em fases sequenciais para minimizar riscos:

```
┌─────────────────────────────────────────────────────────────┐
│                    Cleanup Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 1: Analysis                                           │
│  ├── Identify unused test files                              │
│  ├── Identify orphaned components/services                   │
│  ├── Identify duplicate documentation                        │
│  └── Identify unused scripts                                 │
│                                                              │
│  Phase 2: Cleanup                                            │
│  ├── Remove unused test files                                │
│  ├── Remove orphaned files                                   │
│  ├── Consolidate documentation                               │
│  ├── Clean scripts directory                                 │
│  └── Organize root directory                                 │
│                                                              │
│  Phase 3: Organization                                       │
│  ├── Archive completed specs                                 │
│  ├── Update documentation index                              │
│  ├── Update README                                           │
│  └── Clean up specs directory                                │
│                                                              │
│  Phase 4: Verification                                       │
│  ├── Run all tests                                           │
│  ├── Verify build succeeds                                   │
│  ├── Verify Docker build                                     │
│  └── Final review                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Files to Remove

#### 1. Root Level Shell Scripts (Move to scripts/ or Remove)
```
build-arm64-only.sh          → Remove (duplicate of deploy-multiarch.sh)
build-local-only.sh          → Remove (duplicate of scripts/docker-build-local.sh)
push-image.sh                → Remove (duplicate functionality)
push-now.sh                  → Remove (duplicate functionality)
test-and-push.sh             → Remove (not used)
diagnose-docker.sh           → Move to scripts/
```

#### 2. Cleanup Analyzer (Remove Entire Directory)
```
cleanup-analyzer/            → Remove (not actively used, was a one-time tool)
```

#### 3. TestSprite Tests (Remove)
```
testsprite_tests/            → Remove (external tool tests, not part of project)
src/utils/calculator.ts      → Remove (only used for TestSprite testing)
```

#### 4. Unused Documentation Files
```
docs/deployment/             → Remove empty directory
docs/ACCESSIBILITY.md        → Consolidate with ACCESSIBILITY_GUIDE.md
docs/DOCKER_AUTHENTICATION_FIX_SUMMARY.md → Archive (historical)
docs/DOCKER_AUTHENTICATION_TROUBLESHOOTING.md → Archive (historical)
docs/DOCKER_COOKIE_FIX.md    → Archive (historical)
docs/Guia_Landing_Pages_SaaS.md → Review (may be outdated)
docs/Landing_Page_Customizada.md → Review (may be outdated)
```

#### 5. Duplicate/Obsolete Root Files
```
CLEANUP_SUMMARY.md           → Archive to docs/development/
PRODUCTION_STATUS.md         → Review and update or remove
PUSH_INSTRUCTIONS.md         → Consolidate with CONTRIBUTING.md
docker-swarm-servidor.yml    → Remove (duplicate of docker-compose.swarm.yml)
```

#### 6. Specs to Archive
```
.kiro/specs/admin-settings-comprehensive-fix/
.kiro/specs/avatar-display-fix/
.kiro/specs/branding-persistence-docker-fix/
.kiro/specs/custom-html-rendering-fix/
.kiro/specs/database-security-fixes/
.kiro/specs/design-system-refactor/
.kiro/specs/disparador-review-cleanup/
.kiro/specs/messaging-system-modularization/
.kiro/specs/mobile-responsiveness-fix/
.kiro/specs/phone-validation-fix/
.kiro/specs/whatsapp-support-button/
```

### Files to Keep

#### Essential Root Files
```
.commitlintrc.json           ✓ Commit linting config
.dockerignore                ✓ Docker ignore
.env.example                 ✓ Environment template
.env.docker.example          ✓ Docker environment template
.env.production.example      ✓ Production environment template
.eslintignore                ✓ ESLint ignore
.gitignore                   ✓ Git ignore
.gitmessage                  ✓ Git message template
.releaserc.json              ✓ Release config
CHANGELOG.md                 ✓ Changelog
components.json              ✓ shadcn/ui config
CONTRIBUTING.md              ✓ Contributing guide
cypress.config.ts            ✓ Cypress config
deploy-multiarch.sh          ✓ Main deploy script
docker-compose.yml           ✓ Main docker compose
docker-compose.local.yml     ✓ Local development
docker-compose.swarm.yml     ✓ Swarm deployment
Dockerfile                   ✓ Docker build
eslint.config.js             ✓ ESLint config
index.html                   ✓ Entry HTML
package.json                 ✓ Package config
postcss.config.js            ✓ PostCSS config
README.md                    ✓ Main readme
tailwind.config.ts           ✓ Tailwind config
tsconfig*.json               ✓ TypeScript configs
vite.config.ts               ✓ Vite config
vitest.config.ts             ✓ Vitest config
DOCKER_QUICK_START.md        ✓ Quick start guide
```

## Data Models

N/A - This is a cleanup task, no new data models.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, this cleanup task consists primarily of manual analysis and one-time actions. The testable criteria are verification examples rather than properties that hold across all inputs. Therefore, we define the following verification checks:

### Verification Check 1: Test Suite Integrity
After cleanup, all remaining tests must pass.
**Validates: Requirements 1.3, 1.4, 9.1**

### Verification Check 2: Build Integrity
After cleanup, the frontend build must succeed without errors.
**Validates: Requirements 5.3, 9.2**

### Verification Check 3: Docker Build Integrity
After cleanup, the Docker build must succeed without errors.
**Validates: Requirements 9.3**

### Verification Check 4: No Broken Imports
After cleanup, there should be no TypeScript/JavaScript import errors.
**Validates: Requirements 5.3, 5.4**

## Error Handling

### Rollback Strategy
1. Create a git branch before starting cleanup
2. Commit after each major phase
3. If verification fails, revert to last working commit
4. Document any files that couldn't be removed and why

### Risk Mitigation
- Run tests after each file removal
- Keep backup of removed files in a separate branch
- Document all changes in commit messages

## Testing Strategy

### Verification Tests (Manual)

Since this is a cleanup task, testing consists of verification steps:

1. **Test Suite Verification**
   - Run `npm run test:run` - all tests must pass
   - Run `cd server && npm test` - all backend tests must pass

2. **Build Verification**
   - Run `npm run build` - must succeed
   - Run `npm run lint` - no new errors

3. **Docker Verification**
   - Run `docker build -t test .` - must succeed

4. **Import Verification**
   - Run `npx tsc --noEmit` - no TypeScript errors

### Checklist After Each Phase

- [ ] All tests pass
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] Application starts correctly
- [ ] No console errors in browser
