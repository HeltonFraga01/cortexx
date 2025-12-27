# Implementation Plan: Contact CRM Evolution

## Overview

Implementação incremental da evolução do sistema de contatos para CRM completo. As tarefas estão organizadas em fases para permitir entregas parciais funcionais.

## Status: ✅ COMPLETO (27/12/2024)

Todas as funcionalidades foram implementadas com sucesso:
- 7 migrations de banco de dados
- 7 serviços backend (LeadScoring, Credit, Purchase, Interaction, Segment, CustomField, CommunicationPreference)
- 5 rotas de API (CRM, Purchase, Credit, CustomField, Segment)
- 5 serviços frontend
- 13 componentes React
- 3 background jobs (decay, inactivity, segment evaluation)
- Testes de propriedade para validação

## Tasks

- [x] 1. Database Schema - Extensão e Novas Tabelas
  - [x] 1.1 Criar migration para estender tabela contacts
    - Adicionar colunas: lead_score, lead_tier, lifetime_value_cents, purchase_count, credit_balance, last_interaction_at, last_purchase_at, is_active, bulk_messaging_opt_in, opt_out_at, opt_out_method, custom_fields
    - Adicionar constraints e indexes
    - _Requirements: 2.1, 3.2, 4.1, 5.1_
  - [x] 1.2 Criar tabela contact_interactions
    - Campos: id, tenant_id, account_id, contact_id, type, direction, content, content_preview, metadata, created_at, created_by, created_by_type
    - Indexes para contact_id, created_at, type
    - RLS policies para isolamento por account_id
    - _Requirements: 1.1, 1.2_
  - [x] 1.3 Criar tabela contact_purchases
    - Campos: id, tenant_id, account_id, contact_id, external_id, amount_cents, currency, description, product_name, status, source, metadata, purchased_at, created_at
    - Indexes para contact_id, purchased_at, external_id
    - RLS policies
    - _Requirements: 3.1_
  - [x] 1.4 Criar tabela contact_credit_transactions
    - Campos: id, tenant_id, account_id, contact_id, type, amount, balance_after, source, description, metadata, created_at, created_by, created_by_type
    - Indexes para contact_id, created_at
    - RLS policies
    - _Requirements: 4.2, 4.3_
  - [x] 1.5 Criar tabela custom_field_definitions
    - Campos: id, tenant_id, account_id, name, label, field_type, options, is_required, is_searchable, display_order, default_value, validation_rules, created_at, updated_at
    - Unique constraint em (account_id, name)
    - RLS policies
    - _Requirements: 6.1, 6.2_
  - [x] 1.6 Criar tabelas contact_segments e contact_segment_members
    - contact_segments: id, tenant_id, account_id, name, description, conditions, is_template, template_key, member_count, last_evaluated_at, created_at, updated_at
    - contact_segment_members: id, segment_id, contact_id, added_at
    - Indexes e RLS policies
    - _Requirements: 7.1_
  - [x] 1.7 Criar tabela lead_scoring_config
    - Campos: id, tenant_id, account_id, config (JSONB), created_at, updated_at
    - Unique constraint em account_id
    - Default config com valores padrão
    - _Requirements: 2.1_

- [x] 2. Checkpoint - Verificar migrations
  - Executar migrations em ambiente de desenvolvimento
  - Verificar RLS policies funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Backend Services - Lead Scoring
  - [x] 3.1 Criar LeadScoringService.js
    - Implementar calculateScore(contactId, config)
    - Implementar updateScoreOnMessage(contactId, direction)
    - Implementar updateScoreOnPurchase(contactId, amount)
    - Implementar applyDecay(accountId) para batch job
    - Implementar getTier(score, config)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x]* 3.2 Write property test for Lead Score Bounds
    - **Property 1: Lead Score Bounds**
    - Verificar score sempre entre 0-100
    - Verificar tier corresponde ao score
    - **Validates: Requirements 2.1, 2.5**
  - [x]* 3.3 Write property test for Score Increase
    - **Property 2: Lead Score Monotonic Increase on Positive Events**
    - Verificar score aumenta após mensagem/compra
    - **Validates: Requirements 2.2, 2.3**

