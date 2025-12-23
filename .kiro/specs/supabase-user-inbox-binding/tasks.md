# Implementation Plan: Supabase User Inbox Binding

## Overview

Este plano implementa a vinculação automática de inbox ao usuário Supabase Auth, permitindo que owners e agentes acessem automaticamente suas caixas de entrada WhatsApp em todo o sistema.

## Tasks

- [x] 1. Preparação do banco de dados
  - [x] 1.1 Criar migration para tabela user_preferences
    - Criar tabela com campos: id, user_id, key, value (JSONB), created_at, updated_at
    - Adicionar constraint UNIQUE(user_id, key)
    - Criar índice para performance
    - _Requirements: 7.5, 12.5_
  - [x] 1.2 Adicionar coluna is_primary em user_inboxes
    - Verificar se coluna já existe
    - Adicionar com DEFAULT false
    - _Requirements: 7.1_
  - [x] 1.3 Criar índices de performance
    - Índice em inbox_members(agent_id)
    - Índice em user_inboxes(user_id)
    - _Requirements: 6.6_

- [x] 2. Implementar InboxContextService
  - [x] 2.1 Criar arquivo server/services/InboxContextService.js
    - Implementar estrutura base da classe
    - Importar SupabaseService e logger
    - _Requirements: 2.1, 6.4_
  - [x] 2.2 Implementar método getUserInboxContext(userId)
    - Verificar se usuário é owner (accounts.owner_user_id)
    - Se não, verificar se é agent (agents.user_id)
    - Retornar erro apropriado se nenhum
    - _Requirements: 1.1, 9.1, 11.1_
  - [x] 2.3 Implementar método getAvailableInboxes(userId, accountId, userType)
    - Para owner: buscar todas inboxes da account
    - Para agent: buscar apenas via inbox_members
    - Incluir status de conexão
    - _Requirements: 9.2, 10.1, 11.2, 11.3_
  - [x] 2.4 Implementar método selectActiveInbox(userId, inboxes)
    - Verificar preferência salva em user_preferences
    - Fallback para is_primary = true
    - Fallback para primeira inbox
    - _Requirements: 7.1, 7.2, 9.3_
  - [x] 2.5 Implementar método switchActiveInbox(userId, inboxId)
    - Verificar acesso à inbox
    - Atualizar preferência
    - Retornar novo contexto
    - _Requirements: 7.4, 10.4, 12.3_
  - [x] 2.6 Implementar método saveInboxPreference(userId, inboxId)
    - Upsert em user_preferences
    - _Requirements: 7.5, 12.5_
  - [x] 2.7 Implementar método hasInboxAccess(userId, inboxId)
    - Verificar se owner da account
    - Ou se agent com inbox_members
    - _Requirements: 10.2_
  - [ ]* 2.8 Escrever testes unitários para InboxContextService
    - Testar getUserInboxContext para owner e agent
    - Testar getAvailableInboxes com diferentes cenários
    - Testar switchActiveInbox com acesso permitido e negado
    - _Requirements: 1.1, 9.1, 10.2_

- [x] 3. Implementar inboxContextMiddleware
  - [x] 3.1 Criar arquivo server/middleware/inboxContextMiddleware.js
    - Importar InboxContextService
    - Estrutura base do middleware
    - _Requirements: 6.1_
  - [x] 3.2 Implementar lógica principal do middleware
    - Verificar se req.user existe (após validateSupabaseToken)
    - Chamar InboxContextService.getUserInboxContext
    - Popular req.context com resultado
    - _Requirements: 2.2, 6.2, 6.3, 6.4_
  - [x] 3.3 Implementar tratamento de erros
    - Retornar 401 para NO_ACCOUNT, NO_AGENT
    - Retornar 403 para NO_INBOX
    - Retornar 500 para erros internos
    - _Requirements: 1.4, 1.5, 6.5, 9.5_
  - [x] 3.4 Implementar cache de contexto na sessão
    - Verificar se contexto já existe em req.session
    - Evitar consultas repetidas
    - _Requirements: 6.6_
  - [ ]* 3.5 Escrever testes para middleware
    - Testar população de req.context
    - Testar erros 401, 403, 500
    - _Requirements: 6.4, 6.5_

- [x] 4. Criar endpoints de API
  - [x] 4.1 Criar arquivo server/routes/inboxContextRoutes.js
    - Configurar router com validateSupabaseToken
    - _Requirements: 2.2_
  - [x] 4.2 Implementar GET /api/user/inbox-context
    - Retornar contexto atual do usuário
    - Usar InboxContextService
    - _Requirements: 2.1, 2.2_
  - [x] 4.3 Implementar POST /api/user/inbox-context/switch
    - Receber inboxId no body
    - Validar acesso
    - Retornar novo contexto
    - _Requirements: 7.4, 10.4, 12.3_
  - [x] 4.4 Implementar GET /api/user/inboxes/available
    - Listar inboxes disponíveis para o usuário
    - _Requirements: 10.3, 12.2_
  - [x] 4.5 Implementar GET /api/user/inbox-status
    - Retornar status de conexão da inbox ativa
    - Consultar WUZAPI se necessário
    - _Requirements: 8.1_
  - [x] 4.6 Registrar rotas em server/routes/index.js
    - Adicionar /api/user/inbox-context
    - _Requirements: 2.2_
  - [ ]* 4.7 Escrever testes de integração para endpoints
    - Testar GET /inbox-context
    - Testar POST /inbox-context/switch
    - _Requirements: 2.2, 7.4_

