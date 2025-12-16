# Implementation Plan: Agent Messaging System

## Overview
Este plano implementa o sistema completo de mensagens para agentes, permitindo envio individual e em massa (campanhas), gerenciamento de templates, caixa de saída e relatórios. O sistema reutiliza componentes existentes do sistema de mensagens do usuário, adaptando-os para o contexto do agente.

## Current State
- ✅ Basic individual message sending (text, image, document, audio) implemented
- ✅ Backend routes for `/api/agent/messaging/send/*` working
- ✅ Quota checking and consumption from owner implemented
- ✅ Inbox filtering by agent access implemented
- ✅ Basic AgentMessagingPage with simple form
- ❌ Campaign system (bulk sending) not implemented
- ❌ Templates management not implemented
- ❌ Outbox and Reports pages not implemented
- ❌ SendFlow integration not implemented

---

## Phase 1: Database Schema

- [x] 1. Create database migrations for agent messaging tables
  - [x] 1.1 Create migration for `agent_campaigns` table
    - Fields: id, agent_id, account_id, inbox_id, name, status, total_contacts, sent_count, failed_count, current_position, config (JSON), scheduled_at, started_at, completed_at, created_at, updated_at
    - Foreign keys to agents, accounts, inboxes tables
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 1.2 Create migration for `agent_campaign_contacts` table
    - Fields: id, campaign_id, phone, name, variables (JSON), status, sent_at, error_message, message_id, created_at
    - Foreign key to agent_campaigns
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 1.3 Create migration for `agent_templates` table
    - Fields: id, agent_id, account_id, name, content, config (JSON), created_at, updated_at
    - Foreign keys to agents, accounts tables
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 2. Checkpoint - Verify migrations
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 2: Backend Services

- [x] 3. Implement AgentTemplateService
  - [x] 3.1 Create `server/services/AgentTemplateService.js`
    - Implement createTemplate(agentId, accountId, data)
    - Implement listTemplates(agentId, accountId)
    - Implement getTemplate(agentId, templateId)
    - Implement updateTemplate(agentId, templateId, data)
    - Implement deleteTemplate(agentId, templateId)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ]* 3.2 Write property test for template persistence round-trip
    - **Property 5: Template persistence round-trip**
    - **Validates: Requirements 3.5, 8.2, 8.3**

- [x] 4. Implement AgentCampaignService
  - [x] 4.1 Create `server/services/AgentCampaignService.js`
    - Implement createCampaign(agentId, accountId, config)
    - Implement listCampaigns(agentId, accountId, filters)
    - Implement getCampaign(agentId, campaignId)
    - Implement pauseCampaign(agentId, campaignId)
    - Implement resumeCampaign(agentId, campaignId)
    - Implement cancelCampaign(agentId, campaignId)
    - Implement getProgress(campaignId)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 4.2 Write property test for campaign pause preserves position
    - **Property 12: Campaign pause preserves position**
    - **Validates: Requirements 6.3, 6.4**
  - [ ]* 4.3 Write property test for campaign cancellation marks remaining
    - **Property 13: Campaign cancellation marks remaining**
    - **Validates: Requirements 6.5**

- [x] 5. Implement AgentCampaignScheduler
  - [x] 5.1 Create campaign execution logic in AgentCampaignService
    - Process contacts in order with humanization delays
    - Handle pause/resume state
    - Update progress counters
    - Consume owner's quota per message
    - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4, 9.1, 9.4_
  - [ ]* 5.2 Write property test for delay values within bounds
    - **Property 8: Delay values within bounds**
    - **Validates: Requirements 4.3**

- [x] 6. Checkpoint - Verify backend services
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 3: Backend API Routes

- [x] 7. Add template routes to agentMessagingRoutes.js
  - [x] 7.1 Implement GET `/api/agent/messaging/templates` - List templates
    - Filter by agent_id and account_id
    - _Requirements: 8.1_
  - [x] 7.2 Implement POST `/api/agent/messaging/templates` - Create template
    - Validate name and content
    - _Requirements: 8.2_
  - [x] 7.3 Implement GET `/api/agent/messaging/templates/:id` - Get template
    - Verify ownership
    - _Requirements: 8.1_
  - [x] 7.4 Implement PUT `/api/agent/messaging/templates/:id` - Update template
    - Verify ownership before update
    - _Requirements: 8.3_
  - [x] 7.5 Implement DELETE `/api/agent/messaging/templates/:id` - Delete template
    - Verify ownership before delete
    - _Requirements: 8.4_
  - [ ]* 7.6 Write property test for template deletion removes from list
    - **Property 17: Template deletion removes from list**
    - **Validates: Requirements 8.4**

