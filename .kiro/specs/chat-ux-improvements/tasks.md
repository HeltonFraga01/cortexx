# Implementation Plan: Chat UX Improvements

## Overview

Este plano implementa melhorias incrementais de UX/UI na interface de chat do Cortexx. As tarefas estão organizadas para entregar valor rapidamente, começando pelas melhorias mais visíveis e de maior impacto.

## Tasks

- [x] 1. Melhorias na Lista de Conversas (InboxSidebar)
  - [x] 1.1 Atualizar layout do ConversationItem com nova hierarquia visual
    - Aumentar avatar para 44px (h-11 w-11)
    - Adicionar ring-2 ring-background no avatar
    - Melhorar espaçamento e tipografia
    - Adicionar border-l-2 border-primary quando selecionado
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Implementar TypingIndicator component
    - Criar componente com animação de 3 pontos
    - Integrar no ConversationItem quando isTyping=true
    - Usar cores do tema (text-primary)
    - _Requirements: 1.6_

  - [x] 1.3 Adicionar QuickActions no hover
    - Criar componente QuickActions com botões (mark read, mute, archive)
    - Posicionar absolutamente à direita do item
    - Mostrar apenas no hover (opacity-0 group-hover:opacity-100)
    - _Requirements: 1.3_

  - [ ]* 1.4 Write property tests for conversation list
    - **Property 1: Unread Badge Display**
    - **Property 2: Selected Conversation Visual State**
    - **Property 4: Typing Indicator Display**
    - **Validates: Requirements 1.2, 1.4, 1.6**

- [x] 2. Melhorias nas Bolhas de Mensagem (MessageBubble)
  - [x] 2.1 Atualizar estilos base das bolhas
    - Aumentar border-radius para 16px (rounded-2xl)
    - Ajustar padding para 12px horizontal, 8px vertical
    - Usar bg-primary para outgoing, bg-muted para incoming
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Implementar agrupamento de mensagens consecutivas
    - Criar lógica para detectar mensagens consecutivas do mesmo sender
    - Reduzir espaçamento entre mensagens agrupadas (mt-0.5)
    - Ajustar border-radius para mensagens do meio do grupo
    - _Requirements: 2.7_

  - [x] 2.3 Implementar detecção e exibição de emoji-only
    - Criar função isEmojiOnlyMessage com regex Unicode
    - Renderizar emojis em tamanho grande (text-4xl) sem bolha
    - Suportar 1-3 emojis consecutivos
    - _Requirements: 2.6_

  - [x] 2.4 Melhorar MessageStatusIcon
    - Atualizar ícones para cada status (Clock, Check, CheckCheck)
    - Adicionar cor azul para status 'read'
    - Adicionar animação pulse para 'sending'
    - _Requirements: 2.5_

  - [ ]* 2.5 Write property tests for message bubbles
    - **Property 5: Outgoing Message Styling**
    - **Property 6: Incoming Message Styling**
    - **Property 7: Message Status Icon Mapping**
    - **Property 8: Emoji-Only Message Display**
    - **Property 9: Consecutive Message Grouping**
    - **Validates: Requirements 2.2, 2.3, 2.5, 2.6, 2.7**

- [x] 3. Checkpoint - Validar melhorias visuais básicas
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Melhorias no Campo de Input (MessageInput)
  - [x] 4.1 Implementar auto-expansão do textarea
    - Usar useEffect para ajustar altura baseado no scrollHeight
    - Limitar a 4 linhas (max-h-[96px])
    - Adicionar overflow-y-auto quando exceder
    - _Requirements: 3.2_

  - [x] 4.2 Melhorar visual do container de input
    - Adicionar rounded-2xl no container
    - Implementar focus-within:ring-2 focus-within:ring-primary/20
    - Adicionar transição suave de borda
    - _Requirements: 3.4_

  - [x] 4.3 Implementar botão de envio animado
    - Mostrar botão apenas quando há conteúdo
    - Animar entrada/saída com scale e opacity
    - Usar bg-primary quando ativo, bg-muted quando inativo
    - _Requirements: 3.3_

  - [x] 4.4 Melhorar preview de reply
    - Criar componente ReplyPreview compacto
    - Adicionar botão de dismiss claro
    - Posicionar acima do input
    - _Requirements: 3.7_

  - [ ]* 4.5 Write property tests for message input
    - **Property 10: Input Auto-Expansion**
    - **Property 11: Send Button Visibility**
    - **Property 13: Reply Preview Display**
    - **Validates: Requirements 3.2, 3.3, 3.7**

- [x] 5. Melhorias no Painel de Contato (ContactPanel)
  - [x] 5.1 Reorganizar header do contato
    - Aumentar avatar para 80px com ring-4
    - Centralizar nome e telefone
    - Adicionar botão de copiar telefone
    - _Requirements: 4.1_

  - [x] 5.2 Implementar CollapsibleSection com animação
    - Criar componente reutilizável
    - Adicionar transição de max-height e opacity
    - Rotacionar ícone chevron ao expandir
    - _Requirements: 4.2_

  - [x] 5.3 Reorganizar seções do painel
    - Agrupar ações relacionadas
    - Aplicar max-w-[320px] no container
    - Melhorar espaçamento entre seções
    - _Requirements: 4.3, 4.4_

  - [x] 5.4 Melhorar exibição de labels
    - Renderizar como chips coloridos
    - Usar cor do label como background com opacidade
    - Adicionar hover state
    - _Requirements: 4.5_

  - [ ]* 5.5 Write property tests for contact panel
    - **Property 14: Label Chip Rendering**
    - **Validates: Requirements 4.5**

