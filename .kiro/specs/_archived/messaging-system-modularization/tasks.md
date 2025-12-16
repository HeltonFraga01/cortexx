# Implementation Plan

## Fase 1: Infraestrutura Base

- [x] 1. Criar migração e contexto para persistência de rascunhos
  - [x] 1.1 Criar migração `017_add_message_drafts.js` para tabela `message_drafts`
    - Campos: id, user_id, draft_type, data (JSON), created_at, updated_at
    - Índice em user_id
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 1.2 Criar rotas backend para rascunhos em `server/routes/userDraftRoutes.js`
    - GET /api/user/drafts - listar rascunhos
    - POST /api/user/drafts - salvar rascunho
    - DELETE /api/user/drafts/:id - excluir rascunho
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 1.3 Criar `src/services/draftService.ts` para operações de rascunho
    - saveDraft, loadDraft, clearDraft
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 1.4 Write property test for draft persistence
    - **Property 11: Draft Persistence Round-Trip**
    - **Validates: Requirements 7.1, 7.2**
  - [ ]* 1.5 Write property test for draft deletion
    - **Property 12: Draft Deletion**
    - **Validates: Requirements 7.3**
  - [x] 1.6 Criar `src/contexts/DraftContext.tsx`
    - Implementar DraftContextValue interface do design
    - Auto-save em intervalo configurável
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fase 2: Serviços e Extensões

- [x] 3. Estender templateService para paginação
  - [x] 3.1 Atualizar `src/services/templateService.ts`
    - Adicionar método `list(page, limit)` com paginação
    - Adicionar método `get(id)` para buscar template individual
    - Adicionar método `update(id, data)` para edição
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 3.2 Atualizar rotas backend em `server/routes/templateRoutes.js`
    - Adicionar suporte a paginação no GET /api/user/templates
    - Adicionar GET /api/user/templates/:id
    - _Requirements: 1.1, 1.3_
  - [ ]* 3.3 Write property test for template CRUD
    - **Property 1: Template CRUD Round-Trip**
    - **Validates: Requirements 1.2, 1.3**
  - [ ]* 3.4 Write property test for template deletion
    - **Property 2: Template Deletion Removes from List**
    - **Validates: Requirements 1.4**

- [x] 4. Criar reportService para relatórios
  - [x] 4.1 Criar `src/services/reportService.ts`
    - Método `list(filters, page)` com filtros por período, status, tipo
    - Método `getDetail(campaignId)` para relatório detalhado
    - Método `export(campaignId, format)` para CSV/PDF
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 4.2 Criar rotas backend em `server/routes/reportRoutes.js`
    - GET /api/user/reports - listar relatórios com filtros
    - GET /api/user/reports/:campaignId - relatório detalhado
    - GET /api/user/reports/:campaignId/export - exportar CSV/PDF
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 4.3 Write property test for report filters
    - **Property 7: Report Filter Correctness**
    - **Validates: Requirements 3.3**
  - [ ]* 4.4 Write property test for CSV export
    - **Property 8: CSV Export Round-Trip**
    - **Validates: Requirements 3.4**

- [x] 5. Estender campaignService para categorização
  - [x] 5.1 Atualizar `src/services/bulkCampaignService.ts`
    - Adicionar método `listByStatus(status, page)` para filtrar por status
    - Adicionar função `categorizeCampaign(campaign)` para categorização
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 5.2 Write property test for campaign categorization
    - **Property 3: Campaign Status Categorization**
    - **Validates: Requirements 2.1**
  - [ ]* 5.3 Write property test for progress counters
    - **Property 4: Campaign Progress Counters Consistency**
    - **Validates: Requirements 2.3**
  - [ ]* 5.4 Write property test for metrics calculation
    - **Property 5: Campaign Metrics Calculation**
    - **Validates: Requirements 2.4, 3.5**
  - [ ]* 5.5 Write property test for state transitions
    - **Property 6: Campaign State Transitions**
    - **Validates: Requirements 2.5**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fase 3: Componentes de Feature

