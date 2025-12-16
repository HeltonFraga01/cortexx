# Requirements Document

## Introduction

Esta feature implementa a navegação direta para a página de edição de registro quando um agente clica em um item de database no menu lateral. Atualmente, ao clicar em "Perfil" (ou qualquer database), o agente é direcionado para a listagem de registros. O comportamento desejado é que, quando houver apenas um registro associado ao agente, ele seja redirecionado diretamente para a página de edição desse registro, similar ao comportamento já existente no dashboard do usuário (User).

## Glossary

- **Agent**: Usuário com papel de agente no sistema, com acesso limitado baseado em permissões
- **Database Connection**: Conexão configurada com um banco de dados externo (NocoDB)
- **Record**: Registro individual em uma tabela do banco de dados
- **AgentLayout**: Componente de layout que contém o menu lateral do agente
- **Direct Edit Navigation**: Navegação direta para a página de edição sem passar pela listagem

## Requirements

### Requirement 1

**User Story:** Como um agente, eu quero ser redirecionado diretamente para a página de edição do meu registro quando clicar em um item de database no menu, para que eu possa editar meus dados mais rapidamente sem passar pela listagem.

#### Acceptance Criteria

1. WHEN um agente clica em um item de database no menu lateral AND existe exatamente um registro associado ao agente THEN o sistema SHALL navegar diretamente para a página de edição desse registro (`/agent/database/{connectionId}/edit/{recordId}`)
2. WHEN um agente clica em um item de database no menu lateral AND existem múltiplos registros associados ao agente THEN o sistema SHALL navegar para a página de listagem de registros (`/agent/database/{connectionId}`)
3. WHEN um agente clica em um item de database no menu lateral AND não existem registros associados ao agente THEN o sistema SHALL exibir uma mensagem de erro informativa e permanecer na página atual
4. WHILE o sistema está carregando os registros do database THEN o sistema SHALL exibir um indicador de carregamento no item do menu clicado

### Requirement 2

**User Story:** Como um agente, eu quero ter feedback visual durante o carregamento dos dados do database, para que eu saiba que minha ação está sendo processada.

#### Acceptance Criteria

1. WHEN um agente clica em um item de database no menu THEN o sistema SHALL desabilitar o item clicado e exibir um spinner de carregamento
2. WHEN o carregamento é concluído com sucesso THEN o sistema SHALL remover o indicador de carregamento e navegar para a página apropriada
3. IF ocorrer um erro durante o carregamento THEN o sistema SHALL exibir uma notificação toast com a mensagem de erro e restaurar o estado do item do menu

### Requirement 3

**User Story:** Como um agente, eu quero que o sistema mantenha consistência com o comportamento existente no dashboard do usuário, para que a experiência seja familiar e previsível.

#### Acceptance Criteria

1. WHEN o sistema determina a navegação para um database THEN o sistema SHALL usar a mesma lógica de decisão implementada no componente DynamicDatabaseItems do User
2. WHEN o sistema exibe mensagens de erro THEN o sistema SHALL usar o mesmo padrão de mensagens e toasts do componente DynamicDatabaseItems