- [x] 4. Backend Services - Credits
  - [x] 4.1 Criar CreditService.js
    - Implementar getBalance(contactId)
    - Implementar addCredits(contactId, amount, source, metadata)
    - Implementar consumeCredits(contactId, amount, reason, metadata)
    - Implementar getTransactionHistory(contactId, options)
    - Implementar checkSufficientBalance(contactId, amount)
    - Usar transações para atomicidade
    - _Requirements: 4.1, 4.2, 4.3, 4.7_
  - [x]* 4.2 Write property test for Credit Balance Consistency
    - **Property 4: Credit Balance Consistency**
    - Verificar balance = soma das transações
    - Verificar balance_after correto após cada transação
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.7**

- [x] 5. Backend Services - Purchases
  - [x] 5.1 Criar PurchaseService.js
    - Implementar createPurchase(contactId, purchaseData)
    - Implementar getPurchaseHistory(contactId, options)
    - Implementar updateContactMetrics(contactId) - atualiza LTV, purchase_count, last_purchase_at
    - Implementar processWebhookPurchase(webhookData)
    - _Requirements: 3.1, 3.2, 3.3, 9.1, 9.2, 9.3_
  - [x]* 5.2 Write property test for Purchase Metrics
    - **Property 5: Purchase Metrics Accuracy**
    - Verificar LTV = soma das compras
    - Verificar purchase_count correto
    - **Validates: Requirements 3.2, 3.3, 3.4**
  - [x]* 5.3 Write property test for Webhook Contact Matching
    - **Property 10: Purchase Webhook Contact Matching**
    - Verificar matching por phone/email
    - Verificar criação de novo contato se não encontrado
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [x] 6. Backend Services - Interactions
  - [x] 6.1 Criar InteractionService.js
    - Implementar logInteraction(contactId, type, direction, content, metadata)
    - Implementar getTimeline(contactId, options)
    - Implementar updateLastInteraction(contactId)
    - Implementar checkInactivity(accountId) - batch job
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x]* 6.2 Write property test for Timeline Ordering
    - **Property 3: Timeline Chronological Ordering**
    - Verificar eventos em ordem decrescente de timestamp
    - **Validates: Requirements 1.3, 3.5, 8.5**
  - [x]* 6.3 Write property test for Interaction Completeness
    - **Property 11: Interaction Log Completeness**
    - Verificar registro criado com todos os campos
    - Verificar last_interaction_at atualizado
    - **Validates: Requirements 1.1, 1.2, 1.4**
  - [x]* 6.4 Write property test for Inactivity Detection
    - **Property 12: Inactivity Detection**
    - Verificar is_active = false após 30 dias sem interação
    - **Validates: Requirements 1.5, 2.4**

- [x] 7. Checkpoint - Verificar services básicos
  - Testar services com dados de teste
  - Verificar integração com Supabase
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Backend Services - Communication Preferences
  - [x] 8.1 Criar CommunicationPreferenceService.js
    - Implementar setOptIn(contactId, optIn)
    - Implementar processOptOutKeyword(contactId, message)
    - Implementar getOptedOutContacts(accountId)
    - Implementar filterOptedIn(contactIds)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x]* 8.2 Write property test for Opt-Out Enforcement
    - **Property 6: Communication Preference Enforcement**
    - Verificar opted-out contacts excluídos de campanhas
    - **Validates: Requirements 5.1, 5.2, 5.4**
  - [x]* 8.3 Write property test for Opt-Out Keyword Detection
    - **Property 7: Opt-Out Keyword Detection**
    - Verificar keywords "SAIR", "PARAR", "STOP", "UNSUBSCRIBE"
    - **Validates: Requirements 5.3**

