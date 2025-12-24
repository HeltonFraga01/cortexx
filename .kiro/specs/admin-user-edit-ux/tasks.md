# Implementation Plan: Admin User Edit UX Improvements

## Overview

Este plano implementa as melhorias de UX/UI para a gestão de usuários admin, incluindo visualização de planos na lista, ações rápidas via modal, e navegação contextual. A implementação segue uma abordagem incremental, começando pelos componentes base e progredindo para a integração completa.

## Tasks

- [x] 1. Criar serviço para buscar subscriptions de usuários
  - Adicionar endpoint no backend para listar subscriptions por user IDs
  - Criar função no `admin-subscriptions.ts` para buscar subscriptions em batch
  - _Requirements: 1.1, 1.3_

- [x] 2. Criar componente PlanPreviewCard
  - [x] 2.1 Implementar componente visual do card de plano
    - Criar `src/components/admin/PlanPreviewCard.tsx`
    - Exibir nome, preço formatado, ciclo de cobrança
    - Exibir lista de features com ícones de check/x
    - Implementar estado de seleção com destaque visual
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 2.2 Escrever testes para PlanPreviewCard
    - Testar renderização com diferentes planos
    - Testar estado de seleção
    - **Property 3: Plan preview completeness**
    - **Validates: Requirements 4.1, 4.2**

- [x] 3. Criar componente PlanAssignmentDialog
  - [x] 3.1 Implementar dialog modal de atribuição de plano
    - Criar `src/components/admin/PlanAssignmentDialog.tsx`
    - Buscar lista de planos disponíveis
    - Renderizar PlanPreviewCard para cada plano
    - Implementar seleção de plano
    - Implementar botões de confirmar/cancelar
    - Chamar API de atribuição ao confirmar
    - Exibir feedback de sucesso/erro
    - _Requirements: 2.2, 2.3, 2.5, 4.4, 4.5_

  - [ ]* 3.2 Escrever testes para PlanAssignmentDialog
    - Testar abertura/fechamento do dialog
    - Testar seleção de plano
    - Testar fluxo de confirmação
    - Testar tratamento de erro

- [x] 4. Criar componente SupabaseUserCard
  - [x] 4.1 Implementar card de usuário
    - Criar `src/components/admin/SupabaseUserCard.tsx`
    - Exibir email, role, status de confirmação
    - Exibir badge de plano (nome ou "Sem plano")
    - Exibir status da assinatura quando houver
    - Implementar botões de ação (Editar, Atribuir Plano, Excluir)
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.4_

  - [ ]* 4.2 Escrever testes para SupabaseUserCard
    - Testar renderização com usuário com plano
    - Testar renderização com usuário sem plano
    - **Property 1: User plan status display consistency**
    - **Property 2: Plan assignment CTA visibility**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1**

- [x] 5. Refatorar SupabaseUsersList para usar cards
  - [x] 5.1 Atualizar componente para layout de cards
    - Modificar `src/components/admin/SupabaseUsersList.tsx`
    - Buscar subscriptions junto com usuários
    - Substituir tabela por grid de SupabaseUserCard
    - Integrar PlanAssignmentDialog
    - Manter funcionalidades de busca e paginação
    - _Requirements: 1.4, 2.1, 2.2, 2.3_

  - [ ]* 5.2 Escrever testes de integração
    - Testar listagem com diferentes usuários
    - Testar fluxo de atribuição de plano
    - Testar atualização da lista após atribuição

- [x] 6. Checkpoint - Verificar lista de usuários
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Criar componente UserEditBreadcrumb
  - [x] 7.1 Implementar breadcrumb de navegação
    - Criar `src/components/admin/UserEditBreadcrumb.tsx`
    - Exibir caminho: Admin > Multi-Usuário > Editar [userName]
    - Links clicáveis para navegação
    - _Requirements: 5.1_

- [x] 8. Melhorar seção de plano no UserEditForm
  - [x] 8.1 Adicionar destaque visual para usuários sem plano
    - Modificar `src/components/admin/UserEditForm.tsx`
    - Adicionar borda/background de destaque quando sem plano
    - Melhorar CTA de atribuição de plano
    - Integrar PlanAssignmentDialog
    - _Requirements: 3.2, 3.3_

  - [ ]* 8.2 Escrever testes para seção de plano
    - Testar destaque visual sem plano
    - Testar CTA de atribuição
    - **Property 2: Plan assignment CTA visibility**
    - **Validates: Requirements 3.2, 3.3**

- [x] 9. Adicionar navegação contextual
  - [x] 9.1 Implementar navegação na página de edição
    - Adicionar UserEditBreadcrumb no topo
    - Adicionar botão "Voltar para lista"
    - Implementar opções após salvar (voltar ou continuar)
    - _Requirements: 5.2, 5.3_

  - [x] 9.2 Implementar persistência de estado na lista
    - Salvar filtros e paginação no URL ou sessionStorage
    - Restaurar estado ao retornar da edição
    - _Requirements: 5.4_

- [x] 10. Implementar responsividade
  - [x] 10.1 Ajustar layout para mobile
    - Configurar breakpoints no grid de cards
    - Ajustar PlanAssignmentDialog para mobile
    - Reorganizar seções do UserEditForm em coluna
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 10.2 Escrever testes de responsividade
    - Testar layout em diferentes viewports
    - Verificar acessibilidade de funcionalidades

- [x] 11. Checkpoint final - Verificar implementação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades de correção universais
- Unit tests validam exemplos específicos e edge cases

