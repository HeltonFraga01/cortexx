# Implementation Plan: Plan Assignment Fix

## Overview

Este plano implementa a correção do bug de atribuição de plano, adicionando fallback para verificar usuários no Supabase Auth e criar contas automaticamente quando necessário.

## Tasks

- [x] 1. Adicionar função para buscar usuário no Supabase Auth
  - [x] 1.1 Criar função `getSupabaseAuthUser` em `adminUserSubscriptionRoutes.js`
    - Usar `SupabaseService.adminClient.auth.admin.getUserById()`
    - Retornar null se usuário não existir
    - Logar tentativa de busca
    - _Requirements: 1.2_

- [x] 2. Criar função para criar conta para usuário Auth
  - [x] 2.1 Implementar `createAccountForAuthUser` em `adminUserSubscriptionRoutes.js`
    - Gerar UUID para nova conta
    - Usar email do usuário Auth como nome
    - Definir `owner_user_id` com ID do usuário Auth
    - Definir `tenant_id` com tenant do admin
    - Definir `status` como 'active'
    - Definir settings padrão
    - Logar criação da conta
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 3. Modificar função `validateUserTenant`
  - [x] 3.1 Adicionar fallback para Supabase Auth
    - Manter verificação existente na tabela `accounts`
    - Se não encontrar, chamar `getSupabaseAuthUser`
    - Se encontrar no Auth, chamar `createAccountForAuthUser`
    - Retornar conta criada ou null
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Checkpoint - Testar atribuição de plano
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 5. Escrever testes para as novas funções
  - [ ]* 5.1 Testes unitários para `getSupabaseAuthUser`
    - Testar com usuário existente
    - Testar com usuário inexistente
    - _Requirements: 1.2_

  - [ ]* 5.2 Testes unitários para `createAccountForAuthUser`
    - Testar criação com dados corretos
    - Testar campos obrigatórios
    - **Property 2: Integridade de conta criada**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 5.3 Testes de integração para `validateUserTenant`
    - Testar com conta existente
    - Testar com usuário Auth sem conta
    - Testar com usuário inexistente
    - **Property 1: Fallback de validação**
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 6. Checkpoint final - Verificar implementação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- A implementação foca no backend, pois o frontend já está correto
- O problema é que o backend não encontrava usuários Auth sem conta
- Após a correção, o fluxo existente de atribuição de plano funcionará

