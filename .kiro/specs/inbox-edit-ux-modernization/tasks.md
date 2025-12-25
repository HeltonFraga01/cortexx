# Implementation Plan: Inbox Edit UX Modernization

## Overview

Modernizar a página de edição de caixa de entrada (`UserInboxEditPage.tsx`) com layout em tabs, visual moderno com gradientes, e micro-interações. A implementação será incremental, começando pela estrutura de tabs e progredindo para os componentes visuais.

## Tasks

- [x] 1. Criar hook useTabNavigation para gerenciamento de tabs
  - [x] 1.1 Implementar hook com persistência na URL
    - Criar `src/hooks/useTabNavigation.ts`
    - Usar `useSearchParams` para persistir tab ativa
    - Validar tabs inválidas e fallback para default
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 1.2 Escrever teste de propriedade para tab state persistence
    - **Property 1: Tab Navigation State Persistence**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 2. Criar componente ModernHeader
  - [x] 2.1 Implementar header com status indicator
    - Criar `src/components/shared/inbox/ModernInboxHeader.tsx`
    - Implementar StatusIndicator com pulse animation
    - Adicionar Quick Actions (QR Code, Refresh)
    - Responsivo: icon-only em mobile
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [ ]* 2.2 Escrever teste de propriedade para connection status display
    - **Property 2: Connection Status Display Consistency**
    - **Validates: Requirements 2.3, 2.6**

- [x] 3. Criar componente ConnectionCard modernizado
  - [x] 3.1 Implementar card com gradientes e seção expansível
    - Criar `src/components/shared/inbox/ModernConnectionCard.tsx`
    - Gradiente baseado no status de conexão
    - Avatar com ring indicator
    - Seção "Detalhes" expansível (Collapsible)
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [x] 4. Checkpoint - Validar componentes base
  - Verificar TypeScript sem erros
  - Testar hook useTabNavigation isoladamente
  - Verificar responsividade do header

- [x] 5. Criar componente BotCard e BotGrid
  - [x] 5.1 Implementar BotCard com seleção visual
    - Criar `src/components/shared/inbox/BotCard.tsx`
    - Highlight quando selecionado (ring-2 ring-primary)
    - Badge "Ativo" no bot selecionado
    - Badge de status (ativo/pausado)
    - _Requirements: 6.1, 6.2, 6.6_

  - [x] 5.2 Implementar BotGrid com empty state
    - Criar `src/components/shared/inbox/BotGrid.tsx`
    - Grid responsivo (1 col mobile, 2 tablet, 3 desktop)
    - Card "Nenhum bot" como opção
    - Empty state quando não há bots
    - _Requirements: 6.4, 6.5_

  - [ ]* 5.3 Escrever teste de propriedade para bot assignment state
    - **Property 5: Bot Assignment State**
    - **Validates: Requirements 6.2, 6.3, 6.6**

- [x] 6. Criar componente WebhookToggle
  - [x] 6.1 Implementar toggle com summary
    - Criar `src/components/shared/inbox/WebhookToggle.tsx`
    - Switch para habilitar/desabilitar
    - Badge com contagem de eventos
    - Animação de collapse quando desabilitado
    - _Requirements: 5.1, 5.2, 5.5_

  - [ ]* 6.2 Escrever teste de propriedade para webhook configuration state
    - **Property 4: Webhook Configuration State**
    - **Validates: Requirements 5.2, 5.4, 5.5, 5.7**

- [x] 7. Checkpoint - Validar componentes de seção
  - Verificar BotCard selection visual
  - Verificar WebhookToggle collapse animation
  - Testar empty states

- [x] 8. Refatorar UserInboxEditPage com tabs
  - [x] 8.1 Implementar estrutura de tabs
    - Modificar `src/components/user/UserInboxEditPage.tsx`
    - Adicionar Tabs component do shadcn/ui
    - Organizar conteúdo em 3 tabs: Visão Geral, Webhooks, Automação
    - Integrar useTabNavigation hook
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.2 Integrar ModernHeader
    - Substituir header atual pelo ModernHeader
    - Passar props de status e ações
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 8.3 Integrar ModernConnectionCard na tab Visão Geral
    - Substituir card de informações atual
    - Manter ConnectionControlCard existente
    - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [x] 9. Integrar componentes nas tabs restantes
  - [x] 9.1 Configurar tab Webhooks
    - Adicionar WebhookToggle no topo
    - Integrar WebhookConfigCard existente
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 9.2 Configurar tab Automação
    - Substituir Select por BotGrid
    - Integrar ChatIntegrationSection existente
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 10. Implementar feedback visual aprimorado
  - [x] 10.1 Adicionar estados de loading e sucesso
    - Skeleton loading para cards (já implementado via isLoading props)
    - Success animation via toast notifications
    - Inline error messages com retry (já implementado)
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 10.2 Escrever teste de propriedade para action state management
    - **Property 3: Action State Management**
    - **Validates: Requirements 4.1, 4.3, 4.6**

- [x] 11. Adicionar micro-interações e animações
  - [x] 11.1 Implementar animações CSS
    - Pulse animation para status online (já em ModernInboxHeader)
    - Smooth transitions para tabs (via Tailwind)
    - Hover effects nos cards (card-hover utility class)
    - Copy icon animation (copy-success keyframe)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 12. Ajustes de responsividade
  - [x] 12.1 Otimizar para mobile
    - Tab navigation horizontal scrollable (grid-cols-3 com icons em mobile)
    - Quick actions icon-only em mobile (hidden sm:inline)
    - Cards em coluna única (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
    - Touch targets adequados (min-h-10 nos botões)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 13. Checkpoint final - Validação completa
  - Verificar TypeScript sem erros ✓
  - Testar todas as tabs e navegação ✓
  - Verificar responsividade em diferentes breakpoints ✓
  - Testar todas as ações (connect, disconnect, QR, webhook save, bot assign) ✓
  - Verificar animações e transições ✓

## Notes

- Tasks marcadas com `*` são opcionais (testes de propriedade)
- Componentes novos vão em `src/components/shared/inbox/` para reutilização
- Usar componentes shadcn/ui existentes: Tabs, Card, Badge, Avatar, Switch, Collapsible
- Manter compatibilidade com componentes existentes (WebhookConfigCard, ConnectionControlCard)
- Animações devem ser sutis para não distrair o usuário

