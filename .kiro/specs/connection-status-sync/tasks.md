# Implementation Plan: Connection Status Sync

## Overview

Implementação da sincronização de status de conexão entre componentes e gerenciamento completo de inboxes pelo usuário.

## Tasks

- [x] 1. Atualizar SupabaseInboxContext com função de sincronização
  - [x] 1.1 Adicionar campo `isLoggedIn` ao tipo InboxSummary
    - Modificar interface em `src/contexts/SupabaseInboxContext.tsx`
    - _Requirements: 2.3_
  - [x] 1.2 Implementar função `updateInboxStatus(inboxId, status)`
    - Adicionar ao contexto para atualizar isConnected/isLoggedIn de uma inbox específica
    - _Requirements: 1.1, 2.1, 2.2_
  - [ ]* 1.3 Escrever teste de propriedade para sincronização de status
    - **Property 1: Context Status Synchronization**
    - **Validates: Requirements 1.1, 2.1, 2.2, 2.3**

- [x] 2. Modificar hook useInboxConnectionData para atualizar contexto
  - [x] 2.1 Integrar com SupabaseInboxContext
    - Chamar `updateInboxStatus` quando receber status do WUZAPI
    - Usar `useSupabaseInboxOptional` para obter a função
    - _Requirements: 2.1, 2.2_
  - [x] 2.2 Garantir fallback para status do banco quando WUZAPI falhar
    - _Requirements: 1.4_

- [x] 3. Atualizar componentes para usar status do contexto
  - [x] 3.1 Modificar ConnectionControlCard para usar status do contexto
    - Obter isConnected/isLoggedIn de availableInboxes em vez de sessionStatus local
    - _Requirements: 1.2, 3.2, 3.4_
  - [x] 3.2 Verificar UnifiedInboxSelector já usa contexto corretamente
    - Confirmar que usa inbox.isConnected do availableInboxes
    - _Requirements: 3.1, 3.3_
  - [ ]* 3.3 Escrever teste de propriedade para consistência visual
    - **Property 2: Visual Indicator Consistency**
    - **Validates: Requirements 1.2, 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 4. Checkpoint - Verificar sincronização de status
  - Testar manualmente: conectar/desconectar e verificar que toggle e card mostram mesmo status
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implementar endpoint de quota de inboxes
  - [x] 5.1 Criar endpoint GET /api/user/inboxes/quota
    - Retornar { current, limit, canCreate }
    - Buscar limite do plano do usuário
    - _Requirements: 7.1, 7.4_
  - [x] 5.2 Adicionar validação de quota no endpoint de criação de inbox
    - Verificar quota antes de permitir criação
    - Retornar erro QUOTA_EXCEEDED se limite atingido
    - _Requirements: 5.2, 7.4_
  - [ ]* 5.3 Escrever teste de propriedade para enforcement de quota
    - **Property 3: Quota Enforcement**
    - **Validates: Requirements 5.2, 7.2, 7.4**

- [x] 6. Criar serviço frontend para quota
  - [x] 6.1 Criar função getInboxQuota em src/services/account-inboxes.ts
    - Chamar endpoint de quota
    - _Requirements: 7.1_
  - [x] 6.2 Criar hook useInboxQuota
    - Gerenciar estado de quota com polling ou refresh manual
    - _Requirements: 7.1, 7.2_

- [x] 7. Atualizar página de listagem de inboxes do usuário
  - [x] 7.1 Adicionar exibição de quota (ex: "3/5 caixas")
    - Usar hook useInboxQuota
    - _Requirements: 7.1_
  - [x] 7.2 Desabilitar botão "Criar" quando quota atingida
    - Mostrar tooltip explicando o limite
    - _Requirements: 7.2, 7.3_
  - [ ]* 7.3 Escrever teste de propriedade para display de quota
    - **Property 4: Quota Display Accuracy**
    - **Validates: Requirements 7.1, 7.2**

- [x] 8. Implementar controles de conexão na lista de inboxes
  - [x] 8.1 Adicionar botões de ação em cada inbox card
    - Conectar, Desconectar, Logout, Gerar QR Code
    - Usar mesma lógica do admin
    - _Requirements: 5.6, 6.1, 6.2, 6.3, 6.4_
  - [x] 8.2 Implementar handlers de conexão
    - Chamar WUZAPI e atualizar contexto após ação
    - _Requirements: 6.5_
  - [x] 8.3 Adicionar estados de loading durante operações
    - _Requirements: 6.6_
  - [ ]* 8.4 Escrever teste de propriedade para atualização após ação
    - **Property 5: Connection Action Status Update**
    - **Validates: Requirements 4.1, 6.5**

- [x] 9. Implementar CRUD completo de inboxes
  - [x] 9.1 Criar modal/página de criação de inbox
    - Campos: nome, telefone, token WUZAPI
    - Validar quota antes de submeter
    - _Requirements: 5.2_
  - [x] 9.2 Criar modal/página de edição de inbox
    - Permitir editar nome, telefone, token
    - _Requirements: 5.4_
  - [x] 9.3 Implementar exclusão com confirmação
    - Dialog de confirmação antes de excluir
    - _Requirements: 5.5_

- [x] 10. Checkpoint Final
  - Testar fluxo completo: criar inbox → conectar → verificar status → editar → excluir
  - Verificar que quota é respeitada
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Corrigir tratamento de erro "already connected"
  - [x] 11.1 Atualizar handleConnect em UserOverview.tsx
    - Verificar status antes de tentar conectar
    - Tratar erro "already connected" como sucesso
    - _Requirements: 8.1, 8.2, 9.1_
  - [x] 11.2 Atualizar handleConnect em InboxListUser.tsx
    - Aplicar mesma lógica de verificação prévia
    - _Requirements: 8.1, 8.2, 9.1_
  - [x] 11.3 Atualizar handleConnect em UserInboxEditPage.tsx
    - Aplicar mesma lógica de verificação prévia
    - _Requirements: 8.1, 8.2, 9.1_

- [ ] 12. Melhorar feedback visual de status
  - [ ] 12.1 Adicionar verificação de status stale
    - Se status tem mais de 30 segundos, buscar novo antes de ação
    - _Requirements: 9.3_
  - [ ] 12.2 Exibir timestamp da última atualização de status
    - Mostrar "Atualizado há X segundos" no card de conexão
    - _Requirements: 9.4_

- [x] 14. Sincronizar status de conexão entre Dashboard e Inbox Selector
  - [x] 14.1 Atualizar SupabaseInboxContext para usar getInboxStatus de account-inboxes.ts
    - Usar a mesma API que InboxListUser.tsx usa (getInboxStatus por inboxId)
    - _Requirements: 1.1, 2.1, 2.2_
  - [x] 14.2 Modificar checkStatus para buscar status de TODAS as inboxes
    - Polling paralelo de todas as inboxes disponíveis
    - Atualizar availableInboxes com status correto
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 14.3 Garantir que InboxSelector e UnifiedInboxSelector usam status do contexto
    - Ambos já usam availableInboxes.isConnected do contexto
    - _Requirements: 3.1, 3.3_
  - [x] 14.4 Garantir que Dashboard (InboxOverviewCard) usa status do contexto
    - UserDashboardModern passa availableInboxes para InboxOverviewCard
    - _Requirements: 3.2, 3.4_

- [ ] 13. Checkpoint - Testar tratamento de erros
  - Testar: clicar em Conectar quando já conectado → deve mostrar "Já conectado"
  - Testar: clicar em Desconectar quando já desconectado → deve mostrar "Já desconectado"
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais (testes de propriedade)
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de correção
- Unit tests validam exemplos específicos e edge cases
