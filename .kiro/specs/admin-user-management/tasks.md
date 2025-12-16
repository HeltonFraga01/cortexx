# Implementation Plan

## Phase 1: Database Foundation

- [x] 1. Create database migrations for admin user management
  - [x] 1.1 Create migration for plans table
    - Add plans table with id, name, description, price_cents, billing_cycle, status, quotas, features
    - Add indexes for name, status
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Create migration for user_subscriptions table
    - Add user_subscriptions table with id, user_id, plan_id, status, dates
    - Add unique constraint on user_id
    - Add indexes for plan_id, status
    - _Requirements: 2.1, 2.3_
  - [x] 1.3 Create migration for user_quota_overrides table
    - Add user_quota_overrides table with id, user_id, quota_type, limit_value, reason, set_by
    - Add unique constraint on (user_id, quota_type)
    - _Requirements: 2.6, 3.5_
  - [x] 1.4 Create migration for user_quota_usage table
    - Add user_quota_usage table with id, user_id, quota_type, period_start, period_end, current_usage
    - Add unique constraint on (user_id, quota_type, period_start)
    - Add indexes for user_id, period
    - _Requirements: 3.1, 3.4_
  - [x] 1.5 Create migration for user_feature_overrides table
    - Add user_feature_overrides table with id, user_id, feature_name, enabled, set_by
    - Add unique constraint on (user_id, feature_name)
    - _Requirements: 4.2, 4.4_
  - [x] 1.6 Create migration for usage_metrics table
    - Add usage_metrics table with id, user_id, metric_type, amount, metadata, recorded_at
    - Add indexes for user_id, metric_type, recorded_at
    - _Requirements: 10.1, 10.5_
  - [x] 1.7 Create migration for admin_audit_log table
    - Add admin_audit_log table with id, admin_id, action_type, target_user_id, details, ip_address
    - Add indexes for admin_id, target_user_id, created_at
    - _Requirements: 9.1_
  - [x] 1.8 Create migration for system_settings table
    - Add system_settings table with key, value, description, updated_by
    - _Requirements: 11.1_
  - [x] 1.9 Insert default plan data
    - Insert Free, Basic, Pro, Enterprise plans with default quotas and features
    - _Requirements: 1.1_

## Phase 2: Backend Services - Plans

- [x] 2. Implement PlanService
  - [x] 2.1 Create PlanService class with CRUD operations
    - Implement createPlan, listPlans, getPlanById, updatePlan, deletePlan
    - Use database.js abstraction for all queries
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 2.2 Write property test for plan creation
    - **Property 1: Plan Creation Stores All Required Fields**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [x] 2.3 Write property test for subscriber count
    - **Property 2: Plan Subscriber Count Accuracy**
    - **Validates: Requirements 1.4**
  - [x] 2.4 Write property test for plan deletion constraint
    - **Property 4: Plan Deletion Constraint**
    - **Validates: Requirements 1.6**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Backend Services - Subscriptions

- [x] 4. Implement SubscriptionService
  - [x] 4.1 Create SubscriptionService class
    - Implement assignPlan, getUserSubscription, updateSubscriptionStatus
    - Implement calculateProration, processBillingCycle, isUserActive
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 4.2 Write property test for plan assignment
    - **Property 5: Plan Assignment Updates User Quotas**
    - **Validates: Requirements 2.1**
  - [x] 4.3 Write property test for subscription status access
    - **Property 6: Subscription Status Restricts Access**
    - **Validates: Requirements 2.5**

## Phase 4: Backend Services - Quotas