- [x] 8. Add campaign routes to agentMessagingRoutes.js
  - [x] 8.1 Implement POST `/api/agent/messaging/campaigns` - Create campaign
    - Validate inbox access, contacts, messages
    - Check owner quota before creation
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 9.1_
  - [x] 8.2 Implement GET `/api/agent/messaging/campaigns` - List campaigns
    - Filter by status, date range
    - Include progress info
    - _Requirements: 6.1_
  - [x] 8.3 Implement GET `/api/agent/messaging/campaigns/:id` - Get campaign details
    - Include contacts and their statuses
    - _Requirements: 6.2_
  - [x] 8.4 Implement PUT `/api/agent/messaging/campaigns/:id/pause` - Pause campaign
    - _Requirements: 6.3_
  - [x] 8.5 Implement PUT `/api/agent/messaging/campaigns/:id/resume` - Resume campaign
    - _Requirements: 6.4_
  - [x] 8.6 Implement PUT `/api/agent/messaging/campaigns/:id/cancel` - Cancel campaign
    - _Requirements: 6.5_

- [x] 9. Add report routes to agentMessagingRoutes.js
  - [x] 9.1 Implement GET `/api/agent/messaging/reports` - List completed campaigns
    - Filter by date range
    - Include summary statistics
    - _Requirements: 7.1, 7.3_
  - [x] 9.2 Implement GET `/api/agent/messaging/reports/:id` - Get report details
    - Include per-contact status
    - _Requirements: 7.2_
  - [x] 9.3 Implement GET `/api/agent/messaging/reports/:id/export` - Export CSV
    - Generate CSV with all contact statuses
    - _Requirements: 7.4_
  - [ ]* 9.4 Write property test for report date filtering
    - **Property 15: Report date filtering**
    - **Validates: Requirements 7.3**
  - [ ]* 9.5 Write property test for CSV export completeness
    - **Property 16: CSV export completeness**
    - **Validates: Requirements 7.4**

- [x] 10. Add draft routes to agentMessagingRoutes.js
  - [x] 10.1 Implement POST `/api/agent/messaging/drafts` - Save draft
    - Store campaign state for later
    - _Requirements: 12.1_
  - [x] 10.2 Implement GET `/api/agent/messaging/drafts` - Get draft
    - Return latest draft for agent
    - _Requirements: 12.2, 12.3_
  - [x] 10.3 Implement DELETE `/api/agent/messaging/drafts` - Clear draft
    - Clear after successful send
    - _Requirements: 12.4_
  - [ ]* 10.4 Write property test for draft persistence round-trip
    - **Property 23: Draft persistence round-trip**
    - **Validates: Requirements 12.1, 12.3**

- [x] 11. Checkpoint - Verify API routes
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 4: Frontend Service Layer

- [x] 12. Extend agent-messaging.ts service
  - [x] 12.1 Add template API functions
    - getAgentTemplates(), createAgentTemplate(), updateAgentTemplate(), deleteAgentTemplate()
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 12.2 Add campaign API functions
    - createAgentCampaign(), getAgentCampaigns(), getAgentCampaign()
    - pauseAgentCampaign(), resumeAgentCampaign(), cancelAgentCampaign()
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 12.3 Add report API functions
    - getAgentReports(), getAgentReport(), exportAgentReport()
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 12.4 Add draft API functions
    - saveAgentDraft(), loadAgentDraft(), clearAgentDraft()
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 13. Create TypeScript types for agent messaging
  - [x] 13.1 Create `src/types/agent-messaging.ts`
    - Define Campaign, CampaignContact, Template, Report interfaces
    - Define API request/response types
    - _Requirements: All_

---

## Phase 5: Frontend Pages

- [x] 14. Refactor AgentMessagingPage to use SendFlow
  - [x] 14.1 Update AgentMessagingPage to integrate SendFlow component
    - Pass agent inboxes to SendFlow
    - Handle onSend with agent API
    - Handle onSaveDraft with agent draft API
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_
  - [x] 14.2 Create AgentInboxSelector wrapper component
    - Filter inboxes by agent access
    - Show connection status
    - _Requirements: 2.1_
  - [ ]* 14.3 Write property test for inbox filtering by agent access
    - **Property 2: Inbox filtering by agent access**
    - **Validates: Requirements 2.1**

- [x] 15. Create AgentTemplatesPage
  - [x] 15.1 Create `src/components/agent/AgentTemplatesPage.tsx`
    - List templates with search/filter
    - Create/Edit/Delete template actions
    - "Use template" action navigates to messaging with template pre-loaded
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 16. Create AgentOutboxPage
  - [x] 16.1 Create `src/components/agent/AgentOutboxPage.tsx`
    - List campaigns by status (pending, running, paused, completed, cancelled)
    - Show real-time progress for running campaigns
    - Pause/Resume/Cancel actions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 16.2 Write property test for campaign progress calculation
    - **Property 11: Campaign progress calculation**
    - **Validates: Requirements 6.2**

