# Implementation Plan

## Summary

This implementation plan covers the Superadmin Tenant Management feature, which allows superadmins to manage tenant accounts, agents, branding, and plans directly from the tenant details page without needing to impersonate the tenant.

## Current State Analysis

**Already Implemented:**
- Basic tenant CRUD operations in `superadminTenantRoutes.js`
- `TenantDetails.tsx` page with basic tenant info display
- Tenant account routes for tenant admins (`tenantAccountRoutes.js`)
- Tenant plan routes for tenant admins (`tenantPlanRoutes.js`)
- `SuperadminService.js` with tenant management methods

**Needs Implementation:**
- Superadmin-specific routes for managing tenant accounts and agents
- `TenantManagePanel` component with tabbed interface
- Tab components: Accounts, Agents, Branding, Plans, Settings
- Backend routes for superadmin to manage tenant accounts/agents directly

---

## Tasks

- [x] 1. Create backend routes for superadmin tenant account management
  - [x] 1.1 Create `superadminTenantAccountRoutes.js` with CRUD endpoints
    - Implement GET `/api/superadmin/tenants/:tenantId/accounts` for listing accounts
    - Implement POST `/api/superadmin/tenants/:tenantId/accounts` for creating accounts
    - Implement PUT `/api/superadmin/tenants/:tenantId/accounts/:accountId` for updating accounts
    - Implement DELETE `/api/superadmin/tenants/:tenantId/accounts/:accountId` for deleting accounts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 1.2 Add service methods to `SuperadminService.js` for account management
    - Implement `listTenantAccounts(tenantId, options)` method
    - Implement `createTenantAccount(tenantId, data, superadminId)` method
    - Implement `updateTenantAccount(tenantId, accountId, data, superadminId)` method
    - Implement `deleteTenantAccount(tenantId, accountId, superadminId)` method
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 1.3 Register routes in `server/routes/index.js`
    - _Requirements: 2.1_

- [x] 2. Create backend routes for superadmin tenant agent management
  - [x] 2.1 Create `superadminTenantAgentRoutes.js` with CRUD endpoints
    - Implement GET `/api/superadmin/tenants/:tenantId/agents` for listing agents
    - Implement POST `/api/superadmin/tenants/:tenantId/agents` for creating agents
    - Implement PUT `/api/superadmin/tenants/:tenantId/agents/:agentId` for updating agents
    - Implement POST `/api/superadmin/tenants/:tenantId/agents/:agentId/reset-password` for password reset
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 2.2 Add service methods to `SuperadminService.js` for agent management
    - Implement `listTenantAgents(tenantId, options)` method
    - Implement `createTenantAgent(tenantId, data, superadminId)` method
    - Implement `updateTenantAgent(tenantId, agentId, data, superadminId)` method
    - Implement `resetAgentPassword(tenantId, agentId, superadminId)` method
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 2.3 Register routes in `server/routes/index.js`
    - _Requirements: 3.1_

- [x] 3. Extend superadmin tenant routes for branding and plans management
  - [x] 3.1 Add branding management endpoints to `superadminTenantRoutes.js`
    - Implement GET `/api/superadmin/tenants/:tenantId/branding` for getting branding
    - Implement PUT `/api/superadmin/tenants/:tenantId/branding` for updating branding
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 3.2 Add plan management endpoints to `superadminTenantRoutes.js`
    - Implement GET `/api/superadmin/tenants/:tenantId/plans` for listing plans
    - Implement POST `/api/superadmin/tenants/:tenantId/plans` for creating plans
    - Implement PUT `/api/superadmin/tenants/:tenantId/plans/:planId` for updating plans
    - Implement POST `/api/superadmin/tenants/:tenantId/plans/:planId/set-default` for setting default plan
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 3.3 Add metrics and export endpoints
    - Implement GET `/api/superadmin/tenants/:tenantId/metrics` for tenant metrics
    - Implement GET `/api/superadmin/tenants/:tenantId/audit-log` for audit log
    - Implement GET `/api/superadmin/tenants/:tenantId/export` for CSV export
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create TenantManagePanel component with tabbed interface
  - [x] 5.1 Create `TenantManagePanel.tsx` component
    - Implement tabbed interface with Accounts, Agents, Branding, Plans, Settings tabs
    - Display tenant name and status in header
    - Handle inactive tenant warning banner
    - _Requirements: 1.1, 1.2, 1.4_
  - [ ]* 5.2 Write property test for management panel tabs
    - **Property 1: Management panel displays all required tabs**
    - **Validates: Requirements 1.1**
  - [ ]* 5.3 Write property test for tenant header display
    - **Property 2: Tenant header displays correct information**
    - **Validates: Requirements 1.2**

