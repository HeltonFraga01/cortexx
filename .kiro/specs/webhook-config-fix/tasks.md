# Implementation Plan: Webhook Config Fix

## Overview

Este plano implementa a correção do problema de salvamento de webhook, modificando a ordem de prioridade no middleware de autenticação para priorizar o token explícito do header.

## Tasks

- [x] 1. Modificar middleware verifyUserTokenWithInbox
  - [x] 1.1 Reordenar prioridade de tokens no middleware
    - Mover verificação do header `token` para o início
    - Adicionar trim() para ignorar tokens com apenas whitespace
    - Adicionar propriedade `req.tokenSource` para debug
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Adicionar logging de debug
    - Logar fonte do token usado (header, context, session)
    - Logar preview do token (primeiros 8 caracteres)
    - _Requirements: 3.1, 3.2_

  - [x] 1.3 Atualizar código de erro
    - Mudar código de erro de `NO_TOKEN` para `NO_WUZAPI_TOKEN`
    - Atualizar mensagem de erro para ser mais específica
    - _Requirements: 2.2_

- [-] 2. Checkpoint - Validar middleware
  - Testar manualmente que o token do header é usado
  - Verificar logs de debug
  - Testar fallback para contexto quando sem header

- [ ]* 3. Escrever testes para o middleware
  - [ ]* 3.1 Escrever unit test para prioridade de token
    - Testar que header `token` tem prioridade sobre JWT
    - Testar fallback para contexto quando sem header
    - **Property 1: Token Header Priority**
    - **Validates: Requirements 1.1, 4.1, 4.2, 4.3**

  - [ ]* 3.2 Escrever unit test para validação de token
    - Testar rejeição de tokens vazios
    - Testar rejeição de tokens com apenas whitespace
    - **Property 3: Token Validation**
    - **Validates: Requirements 2.1, 2.2**

- [x] 4. Verificar consistência em outras rotas
  - [x] 4.1 Verificar se outras rotas usam o mesmo padrão
    - Verificar chatRoutes.js
    - Verificar userRoutes.js
    - Verificar chatInboxRoutes.js
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 4.2 Aplicar mesma correção em todas as rotas com verifyUserTokenWithInbox
    - webhookRoutes.js ✅
    - userWebhookRoutes.js ✅
    - chatRoutes.js ✅
    - userDraftRoutes.js ✅
    - reportRoutes.js ✅
    - userContactsRoutes.js ✅
    - userRoutes.js ✅
    - userBotTestRoutes.js ✅
    - bulkCampaignRoutes.js ✅
    - userBotRoutes.js ✅

- [x] 5. Checkpoint final
  - Testar salvamento de webhook via UI
  - Verificar que GET retorna a configuração salva
  - Verificar logs de debug
  - **FIX APPLIED:** Changed GET handler to map WUZAPI's `subscribe` field to `events` for frontend compatibility

- [x] 6. Fix WUZAPI payload field names
  - [x] 6.1 Fix POST /api/webhook handler
    - Changed `webhookURL` to `webhookurl` (lowercase)
    - Changed `Subscribe` to `events`
    - WUZAPI SetWebhook expects: `{ webhookurl: string, events: []string }`
  - [x] 6.2 Fix POST /api/webhook/config handler
    - Same field name corrections applied
  - **ROOT CAUSE:** WUZAPI's Go struct uses `json:"webhookurl"` and `json:"events"` tags, not camelCase

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- A mudança é retrocompatível - o fluxo existente continua funcionando
- O foco principal é a task 1 que resolve o problema imediato
- Todas as 10 rotas com o middleware foram atualizadas para consistência