- [x] 7. Criar componentes de Templates
  - [x] 7.1 Criar `src/components/features/messaging/TemplateList.tsx`
    - Lista paginada de templates
    - Modo seleção para uso em envio
    - Ações de editar/excluir
    - _Requirements: 1.1, 1.5_
  - [x] 7.2 Criar `src/components/features/messaging/TemplateEditor.tsx`
    - Formulário de criação/edição
    - Preview de template
    - Validação de campos obrigatórios
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 8. Criar componentes de Caixa de Saída
  - [x] 8.1 Criar `src/components/features/messaging/CampaignList.tsx`
    - Abas: Programadas, Em Execução, Finalizadas
    - Ações por status (editar, cancelar, pausar, ver relatório)
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 8.2 Criar `src/components/features/messaging/CampaignMonitor.tsx`
    - Progresso em tempo real
    - Contadores de enviados/pendentes/erros
    - Botões pausar/retomar/cancelar
    - _Requirements: 2.3, 2.5, 2.6_

- [x] 9. Criar componentes de Relatórios
  - [x] 9.1 Criar `src/components/features/messaging/ReportFilters.tsx`
    - Filtros por período, status, tipo
    - _Requirements: 3.3_
  - [x] 9.2 Criar `src/components/features/messaging/ReportViewer.tsx`
    - Gráficos e tabelas de métricas
    - Taxa de entrega, erros por tipo, tempo médio
    - Botão de exportação CSV/PDF
    - _Requirements: 3.2, 3.4, 3.5_

- [x] 10. Criar componente SendFlow
  - [x] 10.1 Criar `src/components/features/messaging/SendFlow.tsx`
    - Seletor de tipo de envio (Manual, Grupo, Tag, CSV, Banco de Dados)
    - Renderização condicional por tipo
    - Contador de contatos selecionados
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [ ]* 10.2 Write property test for recipient counter
    - **Property 9: Recipient Counter Accuracy**
    - **Validates: Requirements 4.7**
  - [x] 10.3 Criar `src/components/features/messaging/SendTypeSelector.tsx`
    - UI para seleção de tipo de envio
    - _Requirements: 4.1_
  - [x] 10.4 Criar `src/components/features/messaging/RecipientPicker.tsx`
    - Componente unificado para seleção de destinatários
    - Integração com grupos e tags de Contatos
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2_
  - [ ]* 10.5 Write property test for groups/tags sync
    - **Property 10: Groups/Tags Synchronization**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fase 4: Páginas e Navegação

- [x] 12. Criar páginas modulares
  - [x] 12.1 Criar `src/pages/MessagingPage.tsx`
    - Página principal de envio com SendFlow
    - Links rápidos para Templates, Caixa de Saída, Relatórios
    - Integração com DraftContext
    - _Requirements: 4.1, 4.8, 5.1, 7.1, 7.2_
  - [x] 12.2 Criar `src/pages/TemplatesPage.tsx`
    - CRUD completo de templates
    - Navegação para usar template em envio
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2_
  - [x] 12.3 Criar `src/pages/OutboxPage.tsx`
    - Gerenciamento de campanhas por status
    - Link para relatórios
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3_
  - [x] 12.4 Criar `src/pages/ReportsPage.tsx`
    - Visualização e exportação de relatórios
    - Filtros avançados
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 13. Configurar rotas e navegação
  - [x] 13.1 Atualizar `src/pages/UserDashboard.tsx`
    - Adicionar rotas: /user/mensagens, /user/mensagens/templates, /user/mensagens/caixa, /user/mensagens/relatorios
    - Manter rota legada /user/disparador com redirect
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 13.2 Criar `src/components/features/messaging/MessagingBreadcrumb.tsx`
    - Breadcrumb de navegação entre módulos
    - _Requirements: 5.5_
  - [x] 13.3 Criar `src/components/features/messaging/QuickLinks.tsx`
    - Links rápidos entre módulos
    - _Requirements: 5.1_

