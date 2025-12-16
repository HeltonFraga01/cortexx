# Requirements Document

## Introduction

Este documento define os requisitos para a organização e limpeza do código legado do WUZAPI Manager antes da preparação para produção. O objetivo é eliminar código obsoleto, organizar a estrutura de diretórios, validar rotas e garantir que o projeto esteja limpo e bem estruturado para os próximos passos de testes de segurança e deploy final.

## Glossary

- **System**: O WUZAPI Manager (aplicação completa frontend + backend)
- **Legacy Code**: Código obsoleto, não utilizado ou duplicado que pode ser removido
- **Route**: Endpoint HTTP no backend Express
- **Component**: Componente React no frontend
- **Directory Structure**: Organização de pastas e arquivos do projeto
- **Dead Code**: Código que não é mais executado ou referenciado
- **Test File**: Arquivo de teste unitário ou de integração

## Requirements

### Requirement 1

**User Story:** Como desenvolvedor, eu quero identificar e remover arquivos de código legado, para que o projeto contenha apenas código ativo e necessário

#### Acceptance Criteria

1. WHEN THE System analisa o diretório raiz, THE System SHALL identificar todos os arquivos markdown de documentação obsoletos ou duplicados
2. WHEN THE System analisa o diretório `server/`, THE System SHALL identificar arquivos de teste standalone obsoletos (ex: `test-*.js` na raiz do server/)
3. WHEN THE System analisa o diretório `src/`, THE System SHALL identificar componentes não referenciados em nenhum import
4. WHEN THE System identifica arquivos legados, THE System SHALL gerar uma lista categorizada por tipo e localização
5. WHERE arquivos são identificados como legados, THE System SHALL validar que não há dependências antes de marcar para remoção

### Requirement 2

**User Story:** Como desenvolvedor, eu quero validar que todas as rotas do backend seguem as convenções estabelecidas, para que o código seja consistente e manutenível

#### Acceptance Criteria

1. WHEN THE System analisa arquivos em `server/routes/`, THE System SHALL verificar que cada arquivo segue o padrão de nomenclatura `[role][Feature]Routes.js`
2. WHEN THE System analisa rotas, THE System SHALL verificar que rotas admin usam prefixo `/api/admin/`
3. WHEN THE System analisa rotas, THE System SHALL verificar que rotas user usam prefixo `/api/user/` ou `/api/`
4. WHEN THE System analisa rotas, THE System SHALL verificar que todas as rotas possuem tratamento de erro com logger
5. WHEN THE System identifica rotas fora do padrão, THE System SHALL gerar relatório com sugestões de correção

### Requirement 3

**User Story:** Como desenvolvedor, eu quero organizar a estrutura de diretórios conforme as convenções do projeto, para que novos desenvolvedores possam navegar facilmente

#### Acceptance Criteria

1. WHEN THE System analisa `src/components/`, THE System SHALL verificar que componentes estão organizados por papel (admin/, user/, shared/, features/)
2. WHEN THE System analisa `server/routes/`, THE System SHALL verificar que todas as rotas estão no diretório correto
3. WHEN THE System analisa `server/tests/`, THE System SHALL verificar que testes estão organizados em subdiretórios (integration/, routes/, services/)
4. WHEN THE System identifica arquivos fora do lugar, THE System SHALL sugerir a localização correta
5. WHERE arquivos precisam ser movidos, THE System SHALL verificar que imports serão atualizados corretamente

### Requirement 4

**User Story:** Como desenvolvedor, eu quero remover arquivos de teste obsoletos e consolidar testes, para que a suite de testes seja clara e organizada

#### Acceptance Criteria

1. WHEN THE System analisa `server/`, THE System SHALL identificar arquivos `test-*.js` standalone na raiz
2. WHEN THE System analisa arquivos de teste, THE System SHALL verificar se há testes equivalentes em `server/tests/`
3. WHEN THE System identifica testes duplicados, THE System SHALL marcar o arquivo standalone para remoção
4. WHEN THE System identifica arquivos `.db-shm` e `.db-wal` de teste, THE System SHALL marcar para remoção
5. WHERE testes standalone contêm lógica única, THE System SHALL sugerir migração para `server/tests/`

### Requirement 5

**User Story:** Como desenvolvedor, eu quero remover arquivos de documentação obsoletos ou duplicados, para que a documentação seja clara e atualizada

#### Acceptance Criteria

1. WHEN THE System analisa o diretório raiz, THE System SHALL identificar arquivos markdown de deploy/release obsoletos
2. WHEN THE System analisa `docs/`, THE System SHALL identificar documentação duplicada ou desatualizada
3. WHEN THE System identifica documentação obsoleta, THE System SHALL verificar se há versão mais recente
4. WHEN THE System identifica arquivos de resumo temporários (ex: `*_SUMMARY.md`, `*_SUCCESS.md`), THE System SHALL marcar para arquivamento ou remoção
5. WHERE documentação é relevante historicamente, THE System SHALL sugerir mover para `docs/archived/`

### Requirement 6

**User Story:** Como desenvolvedor, eu quero validar que não há código comentado ou imports não utilizados, para que o código seja limpo e profissional

#### Acceptance Criteria

1. WHEN THE System analisa arquivos TypeScript, THE System SHALL identificar imports não utilizados
2. WHEN THE System analisa arquivos JavaScript, THE System SHALL identificar requires não utilizados
3. WHEN THE System analisa arquivos de código, THE System SHALL identificar blocos grandes de código comentado (mais de 5 linhas)
4. WHEN THE System identifica código comentado, THE System SHALL verificar se há comentários explicativos relevantes
5. WHERE código comentado não tem valor histórico, THE System SHALL marcar para remoção

### Requirement 7

**User Story:** Como desenvolvedor, eu quero consolidar arquivos de configuração duplicados, para que haja uma única fonte de verdade

#### Acceptance Criteria

1. WHEN THE System analisa arquivos `.env*`, THE System SHALL identificar variáveis duplicadas ou inconsistentes
2. WHEN THE System analisa arquivos de configuração, THE System SHALL verificar que `server/.env` e `.env` não conflitam
3. WHEN THE System identifica configurações duplicadas, THE System SHALL sugerir consolidação
4. WHEN THE System analisa scripts em `scripts/`, THE System SHALL identificar scripts obsoletos em `scripts/archive/`
5. WHERE scripts arquivados não são mais necessários, THE System SHALL marcar para remoção definitiva

### Requirement 8

**User Story:** Como desenvolvedor, eu quero gerar um relatório completo de limpeza, para que eu possa revisar e aprovar as mudanças antes da execução

#### Acceptance Criteria

1. WHEN THE System completa a análise, THE System SHALL gerar relatório markdown com todas as descobertas
2. WHEN THE System gera relatório, THE System SHALL categorizar itens por tipo (arquivos para remover, mover, consolidar)
3. WHEN THE System gera relatório, THE System SHALL incluir justificativa para cada item
4. WHEN THE System gera relatório, THE System SHALL incluir estimativa de impacto (baixo, médio, alto)
5. WHEN THE System gera relatório, THE System SHALL incluir comandos ou scripts para executar as mudanças
