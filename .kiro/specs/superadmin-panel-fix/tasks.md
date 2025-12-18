# Implementation Plan

- [x] 1. Create SuperadminLayout component with sidebar navigation
  - [x] 1.1 Create SuperadminLayout.tsx component following AdminLayout pattern
    - Create file at `src/components/superadmin/SuperadminLayout.tsx`
    - Implement responsive sidebar with mobile and desktop views
    - Add navigation items: Dashboard, Tenants, Settings
    - Include user info display and logout button
    - Apply theme toggle and branding support
    - _Requirements: 1.1, 1.2, 1.5_

  - [ ]* 1.2 Write property test for sidebar presence on all routes
    - **Property 1: Sidebar presence on all superadmin routes**
    - **Validates: Requirements 1.1**

  - [ ]* 1.3 Write property test for active navigation link highlighting
    - **Property 2: Active navigation link highlighting**
    - **Validates: Requirements 1.4**

- [x] 2. Update App.tsx route structure for superadmin
  - [x] 2.1 Refactor superadmin routes to use nested routing with SuperadminLayout
    - Update App.tsx to use wildcard route `/superadmin/*`
    - Wrap all superadmin routes with SuperadminLayout
    - Add default redirect from `/superadmin` to `/superadmin/dashboard`
    - Remove individual ProtectedRoute wrappers from each superadmin route
    - _Requirements: 1.1, 1.3, 4.3_

  - [ ]* 2.2 Write property test for client-side navigation without reload
    - **Property 3: Client-side navigation without reload**
    - **Validates: Requirements 1.3**

- [x] 3. Refactor SuperadminDashboard to work with new layout
  - [x] 3.1 Remove redundant layout code from SuperadminDashboard
    - Remove padding/margin that conflicts with layout
    - Ensure component only renders dashboard content
    - Keep metrics fetching and display logic
    - Add proper error handling with toast notifications
    - _Requirements: 2.2, 2.3, 2.4, 5.2_

  - [ ]* 3.2 Write property test for API errors triggering toast notifications
    - **Property 8: API errors trigger toast notifications**
    - **Validates: Requirements 5.2**

- [x] 4. Checkpoint - Ensure sidebar and dashboard render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fix authentication flow and redirects
  - [x] 5.1 Update SuperadminLogin to properly redirect after successful login
    - Ensure navigate() is called after user state is set
    - Add loading state during redirect
    - Handle edge cases where user is already logged in
    - _Requirements: 2.1, 4.1_

  - [x] 5.2 Verify ProtectedRoute handles superadmin role correctly
    - Ensure superadmin role check works in ProtectedRoute
    - Verify redirect to /superadmin/login for unauthenticated access
    - Test role-based access control
    - _Requirements: 4.3, 4.5_

  - [ ]* 5.3 Write property test for superadmin role stored after login
    - **Property 5: Superadmin role stored after successful login**
    - **Validates: Requirements 4.2**

  - [ ]* 5.4 Write property test for protected route redirect
    - **Property 6: Protected route redirect for unauthenticated access**
    - **Validates: Requirements 4.3**

  - [ ]* 5.5 Write property test for superadmin role granting access
    - **Property 7: Superadmin role grants access to superadmin routes**
    - **Validates: Requirements 4.5**

- [x] 6. Implement Error Boundary for superadmin panel
  - [x] 6.1 Create SuperadminErrorBoundary component
    - Create file at `src/components/superadmin/SuperadminErrorBoundary.tsx`
    - Implement React Error Boundary with fallback UI
    - Add retry/refresh functionality
    - Log errors to console for debugging
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 6.2 Wrap SuperadminLayout content with ErrorBoundary
    - Add ErrorBoundary around children in SuperadminLayout
    - Ensure errors don't crash the entire app
    - _Requirements: 5.1, 5.4_

  - [ ]* 6.3 Write property test for errors logged to console
    - **Property 9: Errors are logged to console**
    - **Validates: Requirements 5.5**

- [x] 7. Checkpoint - Verify authentication and error handling
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update TenantManagement to work with new layout
  - [x] 8.1 Refactor TenantManagement component
    - Remove redundant layout code
    - Ensure proper integration with SuperadminLayout
    - Verify all CRUD operations work correctly
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [ ]* 8.2 Write property test for tenant list displaying all required fields
    - **Property 4: Tenant list displays all required fields**
    - **Validates: Requirements 3.2**

- [x] 9. Create SuperadminSettings page
  - [x] 9.1 Create basic SuperadminSettings component
    - Create file at `src/pages/superadmin/SuperadminSettings.tsx`
    - Add placeholder content for future settings
    - Ensure proper navigation from sidebar
    - _Requirements: 1.2_

- [x] 10. Final integration and cleanup
  - [x] 10.1 Remove any unused imports and dead code
    - Clean up SuperadminDashboard.tsx
    - Clean up TenantManagement.tsx
    - Verify no console errors or warnings
    - _Requirements: 5.5_

  - [x] 10.2 Verify all navigation flows work correctly
    - Test login → dashboard redirect
    - Test sidebar navigation between pages
    - Test logout flow
    - _Requirements: 1.3, 2.1, 4.4_

- [x] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