- [x] 17. Create AgentReportsPage
  - [x] 17.1 Create `src/components/agent/AgentReportsPage.tsx`
    - List completed campaigns with summary stats
    - Date range filter
    - View details and export CSV
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 17.2 Write property test for report statistics calculation
    - **Property 14: Report statistics calculation**
    - **Validates: Requirements 7.2**

- [x] 18. Checkpoint - Verify frontend pages
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 6: Navigation and Routing

- [x] 19. Update AgentLayout navigation
  - [x] 19.1 Add expandable "Mensagens" menu with sub-items
    - Enviar → /agent/messaging
    - Templates → /agent/messaging/templates
    - Caixa de Saída → /agent/messaging/outbox
    - Relatórios → /agent/messaging/reports
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [ ]* 19.2 Write property test for permission-based menu visibility
    - **Property 1: Permission-based menu visibility**
    - **Validates: Requirements 1.3, 1.4, 11.1**

- [x] 20. Update AgentDashboard routes
  - [x] 20.1 Add routes for new messaging pages
    - /agent/messaging/templates → AgentTemplatesPage
    - /agent/messaging/outbox → AgentOutboxPage
    - /agent/messaging/reports → AgentReportsPage
    - _Requirements: 8.1, 6.1, 7.1_

---

## Phase 7: Quota and Validation

- [x] 21. Enhance quota display and validation
  - [x] 21.1 Create AgentQuotaDisplay component
    - Show owner's daily and monthly quota
    - Visual progress bars with color coding
    - _Requirements: 1.2, 9.5_
  - [ ]* 21.2 Write property test for quota display shows owner's balance
    - **Property 21: Quota display shows owner's balance**
    - **Validates: Requirements 9.5, 1.2**
  - [ ]* 21.3 Write property test for quota check before send
    - **Property 18: Quota check before send**
    - **Validates: Requirements 9.1**
  - [ ]* 21.4 Write property test for quota exceeded rejection
    - **Property 19: Quota exceeded rejection**
    - **Validates: Requirements 9.2, 9.3**
  - [ ]* 21.5 Write property test for quota increment on success
    - **Property 20: Quota increment on success**
    - **Validates: Requirements 9.4**

- [x] 22. Implement validation utilities
  - [x] 22.1 Add delay validation in campaign config
    - Validate min <= max, both within 1-30 minutes
    - _Requirements: 4.4_
  - [ ]* 22.2 Write property test for delay validation bounds
    - **Property 6: Delay validation bounds**
    - **Validates: Requirements 4.4**
  - [ ]* 22.3 Write property test for schedule time validation
    - **Property 9: Schedule time validation**
    - **Validates: Requirements 5.2**

---

## Phase 8: Advanced Features

- [x] 23. Implement humanization features
  - [x] 23.1 Add randomization logic for contact order
    - Shuffle contacts when randomization enabled
    - _Requirements: 4.2_
  - [ ]* 23.2 Write property test for randomization changes order
    - **Property 7: Randomization changes order**
    - **Validates: Requirements 4.2**

- [x] 24. Implement scheduling features
  - [x] 24.1 Add scheduled campaign support
    - Store scheduled_at timestamp
    - Process scheduled campaigns at start time
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 24.2 Add sending window support
    - Only send during configured hours/days
    - _Requirements: 5.3_
  - [ ]* 24.3 Write property test for sending window enforcement
    - **Property 10: Sending window enforcement**
    - **Validates: Requirements 5.3**

- [x] 25. Implement template variable substitution
  - [x] 25.1 Add variable substitution in campaign messages
    - Replace {{var}} with contact values
    - _Requirements: 3.2_
  - [ ]* 25.2 Write property test for template variable substitution
    - **Property 4: Template variable substitution**
    - **Validates: Requirements 3.2**

- [x] 26. Implement CSV contact parsing
  - [x] 26.1 Add CSV parsing with validation
    - Extract phone numbers and variables
    - Validate phone format
    - _Requirements: 2.3_
  - [ ]* 26.2 Write property test for CSV contact parsing and validation
    - **Property 3: CSV contact parsing and validation**
    - **Validates: Requirements 2.3**

- [x] 27. Implement media quota consumption
  - [x] 27.1 Ensure media messages consume quota correctly
    - One message per media item
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [ ]* 27.2 Write property test for media quota consumption
    - **Property 22: Media quota consumption**
    - **Validates: Requirements 10.4**

- [x] 28. Implement draft auto-clear
  - [x] 28.1 Clear draft after successful campaign send
    - _Requirements: 12.4_
  - [ ]* 28.2 Write property test for draft cleared after send
    - **Property 24: Draft cleared after send**
    - **Validates: Requirements 12.4**

---

## Phase 9: Final Integration

- [x] 29. Final Checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.