- [x] 6. Checkpoint - Validar componentes principais
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Melhorias de Feedback Visual
  - [x] 7.1 Implementar optimistic updates para mensagens
    - Adicionar mensagem ao cache imediatamente com status 'sending'
    - Atualizar status após confirmação do servidor
    - Reverter em caso de erro
    - _Requirements: 5.1_

  - [x] 7.2 Implementar estado de erro com retry
    - Mostrar ícone de erro em mensagens falhadas
    - Adicionar botão de retry
    - Implementar lógica de reenvio
    - _Requirements: 5.2_

  - [x] 7.3 Melhorar skeleton loading
    - Criar MessageSkeleton que simula layout de mensagem
    - Usar animação pulse consistente
    - Variar tamanhos para parecer natural
    - _Requirements: 5.3_

  - [ ]* 7.4 Write property tests for feedback visual
    - **Property 15: Optimistic Message Update**
    - **Property 16: Failed Message Error State**
    - **Validates: Requirements 5.1, 5.2**

- [x] 8. Melhorias de Acessibilidade
  - [x] 8.1 Adicionar suporte a navegação por teclado
    - Garantir todos elementos interativos são focusáveis
    - Adicionar focus-visible styles consistentes
    - Implementar atalhos de teclado (Ctrl+K para busca)
    - _Requirements: 6.1_

  - [x] 8.2 Adicionar ARIA labels
    - Adicionar aria-label em todos os botões de ícone
    - Adicionar aria-live para mensagens novas
    - Adicionar role="list" e role="listitem" na lista de conversas
    - _Requirements: 6.2_

  - [x] 8.3 Verificar e ajustar contraste de cores
    - Auditar todas as combinações de cores
    - Ajustar cores que não atendem WCAG AA
    - Testar em ambos os temas (light/dark)
    - _Requirements: 6.6_

  - [ ]* 8.4 Write property tests for accessibility
    - **Property 17: Keyboard Navigation Support**
    - **Property 18: ARIA Labels Presence**
    - **Property 19: Contrast Ratio Compliance**
    - **Validates: Requirements 6.1, 6.2, 6.6**

- [x] 9. Melhorias de Dark Mode
  - [x] 9.1 Ajustar cores de fundo do dark mode
    - Usar deep blue-gray (#0f172a a #1e293b) ao invés de preto puro
    - Atualizar CSS variables em index.css
    - Testar contraste de todos os elementos
    - _Requirements: 7.1_

  - [x] 9.2 Ajustar cores das bolhas no dark mode
    - Garantir contraste suficiente para texto
    - Usar variantes mais suaves das cores
    - Manter consistência com o tema
    - _Requirements: 7.2_

  - [x] 9.3 Implementar transição suave de tema
    - Adicionar transition-colors duration-300 nos elementos principais
    - Evitar flash de conteúdo ao trocar tema
    - _Requirements: 7.4_

- [x] 10. Checkpoint - Validar acessibilidade e dark mode
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Melhorias de Performance
  - [x] 11.1 Implementar virtualização na lista de conversas
    - Instalar e configurar @tanstack/react-virtual
    - Aplicar na lista de conversas
    - Manter scroll position ao atualizar
    - _Requirements: 8.1_

  - [x] 11.2 Implementar lazy loading de avatares
    - Adicionar loading="lazy" em todas as imagens de avatar
    - Usar IntersectionObserver para carregar sob demanda
    - Adicionar placeholder enquanto carrega
    - _Requirements: 8.3_

  - [x] 11.3 Otimizar animações para GPU
    - Usar transform e opacity ao invés de top/left
    - Adicionar will-change onde apropriado
    - Testar performance com DevTools
    - _Requirements: 8.4_

  - [x] 11.4 Implementar indicador de conexão
    - Criar ConnectionStatusBanner component
    - Mostrar quando isConnected=false
    - Adicionar animação de reconexão
    - _Requirements: 8.5_

  - [ ]* 11.5 Write property tests for performance
    - **Property 20: List Virtualization**
    - **Property 21: Avatar Lazy Loading**
    - **Property 22: Connection Status Indicator**
    - **Validates: Requirements 8.1, 8.3, 8.5**

- [x] 12. Responsividade Mobile
  - [x] 12.1 Implementar layout mobile (< 768px)
    - Esconder sidebar por padrão
    - Mostrar apenas ConversationView
    - Adicionar botão para abrir sidebar como drawer
    - _Requirements: 6.3_

  - [x] 12.2 Implementar layout tablet (768-1024px)
    - Reduzir largura da sidebar para 280px
    - Esconder ContactPanel por padrão
    - Ajustar breakpoints
    - _Requirements: 6.4_

- [x] 13. Final checkpoint - Validação completa
  - Ensure all tests pass, ask the user if questions arise.
  - Testar em diferentes viewports
  - Verificar acessibilidade com axe-core
  - Validar performance com Lighthouse

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- A biblioteca de virtualização recomendada é @tanstack/react-virtual
- Para testes de propriedade, usar Vitest com fast-check
