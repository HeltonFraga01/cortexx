# Implementation Plan: Unified Inbox Selector

## Overview

Este plano implementa a unificação do seletor de inbox em um único componente no header, removendo a duplicação no chat sidebar e adicionando suporte a seleção múltipla e "Todas as Caixas".

## Tasks

- [x] 1. Atualizar contexto de inbox para suportar seleção múltipla
  - [x] 1.1 Atualizar SupabaseInboxContext com novo estado de seleção
    - Adicionar tipo `InboxSelection = 'all' | string[]`
    - Adicionar estado `selection` e `selectedInboxIds`
    - Adicionar helpers `isAllSelected`, `isInboxSelected`, `getSelectedCount`
    - _Requirements: 2.2, 3.2_
  - [x] 1.2 Implementar ações de seleção
    - Implementar `selectAll()` para selecionar todas as caixas
    - Implementar `toggleInbox(inboxId)` para alternar seleção
    - Implementar `selectSingle(inboxId)` para selecionar apenas uma
    - Garantir que pelo menos uma inbox fique selecionada
    - _Requirements: 3.4, 3.5_
  - [x] 1.3 Adicionar agregação de estatísticas
    - Calcular `totalUnreadCount` somando todas as inboxes
    - Calcular `hasDisconnectedInbox` verificando status de conexão
    - _Requirements: 2.4, 6.4, 7.5_

- [x] 2. Implementar persistência de seleção
  - [x] 2.1 Criar endpoint GET /api/user/inbox-selection
    - Buscar seleção salva em user_preferences
    - Retornar 'all' como padrão se não existir
    - Filtrar inboxes que não existem mais
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 2.2 Criar endpoint POST /api/user/inbox-selection
    - Validar que inboxIds são válidos
    - Salvar em user_preferences com key 'inbox_selection'
    - _Requirements: 5.1_
  - [x] 2.3 Integrar persistência no contexto
    - Carregar seleção ao inicializar contexto
    - Salvar automaticamente quando seleção muda
    - _Requirements: 5.1, 5.2_

- [x] 3. Criar componente UnifiedInboxSelector
  - [x] 3.1 Criar arquivo src/components/shared/UnifiedInboxSelector.tsx
    - Estrutura base com DropdownMenu
    - Usar contexto de inbox atualizado
    - _Requirements: 2.1, 3.1_
  - [x] 3.2 Implementar opção "Todas as Caixas"
    - Primeira opção do dropdown
    - Checkbox marcado quando isAllSelected
    - Exibir total de mensagens não lidas
    - Indicador amarelo se alguma inbox desconectada
    - _Requirements: 2.1, 2.3, 6.4, 7.5_
  - [x] 3.3 Implementar lista de inboxes com checkboxes
    - Checkbox para cada inbox
    - Badge com contagem de não lidas (ocultar se zero)
    - Indicador de status de conexão (verde/vermelho)
    - _Requirements: 3.1, 6.1, 6.3, 7.1, 7.2, 7.3_
  - [x] 3.4 Implementar lógica de seleção
    - Toggle ao clicar em checkbox
    - Prevenir desmarcar última inbox
    - Atualizar texto do botão baseado na seleção
    - _Requirements: 3.4, 3.5, 3.6_
  - [x] 3.5 Implementar texto dinâmico do botão
    - "Todas as Caixas" quando all selecionado
    - Nome da inbox quando apenas uma selecionada
    - "X caixas selecionadas" quando múltiplas
    - _Requirements: 2.3, 3.3, 3.6_

- [x] 4. Checkpoint - Componente UnifiedInboxSelector completo
  - Componente renderiza corretamente
  - Seleção funciona (all, single, multiple)
  - Persistência funcionando

- [x] 5. Remover seletor duplicado do Chat Sidebar
  - [x] 5.1 Remover InboxSelector do InboxSidebar
    - Remover import do InboxSelector
    - Remover JSX do InboxSelector
    - Remover estado local de currentInbox
    - _Requirements: 1.1, 1.2_
  - [x] 5.2 Atualizar filtro de conversas para usar contexto
    - Usar selectedInboxIds do contexto unificado
    - Atualizar effectiveFilters para suportar array de inboxIds
    - _Requirements: 1.3, 1.4_
  - [x] 5.3 Atualizar hook useChatInbox
    - Remover estado local de currentInbox
    - Usar seleção do contexto unificado
    - _Requirements: 1.3_

- [x] 6. Criar componente ConversationInboxBadge
  - [x] 6.1 Criar arquivo src/components/features/chat/ConversationInboxBadge.tsx
    - Badge compacto com nome/ícone da inbox
    - Cores distintivas por inbox
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 6.2 Integrar badge no ConversationItem
    - Mostrar badge apenas quando múltiplas inboxes selecionadas
    - Posicionar de forma compacta
    - _Requirements: 4.1, 4.4_

- [x] 7. Atualizar backend para suportar filtro por múltiplas inboxes
  - [x] 7.1 Atualizar endpoint de conversas para aceitar array de inboxIds
    - Modificar GET /api/chat/inbox/conversations
    - Aceitar parâmetro inboxIds como array
    - Filtrar por IN (inboxIds) quando fornecido
    - _Requirements: 3.2_
  - [x] 7.2 Atualizar serviço de conversas
    - Modificar query para suportar múltiplos inboxIds
    - _Requirements: 3.2_

- [x] 8. Substituir InboxSelector antigo pelo UnifiedInboxSelector no Header
  - [x] 8.1 Atualizar UserLayout para usar UnifiedInboxSelector
    - Substituir InboxSelector por UnifiedInboxSelector
    - Manter mesma posição no header
    - _Requirements: 1.1_

- [x] 9. Checkpoint - Integração completa
  - Seletor unificado no header funcionando
  - Chat sidebar usando contexto para filtrar
  - Badge de inbox aparecendo quando necessário

- [ ]* 10. Escrever testes
  - [ ]* 10.1 Testes unitários para UnifiedInboxSelector
    - Testar renderização de opções
    - Testar lógica de seleção
    - _Requirements: 2.1, 3.1_
  - [ ]* 10.2 Property test: Context-Driven Filtering
    - **Property 1: Context-Driven Filtering**
    - **Validates: Requirements 1.3, 1.4**
  - [ ]* 10.3 Property test: Multi-Select Filtering
    - **Property 3: Multi-Select Filtering**
    - **Validates: Requirements 3.2**
  - [ ]* 10.4 Property test: Minimum Selection Constraint
    - **Property 6: Minimum Selection Constraint**
    - **Validates: Requirements 3.5**
  - [ ]* 10.5 Property test: Selection Persistence Round-Trip
    - **Property 8: Selection Persistence Round-Trip**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [ ]* 10.6 Property test: Unread Count Aggregation
    - **Property 9: Unread Count Aggregation**
    - **Validates: Requirements 2.4, 6.4**

- [x] 11. Final checkpoint
  - Seletor unificado funcionando no header
  - Seletor removido do chat sidebar
  - Seleção múltipla e "Todas as Caixas" funcionando
  - Badge de inbox nas conversas quando necessário
  - Persistência de seleção funcionando

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude
- Unit tests validam exemplos específicos e edge cases

</content>
</invoke>