# Implementation Plan

## Phase 1: Backend Endpoints for User Context

- [x] 1. Create user-specific API endpoints
  - [x] 1.1 Create userSubscriptionRoutes.js
    - GET /api/user/subscription - Get current user's subscription
    - Uses existing SubscriptionService with user context
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Create userQuotaRoutes.js
    - GET /api/user/quotas - Get current user's quotas with usage
    - Uses existing QuotaService with user context
    - _Requirements: 1.3, 6.1, 6.2_
  - [x] 1.3 Create userFeatureRoutes.js
    - GET /api/user/features - Get current user's features
    - Uses existing FeatureFlagService with user context
    - _Requirements: 1.5, 7.1_
  - [ ]* 1.4 Write property test for quota calculation
    - **Property 2: Quota Progress Calculation Accuracy**
    - **Validates: Requirements 1.3, 6.2**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Frontend Services

- [x] 3. Create user-specific frontend services
  - [x] 3.1 Create src/services/user-subscription.ts
    - getUserSubscription() - Fetch current user's subscription
    - _Requirements: 1.1, 1.2_
  - [x] 3.2 Create src/services/user-quotas.ts
    - getUserQuotas() - Fetch current user's quotas
    - checkQuotaStatus(quotaType) - Check if quota allows action
    - _Requirements: 1.3, 6.1, 6.2_
  - [x] 3.3 Create src/services/user-features.ts
    - getUserFeatures() - Fetch current user's features
    - isFeatureEnabled(featureName) - Check if feature is enabled
    - _Requirements: 1.5, 7.1_

## Phase 3: Context Enhancement

- [x] 4. Enhance AgentContext
  - [x] 4.1 Add subscription, quotas, and features to AgentContext
    - Add subscription state
    - Add quotas state with refresh
    - Add features state
    - Add isFeatureEnabled helper
    - Add checkQuota helper
    - _Requirements: 1.1, 1.3, 1.5, 7.3_
  - [ ]* 4.2 Write property test for feature access check
    - **Property 6: Disabled Feature Lock Icon**
    - **Validates: Requirements 7.2**

## Phase 4: Subscription and Quota Components

- [x] 5. Create subscription display components
  - [x] 5.1 Create src/components/user/SubscriptionCard.tsx
    - Display plan name, status, billing cycle
    - Display period dates
    - Upgrade button for non-premium plans
    - _Requirements: 1.1, 1.2_
  - [ ]* 5.2 Write property test for subscription display
    - **Property 1: Subscription Data Display Completeness**
    - **Validates: Requirements 1.1, 1.2**

- [x] 6. Create quota display components
  - [x] 6.1 Create src/components/user/QuotaUsageCard.tsx
    - Display all quotas with progress bars
    - Warning state at 80% (yellow)
    - Error state at 100% (red)
    - Click to view details
    - _Requirements: 1.3, 1.4, 6.2, 6.3, 6.4_
  - [ ]* 6.2 Write property test for quota warning threshold
    - **Property 3: Quota Warning Threshold**
    - **Validates: Requirements 1.4, 6.3**
  - [ ]* 6.3 Write property test for quota exceeded state
    - **Property 4: Quota Exceeded State**
    - **Validates: Requirements 6.4**

- [x] 7. Create feature display components
  - [x] 7.1 Create src/components/user/FeaturesList.tsx
    - Display all features with enabled/disabled status
    - Lock icon for disabled features
    - Override indicator
    - _Requirements: 1.5, 7.1, 7.2, 7.4_
  - [ ]* 7.2 Write property test for feature display
    - **Property 5: Feature Display Completeness**
    - **Validates: Requirements 1.5, 7.1, 7.4**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Agent Management Components