- [x] 5. Implement QuotaService
  - [x] 5.1 Create QuotaService class
    - Implement getUserQuotas, checkQuota, incrementUsage, getCurrentUsage
    - Implement setQuotaOverride, removeQuotaOverride, resetCycleCounters
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [x] 5.2 Write property test for quota override precedence
    - **Property 7: Quota Override Takes Precedence**
    - **Validates: Requirements 2.6**
  - [x] 5.3 Write property test for quota enforcement
    - **Property 8: Quota Enforcement Rejects Excess**
    - **Validates: Requirements 3.1, 3.2**
  - [x] 5.4 Write property test for usage tracking accuracy
    - **Property 9: Quota Usage Tracking Accuracy**
    - **Validates: Requirements 3.4**
  - [x] 5.5 Write property test for quota override audit
    - **Property 10: Quota Override Audit Trail**
    - **Validates: Requirements 3.5**
  - [x] 5.6 Write property test for cycle reset
    - **Property 11: Cycle Reset Clears Counters**
    - **Validates: Requirements 3.6**

- [x] 6. Implement Quota Middleware
  - [x] 6.1 Create quotaEnforcement middleware
    - Check quota before operations
    - Return 429 with quota info when exceeded
    - _Requirements: 3.1, 3.2_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Backend Services - Features

- [x] 8. Implement FeatureFlagService
  - [x] 8.1 Create FeatureFlagService class
    - Implement getUserFeatures, isFeatureEnabled
    - Implement setFeatureOverride, removeFeatureOverride
    - Implement propagatePlanFeatureChange, listAvailableFeatures
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 8.2 Write property test for feature enforcement
    - **Property 12: Feature Flag Enforcement**
    - **Validates: Requirements 4.3**
  - [x] 8.3 Write property test for feature source tracking
    - **Property 13: Feature Source Tracking**
    - **Validates: Requirements 4.4**
  - [x] 8.4 Write property test for plan update propagation
    - **Property 3: Plan Update Propagation**
    - **Validates: Requirements 1.5, 4.5**

## Phase 6: Backend Services - Audit & Usage

- [x] 9. Implement AdminAuditService
  - [x] 9.1 Create AdminAuditService class
    - Implement logAction, listAuditLogs, exportAuditLogs
    - Implement getAdminActions, getUserAuditHistory
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 9.2 Write property test for audit completeness
    - **Property 19: Audit Log Completeness**
    - **Validates: Requirements 9.1**

- [x] 10. Implement UsageTrackingService
  - [x] 10.1 Create UsageTrackingService class
    - Implement trackUsage, getUsageMetrics, getAggregatedMetrics
    - Implement calculateCostPerUser, exportUsageData
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 10.2 Write property test for usage tenant isolation
    - **Property 20: Usage Metrics Tenant Isolation**
    - **Validates: Requirements 10.5**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: API Routes - Plans

- [x] 12. Create Plan Routes
  - [x] 12.1 Create adminPlanRoutes.js
    - GET /api/admin/plans - List plans
    - POST /api/admin/plans - Create plan
    - GET /api/admin/plans/:id - Get plan
    - PUT /api/admin/plans/:id - Update plan
    - DELETE /api/admin/plans/:id - Delete plan
    - _Requirements: 1.1, 1.4, 1.5, 1.6_

## Phase 8: API Routes - User Management

- [x] 13. Create User Subscription Routes
  - [x] 13.1 Create adminUserSubscriptionRoutes.js
    - GET /api/admin/users/:userId/subscription - Get subscription
    - PUT /api/admin/users/:userId/subscription - Update subscription
    - POST /api/admin/users/:userId/subscription/assign-plan - Assign plan
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 14. Create User Quota Routes
  - [x] 14.1 Create adminUserQuotaRoutes.js
    - GET /api/admin/users/:userId/quotas - Get quotas
    - PUT /api/admin/users/:userId/quotas/:quotaType - Set override
    - DELETE /api/admin/users/:userId/quotas/:quotaType/override - Remove override
    - POST /api/admin/users/:userId/quotas/reset - Reset counters
    - _Requirements: 3.4, 3.5, 3.6_