- [x] 5. Checkpoint - Backend completo
  - Backend implementado com InboxContextService, middleware e rotas

- [x] 6. Implementar InboxContext no Frontend
  - [x] 6.1 Criar arquivo src/contexts/SupabaseInboxContext.tsx
    - Definir interface SessionContext
    - Definir interface InboxContextValue
    - Criar contexto e provider
    - _Requirements: 2.1_
  - [x] 6.2 Implementar InboxProvider
    - Carregar contexto ao montar
    - Gerenciar estado de loading e error
    - Implementar switchInbox
    - _Requirements: 2.2, 7.4_
  - [x] 6.3 Implementar hook useSupabaseInbox
    - Validar uso dentro do provider
    - Expor helpers (hasPermission, canSendMessages)
    - _Requirements: 2.4, 11.6_
  - [x] 6.4 Criar serviço src/services/inbox-context.ts
    - Implementar getInboxContext()
    - Implementar switchInbox(inboxId)
    - Implementar getAvailableInboxes()
    - _Requirements: 2.2_

- [x] 7. Implementar componentes de UI
  - [x] 7.1 Criar componente InboxSelector
    - Dropdown com inboxes disponíveis
    - Mostrar inbox ativa
    - Chamar switchInbox ao selecionar
    - _Requirements: 7.3, 12.1, 12.2_
  - [x] 7.2 Criar componente ConnectionStatus
    - Indicador visual (verde/vermelho)
    - Tooltip com detalhes
    - Botão de reconectar se desconectado
    - _Requirements: 8.2, 8.3_
  - [x] 7.3 Integrar InboxSelector no Header
    - Mostrar apenas se múltiplas inboxes
    - Posicionar ao lado do nome do usuário
    - _Requirements: 12.1_
  - [x] 7.4 Integrar ConnectionStatus no Header
    - Mostrar status da inbox ativa
    - _Requirements: 8.2, 8.3_

- [x] 8. Integrar contexto nos módulos existentes
  - [x] 8.1 Atualizar Chat para usar InboxContext
    - Usar wuzapiToken e instance do contexto
    - Filtrar mensagens pela inbox ativa
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 8.2 Atualizar Contatos para usar InboxContext
    - Filtrar por accountId do contexto
    - Usar inbox para sincronização
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 8.3 Atualizar Envio de Mensagens para usar InboxContext
    - Usar wuzapiToken e instance do contexto
    - Associar campanhas ao accountId e inboxId
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 8.4 Bloquear operações se inbox desconectada
    - Verificar isConnected antes de envios
    - Mostrar mensagem de erro apropriada
    - _Requirements: 2.4, 5.4_

**Nota:** As tarefas 8.x foram completadas. Todos os arquivos de rotas que usavam o middleware
`verifyUserToken` deprecated (que buscava token da tabela `accounts`) foram atualizados para
usar `inboxContextMiddleware` que busca o token da tabela `inboxes` baseado na inbox ativa.

Arquivos atualizados:
- `server/routes/chatRoutes.js`
- `server/routes/webhookRoutes.js`
- `server/routes/chatInboxRoutes.js`
- `server/routes/bulkCampaignRoutes.js`
- `server/routes/userWebhookRoutes.js`
- `server/routes/userContactsRoutes.js`
- `server/routes/userBotRoutes.js`
- `server/routes/userRoutes.js`
- `server/routes/userDraftRoutes.js`
- `server/routes/reportRoutes.js`
- `server/routes/userBotTestRoutes.js`

- [x] 9. Implementar atualização periódica de status
  - [x] 9.1 Adicionar polling de status no InboxProvider
    - Verificar status a cada 30 segundos
    - Atualizar isConnected no contexto
    - _Requirements: 8.4_
  - [x] 9.2 Implementar notificação de mudança de status
    - Mostrar toast quando status muda
    - _Requirements: 8.5_

- [x] 10. Checkpoint - Frontend completo
  - Frontend implementado com SupabaseInboxContext, serviço, e componentes UI
  - InboxSelector e ConnectionStatus integrados no UserLayout
  - Polling de status implementado no provider

- [ ]* 11. Escrever property tests
  - [ ]* 11.1 Property test: Context Loading Completeness
    - **Property 1: Context Loading Completeness**
    - **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 6.4, 9.4**
  - [ ]* 11.2 Property test: Owner Full Access
    - **Property 2: Owner Full Access**
    - **Validates: Requirements 11.2**
  - [ ]* 11.3 Property test: Agent Restricted Access
    - **Property 3: Agent Restricted Access**
    - **Validates: Requirements 9.2, 10.1, 11.3**
  - [ ]* 11.4 Property test: Inbox Access Validation
    - **Property 4: Inbox Access Validation**
    - **Validates: Requirements 10.2, 10.4**
  - [ ]* 11.5 Property test: Default Inbox Selection
    - **Property 5: Default Inbox Selection**
    - **Validates: Requirements 7.1, 7.2, 9.3**
  - [ ]* 11.6 Property test: Preference Persistence
    - **Property 6: Preference Persistence**
    - **Validates: Requirements 7.5, 12.5**