- [x] 9. Create agent management for user dashboard
  - [x] 9.1 Create src/components/user/AgentListUser.tsx
    - Reuse logic from admin AgentList
    - Adapt for user context
    - Show name, email, role, status, last activity
    - Actions: edit, deactivate
    - _Requirements: 2.1_
  - [x] 9.2 Create src/components/user/AgentInviteDialogUser.tsx
    - Reuse logic from admin AgentInviteDialog
    - Generate invitation link
    - Copy and WhatsApp share buttons
    - _Requirements: 2.2_
  - [x] 9.3 Create src/components/user/AgentCreateDialogUser.tsx
    - Reuse logic from admin AgentCreateDialog
    - Form for direct agent creation
    - _Requirements: 2.3_
  - [ ]* 9.4 Write property test for agent list display
    - **Property 7: Agent List Display Completeness**
    - **Validates: Requirements 2.1**
  - [ ]* 9.5 Write property test for invitation uniqueness
    - **Property 8: Invitation Link Uniqueness**
    - **Validates: Requirements 2.2**
  - [ ]* 9.6 Write property test for quota enforcement
    - **Property 10: Quota Enforcement in Create Actions**
    - **Validates: Requirements 2.6, 3.5, 4.5**

## Phase 6: Team Management Components

- [x] 10. Create team management for user dashboard
  - [x] 10.1 Create src/components/user/TeamListUser.tsx
    - Reuse logic from admin TeamList
    - Show teams with member count
    - _Requirements: 3.1_
  - [x] 10.2 Create src/components/user/TeamDialogUser.tsx
    - Reuse logic from admin TeamDialog
    - Create/edit team form
    - Member management
    - _Requirements: 3.2, 3.3, 3.4_
  - [ ]* 10.3 Write property test for team membership update
    - **Property 11: Team Membership Update**
    - **Validates: Requirements 3.3, 3.4**

## Phase 7: Inbox Management Components

- [x] 11. Create inbox management for user dashboard
  - [x] 11.1 Create src/components/user/InboxListUser.tsx
    - Reuse logic from admin InboxList
    - Show inboxes with agent count
    - _Requirements: 4.1_
  - [x] 11.2 Create src/components/user/InboxDialogUser.tsx
    - Reuse logic from admin InboxDialog
    - Create/edit inbox form
    - Agent assignment
    - _Requirements: 4.2, 4.3, 4.4_
  - [ ]* 11.3 Write property test for inbox membership update
    - **Property 12: Inbox Membership Update**
    - **Validates: Requirements 4.3, 4.4**

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 8: Role Management Components

- [x] 13. Create role management for user dashboard
  - [x] 13.1 Create src/components/user/RoleListUser.tsx
    - Reuse logic from admin RoleList
    - Show default and custom roles
    - _Requirements: 5.1_
  - [x] 13.2 Create src/components/user/CustomRoleDialogUser.tsx
    - Reuse logic from admin CustomRoleDialog
    - Permission selection
    - _Requirements: 5.2_
  - [ ]* 13.3 Write property test for role list display
    - **Property 13: Role List Display**
    - **Validates: Requirements 5.1**
  - [ ]* 13.4 Write property test for role change propagation
    - **Property 9: Role Change Permission Propagation**
    - **Validates: Requirements 2.4, 5.4**

## Phase 9: Audit Log Components

- [x] 14. Create audit log for user dashboard
  - [x] 14.1 Create src/components/user/AuditLogUser.tsx
    - Reuse logic from admin AuditLog
    - Display recent actions
    - Filters: agent, action type, date range
    - Export to CSV
    - _Requirements: 9.1, 9.2, 9.4_
  - [ ]* 14.2 Write property test for audit log display
    - **Property 15: Audit Log Display Completeness**
    - **Validates: Requirements 9.1**
  - [ ]* 14.3 Write property test for audit log filter
    - **Property 16: Audit Log Filter Functionality**
    - **Validates: Requirements 9.2**
  - [ ]* 14.4 Write property test for audit log export
    - **Property 17: Audit Log Export**
    - **Validates: Requirements 9.4**

## Phase 10: Chat Integration Components

- [x] 15. Create chat integration components
  - [x] 15.1 Create src/components/user/InboxSelector.tsx
    - Dropdown to select current inbox
    - Shows inbox name and conversation count
    - _Requirements: 10.2_
  - [x] 15.2 Create src/components/user/AvailabilityToggle.tsx
    - Toggle for online/busy/offline status
    - Visual indicator of current status
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ]* 15.3 Write property test for inbox switching
    - **Property 19: Multi-Inbox Switching**
    - **Validates: Requirements 10.2**

- [x] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 11: Management Pages

