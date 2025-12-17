# Requirements Document

## Introduction

O WUZAPI Manager passou por uma evolução significativa: migração completa do SQLite para Supabase (PostgreSQL), integração com sistema de pagamentos (Stripe), e adição de múltiplas funcionalidades. Esta evolução deixou código legado, referências obsoletas e documentação desatualizada que precisam ser removidos e atualizados para evitar confusões no desenvolvimento futuro.

Este documento define os requisitos para:
1. Remoção completa de código legado relacionado ao SQLite
2. Atualização de toda documentação para refletir a arquitetura atual (Supabase)
3. Atualização dos steering files e specs com informações corretas
4. Limpeza de arquivos e configurações obsoletas

## Glossary

- **Legacy Code**: Código que referencia funcionalidades ou tecnologias não mais utilizadas (ex: SQLite)
- **Steering Files**: Arquivos em `.kiro/steering/` que guiam o comportamento do agente de IA
- **Specs**: Especificações de features em `.kiro/specs/`
- **Supabase**: Plataforma de banco de dados PostgreSQL utilizada atualmente
- **SQLite**: Banco de dados local anteriormente utilizado (OBSOLETO)
- **Compatibility Layer**: Camada de compatibilidade em `server/database.js` que roteia chamadas antigas para Supabase
- **Migration Files**: Arquivos de migração SQLite arquivados em `server/migrations-sqlite-archived/`

## Requirements

### Requirement 1: Remoção de Código Legado SQLite

**User Story:** Como desenvolvedor, quero que todo código relacionado ao SQLite seja removido, para que não haja confusão sobre qual tecnologia de banco de dados está em uso.

#### Acceptance Criteria

1. WHEN o sistema é analisado THEN THE Legacy_Cleanup_System SHALL identificar todas as referências ao SQLite no código fonte
2. WHEN referências SQLite são encontradas em arquivos de produção THEN THE Legacy_Cleanup_System SHALL remover ou atualizar essas referências para usar Supabase
3. WHEN o tipo de conexão 'SQLITE' existe em interfaces TypeScript THEN THE Legacy_Cleanup_System SHALL remover esse tipo das definições
4. WHEN métodos SQLite existem em serviços THEN THE Legacy_Cleanup_System SHALL remover esses métodos obsoletos
5. WHEN a pasta `server/migrations-sqlite-archived/` existe THEN THE Legacy_Cleanup_System SHALL manter a pasta como referência histórica mas adicionar README explicativo

### Requirement 2: Atualização da Camada de Compatibilidade

**User Story:** Como desenvolvedor, quero que a camada de compatibilidade em `database.js` seja simplificada ou removida, para que o código seja mais direto e fácil de manter.

#### Acceptance Criteria

1. WHEN o arquivo `server/database.js` é analisado THEN THE Legacy_Cleanup_System SHALL identificar métodos que podem ser removidos
2. WHEN métodos de compatibilidade SQLite existem THEN THE Legacy_Cleanup_System SHALL remover métodos como `fetchSQLiteUserRecord`
3. WHEN warnings de "not fully implemented" existem THEN THE Legacy_Cleanup_System SHALL implementar completamente ou remover os métodos
4. WHEN o código usa `database.js` indiretamente THEN THE Legacy_Cleanup_System SHALL avaliar migração direta para SupabaseService

### Requirement 3: Atualização dos Steering Files

**User Story:** Como desenvolvedor usando IA, quero que os steering files reflitam a arquitetura atual, para que as sugestões do agente sejam precisas e relevantes.

#### Acceptance Criteria

1. WHEN o arquivo `.kiro/steering/docker-deployment.md` é analisado THEN THE Documentation_System SHALL remover todas as referências ao SQLite e atualizar para Supabase
2. WHEN o arquivo `.kiro/steering/stack_docker_Swarm.yaml.md` é analisado THEN THE Documentation_System SHALL atualizar configurações para Supabase
3. WHEN o arquivo `.kiro/steering/backend-guidelines.md` é analisado THEN THE Documentation_System SHALL atualizar abstrações de banco de dados para SupabaseService
4. WHEN o arquivo `.kiro/steering/tech.md` é analisado THEN THE Documentation_System SHALL atualizar stack para refletir Supabase e sistema de pagamentos
5. WHEN o arquivo `.kiro/steering/structure.md` é analisado THEN THE Documentation_System SHALL atualizar estrutura de diretórios e convenções
6. WHEN o arquivo `.kiro/steering/project-overview.md` é analisado THEN THE Documentation_System SHALL atualizar visão geral com Supabase e Stripe
7. WHEN o arquivo `.kiro/steering/product.md` é analisado THEN THE Documentation_System SHALL atualizar contexto do produto com novas integrações
8. WHEN o arquivo `.kiro/steering/coding-standards.md` é analisado THEN THE Documentation_System SHALL verificar e atualizar padrões de código
9. WHEN o arquivo `.kiro/steering/frontend-guidelines.md` é analisado THEN THE Documentation_System SHALL atualizar guidelines do frontend
10. WHEN variáveis de ambiente SQLite são mencionadas em qualquer steering file THEN THE Documentation_System SHALL substituir por variáveis Supabase equivalentes
11. WHEN restrições de "replicas: 1" são justificadas por SQLite THEN THE Documentation_System SHALL atualizar justificativa para arquitetura atual