- [x] 12. Final checkpoint
  - Backend: InboxContextService, middleware, rotas implementados
  - Frontend: SupabaseInboxContext, serviço, componentes UI implementados
  - Integração: Provider adicionado ao App.tsx, componentes no UserLayout
  - Testes opcionais pendentes (marcados com *)

- [x] 13. Bug Fix: 401 Unauthorized após adicionar nova inbox (2025-12-23)
  - **Problema:** Sistema usava token da tabela `accounts` ao invés de `inboxes`
  - **Solução:** 
    - Registrado `inboxContextRoutes` em `server/index.js` (estava faltando)
    - Corrigido declaração duplicada em `server/routes/reportRoutes.js`
    - Corrigido declaração duplicada em `server/routes/userBotTestRoutes.js`
  - **Verificação:** 
    - `/api/user/inbox-context` retorna 200 com token correto da inbox
    - `/api/chat/inbox/conversations` funciona com token da inbox
    - Status "Conectado" aparece no header do usuário

- [x] 14. Bug Fix: 401 SESSION_CORRUPTED em /api/session/inboxes (2025-12-23)
  - **Problema:** Endpoints `/api/session/inboxes` e `/api/session/inboxes/default` não suportavam autenticação JWT
  - **Causa raiz:**
    - `src/services/account-inboxes.ts` não enviava header Authorization com token Supabase
    - `server/routes/sessionAccountRoutes.js` dependia de `req.session.userToken` que não existe com JWT
  - **Solução:**
    - Atualizado `src/services/account-inboxes.ts` para incluir token JWT no header Authorization
    - Atualizado `GET /api/session/inboxes` para suportar `req.user.id` (JWT) além de `req.session.userId`
    - Atualizado `POST /api/session/inboxes/default` para:
      - Usar `InboxContextService` para obter inbox existente quando autenticado via JWT
      - Retornar inbox existente se usuário já tem uma
      - Fallback para criação apenas quando há `userToken` na sessão
  - **Verificação:**
    - `/api/session/inboxes` retorna 200 com lista de inboxes
    - `/api/session/inboxes/default` retorna 200 com inbox do usuário
    - Página "Caixas de Entrada" exibe corretamente as inboxes do usuário

- [x] 15. Bug Fix: Inbox faltando e status incorreto (2025-12-23)
  - **Problema:** 
    - Página `/user/inboxes` mostrava apenas 1 inbox quando deveria mostrar 2
    - Status mostrava "Não configurado" quando deveria mostrar "Conectado"
  - **Causa raiz:**
    - A inbox "Lívia-Suporte" existia no WUZAPI mas nunca foi criada na tabela `inboxes`
    - O endpoint `/api/session/inboxes/:id/status` retornava 404 porque:
      - Usava `req.session.userId` ao invés de suportar JWT (`req.user.id`)
      - Usava `db.query` com sintaxe SQLite ao invés de `SupabaseService`
  - **Solução:**
    - Criada inbox "WhatsApp Lívia-Suporte" na tabela `inboxes` com dados do WUZAPI:
      - `wuzapi_token`: `5521983168750MINZNJASY54EDVCLU`
      - `wuzapi_user_id`: `321782dd27d565c0a83c8e10412feed0`
      - `wuzapi_connected`: `true`
    - Atualizado `GET /api/session/inboxes/:id/status` para:
      - Suportar autenticação JWT (`req.user?.id || req.session?.userId`)
      - Usar `SupabaseService.update()` ao invés de `db.query()`
  - **Verificação:**
    - Página `/user/inboxes` agora mostra 3 inboxes
    - Status "Conectado" aparece corretamente para inboxes com conexão WUZAPI ativa
    - Dropdown de seleção de inbox no header mostra todas as 3 inboxes

- [x] 16. Bug Fix: Chat page não carrega inboxes (2025-12-23)
  - **Problema:** 
    - Página `/user/chat` não carregava as inboxes
    - `InboxContext` dependia de `AgentContext.agent` que é null para usuários Supabase Auth
  - **Causa raiz:**
    - `InboxContext` usava `useAgent()` e verificava `if (!isAuthenticated || !agent)`
    - Para usuários autenticados via Supabase Auth (não agent auth), `agent` é sempre null
    - Isso fazia o contexto retornar cedo sem carregar as inboxes
  - **Solução:**
    - Atualizado `src/contexts/InboxContext.tsx` para usar `useAuth()` do `AuthContext`
    - Removida dependência de `AgentContext` que era específica para agent auth
    - Agora verifica `if (!isAuthenticated || !user)` usando o usuário Supabase
  - **Verificação:**
    - Página `/user/chat` carrega corretamente as inboxes
    - `useChatInbox` hook funciona com o contexto atualizado

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude
- Unit tests validam exemplos específicos e edge cases
