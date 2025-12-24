# Implementation Plan: User Inbox Edit Improvements

## Overview

Implementar melhorias na página de edição de inbox do usuário (`UserInboxEditPage.tsx`) para ter paridade de funcionalidades com a página admin. As mudanças são mínimas pois os componentes compartilhados já existem e funcionam corretamente.

## Tasks

- [x] 1. Corrigir lógica de carregamento do avatar
  - [x] 1.1 Atualizar dependências do useEffect para usar sessionStatus
    - Modificar `src/components/user/UserInboxEditPage.tsx`
    - Usar `sessionStatus?.loggedIn ?? connectionData?.isLoggedIn` como condição
    - Garantir que fetchAvatar seja chamado quando logado
    - _Requirements: 1.1, 1.2_

  - [ ]* 1.2 Escrever teste de propriedade para avatar loading
    - **Property 1: Avatar Loading When Logged In**
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Verificar inicialização do webhook config
  - [x] 2.1 Revisar adaptWebhookResponseToConfig
    - Verificar `src/lib/adapters/inbox-adapters.ts`
    - Garantir que eventos específicos não sejam convertidos para 'All'
    - Manter array vazio como array vazio (não converter para ['All'])
    - _Requirements: 5.2, 5.3, 5.4_
    - **RESULTADO**: Adapter está correto. Passa eventos como recebidos do servidor.
    - **NOTA**: O comportamento de `isAllSelected = config.events.includes('All') || config.events.length === 0` no WebhookConfigCard é intencional - array vazio significa "todos os eventos" no WUZAPI.

  - [ ]* 2.2 Escrever teste de propriedade para webhook config initialization
    - **Property 5: Webhook Config Initialization**
    - **Validates: Requirements 5.2, 5.3, 5.4**

- [x] 3. Checkpoint - Validar avatar e webhook
  - Avatar carrega quando logado (usa sessionStatus?.loggedIn ?? connectionData?.isLoggedIn)
  - Webhook mostra categorias quando eventos específicos selecionados
  - "Todos os Eventos" esconde categorias (comportamento intencional)
  - **RESULTADO**: Lógica verificada e correta

- [x] 4. Verificar consistência de status de conexão
  - [x] 4.1 Revisar uso de sessionStatus vs connectionData
    - Verificar que isConnected e isLoggedIn usam sessionStatus como prioridade
    - Garantir consistência entre header badge e info card
    - _Requirements: 4.3, 4.4, 4.5, 4.6_
    - **RESULTADO**: Implementação correta:
      - `const isConnected = sessionStatus?.connected ?? connectionData.isConnected ?? false`
      - `const isLoggedIn = sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false`
    - Header badge e info card usam as mesmas variáveis derivadas

  - [ ]* 4.2 Escrever teste de propriedade para connection status badge
    - **Property 4: Connection Status Badge Rendering**
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [x] 5. Verificar hasWebhookChanges function
  - [x] 5.1 Revisar implementação de hasWebhookChanges
    - Garantir comparação correta entre localWebhookConfig e serverConfig
    - Usar JSON.stringify para comparar arrays de eventos
    - _Requirements: 5.5_
    - **RESULTADO**: Implementação correta:
      ```typescript
      const hasWebhookChanges = (): boolean => {
        if (!localWebhookConfig || !webhookConfig) return false
        const serverConfig = adaptWebhookResponseToConfig(webhookConfig.webhook || '', webhookConfig.subscribe)
        return (
          localWebhookConfig.webhookUrl !== serverConfig.webhookUrl ||
          JSON.stringify(localWebhookConfig.events.sort()) !== JSON.stringify(serverConfig.events.sort())
        )
      }
      ```

  - [ ]* 5.2 Escrever teste de propriedade para has changes detection
    - **Property 6: Has Changes Detection**
    - **Validates: Requirements 5.5**

- [x] 6. Checkpoint - Validação final
  - [x] Verificar TypeScript sem erros - **PASSOU**
  - [x] Testar página completa em `/user/inboxes/edit/:inboxId` - **PASSOU**
  - [x] Avatar carregando corretamente com foto do WhatsApp
  - [x] Status de conexão mostrando "Logado" com badge verde
  - [x] Webhook mostrando "Todos os Eventos" (46 eventos)
  - [x] Ações rápidas funcionando (Gerar QR Code, Atualizar Status)
  - [x] Controle de conexão com botões Desconectar, Logout WhatsApp, Novo QR Code

## Bug Fix Aplicado

**Problema encontrado:** Erro 500 ao buscar avatar
- **Causa:** O middleware `verifyUserToken` priorizava o token da inbox ativa (via `inboxContextMiddleware`) sobre o token passado no header
- **Solução:** Modificada a rota `/api/user/avatar` em `server/routes/userRoutes.js` para priorizar o header `token` quando passado explicitamente
- **Arquivo modificado:** `server/routes/userRoutes.js` linha 1020-1024

## Notes

- Tasks marcadas com `*` são opcionais (testes de propriedade)
- A maioria das funcionalidades já existe nos componentes compartilhados
- O foco é garantir que os props corretos sejam passados e a lógica de estado esteja correta
- Não é necessário criar novos componentes, apenas ajustar o `UserInboxEditPage.tsx`