- [x] 6. Create TenantAccountsTab component
  - [x] 6.1 Create `TenantAccountsTab.tsx` component
    - Implement paginated account list with name, email, status, creation date
    - Implement create account form with name, owner email, WUZAPI token fields
    - Implement edit account dialog
    - Implement delete account with confirmation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 6.2 Write property test for account list display
    - **Property 3: Account list displays all required fields**
    - **Validates: Requirements 2.1**
  - [ ]* 6.3 Write property test for account creation
    - **Property 4: Account creation with valid data succeeds**
    - **Validates: Requirements 2.3**

- [x] 7. Create TenantAgentsTab component
  - [x] 7.1 Create `TenantAgentsTab.tsx` component
    - Implement agent list with name, email, role, account name, status
    - Implement create agent form with account selection, name, email, password, role
    - Implement edit agent dialog
    - Implement reset password functionality
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 7.2 Write property test for agent list display
    - **Property 5: Agent list displays all required fields**
    - **Validates: Requirements 3.1**
  - [ ]* 7.3 Write property test for agent creation
    - **Property 6: Agent creation with valid data succeeds**
    - **Validates: Requirements 3.3**

- [x] 8. Create TenantBrandingTab component
  - [x] 8.1 Create `TenantBrandingTab.tsx` component
    - Display current branding settings (app name, logo, colors)
    - Implement branding edit form with color validation
    - Implement logo upload functionality
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 8.2 Write property test for branding form display
    - **Property 7: Branding form displays all required fields**
    - **Validates: Requirements 4.1**
  - [ ]* 8.3 Write property test for color format validation
    - **Property 8: Color format validation**
    - **Validates: Requirements 4.2**

- [x] 9. Create TenantPlansTab component
  - [x] 9.1 Create `TenantPlansTab.tsx` component
    - Implement plan list with name, price, status, subscriber count
    - Implement create plan form with all plan fields
    - Implement edit plan dialog
    - Implement set default plan functionality
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 9.2 Write property test for plan list display
    - **Property 9: Plan list displays all required fields**
    - **Validates: Requirements 5.1**
  - [ ]* 9.3 Write property test for plan edit ID immutability
    - **Property 10: Plan edit preserves ID immutability**
    - **Validates: Requirements 5.3**
  - [ ]* 9.4 Write property test for default plan uniqueness
    - **Property 11: Default plan uniqueness**
    - **Validates: Requirements 5.4**

- [x] 10. Create TenantSettingsTab component
  - [x] 10.1 Create `TenantSettingsTab.tsx` component
    - Display tenant metrics (accounts, agents, inboxes, MRR)
    - Display recent audit log entries
    - Implement CSV export functionality
    - Handle empty states appropriately
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 10.2 Write property test for metrics display
    - **Property 12: Metrics display all required values**
    - **Validates: Requirements 6.1**
  - [ ]* 10.3 Write property test for CSV export
    - **Property 13: CSV export contains required data**
    - **Validates: Requirements 6.3**

- [x] 11. Integrate TenantManagePanel into TenantDetails page
  - [x] 11.1 Update `TenantDetails.tsx` to use TenantManagePanel
    - Replace impersonation-only "Manage" button with management panel
    - Preserve URL context when navigating between tabs
    - Handle error states with toast notifications
    - _Requirements: 1.1, 1.3, 1.5_

- [x] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