- [x] 14. Integrar com sistema de Contatos
  - [x] 14.1 Atualizar `src/pages/UserContacts.tsx`
    - Adicionar botão "Enviar para selecionados"
    - Navegação para MessagingPage com contatos pré-selecionados
    - _Requirements: 5.4, 6.1, 6.2, 6.3, 6.4_

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fase 5: Persistência de Estado

- [x] 16. Implementar persistência de filtros e ordenação
  - [x] 16.1 Criar hook `src/hooks/usePersistedFilters.ts`
    - Salvar/restaurar filtros em localStorage
    - _Requirements: 7.4_
  - [x] 16.2 Integrar hook nas páginas de lista
    - TemplatesPage, OutboxPage, ReportsPage
    - _Requirements: 7.4_

- [x] 17. Implementar auto-save de rascunhos
  - [x] 17.1 Integrar DraftContext em MessagingPage
    - Auto-save ao navegar para outra página
    - Restaurar rascunho ao retornar
    - Opção de descartar rascunho
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 18. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fase 6: Reutilizar Componentes Existentes no SendFlow

- [x] 19. Refatorar SendFlow para reutilizar componentes existentes
  - [x] 19.1 Atualizar SendFlow para receber instance e userToken como props
    - Passar props para componentes filhos
    - _Requirements: 8.9_
  - [x] 19.2 Substituir RecipientPicker simplificado pelo RecipientSelector existente
    - Usar `src/components/disparador/RecipientSelector.tsx` que já tem integração com listas e importação
    - Remover dados mock
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 19.3 Criar CampaignConfigStep reutilizando componentes existentes
    - Reutilizar MessageSequenceEditor de `src/components/disparador/MessageSequenceEditor.tsx`
    - Reutilizar SchedulingInput de `src/components/shared/forms/SchedulingInput.tsx`
    - Reutilizar SchedulingWindowInput de `src/components/disparador/SchedulingWindowInput.tsx`
    - Reutilizar TemplateManager de `src/components/disparador/TemplateManager.tsx`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.10_
  - [x] 19.4 Integrar hook useCampaignBuilder existente
    - Reutilizar `src/components/disparador/hooks/useCampaignBuilder.ts`
    - Manter toda a lógica de validação e criação de campanha
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

- [x] 20. Atualizar step "message" do SendFlow
  - [x] 20.1 Substituir textarea simples pelo CampaignConfigStep completo
    - Campo para nome da campanha
    - MessageSequenceEditor para sequência de mensagens
    - Seção de variáveis (padrão e customizadas)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 20.2 Adicionar seção de humanização
    - Inputs para delay mínimo e máximo (5-300 segundos)
    - Checkbox para randomizar ordem dos contatos
    - _Requirements: 8.5, 8.6_
  - [x] 20.3 Adicionar seção de agendamento
    - SchedulingInput para agendar início
    - SchedulingWindowInput para janela de envio
    - _Requirements: 8.7, 8.8_
  - [x] 20.4 Adicionar resumo com tempo estimado
    - Usar cálculo existente do bulkCampaignService
    - _Requirements: 8.10_

- [x] 21. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fase 7: Garantir Paridade de Funcionalidades

- [x] 22. Verificar paridade com CampaignBuilder original
  - [x] 22.1 Validar que todas as funcionalidades do CampaignBuilder estão presentes
    - Nome da campanha
    - Sequência de mensagens
    - Variáveis padrão e customizadas
    - Humanização (delay min/max, randomização)
    - Agendamento e janela de envio
    - Seletor de destinatários (listas + importação)
    - Templates
    - Tempo estimado
    - _Requirements: 8.1-8.10, 9.1-9.5_
  - [x] 22.2 Validar que ações de campanha funcionam
    - Pausar campanha
    - Retomar campanha
    - Cancelar campanha
    - Ver relatório
    - _Requirements: 2.5, 2.6_
  - [x] 22.3 Validar que relatórios são gerados corretamente
    - Taxa de entrega
    - Erros por tipo
    - Tempo médio de envio
    - Exportação CSV/PDF
    - _Requirements: 3.2, 3.4, 3.5_

- [x] 23. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
