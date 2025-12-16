# Design Document: Quota System Fix (Extended)

## Overview

Este documento descreve a solução completa para corrigir o sistema de quotas do WUZAPI Manager. Os problemas identificados são:

1. **Identificação incorreta de usuário**: O middleware `quotaEnforcement` usa `req.user?.id || req.userId`, mas nas rotas de agentes o usuário é identificado via `req.account.ownerUserId`
2. **Quotas não refletidas**: Os limites configurados nos planos não são exibidos corretamente no dashboard
3. **Enforcement inconsistente**: Bloqueios ocorrem mesmo quando o plano permite mais recursos
4. **Falta de enforcement**: Nem todas as operações verificam quotas

## Architecture

O sistema de quotas conecta planos configurados pelo admin aos limites aplicados aos usuários através da cadeia: Plan → Subscription → Account → Resources.

## Components and Interfaces

### 1. Quota Enforcement Middleware (FIXED)

O middleware precisa ser corrigido para identificar corretamente o usuário em diferentes contextos.

### 2. QuotaService Enhancements

Adicionar métodos para contar recursos corretamente (webhooks, campaigns, connections).

### 3. Route Enforcement

Garantir que todas as rotas de criação de recursos usem o middleware de quota.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 7: User ID Resolution (NEW)

*For any* request to a quota-enforced endpoint, the middleware should correctly identify the user ID from either `req.account.ownerUserId` (agent routes) or `req.session.userId` (user routes).

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

### Property 8: Agent Quota Enforcement (NEW)

*For any* user with a plan that allows N agents, when the user has fewer than N active agents, creating a new agent should succeed. When the user has N or more active agents, creating a new agent should return 429.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 9: Resource Count Accuracy (NEW)

*For any* user, the count of resources (agents, inboxes, teams, webhooks, campaigns) should match the actual number of records in the database for that user's account.

**Validates: Requirements 7.4, 8.4, 9.4, 10.4, 11.4**

### Property 10: Plan Limits Reflection (NEW)

*For any* user with a subscription to a plan, the quota limits displayed in the dashboard should exactly match the limits defined in the plan table.

**Validates: Requirements 13.3, 13.4**

## Testing Strategy

Property-based tests using Vitest with fast-check for all new properties.
