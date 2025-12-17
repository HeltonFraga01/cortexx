# Implementation Plan

## Fase 1: Limpeza de Código Legado

- [x] 1. Remover tipo SQLITE das interfaces TypeScript
  - [x] 1.1 Atualizar `src/lib/types.ts` removendo 'SQLITE' do union type DatabaseConnection
    - Remover 'SQLITE' de `type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE'`
    - _Requirements: 7.1, 7.2_
  - [x] 1.2 Atualizar `src/services/database-connections.ts` removendo tipo SQLITE e método testSQLiteConnection
    - Remover 'SQLITE' do union type
    - Remover método `testSQLiteConnection`
    - Remover referência ao método em `testConnection`
    - _Requirements: 1.3, 1.4, 7.3_
  - [x] 1.3 Write property test para validar ausência de tipo SQLITE
    - **Property 2: Consistência de tipos de conexão**
    - **Validates: Requirements 7.1, 7.2**

- [x] 2. Atualizar componentes frontend
  - [x] 2.1 Atualizar `src/components/admin/AdminDatabases.tsx`
    - Remover menção a "SQLite - Banco local integrado" da lista de tipos suportados
    - _Requirements: 1.2_
  - [x] 2.2 Atualizar `src/components/user/GenericTableView.README.md`
    - Mudar descrição de "SQLite table" para "database table"
    - _Requirements: 4.5_

- [x] 3. Atualizar arquivos de teste
  - [x] 3.1 Atualizar `src/test/templates/factory.js`
    - Mudar tipo padrão de 'SQLITE' para 'POSTGRES' ou 'NOCODB'
    - _Requirements: 1.2_
  - [x] 3.2 Atualizar `src/test/templates/README.md`
    - Remover referência a SQLITE_DB_PATH
    - _Requirements: 5.1_

- [x] 4. Limpar camada de compatibilidade do backend
  - [x] 4.1 Atualizar `server/database.js`
    - Remover método `fetchSQLiteUserRecord`
    - Remover warnings "SQLite connections are no longer supported"
    - Implementar ou remover métodos com "not fully implemented"
    - _Requirements: 2.2, 2.3_

- [x] 5. Checkpoint - Verificar que código compila e testes passam
  - Ensure all tests pass, ask the user if questions arise.

## Fase 2: Atualização dos Steering Files

- [x] 6. Atualizar steering files de infraestrutura
  - [x] 6.1 Atualizar `.kiro/steering/docker-deployment.md`
    - Remover todas as referências ao SQLite
    - Atualizar para configurações Supabase
    - Remover restrição de "replicas: 1" justificada por SQLite
    - Atualizar variáveis de ambiente
    - _Requirements: 3.1, 3.10, 3.11_
  - [x] 6.2 Atualizar `.kiro/steering/stack_docker_Swarm.yaml.md`
    - Remover configurações SQLite (SQLITE_DB_PATH, SQLITE_WAL_MODE, etc.)
    - Adicionar configurações Supabase
    - _Requirements: 3.2, 3.10_
  - [x] 6.3 Atualizar `.kiro/steering/backend-guidelines.md`
    - Mudar abstração de banco de dados para SupabaseService
    - Remover menção a sqlite3
    - _Requirements: 3.3_

- [x] 7. Atualizar steering files de documentação do projeto
  - [x] 7.1 Atualizar `.kiro/steering/tech.md`
    - Atualizar stack para incluir Supabase explicitamente
    - Adicionar informações sobre Stripe
    - Atualizar variáveis de ambiente
    - _Requirements: 3.4_
  - [x] 7.2 Atualizar `.kiro/steering/structure.md`
    - Verificar e atualizar estrutura de diretórios
    - Atualizar convenções se necessário
    - _Requirements: 3.5_
  - [x] 7.3 Atualizar `.kiro/steering/project-overview.md`
    - Atualizar visão geral com Supabase e Stripe
    - Atualizar diagrama de arquitetura
    - _Requirements: 3.6_
  - [x] 7.4 Atualizar `.kiro/steering/product.md`
    - Adicionar informações sobre sistema de pagamentos
    - Atualizar integrações externas
    - _Requirements: 3.7, 8.3_