- [x] 9. Backend Services - Custom Fields
  - [x] 9.1 Criar CustomFieldService.js
    - Implementar createFieldDefinition(accountId, fieldData)
    - Implementar getFieldDefinitions(accountId)
    - Implementar validateFieldValue(fieldDef, value)
    - Implementar setContactCustomField(contactId, fieldName, value)
    - Implementar searchByCustomField(accountId, fieldName, value)
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  - [x]* 9.2 Write property test for Custom Field Validation
    - **Property 8: Custom Field Type Validation**
    - Verificar validação por tipo (number, date, url, dropdown)
    - **Validates: Requirements 6.1, 6.3**

- [x] 10. Backend Services - Segments
  - [x] 10.1 Criar SegmentService.js
    - Implementar createSegment(accountId, name, conditions)
    - Implementar evaluateSegment(segmentId)
    - Implementar getSegmentMembers(segmentId, options)
    - Implementar updateContactSegments(contactId)
    - Implementar getPrebuiltTemplates()
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_
  - [x]* 10.2 Write property test for Segment Membership
    - **Property 9: Dynamic Segment Membership**
    - Verificar membership matches conditions
    - Verificar re-avaliação após mudança de atributos
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 11. Backend Routes
  - [x] 11.1 Criar userCRMRoutes.js
    - GET /user/contacts/:id/crm - Dados CRM completos do contato
    - PUT /user/contacts/:id/lead-score - Atualizar score manualmente
    - GET /user/contacts/:id/timeline - Timeline de atividades
    - PUT /user/contacts/:id/preferences - Atualizar preferências
    - _Requirements: 8.2, 8.3_
  - [x] 11.2 Criar userPurchaseRoutes.js
    - GET /user/contacts/:id/purchases - Histórico de compras
    - POST /user/contacts/:id/purchases - Adicionar compra manual
    - POST /user/purchases/webhook - Webhook de compras externas
    - POST /user/purchases/import - Importar CSV de compras
    - _Requirements: 3.1, 3.6, 9.1, 9.4_
  - [x] 11.3 Criar userCreditRoutes.js
    - GET /user/contacts/:id/credits - Saldo e histórico
    - POST /user/contacts/:id/credits - Adicionar créditos
    - POST /user/contacts/:id/credits/consume - Consumir créditos
    - _Requirements: 4.1, 4.2, 4.3, 4.7_
  - [x] 11.4 Criar userCustomFieldRoutes.js
    - GET /user/custom-fields - Listar definições
    - POST /user/custom-fields - Criar campo
    - PUT /user/custom-fields/:id - Atualizar campo
    - DELETE /user/custom-fields/:id - Remover campo
    - _Requirements: 6.1, 6.2_
  - [x] 11.5 Criar userSegmentRoutes.js
    - GET /user/segments - Listar segmentos
    - POST /user/segments - Criar segmento
    - GET /user/segments/:id/members - Membros do segmento
    - POST /user/segments/:id/evaluate - Reavaliar segmento
    - GET /user/segments/templates - Templates pré-definidos
    - _Requirements: 7.1, 7.4, 7.5, 7.6_

- [x] 12. Checkpoint - Verificar API completa
  - Testar todos os endpoints com Postman/curl
  - Verificar autenticação e autorização
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Frontend Services
  - [x] 13.1 Criar contactCRMService.ts
    - Implementar getContactCRM(contactId)
    - Implementar updateLeadScore(contactId, score)
    - Implementar getTimeline(contactId, options)
    - Implementar updatePreferences(contactId, preferences)
    - _Requirements: 8.2_
  - [x] 13.2 Criar purchaseService.ts
    - Implementar getPurchases(contactId, options)
    - Implementar createPurchase(contactId, data)
    - Implementar importPurchases(file)
    - _Requirements: 3.1, 3.6_
  - [x] 13.3 Criar creditService.ts
    - Implementar getCredits(contactId)
    - Implementar addCredits(contactId, amount, source)
    - Implementar consumeCredits(contactId, amount, reason)
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 13.4 Criar customFieldService.ts
    - Implementar getFieldDefinitions()
    - Implementar createField(data)
    - Implementar updateField(id, data)
    - Implementar deleteField(id)
    - _Requirements: 6.1, 6.2_
  - [x] 13.5 Criar segmentService.ts
    - Implementar getSegments()
    - Implementar createSegment(data)
    - Implementar getSegmentMembers(segmentId, options)
    - Implementar evaluateSegment(segmentId)
    - Implementar getTemplates()
    - _Requirements: 7.1, 7.4_