- [x] 17. Create management pages
  - [x] 17.1 Create src/pages/user/AccountSettingsPage.tsx
    - Tabs: Assinatura, Quotas, Features
    - Uses SubscriptionCard, QuotaUsageCard, FeaturesList
    - _Requirements: 1.1, 1.3, 1.5_
  - [x] 17.2 Create src/pages/user/AgentManagementPage.tsx
    - Uses AgentListUser, AgentInviteDialogUser, AgentCreateDialogUser
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 17.3 Create src/pages/user/TeamManagementPage.tsx
    - Uses TeamListUser, TeamDialogUser
    - _Requirements: 3.1, 3.2_
  - [x] 17.4 Create src/pages/user/InboxManagementPage.tsx
    - Uses InboxListUser, InboxDialogUser
    - _Requirements: 4.1, 4.2_
  - [x] 17.5 Create src/pages/user/RoleManagementPage.tsx
    - Uses RoleListUser, CustomRoleDialogUser
    - _Requirements: 5.1, 5.2_
  - [x] 17.6 Create src/pages/user/AuditLogPage.tsx
    - Uses AuditLogUser
    - _Requirements: 9.1_

## Phase 12: Navigation and Layout Updates

- [x] 18. Update UserLayout navigation
  - [x] 18.1 Add management section to UserLayout
    - Add "Gestão" menu with submenu
    - Items: Agents, Teams, Inboxes, Papéis, Audit Log
    - Permission-based visibility
    - _Requirements: 8.1, 8.4_
  - [x] 18.2 Add AvailabilityToggle to header
    - Show current status
    - Quick toggle
    - _Requirements: 8.1_
  - [ ]* 18.3 Write property test for permission-based navigation
    - **Property 14: Permission-Based Navigation**
    - **Validates: Requirements 8.4**

- [x] 19. Update UserDashboard routes
  - [x] 19.1 Add new routes to UserDashboard.tsx
    - /user/account - AccountSettingsPage
    - /user/agents - AgentManagementPage
    - /user/teams - TeamManagementPage
    - /user/inboxes - InboxManagementPage
    - /user/roles - RoleManagementPage
    - /user/audit - AuditLogPage
    - _Requirements: 8.1_

## Phase 13: Chat Page Integration

- [x] 20. Update ChatInboxPage
  - [x] 20.1 Add InboxSelector to ChatInboxPage
    - Filter conversations by selected inbox
    - Update on inbox change
    - _Requirements: 10.1, 10.2_
  - [x] 20.2 Integrate with InboxContext
    - Use context for current inbox
    - Subscribe to inbox changes
    - _Requirements: 10.1_
  - [ ]* 20.3 Write property test for inbox filtering
    - **Property 18: Inbox-Based Conversation Filtering**
    - **Validates: Requirements 10.1**
  - [ ]* 20.4 Write property test for access revocation
    - **Property 20: Real-Time Access Revocation**
    - **Validates: Requirements 10.4**

- [x] 21. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 14: Feature Gating

- [x] 22. Implement feature gating in UI
  - [x] 22.1 Create FeatureGate component
    - Wrapper component that checks feature access
    - Shows lock/upgrade message for disabled features
    - _Requirements: 7.2, 7.3_
  - [x] 22.2 Apply FeatureGate to existing features
    - Page Builder
    - Bulk Campaigns
    - NocoDB Integration
    - Bot Automation
    - _Requirements: 7.3_

## Phase 15: Quota Enforcement in UI

- [x] 23. Implement quota enforcement in UI
  - [x] 23.1 Create QuotaGate component
    - Wrapper that checks quota before action
    - Disables action when quota reached
    - Shows upgrade message
    - _Requirements: 2.6, 3.5, 4.5_
  - [x] 23.2 Apply QuotaGate to create actions
    - Agent creation
    - Team creation
    - Inbox creation
    - Message sending
    - _Requirements: 2.6, 3.5, 4.5_

## Phase 16: UserOverview Enhancement

- [x] 24. Update UserOverview dashboard
  - [x] 24.1 Add quota summary card to UserOverview
    - Show key quotas (messages, agents, connections)
    - Warning indicators
    - Link to detailed view
    - _Requirements: 6.1_
  - [x] 24.2 Add quick actions for management
    - Quick links to Agents, Teams, Inboxes
    - Only show if user has permission
    - _Requirements: 8.1_

- [x] 25. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
