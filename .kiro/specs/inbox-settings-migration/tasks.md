# Implementation Plan: Inbox Settings Migration

## Overview

Este plano implementa a migração de configurações de webhooks de chat da página de Settings para a página de edição de inbox. A implementação segue uma abordagem em fases para garantir compatibilidade retroativa e transição suave.

## Tasks

- [x] 1. Migração de Banco de Dados
  - [x] 1.1 Criar migration para adicionar inbox_id à tabela outgoing_webhooks
    - Adicionar coluna `inbox_id` (uuid, nullable)
    - Adicionar FK constraint referenciando `inboxes(id)` com ON DELETE CASCADE
    - Criar índice `idx_outgoing_webhooks_inbox_id`
    - Criar índice composto `idx_outgoing_webhooks_user_inbox`
    - Adicionar constraint unique `unique_user_inbox_url` em (user_id, inbox_id, url)
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [ ]* 1.2 Escrever property test para cascade delete
    - Criar webhook com inbox_id, deletar inbox, verificar webhook deletado
    - **Property 1: Foreign Key Cascade Delete**
    - **Validates: Requirements 1.2**

  - [ ]* 1.3 Escrever property test para unique constraint
    - Tentar criar webhooks duplicados, verificar erro de constraint
    - **Property 2: Unique Constraint Enforcement**
    - **Validates: Requirements 1.6**

- [x] 2. Atualizar OutgoingWebhookService
  - [x] 2.1 Adicionar parâmetro inboxId ao método configureWebhook
    - Aceitar `inboxId` opcional no objeto de dados
    - Salvar `inbox_id` no banco de dados
    - _Requirements: 3.1_

  - [x] 2.2 Adicionar método validateInboxOwnership
    - Verificar se inbox pertence ao usuário via accounts.owner_user_id
    - Lançar erro se não pertencer
    - _Requirements: 3.6_

  - [x] 2.3 Atualizar método getWebhooks para filtrar por inboxId
    - Aceitar `inboxId` opcional
    - Filtrar por `inbox_id` quando fornecido
    - Retornar webhooks com `inbox_id IS NULL` quando `inboxId === null`
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 2.4 Atualizar método sendWebhookEvent para aceitar inboxId
    - Tornar `inboxId` parâmetro obrigatório
    - Buscar webhooks da inbox específica
    - Também buscar webhooks legados (inbox_id IS NULL) para compatibilidade
    - _Requirements: 3.5, 8.1, 8.2, 9.1, 9.2_

  - [x] 2.5 Atualizar método formatWebhook para incluir inboxId
    - Adicionar `inboxId` ao objeto retornado
    - _Requirements: 4.6_

  - [ ]* 2.6 Escrever property test para filtragem por inbox
    - Gerar webhooks em múltiplas inboxes, verificar filtragem correta
    - **Property 3: Webhook Filtering by Inbox**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 2.7 Escrever property test para validação de ownership
    - Tentar acessar webhook de outra inbox, verificar erro 403
    - **Property 4: Inbox Ownership Validation**
    - **Validates: Requirements 3.6, 4.3, 4.4, 4.5**

- [x] 3. Checkpoint - Verificar backend
  - Executar testes do OutgoingWebhookService
  - Verificar que migration aplica corretamente
  - Verificar que API continua funcionando (backward compatible)

- [x] 4. Atualizar API Routes
  - [x] 4.1 Atualizar GET /api/user/outgoing-webhooks
    - Aceitar query param `inboxId`
    - Passar para `getWebhooks(userId, inboxId)`
    - _Requirements: 4.1_

  - [x] 4.2 Atualizar POST /api/user/outgoing-webhooks
    - Aceitar `inboxId` no body
    - Validar ownership se inboxId fornecido
    - Passar para `configureWebhook(userId, { inboxId, ... })`
    - _Requirements: 4.2_

  - [x] 4.3 Atualizar PUT /api/user/outgoing-webhooks/:id
    - Validar ownership do webhook
    - Não permitir alterar inbox_id de webhook existente
    - _Requirements: 4.3_

  - [x] 4.4 Atualizar DELETE /api/user/outgoing-webhooks/:id
    - Validar ownership do webhook
    - _Requirements: 4.4_

  - [ ]* 4.5 Escrever property test para isolamento de eventos
    - Gerar eventos em inbox A, verificar que só webhooks de A recebem
    - **Property 5: Event Isolation by Inbox**
    - **Validates: Requirements 8.1, 8.3**

