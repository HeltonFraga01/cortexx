# Implementation Plan: Session Persistence Fix

## Overview

Este plano implementa a correção do problema de persistência de sessão, criando um módulo helper para operações de sessão e atualizando o fluxo de login e autenticação.

## Root Cause Found (2025-12-22)

**O problema NÃO era a persistência de sessão!**

O erro real era: o agente `cortexx@cortexx.com` existia no banco de dados mas **não tinha senha definida** (`password_hash = NULL`).

Quando o `AgentService.verifyPassword()` tentava fazer `hash.split(':')` em um valor `null`, lançava o erro:
```
TypeError: Cannot read properties of null (reading 'split')
```

Isso causava um erro 500 no login, e como o login nunca completava, a sessão nunca era populada com os dados do usuário.

**Solução aplicada:**
1. Definida a senha para o agente no banco de dados
2. Adicionada validação no `verifyPassword()` para tratar hash null/undefined graciosamente

## Tasks

- [x] 1. Criar módulo Session Helper
  - [x] 1.1 Criar `server/utils/sessionHelper.js` com função `regenerateSession()`
  - [x] 1.2 Adicionar função `validateSession()` ao helper
  - [x] 1.3 Adicionar função `destroyCorruptedSession()` ao helper

- [x] 2. Atualizar middleware de autenticação
  - [x] 2.1 Atualizar `requireAdmin` em `server/middleware/auth.js`
  - [x] 2.2 Atualizar `requireAuth` em `server/middleware/auth.js`
  - [x] 2.3 Atualizar `requireUser` em `server/middleware/auth.js`

- [x] 3. Atualizar rotas de autenticação
  - [x] 3.1 Refatorar `/api/auth/login` em `server/routes/authRoutes.js`
  - [x] 3.2 Refatorar `/api/auth/admin-login` em `server/routes/authRoutes.js`

- [x] 4. Checkpoint - Verificar implementação básica

- [x] 5. Corrigir causa raiz
  - [x] 5.1 Identificar que o agente não tinha senha definida
  - [x] 5.2 Definir senha para o agente `cortexx@cortexx.com`
  - [x] 5.3 Adicionar validação em `verifyPassword()` para tratar hash null

- [x] 6. Final checkpoint - Verificar tudo funciona
  - [x] Login funcionando via curl
  - [x] Sessão sendo persistida corretamente
  - [x] Endpoints admin funcionando com sessão autenticada

## Notes

- O problema original parecia ser de sessão, mas era de dados faltando no banco
- A detecção de sessão corrompida funcionava corretamente
- O código de sessão estava correto, apenas o login nunca completava
