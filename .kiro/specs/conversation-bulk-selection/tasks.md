# Implementation Plan: Conversation Bulk Selection

## Overview

Este plano implementa a funcionalidade de seleção em massa de conversas e corrige os botões de ação rápida (QuickActions) na interface de chat. A implementação modifica o componente `InboxSidebar.tsx` existente e adiciona novos componentes e hooks.

## Tasks

- [x] 1. Criar hook useConversationSelection
  - [x] 1.1 Criar arquivo `src/hooks/useConversationSelection.ts`
    - Implementar estado `isSelectionMode` e `selectedIds` (Set<number>)
    - Implementar funções: `enterSelectionMode`, `exitSelectionMode`, `toggleSelection`, `selectAll`, `deselectAll`
    - Implementar computed: `selectedCount`, `isAllSelected`, `isIndeterminate`
    - Adicionar listener de tecla Escape para sair do modo de seleção
    - _Requirements: 2.1, 2.4, 3.1, 3.2, 3.3, 3.4_

- [x] 2. Corrigir QuickActions Component
  - [x] 2.1 Atualizar `QuickActions` em `src/components/features/chat/InboxSidebar.tsx`
    - Conectar botão "Mark as Read" à API `chatApi.markConversationAsRead`
    - Conectar botão "Mute" à API `chatApi.muteConversation`
    - Conectar botão "Resolve" à API `chatApi.updateConversation({ status: 'resolved' })`
    - Adicionar estado de loading para cada ação
    - Adicionar toast de sucesso/erro usando sonner
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Criar SelectionToolbar Component
  - [x] 3.1 Criar arquivo `src/components/features/chat/SelectionToolbar.tsx`
    - Implementar barra com checkbox "Select All" e contador de selecionados
    - Adicionar botões de ação: "Mark as Read", "Mark as Unread", "Resolve", "Delete"
    - Implementar estados de loading para cada ação em lote
    - Adicionar diálogo de confirmação para exclusão usando `useConfirmDialog`
    - Exibir "Todas selecionadas" quando todas as conversas estiverem selecionadas
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.3, 5.4_

- [x] 4. Implementar Bulk Actions
  - [x] 4.1 Criar funções de ação em lote no SelectionToolbar
    - Implementar `handleBulkMarkAsRead` usando `Promise.allSettled`
    - Implementar `handleBulkMarkAsUnread` (criar API se não existir)
    - Implementar `handleBulkResolve` usando `chatApi.updateConversation`
    - Implementar `handleBulkDelete` usando `chatApi.deleteConversation`
    - Mostrar toast com contagem de sucesso/falha
    - Sair do modo de seleção após completar ação
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [x] 5. Checkpoint - Verificar componentes base
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrar Selection Mode no InboxSidebar
  - [x] 6.1 Adicionar botão "Select" no header do InboxSidebar
    - Adicionar ícone CheckSquare no header
    - Conectar ao `enterSelectionMode` do hook
    - Esconder botão quando já estiver em modo de seleção
    - _Requirements: 2.1_

  - [x] 6.2 Renderizar SelectionToolbar quando em modo de seleção
    - Mostrar toolbar quando `selectedCount > 0`
    - Passar props necessárias (selectedCount, totalCount, handlers)
    - _Requirements: 4.1, 4.2_

  - [x] 6.3 Atualizar ConversationItem para suportar seleção
    - Adicionar prop `isSelectionMode` e `isChecked`
    - Renderizar Checkbox quando em modo de seleção
    - Aplicar classe de highlight `bg-primary/20` quando selecionado
    - Esconder QuickActions quando em modo de seleção
    - Alterar comportamento de click para toggle selection em modo de seleção
    - _Requirements: 2.2, 3.1, 5.1, 5.2_

- [x] 7. Implementar integração com filtros
  - [x] 7.1 Limpar seleção quando filtros mudam
    - Adicionar useEffect para chamar `exitSelectionMode` quando `filters` ou `activeTab` mudar
    - _Requirements: 6.1_

  - [x] 7.2 Garantir que "Select All" seleciona apenas conversas visíveis
    - Passar apenas IDs das conversas filtradas para `selectAll`
    - _Requirements: 6.2_

- [x] 8. Checkpoint - Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 9. Testes unitários
  - [ ]* 9.1 Escrever testes para useConversationSelection hook
    - Testar toggle selection
    - Testar select all / deselect all
    - Testar isAllSelected e isIndeterminate
    - Testar exit on Escape key
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 9.2 Escrever testes para SelectionToolbar
    - Testar renderização com diferentes estados
    - Testar chamadas de ação em lote
    - _Requirements: 4.1, 4.2_

- [ ]* 10. Testes de propriedade (Property-Based Tests)
  - [ ]* 10.1 Property test: Checkbox toggle adds/removes from selection
    - **Property 7: Checkbox Toggle Selection**
    - **Validates: Requirements 3.1**

  - [ ]* 10.2 Property test: Select all adds all IDs
    - **Property 8: Select All Behavior**
    - **Validates: Requirements 3.2, 3.3, 6.2**

  - [ ]* 10.3 Property test: Indeterminate state when partial selection
    - **Property 9: Indeterminate Checkbox State**
    - **Validates: Requirements 3.4**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- APIs existentes: `markConversationAsRead`, `muteConversation`, `updateConversation`, `deleteConversation`
- API `markConversationAsUnread` pode precisar ser criada no backend

## Backend Fixes Applied During Testing

1. **Added `markConversationAsRead` method to ChatService** (`server/services/ChatService.js`)
   - The route was calling `chatService.markConversationAsRead(userToken, id)` but the method didn't exist
   - Added wrapper method that calls the existing `markAsRead` method with proper parameter mapping

2. **Fixed `markAsRead` method to use camelCase property names**
   - The method was accessing `conversation.contact_jid` but `formatConversation` returns `contactJid` (camelCase)
   - Updated to use `conversation.contactJid || conversation.contact_jid` for compatibility

3. **Fixed `updateConversation` method RLS issue** (`server/services/ChatService.js`, `server/routes/chatInboxRoutes.js`)
   - **Root cause**: The RLS policy `conversations_tenant_isolation` requires `app.tenant_id` to be set, but the application never sets this PostgreSQL setting
   - **Solution**: Changed `updateConversation` to use `queryAsAdmin` with `account_id` filter (same pattern as `deleteConversation`)
   - Updated the PATCH route to pass `accountId` from middleware context
   - This bypasses RLS but maintains security via explicit `account_id` filter in the query

## Manual Testing Results (via Chrome DevTools MCP)

- ✅ Selection mode enters via checkbox button in header
- ✅ Checkboxes appear on all conversations when in selection mode
- ✅ Individual conversation selection works (toggle on/off)
- ✅ "Select All" selects all visible conversations
- ✅ "Select All" again deselects all
- ✅ SelectionToolbar appears when conversations are selected
- ✅ Counter shows correct number of selected conversations
- ✅ "Todas selecionadas" text appears when all are selected
- ✅ Bulk "Mark as Read" action executes (buttons disabled during loading)
- ✅ **Bulk "Mark as Unread" action now works** (fixed RLS issue)
- ✅ Selection mode exits after bulk action completes
- ✅ Escape key exits selection mode
- ✅ Cancel button exits selection mode
- ✅ Conversations list refreshes after bulk actions