- [x] 15. Create User Feature Routes
  - [x] 15.1 Create adminUserFeatureRoutes.js
    - GET /api/admin/users/:userId/features - Get features
    - PUT /api/admin/users/:userId/features/:featureName - Set override
    - DELETE /api/admin/users/:userId/features/:featureName/override - Remove override
    - _Requirements: 4.2, 4.4_

- [x] 16. Create User Action Routes
  - [x] 16.1 Create adminUserActionRoutes.js
    - POST /api/admin/users/:userId/suspend - Suspend user
    - POST /api/admin/users/:userId/reactivate - Reactivate user
    - POST /api/admin/users/:userId/reset-password - Reset password
    - DELETE /api/admin/users/:userId - Delete user
    - GET /api/admin/users/:userId/export - Export data
    - POST /api/admin/users/:userId/notify - Send notification
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 16.2 Write property test for user suspension
    - **Property 14: User Suspension Blocks Access**
    - **Validates: Requirements 7.1**
  - [x] 16.3 Write property test for user reactivation
    - **Property 15: User Reactivation Restores Access**
    - **Validates: Requirements 7.2**
  - [x] 16.4 Write property test for user deletion cascade
    - **Property 16: User Deletion Cascades**
    - **Validates: Requirements 7.4**
  - [x] 16.5 Write property test for data export completeness
    - **Property 17: Data Export Completeness**
    - **Validates: Requirements 7.5**

## Phase 9: API Routes - Bulk Actions

- [x] 17. Create Bulk Action Routes
  - [x] 17.1 Create adminBulkActionRoutes.js
    - POST /api/admin/users/bulk/assign-plan - Bulk assign plan
    - POST /api/admin/users/bulk/suspend - Bulk suspend
    - POST /api/admin/users/bulk/notify - Bulk notify
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 17.2 Write property test for bulk partial failure
    - **Property 18: Bulk Action Partial Failure Handling**
    - **Validates: Requirements 8.6**

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 10: API Routes - Dashboard & Reports

- [x] 19. Create Dashboard Routes
  - [x] 19.1 Create adminDashboardRoutes.js
    - GET /api/admin/management/dashboard/stats - Dashboard statistics
    - GET /api/admin/management/dashboard/alerts - Active alerts
    - GET /api/admin/management/dashboard/growth - Growth metrics
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 20. Create Report Routes
  - [x] 20.1 Create adminReportRoutes.js
    - GET /api/admin/reports/usage - Usage report
    - GET /api/admin/reports/revenue - Revenue report
    - GET /api/admin/reports/growth - Growth report
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 21. Create Audit Routes
  - [x] 21.1 Create adminAuditRoutes.js
    - GET /api/admin/audit - List audit logs
    - GET /api/admin/audit/export - Export audit logs
    - _Requirements: 9.2, 9.3_

- [x] 22. Create Settings Routes
  - [x] 22.1 Create adminSettingsRoutes.js
    - GET /api/admin/settings - Get settings
    - PUT /api/admin/settings/:key - Update setting
    - _Requirements: 11.1, 11.5_

## Phase 11: Frontend - Types and Services

- [x] 23. Create TypeScript types
  - [x] 23.1 Create src/types/admin-management.ts
    - Define Plan, PlanQuotas, PlanFeatures interfaces
    - Define UserSubscription, SubscriptionStatus types
    - Define UserQuota, QuotaType types
    - Define UserFeature, FeatureName types
    - Define AdminAuditLog, AdminActionType types
    - Define DashboardStats, DashboardAlert interfaces
    - _Requirements: All_

- [x] 24. Create Frontend Services
  - [x] 24.1 Create src/services/admin-plans.ts
    - Implement CRUD operations for plans
    - _Requirements: 1.1, 1.4, 1.5, 1.6_
  - [x] 24.2 Create src/services/admin-subscriptions.ts
    - Implement subscription management
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 24.3 Create src/services/admin-quotas.ts
    - Implement quota management
    - _Requirements: 3.4, 3.5, 3.6_
  - [x] 24.4 Create src/services/admin-features.ts
    - Implement feature management
    - _Requirements: 4.2, 4.4_
  - [x] 24.5 Create src/services/admin-user-actions.ts
    - Implement user actions (suspend, reactivate, delete, export)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [x] 24.6 Create src/services/admin-dashboard.ts
    - Implement dashboard stats and alerts
    - _Requirements: 5.1, 5.5_
  - [x] 24.7 Create src/services/admin-audit.ts
    - Implement audit log operations
    - _Requirements: 9.2, 9.3_

