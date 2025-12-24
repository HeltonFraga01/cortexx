# Implementation Plan: Inbox Terminology Refactor

## Overview

Este plano implementa a refatoração de nomenclatura do sistema, substituindo "WuzAPIUser" por "Inbox" de forma gradual e com compatibilidade retroativa.

## Tasks

- [ ] 1. Criar novos tipos TypeScript
  - [ ] 1.1 Adicionar interface `Inbox` em `src/lib/wuzapi-types.ts`
    - Copiar estrutura de `WuzAPIUser`
    - Adicionar JSDoc explicando que é uma caixa de entrada WhatsApp
    - _Requirements: 1.1_
  - [ ] 1.2 Adicionar tipos `InboxResponse` e `InboxListResponse`
    - Criar type aliases para os novos tipos
    - _Requirements: 1.2, 1.3_
  - [ ] 1.3 Criar aliases deprecated para tipos antigos
    - Adicionar `@deprecated` JSDoc aos tipos `WuzAPIUser`, `WuzAPIUserResponse`, `WuzAPIUsersResponse`
    - Fazer apontar para novos tipos
    - _Requirements: 1.4_
  - [ ]* 1.4 Escrever teste de propriedade para equivalência de tipos
    - **Property 1: Equivalência de Tipos**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [ ] 2. Checkpoint - Verificar tipos
  - Garantir que código compila sem erros
  - Verificar que aliases deprecated funcionam

- [ ] 3. Atualizar serviço WUZAPI com novos métodos
  - [ ] 3.1 Adicionar método `listInboxes()` em `src/services/wuzapi.ts`
    - Implementar com mesma lógica de `getUsers()`
    - Adicionar JSDoc
    - _Requirements: 2.2_
  - [ ] 3.2 Adicionar método `getInbox(id)`
    - Implementar com mesma lógica de `getUser()`
    - _Requirements: 2.3_
  - [ ] 3.3 Adicionar método `createInbox(data)`
    - Implementar com mesma lógica de `createUser()`
    - _Requirements: 2.4_
  - [ ] 3.4 Adicionar método `updateInbox(id, data)`
    - Implementar com mesma lógica de `updateUser()`
    - _Requirements: 2.5_
  - [ ] 3.5 Adicionar método `deleteInbox(id)`
    - Implementar com mesma lógica de `deleteUser()`
    - _Requirements: 2.6_
  - [ ] 3.6 Marcar métodos antigos como deprecated
    - Adicionar `@deprecated` JSDoc
    - Adicionar `console.warn` com mensagem de deprecação
    - Fazer métodos antigos chamarem novos métodos
    - _Requirements: 2.7_
  - [ ]* 3.7 Escrever teste de propriedade para equivalência de métodos
    - **Property 2: Equivalência de Métodos CRUD**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

- [ ] 4. Checkpoint - Verificar serviço
  - Garantir que novos métodos funcionam
  - Verificar que métodos deprecated emitem warnings

- [ ] 5. Criar novos componentes React
  - [ ] 5.1 Criar `src/components/admin/InboxList.tsx`
    - Copiar estrutura de `WuzapiUsersList.tsx`
    - Atualizar textos: "Usuários do Sistema" → "Caixas de Entrada"
    - Atualizar textos: "Novo Usuário" → "Nova Caixa de Entrada"
    - Usar novos métodos do serviço (`listInboxes()`)
    - _Requirements: 3.1, 4.1, 4.2_
  - [ ] 5.2 Criar `src/components/admin/CreateInboxForm.tsx`
    - Copiar estrutura de `CreateUserForm.tsx`
    - Atualizar textos para nomenclatura de inbox
    - Usar `createInbox()` em vez de `createUser()`
    - _Requirements: 3.3, 4.2_
  - [ ] 5.3 Criar `src/components/admin/InboxEditForm.tsx`
    - Copiar estrutura de `UserEditForm.tsx` (se existir para inbox)
    - Atualizar textos para nomenclatura de inbox
    - _Requirements: 3.2_
  - [ ] 5.4 Criar re-exports deprecated em `src/components/admin/index.ts`
    - Exportar `InboxList as WuzapiUsersList` com `@deprecated`
    - _Requirements: 3.5_
  - [ ]* 5.5 Escrever teste de propriedade para ausência de terminologia antiga
    - **Property 5: Ausência de Terminologia Antiga na UI**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 6. Checkpoint - Verificar componentes
  - Garantir que novos componentes renderizam corretamente
  - Verificar que textos estão atualizados