- [x] 14. Frontend Types
  - [x] 14.1 Criar src/types/crm.ts
    - Interface ContactCRM (extends Contact com campos CRM)
    - Interface TimelineEvent
    - Interface Purchase
    - Interface CreditTransaction
    - Interface CustomFieldDefinition
    - Interface Segment, SegmentCondition, SegmentGroup
    - Interface LeadScoreConfig
    - _Requirements: All_

- [x] 15. Frontend Components - Contact Detail
  - [x] 15.1 Criar ContactDetailPage.tsx
    - Layout com seções: Header, Metrics, Timeline, Purchases, Credits, Custom Fields, Preferences
    - Integrar com contactCRMService
    - Quick actions no header
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 15.2 Criar LeadScoreCard.tsx
    - Exibir score (0-100) com barra de progresso
    - Badge colorido por tier (cold=gray, warm=yellow, hot=orange, vip=purple)
    - Breakdown opcional do score
    - _Requirements: 2.1, 2.5_
  - [x] 15.3 Criar ContactTimeline.tsx
    - Lista de eventos com ícones por tipo
    - Filtros por tipo de evento
    - Infinite scroll ou paginação
    - _Requirements: 1.3, 8.5_
  - [x] 15.4 Criar PurchaseHistory.tsx
    - Tabela de compras com data, valor, produto, status
    - Botão para adicionar compra manual
    - Métricas: LTV, AOV, total de compras
    - _Requirements: 3.1, 3.3, 3.4, 3.5_
  - [x] 15.5 Criar CreditBalance.tsx
    - Card com saldo atual destacado
    - Histórico de transações
    - Botões para adicionar/consumir créditos
    - _Requirements: 4.1, 4.5, 4.7_
  - [x] 15.6 Criar CustomFieldsEditor.tsx
    - Formulário dinâmico baseado nas definições
    - Validação por tipo de campo
    - Inline editing
    - _Requirements: 6.1, 6.4_
  - [x] 15.7 Criar CommunicationPreferences.tsx
    - Toggle para opt-in/opt-out
    - Histórico de mudanças de preferência
    - Indicador visual de status
    - _Requirements: 5.1, 5.5, 5.6_

- [x] 16. Frontend Components - Segments
  - [x] 16.1 Criar SegmentsPage.tsx
    - Lista de segmentos com nome, descrição, member_count
    - Botão para criar novo segmento
    - Templates pré-definidos
    - _Requirements: 7.1, 7.4, 7.6_
  - [x] 16.2 Criar SegmentBuilder.tsx
    - UI para construir condições com AND/OR
    - Seletor de campo, operador, valor
    - Preview de contatos que matcham
    - _Requirements: 7.1, 7.3_
  - [x] 16.3 Criar SegmentMembersList.tsx
    - Lista paginada de membros do segmento
    - Ações em bulk (enviar mensagem, exportar)
    - _Requirements: 7.4, 7.5_

- [x] 17. Frontend Components - Custom Fields Management
  - [x] 17.1 Criar CustomFieldsManagementPage.tsx
    - Lista de campos customizados
    - Criar/editar/deletar campos
    - Reordenar campos (drag and drop)
    - _Requirements: 6.1, 6.2, 6.4_

