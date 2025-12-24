# Implementation Plan: User Dashboard Modernization

## Overview

Este plano implementa a modernização do Dashboard do Usuário em etapas incrementais, começando pela infraestrutura backend, seguido pelos componentes frontend, e finalizando com testes e integração.

## Tasks

- [x] 1. Backend API - Dashboard Metrics Endpoint
  - [x] 1.1 Create dashboard metrics service
    - Create `server/services/DashboardMetricsService.js`
    - Implement methods for fetching inbox status, conversation metrics, agent metrics
    - Use SupabaseService for all database queries
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

  - [x] 1.2 Create dashboard routes
    - Create `server/routes/userDashboardRoutes.js`
    - Implement GET `/api/user/dashboard-metrics` endpoint
    - Implement GET `/api/user/messages/activity` endpoint
    - Implement GET `/api/user/contacts/growth` endpoint
    - Add authentication middleware
    - _Requirements: 1.1, 3.1, 7.1_

  - [ ]* 1.3 Write unit tests for DashboardMetricsService
    - Test inbox status aggregation
    - Test conversation metrics calculation
    - Test agent metrics aggregation
    - _Requirements: 1.1, 2.1, 4.1_

- [x] 2. Frontend Types and Services
  - [x] 2.1 Create TypeScript types
    - Create `src/types/dashboard.ts`
    - Define all interfaces from design document
    - _Requirements: All_

  - [x] 2.2 Create dashboard service
    - Create `src/services/dashboard-metrics.ts`
    - Implement API client methods for all dashboard endpoints
    - Add error handling and response transformation
    - _Requirements: All_


- [x] 3. Inbox Overview Component
  - [x] 3.1 Create InboxOverviewCard component
    - Create `src/components/user/dashboard/InboxOverviewCard.tsx`
    - Implement inbox card with status indicator, name, phone, unread count
    - Add click handler for navigation to chat
    - Style with shadcn/ui Card and Badge components
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 Write property test for inbox status indicator
    - **Property 1: Inbox Status Indicator Correctness**
    - **Validates: Requirements 1.2, 1.3**

- [x] 4. Conversation Stats Component
  - [x] 4.1 Create ConversationStatsCard component
    - Create `src/components/user/dashboard/ConversationStatsCard.tsx`
    - Display open, resolved, pending counts
    - Display average response time
    - Add trend indicators comparing to previous period
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ]* 4.2 Write property test for trend indicator
    - **Property 5: Trend Indicator Direction**
    - **Validates: Requirements 2.5**

- [x] 5. Message Activity Chart Component
  - [x] 5.1 Create MessageActivityChart component
    - Create `src/components/user/dashboard/MessageActivityChart.tsx`
    - Use Recharts LineChart for visualization
    - Implement daily/hourly toggle
    - Add tooltip with exact values
    - Use distinct colors for incoming/outgoing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write property test for message data integrity
    - **Property 6: Message Activity Data Integrity**
    - **Validates: Requirements 3.1**

- [x] 6. Agent Performance Component
  - [x] 6.1 Create AgentPerformanceCard component
    - Create `src/components/user/dashboard/AgentPerformanceCard.tsx`
    - Display agent list with availability status
    - Show assigned conversation count per agent
    - Display top 3 agents by resolved conversations
    - Add empty state when no agents
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.2 Write property test for top agents ranking
    - **Property 8: Top Agents Ranking**
    - **Validates: Requirements 4.3**

- [x] 7. Campaign Status Component
  - [x] 7.1 Create CampaignStatusCard component
    - Create `src/components/user/dashboard/CampaignStatusCard.tsx`
    - Display active campaigns with progress bars
    - Show sent/failed/total counts
    - Display most recent completed campaign
    - Add empty state when no campaigns
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 7.2 Write property test for campaign progress
    - **Property 9: Campaign Progress Calculation**
    - **Validates: Requirements 5.1, 5.2**


- [x] 8. Quota Usage Component
  - [x] 8.1 Create QuotaUsagePanel component
    - Create `src/components/user/dashboard/QuotaUsagePanel.tsx`
    - Display quota progress bars for messages, inboxes, agents, campaigns
    - Implement threshold styling (normal/warning/danger)
    - Display subscription plan name and renewal date
    - Display credit balance
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 8.2 Write property test for quota percentage and threshold
    - **Property 11: Quota Percentage Calculation**
    - **Property 12: Quota Threshold Styling**
    - **Validates: Requirements 6.2, 6.3, 6.4**

- [x] 9. Contact Growth Chart Component
  - [x] 9.1 Create ContactGrowthChart component
    - Create `src/components/user/dashboard/ContactGrowthChart.tsx`
    - Use Recharts BarChart for daily new contacts
    - Add cumulative trend line
    - Display total contact count
    - Display growth percentage
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 9.2 Write property test for growth calculation
    - **Property 14: Growth Percentage Calculation**
    - **Validates: Requirements 7.5**

- [x] 10. Quick Actions Component
  - [x] 10.1 Create QuickActionsPanel component
    - Create `src/components/user/dashboard/QuickActionsPanel.tsx`
    - Add buttons for New Message, New Campaign, View Contacts, Settings
    - Conditionally show Manage Agents, Manage Teams based on permissions
    - Implement navigation handlers
    - Make responsive for mobile
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 10.2 Write property test for management actions visibility
    - **Property 15: Management Actions Visibility**
    - **Validates: Requirements 8.3**

- [x] 11. Main Dashboard Component
  - [x] 11.1 Create UserDashboardModern component
    - Create `src/components/user/UserDashboardModern.tsx`
    - Compose all sub-components in responsive grid layout
    - Implement inbox filter state and propagation
    - Add loading states with skeletons
    - Add error handling with retry
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.2 Implement real-time updates
    - Add Supabase realtime subscription for messages
    - Update unread counts on new message events
    - Add auto-refresh interval for connection status
    - Display last updated timestamp
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 11.3 Write property test for real-time updates
    - **Property 16: Real-time Update Propagation**
    - **Property 17: Last Updated Timestamp**
    - **Validates: Requirements 9.2, 9.5**

- [x] 12. Integration and Routing
  - [x] 12.1 Update UserOverview to use new dashboard
    - Replace current UserOverview content with UserDashboardModern
    - Maintain backward compatibility with existing routes
    - Ensure all navigation links work correctly
    - _Requirements: All_

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Final Polish
  - [x] 14.1 Add loading and empty states
    - Implement skeleton loaders for all cards
    - Add empty state components with action buttons
    - Add error boundaries for graceful error handling
    - _Requirements: 4.4, 5.4_

  - [x] 14.2 Responsive design verification
    - Test on mobile (< 768px)
    - Test on tablet (768px - 1024px)
    - Test on desktop (> 1024px)
    - Adjust grid breakpoints as needed
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 15. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Use Recharts library for all chart components (already in project dependencies)
- Follow existing project patterns for API calls and error handling

