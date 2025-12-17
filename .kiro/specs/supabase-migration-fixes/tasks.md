# Implementation Plan

## Supabase Migration Fixes

- [x] 1. Refatorar OutgoingWebhookService para usar SupabaseService
  - [x] 1.1 Remover dependência de `this.db` e usar `supabaseService` diretamente
    - Substituir `this.db.query()` por métodos do SupabaseService
    - Atualizar construtor para não receber `db` como parâmetro
    - _Requirements: 1.1, 1.2, 6.1_
  - [x] 1.2 Refatorar método `getWebhooks()` para usar `supabaseService.getMany()`
    - Usar `supabaseService.queryAsAdmin()` para queries customizadas
    - Manter formatação de resposta compatível
    - _Requirements: 1.3_
  - [x] 1.3 Refatorar método `getWebhookById()` para usar `supabaseService.getOne()`
    - _Requirements: 1.1_
  - [x] 1.4 Refatorar método `configureWebhook()` para usar `supabaseService.insert()`
    - _Requirements: 1.1_
  - [x] 1.5 Refatorar método `updateWebhook()` para usar `supabaseService.update()`
    - _Requirements: 1.1_
  - [x] 1.6 Refatorar método `deleteWebhook()` para usar `supabaseService.delete()`
    - _Requirements: 1.1_
  - [x] 1.7 Refatorar métodos de logging e stats para usar SupabaseService
    - `logDelivery()`, `updateWebhookStats()`, `getWebhookStats()`
    - _Requirements: 1.1_
  - [ ]* 1.8 Write property test for webhook retrieval
    - **Property 1: Webhook retrieval returns valid array**
    - **Validates: Requirements 1.1, 1.3**

- [x] 2. Adicionar métodos de Labels ao ChatService
  - [x] 2.1 Implementar método `getLabels(token)`
    - Usar `supabaseService.getMany()` para buscar labels do usuário
    - Retornar array de objetos com id, name, color
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 2.2 Implementar método `createLabel(token, data)`
    - Usar `supabaseService.insert()` para criar label
    - _Requirements: 2.1_
  - [x] 2.3 Implementar método `updateLabel(token, id, data)`
    - Usar `supabaseService.update()` para atualizar label
    - _Requirements: 2.1_
  - [x] 2.4 Implementar método `deleteLabel(token, id)`
    - Usar `supabaseService.delete()` para remover label
    - _Requirements: 2.1_
  - [ ]* 2.5 Write property test for labels retrieval
    - **Property 2: Labels retrieval returns valid array**
    - **Validates: Requirements 2.1, 2.3**

- [x] 3. Adicionar métodos de Canned Responses ao ChatService
  - [x] 3.1 Implementar método `getCannedResponses(token, options)`
    - Usar `supabaseService.getMany()` para buscar respostas prontas
    - Suportar filtro de busca por shortcut/content
    - Retornar array de objetos com id, shortcut, content
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 3.2 Implementar método `createCannedResponse(token, data)`
    - Usar `supabaseService.insert()` para criar resposta
    - _Requirements: 3.1_
  - [x] 3.3 Implementar método `updateCannedResponse(token, id, data)`
    - Usar `supabaseService.update()` para atualizar resposta
    - _Requirements: 3.1_
  - [x] 3.4 Implementar método `deleteCannedResponse(token, id)`
    - Usar `supabaseService.delete()` para remover resposta
    - _Requirements: 3.1_
  - [ ]* 3.5 Write property test for canned responses retrieval
    - **Property 3: Canned responses retrieval returns valid array**
    - **Validates: Requirements 3.1, 3.3**

- [x] 4. Checkpoint - Verificar correções de Settings
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Corrigir query de Conversations
  - [x] 5.1 Identificar e corrigir colunas inexistentes na query de conversations
    - Verificar schema do Supabase para tabela `conversations`
    - Ajustar query para usar apenas colunas existentes
    - _Requirements: 4.1, 4.2_
  - [x] 5.2 Garantir que a resposta inclui todos os campos necessários
    - Verificar formatação de resposta
    - _Requirements: 4.3_
  - [ ]* 5.3 Write property test for conversations retrieval
    - **Property 4: Conversations retrieval handles all states**
    - **Validates: Requirements 4.1, 4.3**

- [x] 6. Refatorar BulkCampaignRoutes para usar SupabaseService
  - [x] 6.1 Refatorar rota `/history` para usar SupabaseService
    - Substituir `db.query()` por `supabaseService.getMany()`
    - Usar `supabaseService.count()` para total
    - _Requirements: 5.1, 5.2_
  - [x] 6.2 Garantir tratamento de resultados vazios
    - Retornar `{ total: 0, items: [] }` quando não houver campanhas
    - _Requirements: 5.2, 5.3_
  - [ ]* 6.3 Write property test for campaign history
    - **Property 5: Campaign history handles empty results**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 7. Atualizar rotas para usar serviços refatorados
  - [x] 7.1 Atualizar userWebhookRoutes.js
    - Remover passagem de SupabaseService no construtor
    - Usar `new OutgoingWebhookService()` sem parâmetros
    - _Requirements: 1.1_
  - [x] 7.2 Atualizar chatInboxRoutes.js
    - Remover passagem de SupabaseService no construtor do ChatService
    - Usar `new ChatService()` sem parâmetros
    - _Requirements: 2.1, 3.1_

- [x] 8. Final Checkpoint - Verificar todas as correções
  - Ensure all tests pass, ask the user if questions arise.
