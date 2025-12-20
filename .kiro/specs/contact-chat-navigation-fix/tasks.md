# Implementation Plan: Contact Chat Navigation Fix

## Overview

Implementação da correção do bug de navegação do chat a partir da página de contatos. A correção envolve modificar o `ChatLayout` para aguardar que o `chatApi` esteja no modo correto antes de carregar a conversa da URL.

## Tasks

- [x] 1. Modificar ChatLayout para aguardar modo correto do chatApi
  - [x] 1.1 Adicionar estados de loading e erro para carregamento da URL
    - Adicionar `isLoadingFromUrl` e `urlLoadError` ao estado do componente
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 1.2 Modificar useEffect de carregamento de conversa
    - Adicionar verificação de `isAgentMode === chatApi.isAgentMode`
    - Mover limpeza de URL para o finally block
    - Adicionar tratamento de erro com setUrlLoadError
    - **FIX ADICIONAL:** Remover `parseInt()` do conversationId - IDs são UUIDs, não números
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2, 4.3_
  - [x] 1.3 Atualizar EmptyState para suportar loading e erro
    - Adicionar props `isLoading` e `error`
    - Renderizar spinner quando loading
    - Renderizar mensagem de erro quando apropriado
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 1.4 Passar novos estados para EmptyState
    - Passar `isLoadingFromUrl` e `urlLoadError` para EmptyState
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Checkpoint - Testar navegação manualmente
  - [x] Testar navegação de /agent/contacts para /agent/chat
  - [x] Verificar que conversa é selecionada corretamente
  - [x] Verificar que URL é limpa após carregamento
  - [x] Verificar feedback visual durante carregamento

- [ ]* 3. Adicionar testes unitários
  - [ ]* 3.1 Teste de aguardar modo correto
    - Verificar que carregamento não ocorre quando modos não correspondem
    - _Requirements: 1.2, 2.3_
  - [ ]* 3.2 Teste de carregamento único
    - Verificar que API é chamada apenas uma vez
    - _Requirements: 1.2_
  - [ ]* 3.3 Teste de limpeza de URL
    - Verificar que URL é limpa após sucesso e erro
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Checkpoint final
  - [x] Bug corrigido e testado com sucesso

- [x] 5. Corrigir bug de envio de mensagens (inbox token não encontrado)
  - [x] 5.1 Diagnosticar erro "Caixa de entrada não configurada para envio de mensagens"
    - Identificado: `ChatService.getConversationById` retornava dados raw (snake_case)
    - `agentChatRoutes.js` acessava `conversation.inboxId` (camelCase) que era undefined
    - _Root cause: inconsistência snake_case vs camelCase_
  - [x] 5.2 Corrigir ChatService.getConversationById
    - Adicionar `this.formatConversation(data)` antes de retornar
    - Converte `inbox_id` para `inboxId` corretamente
  - [x] 5.3 Corrigir ChatService.getConversationByJid
    - Adicionar `this.formatConversation(data)` antes de retornar
    - Mantém consistência com getConversationById

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- A correção principal estava em dois lugares:
  1. Task 1.2 - modificação do useEffect para aguardar modo correto
  2. **Bug adicional encontrado:** `parseInt(conversationId, 10)` convertia UUID para número errado
- O checkpoint 2 validou a correção
- **Novo bug encontrado (Task 5):** Envio de mensagens falhava com "Caixa de entrada não configurada"
  - Causa: `conversation.inboxId` era undefined porque dados vinham em snake_case
  - Solução: Formatar dados antes de retornar em ChatService

## Correções Aplicadas

### Task 1-4 (Navegação)
1. **ChatLayout.tsx:** Removido `parseInt()` - conversationId é UUID string, não número
2. **agent-chat.ts:** Atualizado tipo de `getAgentConversation` para aceitar `string | number`
3. **chat.ts:** Atualizado tipo de `getConversation` para aceitar `string | number`
4. **useChatApi.ts:** Atualizado interface `ChatApi.getConversation` para `string | number`

### Task 5 (Envio de mensagens)
5. **ChatService.js:** `getConversationById` agora retorna dados formatados (camelCase)
6. **ChatService.js:** `getConversationByJid` agora retorna dados formatados (camelCase)

## Status Atual

- ✅ Navegação do chat corrigida (Task 1-4)
- ✅ Bug "Caixa de entrada não configurada" corrigido (Task 5)
  - Inbox token agora é encontrado corretamente
  - `SupabaseService.update()` usado em vez de `db.query()` para atualizar status de mensagens
- ⚠️ Novo problema identificado: "Número de telefone inválido" 
  - Isso é um problema separado com a validação de telefone via WUZAPI API
  - Não relacionado ao inbox token - a mensagem chega até a etapa de validação de telefone
  - Causa provável: estrutura de resposta da API WUZAPI diferente do esperado em `PhoneValidationService.js`
  - Este é um bug pré-existente, não introduzido pelas correções atuais

## Próximos Passos (Fora do Escopo Atual)

1. Investigar resposta da API WUZAPI `/user/check` para entender estrutura real
2. Corrigir `PhoneValidationService.js` para lidar com a estrutura de resposta correta
3. Corrigir chamadas `db.query()` restantes em `agentChatRoutes.js`:
   - Linha ~1177: Transfer route (verificação de disponibilidade do agente)
   - Linhas ~1421-1428: Macros route (listagem de macros)
   - Linhas ~1484-1496: Macro execute route
   - Linha ~1594: Previous conversations route