- [ ] 7. Configurar novas rotas frontend
  - [ ] 7.1 Adicionar rotas `/admin/inboxes/*` em `src/pages/admin/AdminDashboard.tsx`
    - Rota `/admin/inboxes` → `InboxList`
    - Rota `/admin/inboxes/new` → `CreateInboxForm`
    - Rota `/admin/inboxes/edit/:inboxId` → `InboxEditForm`
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ] 7.2 Adicionar redirects para rotas antigas
    - `/admin/users` → redirect para `/admin/inboxes`
    - `/admin/users/new` → redirect para `/admin/inboxes/new`
    - `/admin/users/edit/:id` → redirect para `/admin/inboxes/edit/:id`
    - _Requirements: 5.4_
  - [ ] 7.3 Atualizar navegação do sidebar
    - Mudar link de "Usuários" para "Caixas de Entrada"
    - Atualizar ícone para `Inbox` ou `MessageSquare`
    - _Requirements: 5.5, 9.1, 9.3_
  - [ ]* 7.4 Escrever teste de propriedade para equivalência de rotas
    - **Property 3: Equivalência de Rotas**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

- [ ] 8. Checkpoint - Verificar rotas
  - Testar navegação para novas rotas
  - Verificar que redirects funcionam

- [ ] 9. Criar novos endpoints backend
  - [ ] 9.1 Criar `server/routes/adminInboxRoutes.js`
    - GET `/api/admin/inboxes` - listar inboxes
    - GET `/api/admin/inboxes/:id` - obter inbox
    - POST `/api/admin/inboxes` - criar inbox
    - PUT `/api/admin/inboxes/:id` - atualizar inbox
    - DELETE `/api/admin/inboxes/:id` - deletar inbox
    - _Requirements: 6.1_
  - [ ] 9.2 Registrar novas rotas em `server/routes/index.js`
    - Importar e usar `adminInboxRoutes`
    - _Requirements: 6.1_
  - [ ] 9.3 Adicionar deprecation warnings aos endpoints antigos
    - Adicionar header `Deprecation: true` nas respostas
    - Logar warning quando endpoint antigo for usado
    - _Requirements: 6.2, 6.4_
  - [ ]* 9.4 Escrever teste de propriedade para equivalência de endpoints
    - **Property 4: Equivalência de Endpoints API**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 10. Checkpoint - Verificar backend
  - Testar novos endpoints
  - Verificar que endpoints antigos ainda funcionam com warnings

- [ ] 11. Atualizar UI e mensagens
  - [ ] 11.1 Atualizar mensagens de toast/erro em componentes de inbox
    - Substituir "usuário" por "caixa de entrada" em mensagens
    - _Requirements: 4.3_
  - [ ] 11.2 Atualizar tooltips e textos de ajuda
    - Revisar todos os textos em componentes de inbox
    - _Requirements: 4.4_
  - [ ] 11.3 Adicionar descrições explicativas nas seções
    - Adicionar subtítulo explicando que são conexões WhatsApp
    - _Requirements: 9.4_
  - [ ]* 11.4 Escrever teste de propriedade para warnings de deprecação
    - **Property 6: Warnings de Deprecação**
    - **Validates: Requirements 2.7, 8.1, 8.2**

- [ ] 12. Atualizar documentação
  - [ ] 12.1 Criar guia de migração `docs/INBOX_MIGRATION_GUIDE.md`
    - Explicar mudança de nomenclatura
    - Listar mapeamento de tipos/métodos/componentes
    - Documentar timeline de deprecação
    - _Requirements: 7.4, 8.3_
  - [ ] 12.2 Atualizar README.md
    - Substituir referências a "WuzAPI user" por "inbox"
    - _Requirements: 7.1_
  - [ ] 12.3 Atualizar steering files em `.kiro/steering/`
    - Atualizar `project-overview.md` com nova nomenclatura
    - Atualizar `product.md` com nova nomenclatura
    - _Requirements: 7.2_

- [ ] 13. Verificação final
  - [ ] 13.1 Executar todos os testes
    - Garantir que testes existentes passam
    - _Requirements: 8.4_
  - [ ] 13.2 Verificar build de produção
    - Garantir que build compila sem erros
    - _Requirements: 1.5, 3.4_
  - [ ]* 13.3 Testar fluxo completo manualmente
    - Criar, editar, listar e deletar inbox
    - Verificar que UI usa nova nomenclatura
    - _Requirements: 4.1, 4.2, 4.3_

## Notes

- Tasks marcadas com `*` são opcionais (testes de propriedade)
- Cada checkpoint é uma oportunidade para validar progresso
- Manter aliases deprecated por pelo menos 3 meses antes de remover
- Priorizar compatibilidade retroativa sobre limpeza de código

