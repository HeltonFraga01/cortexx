# Tasks - Transferência de Conversa entre Caixas de Entrada

## Fase 1: Infraestrutura de Banco de Dados

- [x] 1.1 Criar migration para tabela conversation_transfers
  - Criado arquivo `server/migrations/019_create_conversation_transfers_table.sql`
  - Tabela com campos: id, conversation_id, from_inbox_id, to_inbox_id, transferred_by, transferred_at, reason
  - Índices para conversation_id e transferred_at
  - RLS policy para acesso por conta
  - _Requisitos: REQ-4.1, REQ-4.2_

## Fase 2: Backend - Service Layer

- [x] 2.1 Implementar método transferConversation no ChatService
  - Adicionado método `transferConversation(accountId, conversationId, targetInboxId, options)`
  - Valida ownership da conversa (account_id)
  - Valida que inbox de destino pertence à mesma conta
  - Valida que inbox de destino é diferente da atual
  - Atualiza `inbox_id` na tabela conversations
  - Registra transferência na tabela conversation_transfers
  - Retorna conversa atualizada com dados da transferência
  - _Requisitos: REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-1.6_

- [x] 2.2 Implementar método getTransferHistory no ChatService
  - Adicionado método `getTransferHistory(accountId, conversationId)`
  - Retorna lista de transferências com dados das inboxes (nome)
  - Ordenado por data decrescente
  - _Requisitos: REQ-4.1, REQ-4.2_

## Fase 3: Backend - API Routes

- [x] 3.1 Criar rota PATCH /conversations/:id/transfer
  - Adicionada rota em `server/routes/chatInboxRoutes.js`
  - Valida input (targetInboxId obrigatório, reason opcional)
  - Chama ChatService.transferConversation()
  - Retorna resposta padronizada { success, data }
  - Trata erros com mensagens apropriadas
  - _Requisitos: REQ-1.1, REQ-1.2, REQ-1.5, REQ-1.6_

- [x] 3.2 Criar rota GET /conversations/:id/transfers
  - Adicionada rota em `server/routes/chatInboxRoutes.js`
  - Chama ChatService.getTransferHistory()
  - Retorna histórico de transferências
  - _Requisitos: REQ-4.1, REQ-4.2_

## Fase 4: Frontend - Componentes

- [x] 4.1 Criar componente InboxTransferSelector
  - Criado `src/components/features/chat/InboxTransferSelector.tsx`
  - Dialog com lista de inboxes da conta
  - Mostra nome e status de conexão de cada inbox
  - Desabilita inbox atual na lista
  - Campo opcional para motivo da transferência
  - Loading state durante transferência
  - _Requisitos: REQ-1.1, REQ-2.1_

- [x] 4.2 Integrar InboxTransferSelector no ConversationActionsSection
  - Modificado `src/components/features/chat/ConversationActionsSection.tsx`
  - Importado e adicionado InboxTransferSelector
  - Disponível para todos os usuários (não apenas agent mode)
  - _Requisitos: REQ-2.1, REQ-2.2, REQ-2.3_

- [x] 4.3 Exportar InboxTransferSelector no index
  - Atualizado `src/components/features/chat/index.ts`
  - Exportado InboxTransferSelector
  - _Requisitos: REQ-1.1, REQ-1.4, REQ-2.2_

## Fase 5: Frontend - Serviços e Hooks

- [x] 5.1 Adicionar função transferConversation ao serviço de chat
  - Atualizado `src/services/chat.ts`
  - Implementada chamada PATCH /conversations/:id/transfer
  - Tipos TransferResult e TransferHistoryItem definidos
  - _Requisitos: REQ-1.1_

- [x] 5.2 Criar hook useInboxes
  - Criado `src/hooks/useInboxes.ts`
  - Busca lista de inboxes da conta
  - Cache de 1 minuto
  - _Requisitos: REQ-1.1, REQ-2.1_

- [x] 5.3 Criar serviço chat-inbox-api
  - Criado `src/services/chat-inbox-api.ts`
  - Wrapper para funções de transferência
  - _Requisitos: REQ-1.1_

## Fase 6: Validação do Token WUZAPI

- [x] 6.1 Verificar que sendMessage usa token da inbox correta
  - Revisado `server/routes/chatInboxRoutes.js` rota de envio
  - Já busca token WUZAPI baseado no inbox_id da conversa
  - Envio após transferência usa token correto automaticamente
  - _Requisitos: REQ-3.1, REQ-3.2, REQ-3.3_

## Fase 7: Testes e Validação

- [ ] 7.1 Testar fluxo completo de transferência
  - Transferir conversa de uma inbox para outra
  - Verificar que indicador visual atualiza
  - Verificar que mensagens são enviadas pela nova inbox
  - Verificar histórico de transferência
  - _Requisitos: REQ-1.1, REQ-1.2, REQ-1.3, REQ-2.2, REQ-3.2, REQ-4.1_

- [ ] 7.2 Testar casos de erro
  - Tentar transferir para mesma inbox (deve falhar)
  - Tentar transferir para inbox de outra conta (deve falhar)
  - Tentar transferir conversa inexistente (deve falhar)
  - _Requisitos: REQ-1.5, REQ-1.6, REQ-5.1, REQ-5.2_

## Notas

- Todas as operações de banco usam SupabaseService (nunca cliente direto)
- Logs estruturados com logger (nunca console.log)
- Respostas padronizadas { success, data?, error? }
- Frontend usa alias @/ para imports
- Backend usa require() com caminhos relativos

## Pendências

- [x] Executar migration 019 no banco de dados (executada via Supabase MCP)
- [ ] Reiniciar servidor para aplicar mudanças no backend
