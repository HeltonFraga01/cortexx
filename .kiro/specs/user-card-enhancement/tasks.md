# Implementation Plan: User Card Enhancement

## Overview

Implementação das melhorias no card de usuários, incluindo renomeação de títulos e enriquecimento das informações exibidas.

## Tasks

- [x] 1. Renomear títulos na listagem de usuários
  - [x] 1.1 Alterar título principal de "Usuários do Supabase" para "Usuários" em SupabaseUsersList.tsx
    - Modificar o h2 no header do componente
    - _Requirements: 1.1_
  - [x] 1.2 Alterar título do dialog de criação de "Criar Novo Usuário Supabase" para "Criar Novo Usuário"
    - Modificar DialogTitle e DialogDescription
    - _Requirements: 1.2_

- [x] 2. Melhorar exibição de status de assinatura no SupabaseUserCard
  - [x] 2.1 Atualizar statusConfig com cores corretas por status
    - active: verde (bg-green-50 text-green-700 border-green-200)
    - trial: azul (bg-blue-50 text-blue-700 border-blue-200)
    - past_due, expired, suspended: vermelho (variant destructive)
    - canceled: cinza (variant secondary)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 2.2 Escrever property test para mapeamento de status para cores
    - **Property 1: Status Badge Color Mapping**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 3. Adicionar exibição de último acesso
  - [x] 3.1 Implementar formatação de data de último login em SupabaseUserCard
    - Usar last_sign_in_at do usuário
    - Exibir "Nunca acessou" quando null/undefined
    - Formatar como "Último acesso: dd/MM/yyyy HH:mm"
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 3.2 Escrever property test para formatação de último acesso
    - **Property 2: Last Login Date Formatting**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Melhorar indicador de email confirmado
  - [x] 4.1 Atualizar indicador visual de confirmação de email
    - Manter checkmark verde para email confirmado
    - Manter warning laranja para email não confirmado
    - Tornar indicador mais compacto
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 4.2 Escrever property test para indicador de email
    - **Property 3: Email Confirmation Indicator**
    - **Validates: Requirements 7.1, 7.2**

- [x] 5. Reorganizar layout do card
  - [x] 5.1 Reorganizar informações no SupabaseUserCard
    - Email como identificador principal
    - Role badge (Admin/User) próximo ao email
    - Plan badge e status badge na mesma linha
    - Último acesso e data de criação em linha separada
    - Indicador de email confirmado compacto
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2_
  - [ ]* 5.2 Escrever property test para informações obrigatórias
    - **Property 4: Required Information Display**
    - **Validates: Requirements 5.2, 5.3, 5.4, 6.1, 6.2**

- [x] 6. Checkpoint - Verificar implementação
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implementar funcionalidade de atribuir inbox existente
  - [x] 7.1 Criar endpoint GET /api/admin/inboxes/unassigned no backend
    - Listar inboxes que não estão vinculadas a nenhum usuário
    - Filtrar por tenant_id do admin
    - _Requirements: 8.2_
  - [x] 7.2 Criar endpoint POST /api/admin/users/:userId/inboxes/assign no backend
    - Vincular inbox existente ao usuário
    - Validar que inbox não está atribuída a outro usuário
    - _Requirements: 8.5_
  - [x] 7.3 Adicionar métodos no supabaseUserService
    - `getUnassignedInboxes()` - Listar inboxes não atribuídas
    - `assignInboxToUser(userId, inboxId)` - Atribuir inbox ao usuário
    - _Requirements: 8.2, 8.5_
  - [x] 7.4 Atualizar CreateUserInboxDialog com tabs
    - Adicionar Tabs: "Criar Nova" e "Atribuir Existente"
    - Tab "Criar Nova" mantém comportamento atual
    - Tab "Atribuir Existente" exibe lista de inboxes disponíveis
    - _Requirements: 8.1_
  - [x] 7.5 Implementar busca e seleção de inbox existente
    - Input de busca por nome ou telefone
    - Lista de inboxes com radio buttons
    - Exibir detalhes da inbox selecionada
    - _Requirements: 8.2, 8.3, 8.4_
  - [x] 7.6 Implementar estado vazio quando não há inboxes disponíveis
    - Exibir mensagem "Nenhuma caixa de entrada disponível"
    - Sugerir criar nova inbox
    - _Requirements: 8.6_
  - [x] 7.7 Implementar confirmação de atribuição
    - Chamar endpoint de atribuição
    - Exibir toast de sucesso
    - Atualizar lista de inboxes do usuário
    - _Requirements: 8.5, 8.7_

- [x] 8. Checkpoint Final - Verificar implementação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude
- Unit tests validam exemplos específicos e edge cases
