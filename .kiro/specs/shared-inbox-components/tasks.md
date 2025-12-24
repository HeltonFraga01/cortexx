# Implementation Plan: Shared Inbox Components

## Overview

Criar componentes compartilhados de inbox para reutilização entre admin e user dashboards.

## Tasks

- [x] 1. Criar estrutura de tipos compartilhados
  - Criar `src/components/shared/inbox/types.ts`
  - Interface `InboxInfoCardProps` com todos os campos
  - Interface `ConnectionControlCardProps`
  - Interface `WebhookConfigCardProps`
  - Interface `AvailableEvent` para lista de eventos
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Criar componente InboxInfoCard
  - Criar `src/components/shared/inbox/InboxInfoCard.tsx`
  - Avatar com indicador de status
  - Nome, telefone e JID com botões de copiar
  - Token com toggle show/hide e botão copiar
  - Badge de status (Conectado/Desconectado)
  - Suporte a variant "compact" e "full"
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 3. Criar componente ConnectionControlCard
  - Criar `src/components/shared/inbox/ConnectionControlCard.tsx`
  - Botões baseados no estado de conexão
  - Loading states nos botões
  - Cores consistentes (verde/laranja/vermelho)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 4. Criar componente WebhookConfigCard
  - Criar `src/components/shared/inbox/WebhookConfigCard.tsx`
  - Input de URL com validação
  - Eventos agrupados por categoria
  - Checkbox "Todos os Eventos"
  - Badge com contagem de eventos
  - Modo readOnly funcional
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 5. Criar arquivo de exports
  - Criar `src/components/shared/inbox/index.ts`
  - Export de todos os componentes e tipos
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 6. Criar adaptadores de dados
  - Criar `src/lib/adapters/inbox-adapters.ts`
  - Função `adaptWuzapiUserToInboxInfo`
  - Função `adaptConnectionDataToInboxInfo`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Integrar componentes no User Dashboard
  - Modificar `src/components/user/UserOverview.tsx`
  - Usar componentes compartilhados
  - Usar adapter `adaptConnectionDataToInboxInfo`
  - Adicionar estado local para webhook config com onChange
  - Implementar hasWebhookChanges() para detectar mudanças
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 8. Refatorar UserEditForm para usar componentes compartilhados
  - Modificar `src/components/admin/UserEditForm.tsx`
  - Usar WebhookConfigCard compartilhado
  - Remover lista duplicada de availableEvents
  - Adicionar estado local para webhook config
  - Manter seções específicas do admin (Supabase, ações)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 9. Deprecar componentes antigos
  - Adicionar @deprecated em UserInfoCardModern.tsx
  - Adicionar @deprecated em ConnectionControlCardModern.tsx
  - Adicionar @deprecated em WebhookConfigCardModern.tsx
  - Atualizar index.ts com avisos de deprecação
  - _Requirements: 6.6_

- [x] 10. Checkpoint - Validação final
  - Verificar TypeScript sem erros em todos os arquivos
  - Componentes compartilhados funcionando em UserOverview
  - Componentes compartilhados funcionando em UserEditForm
  - Componentes antigos marcados como deprecated

## Bug Fixes

- [x] 11. Corrigir status de conexão no InboxInfoCard (User Dashboard)
  - **Problema:** O card mostrava "Desconectado" enquanto o header mostrava "Conectado"
  - **Causa:** O `InboxInfoCard` usava `sessionStatus` do hook que pode estar desatualizado
  - **Solução:** Usar `inboxContext.availableInboxes` como fonte de verdade (igual ao header)
  - **Arquivo:** `src/components/user/UserOverview.tsx`
  - **Data:** 2024-12-24

- [ ] 12. Corrigir sincronização de status entre header e InboxInfoCard
  - **Problema:** Header mostra "Conectado" mas InboxInfoCard mostra "Desconectado"
  - **Causa raiz identificada:**
    1. Header usa `availableInboxes[].isConnected` do `SupabaseInboxContext`
    2. `SupabaseInboxContext` usa `/inbox-status` que chama `checkInboxConnectionStatus()`
    3. `checkInboxConnectionStatus()` retornava apenas `wuzapi_connected` do banco (não consultava WUZAPI)
    4. `InboxInfoCard` usa `sessionStatus` do `useInboxConnectionData` que consulta `/inbox/:id/status`
    5. `/inbox/:id/status` consulta WUZAPI e retorna `{ connected, loggedIn }`
  - **Correções aplicadas:**
    1. `server/services/InboxContextService.js`: `checkInboxConnectionStatus()` agora consulta WUZAPI
    2. `src/hooks/useInboxConnectionData.ts`: `loadAllData()` usa `Promise.allSettled` para não falhar silenciosamente
    3. Adicionado debug logging para rastrear valores
  - **Arquivos modificados:**
    - `server/services/InboxContextService.js`
    - `src/hooks/useInboxConnectionData.ts`
    - `src/components/user/UserOverview.tsx`
  - **Data:** 2024-12-24
  - **Status:** Em teste - aguardando validação do usuário
