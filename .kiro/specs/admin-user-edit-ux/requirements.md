# Requirements Document

## Introduction

Este documento especifica os requisitos para melhorar a experiência do usuário (UX) e interface (UI) da página de edição de usuários no sistema multi-user admin. O objetivo é tornar a gestão de usuários mais intuitiva, especialmente a vinculação de planos, e modernizar a interface da lista de usuários Supabase.

## Glossary

- **Admin_Panel**: Interface administrativa para gerenciamento do sistema
- **User_Edit_Page**: Página de edição de usuário individual em `/admin/users/edit/:id`
- **Multi_User_Page**: Página de gestão multi-usuário em `/admin/multi-user`
- **Supabase_Users_List**: Componente que lista usuários do Supabase na aba Admin/Login
- **Plan_Assignment**: Funcionalidade de atribuição de plano a um usuário
- **User_Card**: Componente visual que exibe informações resumidas de um usuário
- **Inline_Edit**: Edição de dados diretamente na lista sem abrir página separada

## Requirements

### Requirement 1: Melhorar visualização de usuários na lista

**User Story:** Como administrador, quero visualizar informações importantes dos usuários diretamente na lista, para ter uma visão rápida do status de cada usuário sem precisar abrir a página de edição.

#### Acceptance Criteria

1. WHEN a lista de usuários é exibida, THE Supabase_Users_List SHALL mostrar o plano atual do usuário em uma coluna dedicada
2. WHEN um usuário não possui plano atribuído, THE Supabase_Users_List SHALL exibir um badge "Sem plano" com destaque visual de alerta
3. WHEN um usuário possui plano ativo, THE Supabase_Users_List SHALL exibir o nome do plano e status da assinatura
4. THE Supabase_Users_List SHALL exibir cards de usuário em vez de tabela para melhor visualização em dispositivos móveis

### Requirement 2: Adicionar ações rápidas na lista de usuários

**User Story:** Como administrador, quero realizar ações comuns diretamente na lista de usuários, para economizar tempo sem precisar navegar para páginas separadas.

#### Acceptance Criteria

1. WHEN visualizando a lista de usuários, THE Admin_Panel SHALL exibir botão de "Atribuir Plano" para usuários sem plano
2. WHEN o administrador clica em "Atribuir Plano", THE Admin_Panel SHALL abrir um dialog modal com seleção de planos disponíveis
3. WHEN o administrador seleciona um plano e confirma, THE Admin_Panel SHALL atribuir o plano e atualizar a lista automaticamente
4. WHEN visualizando a lista de usuários, THE Admin_Panel SHALL exibir botão de "Editar" que navega para a página de edição completa
5. IF a atribuição de plano falhar, THEN THE Admin_Panel SHALL exibir mensagem de erro clara e manter o estado anterior

### Requirement 3: Modernizar página de edição de usuário

**User Story:** Como administrador, quero uma página de edição de usuário mais organizada e intuitiva, para gerenciar usuários de forma eficiente.

#### Acceptance Criteria

1. THE User_Edit_Page SHALL organizar informações em seções colapsáveis com ícones identificadores
2. THE User_Edit_Page SHALL destacar visualmente a seção de plano quando o usuário não possui plano atribuído
3. WHEN o usuário não possui plano, THE User_Edit_Page SHALL exibir call-to-action proeminente para atribuir plano
4. THE User_Edit_Page SHALL exibir histórico resumido de alterações de plano quando disponível
5. THE User_Edit_Page SHALL manter consistência visual com o design system do projeto (shadcn/ui)

### Requirement 4: Melhorar fluxo de atribuição de plano

**User Story:** Como administrador, quero um fluxo simplificado para atribuir planos aos usuários, para reduzir erros e agilizar o processo.

#### Acceptance Criteria

1. WHEN atribuindo um plano, THE Plan_Assignment SHALL exibir preview das features incluídas no plano selecionado
2. WHEN atribuindo um plano, THE Plan_Assignment SHALL exibir o preço e ciclo de cobrança claramente
3. WHEN um plano é selecionado, THE Plan_Assignment SHALL destacar visualmente o plano escolhido
4. WHEN a atribuição é confirmada, THE Plan_Assignment SHALL exibir feedback de sucesso com resumo da ação
5. THE Plan_Assignment SHALL permitir cancelar a operação a qualquer momento antes da confirmação

### Requirement 5: Adicionar navegação contextual

**User Story:** Como administrador, quero navegar facilmente entre a lista de usuários e a página de edição, para manter o contexto durante a gestão.

#### Acceptance Criteria

1. THE User_Edit_Page SHALL exibir breadcrumb de navegação mostrando o caminho atual
2. THE User_Edit_Page SHALL incluir botão "Voltar para lista" visível no topo da página
3. WHEN salvando alterações com sucesso, THE User_Edit_Page SHALL oferecer opção de voltar à lista ou continuar editando
4. THE Multi_User_Page SHALL manter o estado de filtros e paginação ao retornar da página de edição

### Requirement 6: Melhorar responsividade

**User Story:** Como administrador, quero acessar a gestão de usuários em diferentes dispositivos, para poder gerenciar o sistema de qualquer lugar.

#### Acceptance Criteria

1. THE Supabase_Users_List SHALL adaptar layout para telas menores usando cards em vez de tabela
2. THE User_Edit_Page SHALL reorganizar seções em coluna única em dispositivos móveis
3. THE Plan_Assignment dialog SHALL ocupar largura adequada em dispositivos móveis
4. WHILE em dispositivo móvel, THE Admin_Panel SHALL manter todas as funcionalidades acessíveis

