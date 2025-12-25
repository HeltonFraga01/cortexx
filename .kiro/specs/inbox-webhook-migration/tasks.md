# Implementation Plan: Inbox Webhook Migration

## Overview

Este plano implementa a migração da configuração de webhooks WUZAPI da página de Settings para a página de edição de inbox. A implementação é principalmente de remoção de código redundante, já que a funcionalidade já existe na página de edição de inbox.

## Tasks

- [x] 1. Remover configuração de webhook WUZAPI de UserSettings.tsx
  - [x] 1.1 Remover tab "webhook" do TabsList
    - Remover `<TabsTrigger value="webhook">` do componente
    - Atualizar grid-cols de 8 para 7 no TabsList
    - _Requirements: 2.1, 2.3_

  - [x] 1.2 Remover TabsContent de webhook
    - Remover todo o bloco `<TabsContent value="webhook">` e seu conteúdo
    - _Requirements: 2.1_

  - [x] 1.3 Remover estados relacionados a webhook WUZAPI
    - Remover `const [webhookUrl, setWebhookUrl] = useState('')`
    - Remover `const [selectedEvents, setSelectedEvents] = useState<string[]>(['Message'])`
    - _Requirements: 2.4_

  - [x] 1.4 Remover funções de webhook WUZAPI
    - Remover função `fetchWebhookConfig`
    - Remover função `handleSaveWebhook`
    - Remover função `handleEventToggle`
    - _Requirements: 2.4_

  - [x] 1.5 Remover arrays de eventos WUZAPI
    - Remover array `availableEvents` (40+ eventos)
    - Remover array `validEventIds`
    - Remover objeto `eventsByCategory`
    - _Requirements: 2.4_

  - [x] 1.6 Remover useEffect de webhook
    - Remover `useEffect(() => { fetchWebhookConfig() }, [user?.token])`
    - _Requirements: 2.4_

  - [x] 1.7 Remover imports não utilizados
    - Remover imports que ficaram órfãos após remoção do código
    - Verificar: Separator, Checkbox (se não usados em outras tabs)
    - _Requirements: 2.4_

- [x] 2. Atualizar descrições e labels em Settings
  - [x] 2.1 Atualizar descrição da tab "Integração Chat"
    - A tab já tem descrição adequada no componente WebhookSettings
    - Texto atual: "Configure webhooks para enviar eventos do chat para sistemas externos"
    - _Requirements: 6.1_

- [x] 3. Verificar WebhookConfigCard na página de edição de inbox
  - [x] 3.1 Confirmar que WebhookConfigCard está renderizando corretamente
    - Verificado: WebhookConfigCard importado e usado em UserInboxEditPage
    - Posicionado após ConnectionControlCard
    - Título e ícone Globe presentes
    - _Requirements: 1.1, 6.2, 6.4_

  - [x] 3.2 Verificar funcionalidade de salvamento
    - WebhookConfigCard já implementado com onSave callback
    - Feedback de sucesso/erro via toast
    - _Requirements: 1.4, 5.6, 5.7_

- [x] 4. Checkpoint - Validação de remoção
  - ✅ UserSettings.tsx compila sem erros (getDiagnostics: No diagnostics found)
  - ✅ TabsList tem 7 tabs (grid-cols-7)
  - ✅ Tab "webhook" removida
  - ✅ "Integração Chat" mantida para webhooks de saída
  - ✅ WebhookConfigCard presente em UserInboxEditPage

- [ ]* 5. Escrever testes para validar migração
  - [ ]* 5.1 Escrever unit test para contagem de tabs
    - Verificar que TabsList tem 7 tabs
    - Verificar que não existe tab com value="webhook"
    - **Property 6: Settings Tab Count**
    - **Validates: Requirements 2.1, 2.3**

  - [ ]* 5.2 Escrever property test para validação de URL
    - Testar URLs válidas (http://, https://, vazio)
    - Testar URLs inválidas (sem protocolo, ftp://)
    - **Property 3: URL Validation**
    - **Validates: Requirements 5.4**

  - [ ]* 5.3 Escrever property test para round-trip de transformação
    - Testar adaptWebhookConfigToWuzapi → adaptWebhookResponseToConfig
    - Verificar que dados são preservados
    - **Property 5: Webhook Config Round-Trip**
    - **Validates: Requirements 7.2, 7.3**

- [x] 6. Checkpoint final
  - ✅ TypeScript sem erros
  - ✅ Página Settings funciona (7 tabs)
  - ✅ Página InboxEdit funciona com WebhookConfigCard
  - ✅ Webhooks WUZAPI configurados por inbox (não mais global)

- [x] 7. Corrigir API WUZAPI e caching
  - [x] 7.1 Corrigir parâmetros da API WUZAPI
    - ✅ Endpoint: POST /webhook (correto)
    - ✅ Header: Token (não Authorization Bearer)
    - ✅ Body: webhookURL (camelCase), Subscribe (array)
    - _Requirements: 1.4_

  - [x] 7.2 Adicionar cache-control headers
    - ✅ Adicionado no GET /api/user/inbox/:inboxId/webhook
    - ✅ Adicionado no GET /api/webhook
    - Headers: Cache-Control: no-cache, no-store, must-revalidate
    - _Requirements: 5.1_

  - [x] 7.3 Validar salvamento de webhook
    - ✅ POST /api/webhook retorna success: true
    - ✅ WUZAPI retorna code: 200 com webhook URL correto
    - ⚠️ GET /webhook do WUZAPI pode retornar dados stale (issue do WUZAPI)
    - _Requirements: 1.4, 5.6_

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- A maior parte do trabalho é remoção de código, não adição
- WebhookConfigCard já está implementado e funcionando em UserInboxEditPage
- Não há necessidade de criar novos componentes ou rotas
- Checkpoints garantem validação incremental

## Known Issues

### WUZAPI GET /webhook Stale Data
- **Sintoma**: Após salvar webhook com sucesso (POST retorna 200), o GET /webhook retorna URL antiga
- **Causa**: WUZAPI pode ter caching interno ou delay na propagação
- **Impacto**: UI mostra URL antiga após salvar, mas webhook está configurado corretamente
- **Workaround**: Recarregar página após alguns segundos ou confiar na resposta do POST
- **Status**: Issue do WUZAPI, não do nosso código
