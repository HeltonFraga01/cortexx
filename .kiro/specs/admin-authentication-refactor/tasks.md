# Implementation Plan

- [x] 1. Add requires_password_change field to superadmins table
  - [x] 1.1 Create migration to add requires_password_change column
    - Create migration file `server/migrations/008_add_requires_password_change.sql`
    - Add `requires_password_change BOOLEAN DEFAULT false` column
    - _Requirements: 5.3_

- [x] 2. Implement password change functionality
  - [x] 2.1 Add changePassword method to SuperadminService
    - Implement password verification with bcrypt.compare
    - Validate new password complexity (min 8 chars, uppercase, lowercase, number, special)
    - Hash new password with bcrypt cost factor 12
    - Update password_hash in database
    - Set requires_password_change to false
    - _Requirements: 2.2, 2.3, 2.4, 4.1_

  - [ ]* 2.2 Write property test for password hash security
    - **Property 2: Password Hash Security**
    - **Validates: Requirements 4.1**

  - [ ]* 2.3 Write property test for password complexity validation
    - **Property 5: Password Complexity Validation**
    - **Validates: Requirements 2.5**

  - [ ]* 2.4 Write property test for password change validation
    - **Property 4: Password Change Validation**
    - **Validates: Requirements 2.4**

  - [x] 2.5 Add password change route to superadminAuthRoutes
    - Create POST /api/superadmin/change-password endpoint
    - Validate request body (currentPassword, newPassword)
    - Call SuperadminService.changePassword
    - Return success/error response
    - _Requirements: 2.1, 2.2_

- [x] 3. Implement session invalidation on password change
  - [x] 3.1 Add invalidateSessions method implementation
    - Track sessions in database or use session store
    - Invalidate all sessions except current on password change
    - _Requirements: 2.3_

  - [ ]* 3.2 Write property test for session invalidation
    - **Property 9: Session Invalidation on Password Change**
    - **Validates: Requirements 2.3**

- [x] 4. Checkpoint - Ensure password change functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement rate limiting for login attempts
  - [x] 5.1 Create rate limiter middleware for superadmin login
    - Track failed attempts by IP address
    - Block after 5 failed attempts within 15 minutes
    - Return 429 status with retry-after header
    - _Requirements: 4.4_

  - [ ]* 5.2 Write property test for rate limiting enforcement
    - **Property 3: Rate Limiting Enforcement**
    - **Validates: Requirements 4.4**

- [x] 6. Implement superadmin account management
  - [x] 6.1 Add listSuperadmins method to SuperadminService
    - Return all superadmins without password_hash
    - Include id, email, name, status, lastLoginAt, createdAt
    - _Requirements: 5.4_

  - [x] 6.2 Add deleteSuperadmin method to SuperadminService
    - Prevent self-deletion (targetId !== requesterId)
    - Delete superadmin from database
    - Log audit action
    - _Requirements: 5.5_

  - [ ]* 6.3 Write property test for self-deletion prevention
    - **Property 6: Self-Deletion Prevention**
    - **Validates: Requirements 5.5**

  - [x] 6.4 Add superadmin account management routes
    - GET /api/superadmin/accounts - List all superadmins
    - POST /api/superadmin/accounts - Create new superadmin
    - DELETE /api/superadmin/accounts/:id - Delete superadmin
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 6.5 Update create method to set requires_password_change
    - Set requires_password_change: true for new accounts
    - _Requirements: 5.3_

  - [ ]* 6.6 Write property test for first login password change requirement
    - **Property 10: First Login Password Change Requirement**
    - **Validates: Requirements 5.3**

- [x] 7. Checkpoint - Ensure superadmin management works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement tenant edit functionality in backend
  - [x] 8.1 Add PUT route for tenant update
    - Create PUT /api/superadmin/tenants/:id endpoint
    - Validate request body (name, status, settings)
    - Call SuperadminService.updateTenant
    - Return updated tenant data
    - _Requirements: 3.3_

  - [ ]* 8.2 Write property test for tenant edit persistence
    - **Property 7: Tenant Edit Persistence**
    - **Validates: Requirements 3.3**

- [x] 9. Implement dropdown menu in TenantManagement
  - [x] 9.1 Replace action buttons with DropdownMenu component
    - Import DropdownMenu from shadcn/ui
    - Create dropdown with Edit, View, Impersonate, Delete options
    - Add icons for each option (Pencil, Eye, UserCog, Trash2)
    - Style Delete option with destructive color
    - _Requirements: 3.1_

- [x] 10. Implement TenantEditModal component
  - [x] 10.1 Create TenantEditModal component
    - Create file at `src/components/superadmin/TenantEditModal.tsx`
    - Implement Dialog with form fields (name, status)
    - Pre-fill form with tenant data when opened
    - Add validation for required fields
    - _Requirements: 3.2_

  - [x] 10.2 Integrate TenantEditModal with TenantManagement
    - Add state for selected tenant and modal visibility
    - Connect Edit dropdown option to open modal
    - Handle save with API call and list refresh
    - Preserve form data on error
    - _Requirements: 3.2, 3.3, 3.5_

  - [ ]* 10.3 Write property test for form data preservation on error
    - **Property 8: Form Data Preservation on Error**
    - **Validates: Requirements 3.5**

- [x] 11. Checkpoint - Ensure tenant edit functionality works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement SuperadminSettings page
  - [x] 12.1 Create PasswordChangeForm component
    - Create form with currentPassword, newPassword, confirmPassword fields
    - Add password visibility toggles
    - Display password requirements
    - Show validation errors
    - _Requirements: 2.1, 2.5_

  - [x] 12.2 Create SuperadminAccountsSection component
    - Display list of superadmin accounts in table
    - Show email, name, status, lastLoginAt, createdAt
    - Add "Add Superadmin" button with form dialog
    - Add delete button with confirmation
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 12.3 Update SuperadminSettings page
    - Replace placeholder with PasswordChangeForm
    - Add SuperadminAccountsSection
    - Connect to API endpoints
    - _Requirements: 2.1, 5.1_

- [x] 13. Implement authentication error consistency
  - [x] 13.1 Update authenticate method error handling
    - Return same "Invalid credentials" message for all failure types
    - Do not reveal if email exists or password is wrong
    - _Requirements: 1.4_

  - [ ]* 13.2 Write property test for authentication error consistency
    - **Property 1: Authentication Error Message Consistency**
    - **Validates: Requirements 1.4**

- [x] 14. Clean up token-based authentication references
  - [x] 14.1 Remove VITE_ADMIN_TOKEN dependencies from frontend
    - Update src/lib/env-config.ts to make adminToken optional
    - Remove adminToken validation requirement
    - Update wuzapi.ts to not require adminToken
    - _Requirements: 6.5_

  - [x] 14.2 Add deprecation warning for token-based endpoints
    - Add X-Deprecated header to any remaining token-based endpoints
    - Log deprecation warnings
    - _Requirements: 6.3_

- [x] 15. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

