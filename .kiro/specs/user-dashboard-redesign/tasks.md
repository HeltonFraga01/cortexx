# Implementation Plan: User Dashboard Redesign

## Overview

Este plano implementa o redesign do dashboard do usuário em etapas incrementais, começando pelos componentes base e progredindo para a integração completa. A implementação usa TypeScript, React, e os componentes shadcn/ui existentes.

## Tasks

- [x] 1. Create ModernStatsCard component
  - [x] 1.1 Create `src/components/user/dashboard/ModernStatsCard.tsx`
    - Implement interface ModernStatsCardProps with title, value, icon, iconColor, trend, isLoading
    - Create colorMap object for blue, green, orange, purple, red variants
    - Implement Card layout with icon circle, value display, and trend indicator
    - Add dark mode support with dark: variants
    - Add Skeleton loading state
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.2_

  - [ ]* 1.2 Write property test for ModernStatsCard color mapping
    - **Property 2: Stats Card Color Mapping**
    - **Validates: Requirements 4.1**

  - [ ]* 1.3 Write property test for trend indicator display
    - **Property 3: Trend Indicator Display**
    - **Validates: Requirements 4.3**

- [x] 2. Create DashboardHeader component
  - [x] 2.1 Create `src/components/user/dashboard/DashboardHeader.tsx`
    - Implement interface DashboardHeaderProps with userName, userAvatar, onRefresh, isRefreshing, lastUpdated
    - Create flex layout with avatar, welcome message, date/time, refresh button
    - Add RefreshCw icon with animate-spin when isRefreshing
    - Format lastUpdated with date-fns
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Refactor ModernInboxCard component
  - [x] 3.1 Update `src/components/user/dashboard/InboxOverviewCard.tsx`
    - Refactor InboxCard to use new design with min-w-[180px] max-w-[200px]
    - Add status indicator circle (h-3 w-3) with green/red color
    - Improve hover effect with shadow-md transition
    - Add ring-2 ring-primary for selected state
    - Ensure proper truncation for long names
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Write property test for InboxCard rendering
    - **Property 1: Inbox Card Rendering Correctness**
    - **Validates: Requirements 3.1, 3.2**

- [x] 4. Refactor UserInfoCardModern component
  - [x] 4.1 Create `src/components/user/dashboard/UserInfoCardModern.tsx`
    - Implement two-column layout with avatar on left, info grid on right
    - Add large avatar (h-20 w-20) with status indicator
    - Display name, phone, JID with proper formatting
    - Add token display with show/hide toggle and copy button
    - Add dark mode support
    - _Requirements: 7.2, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 4.2 Write property test for UserInfoCard data display
    - **Property 5: User Info Card Data Display**
    - **Validates: Requirements 7.2**

- [x] 5. Refactor ConnectionControlCardModern component
  - [x] 5.1 Create `src/components/user/dashboard/ConnectionControlCardModern.tsx`
    - Implement Card with Settings icon header
    - Add status badge with semantic colors
    - Create Connect button (green), Disconnect button (outline), Logout button (destructive)
    - Add loading states for each action
    - Add success/connected message box
    - _Requirements: 7.3, 8.1, 8.5_

- [x] 6. Refactor WebhookConfigCardModern component
  - [x] 6.1 Create `src/components/user/dashboard/WebhookConfigCardModern.tsx`
    - Implement Card with Webhook icon header (purple)
    - Add URL input with placeholder
    - Display subscribed events count in Badge
    - Add Save and Configure buttons
    - Add loading state for save action
    - _Requirements: 7.4, 8.1_

  - [ ]* 6.2 Write property test for WebhookConfig display
    - **Property 6: Webhook Config Display**
    - **Validates: Requirements 7.4**

- [x] 7. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update QuickActionsPanel with modern design
  - [x] 8.1 Update `src/components/user/dashboard/QuickActionsPanel.tsx`
    - Refactor to use responsive grid (2 cols mobile, 4 cols desktop)
    - Update button styling with outline variant and hover:bg-primary/5
    - Ensure consistent button height and icon placement
    - Add conditional rendering for management buttons
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.2 Write property test for management permissions visibility
    - **Property 4: Management Permissions Visibility**
    - **Validates: Requirements 6.4**

- [x] 9. Update UserDashboardModern main component
  - [x] 9.1 Update `src/components/user/UserDashboardModern.tsx`
    - Add DashboardHeader at the top
    - Replace stats section with ModernStatsCard grid (4 columns on desktop)
    - Update grid layout with consistent gap-4 spacing
    - Ensure proper responsive breakpoints (1 col mobile, 2 col tablet, 3 col desktop)
    - Add smooth transitions between layouts
    - _Requirements: 1.1, 1.2, 1.5, 8.1_

- [-] 10. Update UserOverview connection tab
  - [x] 10.1 Update `src/components/user/UserOverview.tsx`
    - Replace User Info Card with UserInfoCardModern
    - Replace Connection Control with ConnectionControlCardModern
    - Replace Webhook Config with WebhookConfigCardModern
    - Organize into 2-column grid layout
    - Update QR code card styling
    - _Requirements: 7.1, 7.5_

- [x] 11. Add loading and empty states
  - [x] 11.1 Update components with proper loading states
    - Ensure all cards have Skeleton loading states
    - Add EmptyState component usage where needed
    - Add error state with retry button
    - Ensure layout stability during loading
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 12. Ensure dark mode support
  - [x] 12.1 Audit and update dark mode classes
    - Verify all color classes have dark: variants
    - Test contrast in dark mode
    - Update any missing dark mode styles
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Export new components
  - [x] 14.1 Update `src/components/user/dashboard/index.ts`
    - Export ModernStatsCard
    - Export DashboardHeader
    - Export UserInfoCardModern
    - Export ConnectionControlCardModern
    - Export WebhookConfigCardModern
    - _Requirements: 8.1_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation maintains backward compatibility with existing data structures
