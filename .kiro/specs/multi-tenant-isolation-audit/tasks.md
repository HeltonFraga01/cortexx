# Implementation Tasks - Multi-Tenant Isolation Fixes

## Phase 1: Critical Priority (P0)

### Task 1: Fix AdminBulkActionRoutes Cross-Tenant Operations

- [x] 1.1 Update `server/routes/adminBulkActionRoutes.js`
  - Add tenant validation before bulk operations
  - Filter userIds to only include users from `req.context.tenantId`
  - Log cross-tenant attempt warnings
  - _Requirements: REQ-9_

- [x] 1.2 Add tenant validation helper function
  - Create `filterUsersByTenant(userIds, tenantId)` utility
  - Return only valid user IDs for the tenant
  - _Requirements: REQ-9_

## Phase 2: High Priority (P1)

### Task 2: Create TenantPlanService

- [x] 2.1 Create `server/services/TenantPlanService.js`
  - Implement `createPlan(tenantId, data)`
  - Implement `getPlanById(planId, tenantId)` with tenant validation
  - Implement `listPlans(tenantId)`
  - Implement `updatePlan(planId, tenantId, data)`
  - Implement `deletePlan(planId, tenantId)`
  - _Requirements: REQ-1_

- [x] 2.2 Update `server/routes/adminPlanRoutes.js`
  - Replace `PlanService` with `TenantPlanService`
  - Use `req.context.tenantId` for all operations
  - _Requirements: REQ-1_

### Task 3: Fix SubscriptionService Tenant Validation

- [x] 3.1 Update `server/services/SubscriptionService.js`
  - Add tenant validation in `assignPlan()` method
  - Verify `plan.tenant_id === account.tenant_id`
  - _Requirements: REQ-2_

- [x] 3.2 Update `server/routes/adminUserSubscriptionRoutes.js`
  - Add tenant context validation
  - Verify user belongs to admin's tenant before operations
  - _Requirements: REQ-2_

### Task 4: Fix AdminDashboardRoutes Tenant Filtering

- [x] 4.1 Update `server/routes/adminDashboardRoutes.js`
  - Filter all metrics queries by `req.context.tenantId`
  - Update account count query to filter by tenant
  - Update subscription queries to filter by tenant
  - Update usage metrics to filter by tenant
  - _Requirements: REQ-4_

### Task 5: Fix AdminUserQuotaRoutes Tenant Validation

- [x] 5.1 Update `server/routes/adminUserQuotaRoutes.js`
  - Add tenant validation before quota operations
  - Verify user belongs to admin's tenant
  - _Requirements: REQ-6_

- [x] 5.2 Update `server/services/QuotaService.js`
  - Add optional `tenantId` parameter to methods
  - Validate tenant access when provided
  - _Requirements: REQ-6_

### Task 6: Fix AdminUserActionRoutes Tenant Validation

- [x] 6.1 Update `server/routes/adminUserActionRoutes.js`
  - Add tenant validation before user actions (suspend, activate, etc.)
  - Verify `user.tenant_id === req.context.tenantId`
  - _Requirements: REQ-8_

### Task 7: Fix AdminAuditRoutes Tenant Filtering

- [x] 7.1 Update `server/routes/adminAuditRoutes.js`
  - Filter audit logs by `req.context.tenantId`
  - Only show logs for resources within the tenant
  - _Requirements: REQ-10_

### Task 8: Fix AdminReportRoutes Tenant Filtering

- [x] 8.1 Update `server/routes/adminReportRoutes.js`
  - Filter all report queries by `req.context.tenantId`
  - Update export functions to only include tenant data
  - _Requirements: REQ-11_

## Phase 3: Medium Priority (P2)

### Task 9: Create TenantSettingsService

- [x] 9.1 Create migration for `tenant_settings` table
  - Add id, tenant_id (unique FK), settings (JSONB), timestamps
  - Created: `server/migrations/009_create_tenant_settings_table.sql`
  - _Requirements: REQ-3_

- [x] 9.2 Create `server/services/TenantSettingsService.js`
  - Implement `getSettings(tenantId)`
  - Implement `updateSettings(tenantId, settings)`
  - Implement `getDefaultSettings()`
  - _Requirements: REQ-3_

- [x] 9.3 Update `server/routes/adminSettingsRoutes.js`
  - Replace global settings with `TenantSettingsService`
  - Use `req.context.tenantId` for all operations
  - _Requirements: REQ-3_

### Task 10: Deprecate Global Methods in database.js

- [x] 10.1 Update `server/database.js`
  - Add deprecation warning to `getSystemSettings()`
  - Add deprecation warning to `updateSystemSettings()`
  - Document migration path in comments
  - _Requirements: REQ-5_

### Task 11: Fix AdminUserFeatureRoutes Tenant Validation

- [x] 11.1 Update `server/routes/adminUserFeatureRoutes.js`
  - Add tenant validation before feature operations
  - Verify user belongs to admin's tenant
  - _Requirements: REQ-7_

### Task 12: Fix AdminStripeRoutes Tenant Isolation