- [x] 8. Verificar outros steering files
  - [x] 8.1 Verificar `.kiro/steering/coding-standards.md`
    - Verificar se há referências obsoletas
    - Atualizar se necessário
    - _Requirements: 3.8_
  - [x] 8.2 Verificar `.kiro/steering/frontend-guidelines.md`
    - Verificar se há referências obsoletas
    - Atualizar se necessário
    - _Requirements: 3.9_

- [x] 9. Checkpoint - Verificar consistência dos steering files
  - Ensure all tests pass, ask the user if questions arise.

## Fase 3: Atualização da Documentação Principal

- [x] 10. Atualizar documentação de configuração
  - [x] 10.1 Atualizar `docs/DOCKER_DATABASE_CONFIG.md` (se existir)
    - Atualizar completamente para Supabase
    - Remover instruções SQLite
    - _Requirements: 4.4_
  - [x] 10.2 Atualizar `VERIFICACOES_ADICIONAIS.md`
    - Remover referências a SQLITE nas verificações
    - Atualizar comandos de diagnóstico
    - _Requirements: 4.1_

- [x] 11. Criar documentação do sistema de pagamentos
  - [x] 11.1 Criar `docs/STRIPE_INTEGRATION.md`
    - Documentar integração com Stripe
    - Incluir configuração de variáveis de ambiente
    - Documentar fluxos de pagamento
    - _Requirements: 8.1, 8.2_

- [x] 12. Atualizar arquivos de configuração
  - [x] 12.1 Atualizar `.env.example`
    - Remover nota sobre SQLite
    - Garantir que variáveis Supabase e Stripe estão documentadas
    - _Requirements: 5.1_
  - [x] 12.2 Atualizar `.vscode/extensions.json`
    - Remover extensões SQLite (alexcvzz.vscode-sqlite, qwtel.sqlite-viewer)
    - _Requirements: 5.5_
  - [x] 12.3 Atualizar `.github/workflows/docker-multiarch.yml`
    - Remover tags sqlite-* (sqlite-latest, sqlite-YYYYMMDD, sqlite-sha)
    - Atualizar para tags apropriadas
    - _Requirements: 5.2_

## Fase 4: Limpeza de Specs e Arquivos Históricos

- [x] 13. Atualizar specs com referências obsoletas
  - [x] 13.1 Atualizar `.kiro/specs/branding-system/README.md`
    - Mudar "Persistência em SQLite" para "Persistência em Supabase"
    - _Requirements: 6.1_
  - [x] 13.2 Atualizar `.kiro/specs/container-restart-policy/design.md`
    - Remover menção a "Fechar conexão SQLite"
    - _Requirements: 6.1_
  - [x] 13.3 Verificar outras specs ativas
    - Buscar e atualizar referências SQLite em specs ativas
    - _Requirements: 6.2_

- [x] 14. Adicionar documentação histórica
  - [x] 14.1 Criar `server/migrations-sqlite-archived/ARCHIVED_README.md`
    - Explicar que são migrações históricas do SQLite
    - Documentar que o sistema agora usa Supabase
    - Manter como referência para entender evolução do schema
    - _Requirements: 1.5_

- [x] 15. Atualizar README das specs
  - [x] 15.1 Atualizar `.kiro/specs/README.md`
    - Atualizar para refletir estado atual do sistema
    - Adicionar nota sobre migração SQLite → Supabase
    - _Requirements: 6.3_

## Fase 5: Validação Final

- [x] 16. Executar validação de consistência
  - [x] 16.1 Executar busca por termos obsoletos
    - Buscar por sqlite, SQLite, SQLITE em todo o projeto
    - Verificar que apenas arquivos arquivados contêm referências
    - _Requirements: 9.1, 9.2_
  - [x] 16.2 Write property test para validar ausência de referências SQLite
    - **Property 1: Ausência de referências SQLite em código de produção**
    - **Validates: Requirements 9.1**
  - [x] 16.3 Executar todos os testes
    - `npm run test:run`
    - `cd server && npm test`
    - _Requirements: 9.3_
  - [x] 16.4 Executar build de produção
    - `npm run build`
    - Verificar que não há erros
    - _Requirements: 9.3_

- [x] 17. Final Checkpoint - Verificar que tudo está funcionando
  - Ensure all tests pass, ask the user if questions arise.
