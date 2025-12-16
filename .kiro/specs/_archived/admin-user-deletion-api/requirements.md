# Requirements Document

## Introduction

Implementação das rotas de API no servidor para permitir a remoção de usuários através da interface administrativa. O frontend já possui a funcionalidade implementada, mas as rotas correspondentes no servidor estão ausentes, causando falhas nas operações de remoção.

## Glossary

- **AdminRoutes**: Módulo de rotas administrativas do servidor Express
- **WuzAPIClient**: Cliente para comunicação com a API externa WuzAPI
- **UserDeletion**: Operação de remoção de usuário do sistema
- **FullDeletion**: Remoção completa incluindo sessões ativas do WhatsApp
- **DatabaseDeletion**: Remoção apenas do banco de dados, mantendo sessão ativa

## Requirements

### Requirement 1

**User Story:** Como administrador, eu quero poder remover usuários do banco de dados através da API, para que eu possa gerenciar usuários que não precisam mais estar no sistema mas mantêm sessão ativa.

#### Acceptance Criteria

1. THE AdminRoutes SHALL implementar endpoint DELETE `/api/admin/users/:userId`
2. THE endpoint SHALL validar token administrativo antes de processar remoção
3. THE endpoint SHALL chamar WuzAPI para remover usuário do banco de dados
4. WHEN a remoção for bem-sucedida, THE endpoint SHALL retornar status 200
5. THE endpoint SHALL registrar logs detalhados da operação de remoção

### Requirement 2

**User Story:** Como administrador, eu quero poder remover usuários completamente do sistema, para que eu possa limpar usuários que não devem mais ter acesso ao WhatsApp.

#### Acceptance Criteria

1. THE AdminRoutes SHALL implementar endpoint DELETE `/api/admin/users/:userId/full`
2. THE endpoint SHALL validar token administrativo antes de processar remoção completa
3. THE endpoint SHALL chamar WuzAPI para remover usuário completamente incluindo sessões
4. WHEN a remoção completa for bem-sucedida, THE endpoint SHALL retornar status 200
5. THE endpoint SHALL registrar logs detalhados da operação de remoção completa

### Requirement 3

**User Story:** Como administrador, eu quero receber mensagens de erro específicas quando a remoção falhar, para que eu possa entender e resolver problemas.

#### Acceptance Criteria

1. IF o usuário não existir, THEN THE endpoint SHALL retornar status 404 com mensagem específica
2. IF o token administrativo for inválido, THEN THE endpoint SHALL retornar status 401
3. IF a WuzAPI retornar erro, THEN THE endpoint SHALL retornar status apropriado com mensagem descritiva
4. THE endpoint SHALL incluir timestamp e código de erro em todas as respostas
5. THE endpoint SHALL registrar erros detalhados nos logs do servidor

### Requirement 4

**User Story:** Como administrador, eu quero que as operações de remoção sejam seguras e auditáveis, para que haja controle adequado sobre essas ações críticas.

#### Acceptance Criteria

1. THE endpoints SHALL validar formato do userId antes de processar
2. THE endpoints SHALL registrar IP e User-Agent de quem fez a requisição
3. THE endpoints SHALL incluir tempo de resposta nos logs
4. THE endpoints SHALL usar middleware de validação de token administrativo existente
5. THE endpoints SHALL seguir o mesmo padrão de estrutura de resposta dos outros endpoints

### Requirement 5

**User Story:** Como desenvolvedor, eu quero que os endpoints sigam os padrões existentes do projeto, para que haja consistência na API.

#### Acceptance Criteria

1. THE endpoints SHALL usar o mesmo padrão de middleware dos endpoints existentes
2. THE endpoints SHALL usar o mesmo formato de resposta JSON dos outros endpoints
3. THE endpoints SHALL usar o mesmo sistema de logging dos outros endpoints
4. THE endpoints SHALL usar o mesmo tratamento de erros dos outros endpoints
5. THE endpoints SHALL incluir documentação JSDoc seguindo o padrão existente