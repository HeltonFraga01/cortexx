# Requirements Document

## Introduction

Refatoração da funcionalidade de edição de usuários no sistema WUZAPI Manager, substituindo o modal atual por uma página dedicada para melhorar a experiência do usuário e permitir mais espaço para configurações avançadas.

## Glossary

- **AdminUsers**: Componente principal de gerenciamento de usuários
- **EditUserPage**: Nova página dedicada para edição de usuários
- **WuzAPIUser**: Interface que define a estrutura de dados de um usuário
- **Router**: Sistema de navegação React Router para controle de rotas
- **Modal**: Janela popup atual usada para edição (a ser removida)

## Requirements

### Requirement 1

**User Story:** Como administrador, eu quero navegar para uma página dedicada ao editar um usuário, para que eu tenha mais espaço e melhor organização das configurações.

#### Acceptance Criteria

1. WHEN o administrador clica em "Editar" no menu dropdown de um usuário, THE System SHALL navegar para uma nova página de edição
2. THE EditUserPage SHALL exibir todas as informações do usuário selecionado em um layout organizado
3. THE EditUserPage SHALL manter o mesmo conjunto de campos editáveis do modal atual
4. THE EditUserPage SHALL incluir navegação breadcrumb para facilitar o retorno
5. THE EditUserPage SHALL preservar o estado dos dados durante a navegação

### Requirement 2

**User Story:** Como administrador, eu quero que a página de edição tenha uma interface similar ao formulário de criação, para que a experiência seja consistente.

#### Acceptance Criteria

1. THE EditUserPage SHALL usar o mesmo design pattern do CreateUserForm
2. THE EditUserPage SHALL organizar os campos em seções com cards
3. THE EditUserPage SHALL incluir validação em tempo real dos campos
4. THE EditUserPage SHALL exibir o status atual do usuário (conectado/desconectado)
5. THE EditUserPage SHALL manter a mesma paleta de cores e tipografia

### Requirement 3

**User Story:** Como administrador, eu quero poder salvar as alterações e retornar à lista de usuários, para que o fluxo de trabalho seja eficiente.

#### Acceptance Criteria

1. WHEN o administrador clica em "Salvar", THE System SHALL atualizar os dados do usuário
2. WHEN a atualização for bem-sucedida, THE System SHALL exibir uma notificação de sucesso
3. WHEN a atualização for bem-sucedida, THE System SHALL navegar de volta para a lista de usuários
4. THE EditUserPage SHALL incluir um botão "Cancelar" que retorna sem salvar
5. IF houver erro na atualização, THEN THE System SHALL exibir mensagem de erro específica

### Requirement 4

**User Story:** Como administrador, eu quero que a URL da página de edição seja bookmarkable, para que eu possa acessar diretamente a edição de um usuário específico.

#### Acceptance Criteria

1. THE EditUserPage SHALL usar uma URL no formato `/admin/users/edit/:userId`
2. THE System SHALL carregar os dados do usuário baseado no parâmetro da URL
3. IF o usuário não existir, THEN THE System SHALL redirecionar para a lista com mensagem de erro
4. THE EditUserPage SHALL funcionar corretamente quando acessada diretamente via URL
5. THE System SHALL manter o histórico de navegação do browser

### Requirement 5

**User Story:** Como administrador, eu quero que o modal atual seja completamente removido, para que não haja confusão na interface.

#### Acceptance Criteria

1. THE AdminUsers component SHALL remover o Dialog de edição existente
2. THE AdminUsers component SHALL remover todos os estados relacionados ao modal de edição
3. THE AdminUsers component SHALL atualizar o handler do menu dropdown para navegar
4. THE System SHALL manter apenas os modals de QR Code e criação de usuário
5. THE System SHALL garantir que não há código morto relacionado ao modal removido