- [x] 5. Criar Script de Migração de Dados
  - [x] 5.1 Criar script para associar webhooks existentes à inbox principal
    - Identificar webhooks com inbox_id NULL
    - Para cada usuário, encontrar primeira inbox ativa
    - Atualizar webhook com inbox_id da inbox principal
    - Logar todas as mudanças
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.2 Escrever property test para idempotência da migração
    - Executar migração duas vezes, verificar mesmo resultado
    - **Property 7: Migration Idempotency**
    - **Validates: Requirements 2.6**

  - [ ]* 5.3 Escrever property test para seleção de inbox primária
    - Criar usuário com múltiplas inboxes, verificar seleção determinística
    - **Property 8: Primary Inbox Selection**
    - **Validates: Requirements 2.2**

- [x] 6. Checkpoint - Verificar migração de dados
  - Executar script de migração em ambiente de teste
  - Verificar que webhooks foram associados corretamente
  - Verificar que webhooks de usuários sem inbox permanecem NULL

- [x] 7. Criar Componentes Frontend
  - [x] 7.1 Criar serviço de API para webhooks com inboxId
    - Atualizar `src/services/chat.ts`
    - Adicionar `getOutgoingWebhooks(inboxId?: string)`
    - Adicionar `createOutgoingWebhook(data: CreateWebhookData)`
    - _Requirements: 5.1_

  - [x] 7.2 Criar componente OutgoingWebhookList
    - Criar `src/components/features/chat/settings/OutgoingWebhookList.tsx`
    - Listar webhooks da inbox atual
    - Permitir criar, editar, deletar webhooks
    - Mostrar estatísticas (success/failure counts)
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 7.3 Criar componente ChatIntegrationSection
    - Criar `src/components/features/chat/settings/ChatIntegrationSection.tsx`
    - Incluir IncomingWebhookConfig
    - Incluir OutgoingWebhookList
    - _Requirements: 5.1, 5.8, 10.4_

  - [x] 7.4 Atualizar IncomingWebhookConfig para aceitar inboxId como prop
    - Modificar para não depender de InboxContext
    - Aceitar `inboxId` como prop obrigatória
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Integrar na Página de Edição de Inbox
  - [x] 8.1 Adicionar ChatIntegrationSection ao UserInboxEditPage
    - Importar ChatIntegrationSection
    - Posicionar após Bot Assignment
    - Passar inboxId como prop
    - _Requirements: 5.1, 10.2_

- [x] 9. Checkpoint - Verificar frontend
  - Testar criação de webhook na inbox edit page
  - Testar edição e deleção de webhook
  - Verificar que webhooks são filtrados por inbox

- [x] 10. Remover Tab de Settings
  - [x] 10.1 Remover tab "Integração Chat" de UserSettings.tsx
    - Remover TabsTrigger value="webhooks-chat"
    - Remover TabsContent value="webhooks-chat"
    - Atualizar grid-cols de 7 para 6
    - Remover import de WebhookSettings
    - Remover InboxProvider wrapper
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 11. Adicionar Avisos de Migração
  - [ ] 11.1 Adicionar aviso na página de Settings (opcional)
    - Mostrar notice sobre configurações movidas para inbox edit
    - Incluir link para página de inboxes
    - _Requirements: 11.1, 11.2_

  - [ ] 11.2 Adicionar tooltip explicativo na inbox edit page
    - Explicar diferença entre webhook WUZAPI e webhooks de chat
    - _Requirements: 11.3, 11.4_

- [x] 12. Checkpoint Final
  - Verificar que Settings tem 6 tabs
  - Verificar que inbox edit page tem seção de integrações
  - Verificar que webhooks são isolados por inbox
  - Verificar que webhooks legados continuam funcionando

- [ ]* 13. Escrever property test para compatibilidade legada
  - Criar webhook sem inbox_id, verificar que recebe eventos de todas inboxes
  - **Property 6: Legacy Webhook Compatibility**
  - **Validates: Requirements 9.1, 9.2**

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- A migração de banco de dados é non-breaking (inbox_id é nullable)
- Backend é atualizado de forma backward-compatible antes do frontend
- Script de migração de dados pode ser executado a qualquer momento após task 1
- Checkpoints garantem validação incremental
- Property tests usam `fast-check` para JavaScript/TypeScript