### Requirement 4: Atualização da Documentação Principal

**User Story:** Como desenvolvedor, quero que toda documentação em `docs/` reflita a arquitetura atual, para que novos desenvolvedores não sejam confundidos.

#### Acceptance Criteria

1. WHEN arquivos em `docs/` mencionam SQLite THEN THE Documentation_System SHALL atualizar para mencionar Supabase
2. WHEN guias de configuração existem THEN THE Documentation_System SHALL atualizar variáveis de ambiente e configurações
3. WHEN diagramas de arquitetura existem THEN THE Documentation_System SHALL atualizar para mostrar Supabase
4. WHEN o arquivo `docs/DOCKER_DATABASE_CONFIG.md` existe THEN THE Documentation_System SHALL atualizar completamente para Supabase
5. WHEN exemplos de código usam SQLite THEN THE Documentation_System SHALL atualizar para usar Supabase/SupabaseService

### Requirement 5: Atualização de Arquivos de Configuração

**User Story:** Como DevOps, quero que arquivos de configuração não contenham referências obsoletas, para que deployments sejam claros e corretos.

#### Acceptance Criteria

1. WHEN o arquivo `.env.example` menciona SQLite THEN THE Configuration_System SHALL remover essas referências
2. WHEN workflows do GitHub (`.github/workflows/`) usam tags SQLite THEN THE Configuration_System SHALL atualizar para tags apropriadas
3. WHEN `docker-compose.yml` contém configurações SQLite THEN THE Configuration_System SHALL remover ou atualizar
4. WHEN o `Dockerfile` instala dependências SQLite desnecessárias THEN THE Configuration_System SHALL avaliar remoção
5. WHEN extensões VSCode para SQLite são recomendadas THEN THE Configuration_System SHALL remover da lista

### Requirement 6: Limpeza de Specs Obsoletas

**User Story:** Como desenvolvedor, quero que specs arquivadas que mencionam SQLite sejam marcadas como históricas, para que não causem confusão.

#### Acceptance Criteria

1. WHEN specs em `.kiro/specs/` mencionam SQLite THEN THE Spec_System SHALL adicionar nota de obsolescência ou atualizar
2. WHEN specs ativas referenciam tecnologias obsoletas THEN THE Spec_System SHALL atualizar para tecnologias atuais
3. WHEN o README das specs é analisado THEN THE Spec_System SHALL atualizar para refletir estado atual do sistema

### Requirement 7: Atualização de Tipos e Interfaces

**User Story:** Como desenvolvedor TypeScript, quero que tipos e interfaces reflitam apenas tecnologias em uso, para que o código seja type-safe e preciso.

#### Acceptance Criteria

1. WHEN interfaces em `src/types/` incluem 'SQLITE' como opção THEN THE Type_System SHALL remover essa opção
2. WHEN interfaces em `src/lib/types.ts` incluem tipos SQLite THEN THE Type_System SHALL remover esses tipos
3. WHEN serviços frontend têm métodos SQLite THEN THE Type_System SHALL remover esses métodos

### Requirement 8: Documentação do Sistema de Pagamentos

**User Story:** Como desenvolvedor, quero que a documentação inclua informações sobre o sistema de pagamentos Stripe, para que a integração seja clara.

#### Acceptance Criteria

1. WHEN o sistema de pagamentos não está documentado THEN THE Documentation_System SHALL criar documentação para integração Stripe
2. WHEN steering files não mencionam pagamentos THEN THE Documentation_System SHALL adicionar informações relevantes
3. WHEN o `product.md` não menciona Stripe THEN THE Documentation_System SHALL atualizar com informações de pagamento

### Requirement 9: Validação de Consistência

**User Story:** Como desenvolvedor, quero uma forma de validar que não há mais referências obsoletas, para garantir que a limpeza foi completa.

#### Acceptance Criteria

1. WHEN a limpeza é concluída THEN THE Validation_System SHALL executar busca por termos obsoletos (sqlite, SQLite, SQLITE)
2. WHEN referências obsoletas são encontradas após limpeza THEN THE Validation_System SHALL reportar localização e contexto
3. WHEN todos os testes passam após mudanças THEN THE Validation_System SHALL confirmar que funcionalidade não foi quebrada
