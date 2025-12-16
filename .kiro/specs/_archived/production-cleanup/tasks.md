# Implementation Plan: Production Cleanup

## Fase 1: Limpeza de Console.log

- [x] 1. Limpar console.log do Backend
  - [x] 1.1 Remover console.log de debug em `server/routes/index.js`
    - Substituir logs de debug de rotas por logger.debug
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Remover console.log de debug em `server/config/sqlite.js`
    - Substituir logs DEBUG por logger.debug ou remover
    - _Requirements: 1.1, 1.2_

- [x] 2. Limpar console.log do Frontend
  - [x] 2.1 Envolver console.log em IS_DEVELOPMENT em `src/services/contactImportService.ts`
    - Adicionar verificação IS_DEVELOPMENT nos logs de validação
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Envolver console.log em IS_DEVELOPMENT em `src/services/contactsStorageService.ts`
    - Adicionar verificação IS_DEVELOPMENT em todos os logs de merge/storage
    - _Requirements: 2.3_
  - [x] 2.3 Envolver console.log em IS_DEVELOPMENT em `src/services/database-connections.ts`
    - Adicionar verificação IS_DEVELOPMENT nos logs de cache hit/invalidation
    - _Requirements: 2.4_

- [x] 3. Checkpoint - Verificar limpeza de logs
  - Ensure all tests pass, ask the user if questions arise.

## Fase 2: Limpeza de Testes

- [x] 4. Consolidar arquivos de teste duplicados
  - [x] 4.1 Consolidar `auth.test.js` e `authRoutes.test.js`
    - Removido `auth-routes.test.js` (duplicado com testes menos confiáveis)
    - Mantido `auth.test.js` (middleware) e `authRoutes.test.js` (rotas)
    - _Requirements: 3.2_
  - [x] 4.2 Avaliar e remover testes obsoletos em `server/tests/`
    - `e2e-validation.test.js` - Mantido (testes E2E do banco funcionando)
    - `quick-validation.test.js` - Mantido (testes de validação de telefone funcionando)
    - _Requirements: 3.1, 3.4_

- [ ]* 4.3 Escrever testes para validar que logs estão condicionais
  - Verificar que IS_DEVELOPMENT é respeitado
  - _Requirements: 2.1, 2.2_

## Fase 3: Documentação

- [x] 5. Limpar release notes antigas
  - [x] 5.1 Manter apenas as 5 versões mais recentes em `docs/releases/`
    - Removidos: 14 arquivos de versões antigas (v1.2.9 até v1.4.9)
    - Mantidos: v1.5.0, v1.5.1, v1.5.8, v1.5.9, v1.5.10
    - _Requirements: 4.4_

- [x] 6. Atualizar documentação de specs
  - [x] 6.1 Avaliar specs em `_incomplete/` e arquivar se não relevantes
    - Arquivadas: campaign-builder-variables (já implementado), release-v1.5.2 (obsoleto), fix-database-and-home-page (resolvido)
    - _Requirements: 5.1, 5.2_
  - [x] 6.2 Atualizar `SPEC_STATUS_REPORT.md` com status atual
    - Atualizado com 37 specs arquivadas, 0 incompletas
    - _Requirements: 5.4_

## Fase 4: Limpeza de Código e Configuração

- [x] 7. Remover scripts obsoletos
  - [x] 7.1 Avaliar e remover scripts em `scripts/archive/`
    - Removidos 9 scripts obsoletos: build-fixed.sh, build-multi-arch.sh, build-multiarch.sh, build-simple.sh, deploy-docker.sh, prepare-release.sh, push-v1.2.2.sh, test-docker.sh, verify-release.sh
    - Pasta `scripts/archive/` removida (vazia)
    - Scripts ativos mantidos: deploy.sh, docker-build.sh, docker-build-production.sh
    - _Requirements: 7.4_

- [x] 8. Verificar arquivos de configuração
  - [x] 8.1 Atualizar `.env.example` e `.env.docker.example` com todas as variáveis necessárias
    - Sincronizar com `.env.example` e `.env.docker.example`
    - _Requirements: 7.1, 7.2_
  - [x] 8.2 Atualizar `.env.production.example` e `.env.docker.example`
    - Sincronizar com `.env.docker.example` e `.env.production.example`
    - _Requirements: 7.1, 7.3_

- [x] 9. Checkpoint - Verificar limpeza de código
  - Ensure all tests pass, ask the user if questions arise.

## Fase 5: Validação Final

- [-] 10. Validação de produção
  - [x] 10.1 Executar suite completa de testes
    - `npm run test:run`
    - _Requirements: 8.1_
  - [x] 10.2 Verificar build do frontend
    - `npm run build`
    - _Requirements: 8.2_
  - [ ] 10.3 Verificar build Docker
    - `docker build -t wuzapi-manager:test .`
    - ⚠️ Docker daemon não está rodando - executar manualmente quando disponível
    - _Requirements: 8.3_
  - [x] 10.4 Atualizar documentação com status de produção
    - Atualizar README.md ou criar PRODUCTION_STATUS.md
    - _Requirements: 8.4_

- [x] 11. Final Checkpoint - Garantir que tudo está funcionando
  - Ensure all tests pass, ask the user if questions arise.