## Phase 12: Frontend - Components

- [x] 25. Create Plan Management Components
  - [x] 25.1 Create src/components/admin/PlanList.tsx
    - Display list of plans with subscriber counts
    - Actions: edit, delete
    - _Requirements: 1.4_
  - [x] 25.2 Create src/components/admin/PlanForm.tsx
    - Form to create/edit plan with quotas and features
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 26. Create User Detail Components
  - [x] 26.1 Create src/components/admin/UserDetailPage.tsx
    - Display user profile, subscription, quotas, features
    - Tabs for different sections
    - _Requirements: 6.2_
  - [x] 26.2 Create src/components/admin/UserSubscriptionCard.tsx
    - Display subscription details with plan change option
    - _Requirements: 2.3_
  - [x] 26.3 Create src/components/admin/UserQuotasCard.tsx
    - Display quotas with usage bars and override options
    - _Requirements: 3.4_
  - [x] 26.4 Create src/components/admin/UserFeaturesCard.tsx
    - Display features with toggle for overrides
    - _Requirements: 4.4_
  - [x] 26.5 Create src/components/admin/UserActionsCard.tsx
    - Buttons for suspend, reactivate, reset password, delete, export
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 27. Create Dashboard Components
  - [x] 27.1 Create src/components/admin/AdminDashboardStats.tsx
    - Display user stats, usage stats, revenue stats
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 27.2 Create src/components/admin/AdminDashboardAlerts.tsx
    - Display active alerts with actions
    - _Requirements: 5.5_
  - [x] 27.3 Create src/components/admin/AdminDashboardCharts.tsx
    - Display growth charts and trends
    - _Requirements: 5.1_

- [x] 28. Create Audit Log Components
  - [x] 28.1 Create src/components/admin/AdminAuditLogList.tsx
    - Display audit logs with filters
    - Export functionality
    - _Requirements: 9.2, 9.3_

- [x] 29. Create Report Components
  - [x] 29.1 Create src/components/admin/ReportGenerator.tsx
    - Form to generate reports with date range and type
    - _Requirements: 12.1, 12.2, 12.3, 12.5_

## Phase 13: Integration

- [x] 30. Update Admin Dashboard
  - [x] 30.1 Update AdminOverview to use new dashboard stats
    - Replace current stats with new DashboardStats
    - Add alerts section
    - _Requirements: 5.1, 5.5_
  - [x] 30.2 Update AdminUsers to show subscription info
    - Add plan column, status column
    - Add quick actions
    - _Requirements: 6.1_

- [x] 31. Update Admin Navigation
  - [x] 31.1 Add new routes to AdminDashboard.tsx
    - /admin/plans - Plan management
    - /admin/users/:userId - User detail page
    - /admin/audit - Audit log
    - /admin/reports - Reports
    - /admin/settings - System settings
    - _Requirements: All_
  - [x] 31.2 Update AdminLayout navigation
    - Add menu items for new sections
    - _Requirements: All_

- [x] 32. Integrate Quota Enforcement
  - [x] 32.1 Add quota middleware to existing routes
    - Add to message sending routes
    - Add to agent creation routes
    - Add to webhook creation routes
    - _Requirements: 3.1, 3.2_

- [x] 33. Integrate Feature Flags
  - [x] 33.1 Add feature checks to existing routes
    - Check page_builder feature
    - Check bulk_campaigns feature
    - Check integrations features
    - _Requirements: 4.2, 4.3_

- [x] 34. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