- [x] 12.1 Update `server/routes/adminStripeRoutes.js`
  - Use `tenant.stripe_connect_id` for Stripe operations
  - Validate tenant context before Stripe API calls
  - All analytics queries now filter by tenant
  - _Requirements: REQ-12_

### Task 13: Create Tenant Credit Packages

- [x] 13.1 Create migration for `tenant_credit_packages` table
  - Add id, tenant_id (FK), name, credit_amount, price_cents, status, stripe IDs, timestamps
  - Add unique constraint on (tenant_id, name)
  - Created: `server/migrations/010_create_tenant_credit_packages_table.sql`
  - _Requirements: REQ-13_

- [x] 13.2 Create `server/services/TenantCreditPackageService.js`
  - Implement CRUD operations scoped to tenant
  - _Requirements: REQ-13_

- [x] 13.3 Update `server/routes/adminCreditPackagesRoutes.js`
  - Replace global operations with tenant-scoped service
  - Use `req.context.tenantId` for all operations
  - _Requirements: REQ-13_

## Phase 4: Middleware and Utilities

### Task 14: Create Tenant Resource Validator Middleware

- [x] 14.1 Create `server/middleware/tenantResourceValidator.js`
  - Implement `validateTenantResource(resourceTable, idParam)` middleware factory
  - Support direct tenant_id and account-based tenant resolution
  - Log cross-tenant access attempts
  - _Requirements: All_

- [x] 14.2 Apply middleware to existing routes
  - Routes already implement inline tenant validation using the same patterns
  - Middleware available for routes that need resource-level validation
  - _Requirements: All_

## Phase 5: Testing

### Task 15: Write Isolation Tests

- [x] 15.1 Create `server/tests/tenant-isolation.test.js`
  - Test cross-tenant access denial for each fixed route
  - Test valid tenant access for each fixed route
  - Test bulk operations with mixed tenant IDs
  - _Requirements: All_

- [x] 15.2 Create `server/tests/tenant-services.test.js`
  - Test TenantPlanService isolation
  - Test TenantSettingsService isolation
  - Test TenantCreditPackageService isolation
  - _Requirements: REQ-1, REQ-3, REQ-13_

## Phase 6: Documentation

### Task 16: Update Documentation

- [x] 16.1 Update steering files
  - Added tenant isolation guidelines to backend-guidelines.md
  - Documented required tenant validation patterns
  - _Requirements: All_

- [x] 16.2 Add inline documentation
  - JSDoc comments already present in all tenant services
  - Tenant validation requirements documented in route files
  - _Requirements: All_

## Checklist Final

- [x] Todas as rotas admin validam `req.context.tenantId`
- [x] Todas as queries de dados filtram por tenant
- [x] Operações bulk filtram lista antes de executar
- [x] Tentativas cross-tenant são logadas como warnings
- [x] Testes de isolamento passam para todos os componentes
- [x] Documentação atualizada com padrões de isolamento

## Progresso da Implementação

### Arquivos Corrigidos:
1. ✅ `server/routes/adminBulkActionRoutes.js` - Filtro de userIds por tenant
2. ✅ `server/routes/adminUserActionRoutes.js` - Validação de tenant em todas as ações
3. ✅ `server/routes/adminDashboardRoutes.js` - Métricas filtradas por tenant
4. ✅ `server/routes/adminAuditRoutes.js` - Logs filtrados por tenant
5. ✅ `server/routes/adminUserQuotaRoutes.js` - Validação de tenant em quotas
6. ✅ `server/routes/adminUserFeatureRoutes.js` - Validação de tenant em features
7. ✅ `server/middleware/tenantResourceValidator.js` - Middleware reutilizável criado
8. ✅ `server/routes/adminPlanRoutes.js` - Usa TenantPlanService
9. ✅ `server/routes/adminUserSubscriptionRoutes.js` - Validação de tenant em subscriptions
10. ✅ `server/routes/adminReportRoutes.js` - Relatórios filtrados por tenant
11. ✅ `server/routes/adminSettingsRoutes.js` - Usa TenantSettingsService
12. ✅ `server/routes/adminStripeRoutes.js` - Analytics e operações filtradas por tenant
13. ✅ `server/routes/adminCreditPackagesRoutes.js` - Usa TenantCreditPackageService
14. ✅ `server/database.js` - Métodos globais deprecados com warnings

### Serviços Criados:
1. ✅ `server/services/TenantPlanService.js` - Planos por tenant
2. ✅ `server/services/TenantSettingsService.js` - Configurações por tenant
3. ✅ `server/services/TenantCreditPackageService.js` - Pacotes de crédito por tenant

### Migrações Criadas:
1. ✅ `server/migrations/009_create_tenant_settings_table.sql`
2. ✅ `server/migrations/010_create_tenant_credit_packages_table.sql`

### Testes Criados:
1. ✅ `server/tests/tenant-isolation.test.js` - Testes de isolamento cross-tenant
2. ✅ `server/tests/tenant-services.test.js` - Testes de serviços tenant-scoped

### Documentação Atualizada:
1. ✅ `.kiro/steering/backend-guidelines.md` - Seção de Multi-Tenant Isolation adicionada
