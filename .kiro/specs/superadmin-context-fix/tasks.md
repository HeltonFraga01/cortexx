# Implementation Plan: Superadmin Context Fix

## Overview

Este plano implementa a correção do painel de superadmin que ficou não funcional após as mudanças de isolamento multi-tenant. A correção principal é modificar o middleware `requireSuperadmin` para priorizar a sessão sobre o contexto de subdomain.

## Tasks

- [x] 1. Corrigir o middleware requireSuperadmin
  - [x] 1.1 Modificar `server/middleware/superadminAuth.js` para sobrescrever contexto baseado na sessão
    - Remover o bloco que verifica `req.context.role !== 'superadmin'` (linhas 60-70)
    - Adicionar código que define `req.context.role = 'superadmin'` quando sessão é válida
    - Manter logging para debug
    - _Requirements: 1.1, 1.4_

  - [ ]* 1.2 Escrever testes unitários para o middleware corrigido
    - Testar sessão válida com contexto 'public'
    - Testar sessão válida sem contexto
    - Testar requisição sem sessão (401)
    - Testar sessão com role diferente (403)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.3 Escrever property test para validação de sessão superadmin
    - **Property 1: Superadmin Session Overrides Context**
    - **Validates: Requirements 1.1, 1.4**

- [x] 2. Checkpoint - Verificar middleware funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Testar endpoints do superadmin
  - [x] 3.1 Verificar endpoint `/api/superadmin/dashboard` retorna 200
    - Navegar para http://localhost:8080/superadmin/dashboard
    - Fazer login como superadmin
    - Verificar que métricas carregam
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Verificar endpoint `/api/superadmin/tenants` retorna lista
    - Navegar para página de tenants
    - Verificar que lista carrega
    - _Requirements: 3.1, 3.2_

  - [x] 3.3 Verificar endpoint `/api/superadmin/accounts` retorna lista
    - Navegar para página de settings
    - Verificar que lista de superadmins carrega
    - _Requirements: 5.1, 5.2_

- [x] 4. Checkpoint final - Validar painel completo
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- A correção principal está na task 1.1 - é uma mudança de ~15 linhas
- Os testes de integração (task 3) usam o Chrome DevTools MCP para navegação
- Property tests validam propriedades universais de correção
- Unit tests validam exemplos específicos e edge cases
