# Implementation Plan: Agent Inbox Status Display

## Overview

Implementação da exibição do status de conexão (online/offline) das caixas de entrada no dashboard do agente. A implementação segue a ordem: backend primeiro, depois frontend services, e por fim componentes UI.

## Tasks

- [x] 1. Implementar endpoints backend para status das inboxes do agente
  - [x] 1.1 Criar endpoint GET /api/agent/my/inboxes/status em agentDataRoutes.js
    - Buscar todas as inboxes atribuídas ao agente
    - Para cada inbox do tipo WhatsApp, consultar status via wuzapiClient
    - Retornar lista de status com summary (total, online, offline, connecting)
    - Tratar erros do WUZAPI retornando status "unknown"
    - _Requirements: 4.1, 4.2, 4.4_
  - [x] 1.2 Criar endpoint GET /api/agent/my/inboxes/:id/status em agentDataRoutes.js
    - Verificar se inbox pertence ao agente
    - Consultar status via wuzapiClient
    - Retornar status detalhado da inbox
    - _Requirements: 4.1, 4.3_
  - [ ]* 1.3 Escrever testes unitários para os endpoints de status
    - Testar autenticação (401 sem token)
    - Testar retorno correto de status
    - Testar tratamento de erro do WUZAPI
    - _Requirements: 4.1, 4.3, 4.4_

- [x] 2. Implementar serviços frontend para buscar status
  - [x] 2.1 Adicionar tipos InboxStatus e InboxStatusSummary em agent-data.ts
    - Definir interface InboxStatus com campos: inboxId, inboxName, channelType, status, connected, loggedIn
    - Definir interface InboxStatusSummary com campos: total, online, offline, connecting
    - _Requirements: 1.1_
  - [x] 2.2 Implementar função getMyInboxesStatus() em agent-data.ts
    - Fazer requisição ao endpoint /api/agent/my/inboxes/status
    - Retornar lista de status e summary
    - Tratar erros adequadamente
    - _Requirements: 1.1, 3.1_
  - [x] 2.3 Implementar função getAgentInboxStatus(inboxId) em agent-data.ts
    - Fazer requisição ao endpoint /api/agent/my/inboxes/:id/status
    - Retornar status individual da inbox
    - _Requirements: 1.1_

- [x] 3. Criar componente InboxStatusBadge
  - [x] 3.1 Criar componente InboxStatusBadge em src/components/agent/InboxStatusBadge.tsx
    - Aceitar props: status, isLoading, size
    - Mapear status para cor, ícone e label corretos
    - Exibir skeleton quando isLoading=true
    - _Requirements: 1.2, 1.3, 1.4, 2.3_
  - [ ]* 3.2 Escrever property test para InboxStatusBadge
    - **Property 1: Status Badge Rendering Consistency**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 4. Modificar AgentInboxesPage para exibir status
  - [x] 4.1 Adicionar estado e lógica de busca de status em AgentInboxesPage.tsx
    - Adicionar estado inboxStatuses para armazenar status por inboxId
    - Adicionar estado statusLoading para controlar loading individual
    - Buscar status ao carregar página
    - _Requirements: 1.1_
  - [x] 4.2 Implementar polling automático de status
    - Configurar intervalo de 30 segundos para atualização
    - Limpar intervalo ao desmontar componente
    - _Requirements: 2.1_
  - [x] 4.3 Integrar InboxStatusBadge nos cards de inbox
    - Exibir badge apenas para inboxes do tipo WhatsApp
    - Passar status e loading corretos para o badge
    - Adicionar botão de refresh manual
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2_
  - [ ]* 4.4 Escrever property test para filtro de WhatsApp-only
    - **Property 2: WhatsApp-Only Status Display**
    - **Validates: Requirements 1.1, 1.5**

- [x] 5. Modificar AgentOverview para exibir resumo de status
  - [x] 5.1 Adicionar busca de status summary em AgentOverview.tsx
    - Buscar status ao carregar dashboard
    - Armazenar summary em estado local
    - _Requirements: 3.1_
  - [x] 5.2 Adicionar StatsCard de "Caixas Online" no dashboard
    - Exibir formato "X/Y" (online/total)
    - Usar variante verde quando há inboxes online
    - Usar variante vermelha/alerta quando todas offline
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 5.3 Escrever property tests para summary e visual feedback
    - **Property 3: Summary Counter Accuracy**
    - **Property 4: Visual Feedback Based on Online Count**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 6. Checkpoint - Verificar integração completa
  - ✅ Todos os arquivos sem erros de diagnóstico
  - ✅ Status exibido corretamente na página de inboxes (AgentInboxesPage)
  - ✅ Resumo "Caixas Online" aparece no dashboard principal (AgentOverview)
  - ✅ Polling automático configurado (30 segundos)
  - ✅ Variante 'red' do GradientCard existe e funciona corretamente

- [ ]* 7. Escrever property tests de integração backend
  - [ ]* 7.1 Property test para autorização do agente
    - **Property 5: Agent Authorization Enforcement**
    - **Validates: Requirements 4.3**
  - [ ]* 7.2 Property test para retorno completo de status
    - **Property 6: Complete Status Return for Authenticated Agents**
    - **Validates: Requirements 4.1**

- [ ] 8. Final checkpoint - Validação completa
  - Ensure all tests pass, ask the user if questions arise.
  - Testar manualmente no ambiente de desenvolvimento
  - Verificar comportamento quando WUZAPI está indisponível

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude
- Unit tests validam exemplos específicos e edge cases
- A implementação reutiliza o wuzapiClient existente para consultar status
- O polling de 30 segundos pode ser ajustado conforme necessidade