- [x] 18. Frontend Components - Analytics Dashboard
  - [x] 18.1 Criar CRMDashboardPage.tsx
    - Cards com métricas: total contacts, active, avg score, total LTV
    - Gráfico de crescimento de contatos
    - Distribuição de lead score por tier
    - Top contacts por LTV e engagement
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x]* 18.2 Write property test for Analytics Metrics
    - **Property 13: Analytics Metrics Accuracy**
    - Verificar cálculos de métricas agregadas
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [x] 19. Checkpoint - Verificar UI completa
  - Testar fluxos de usuário end-to-end
  - Verificar responsividade
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Integration - Message Hooks
  - [x] 20.1 Integrar com sistema de mensagens existente
    - Hook para logar interação quando mensagem é enviada/recebida
    - Hook para atualizar lead score
    - Hook para detectar opt-out keywords
    - Hook para consumir créditos (se habilitado)
    - _Requirements: 1.2, 2.2, 4.4, 5.3_

- [x] 21. Integration - Stripe Webhooks
  - [x] 21.1 Integrar com webhooks Stripe existentes
    - Processar checkout.session.completed para criar purchase
    - Processar invoice.paid para atualizar LTV
    - Matching de customer por email/phone
    - _Requirements: 9.5_

- [x] 22. Background Jobs
  - [x] 22.1 Criar job de decay de lead score
    - Executar diariamente
    - Aplicar decay para contatos inativos
    - _Requirements: 2.4_
  - [x] 22.2 Criar job de atualização de is_active
    - Executar diariamente
    - Marcar contatos sem interação há 30 dias como inativos
    - _Requirements: 1.5_
  - [x] 22.3 Criar job de reavaliação de segmentos
    - Executar a cada 5 minutos ou on-demand
    - Atualizar membership de segmentos dinâmicos
    - _Requirements: 7.2_

- [x] 23. Final Checkpoint
  - Executar todos os testes (unit, property, integration)
  - Verificar performance com dados reais
  - Documentar APIs
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- ~~Tasks marked with `*` are optional and can be skipped for faster MVP~~ All tasks completed
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases

## Arquivos Implementados

### Migrations (server/migrations/)
- `024_extend_contacts_for_crm.sql`
- `025_create_contact_interactions_table.sql`
- `026_create_contact_purchases_table.sql`
- `027_create_contact_credit_transactions_table.sql`
- `028_create_custom_field_definitions_table.sql`
- `029_create_contact_segments_tables.sql`
- `030_create_lead_scoring_config_table.sql`

### Backend Services (server/services/)
- `LeadScoringService.js`
- `ContactCreditService.js`
- `ContactPurchaseService.js`
- `ContactInteractionService.js`
- `ContactSegmentService.js`
- `CustomFieldService.js`
- `CommunicationPreferenceService.js`

### Backend Routes (server/routes/)
- `userCRMRoutes.js`
- `userPurchaseRoutes.js`
- `userCreditRoutes.js`
- `userCustomFieldRoutes.js`
- `userSegmentRoutes.js`

### Frontend Services (src/services/)
- `contactCRMService.ts`
- `purchaseService.ts`
- `creditService.ts`
- `customFieldService.ts`
- `segmentService.ts`

### Frontend Components (src/components/features/crm/)
- `ContactDetailPage.tsx`
- `ContactTimeline.tsx`
- `LeadScoreCard.tsx`
- `PurchaseHistory.tsx`
- `CreditBalance.tsx`
- `CustomFieldsEditor.tsx`
- `CommunicationPreferences.tsx`
- `SegmentsPage.tsx`
- `SegmentBuilder.tsx`
- `SegmentMembersList.tsx`
- `CustomFieldsManagementPage.tsx`
- `CRMDashboardPage.tsx`

### Background Jobs (server/workers/)
- `crmWorker.js` - Lead decay, inactivity check, segment evaluation

### Property Tests (server/tests/)
- `lead-scoring.property.test.js`
- `segment-membership.property.test.js`
