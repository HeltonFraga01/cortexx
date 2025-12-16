# Implementation Plan

- [x] 1. Add session debugging and logging
  - Add development mode logging to track session state on admin requests
  - Log session ID, userId, role, and token presence on each admin route access
  - Add detailed error logging when token is missing from session
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. Fix admin routes token extraction
  - [x] 2.1 Update adminRoutes.js to properly extract token from session
    - Add explicit check for `req.session.userToken` at the start of each route
    - Add detailed error response when token is missing from session
    - Remove fallback to `process.env.WUZAPI_ADMIN_TOKEN` in routes (only use session token)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 2.2 Update dashboard-stats route in routes/index.js
    - Extract token from `req.session.userToken` instead of environment variable
    - Add error handling for missing session token
    - Add logging for token extraction
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Create public branding and landing page endpoints
  - [x] 3.1 Create public branding route
    - Add GET /api/branding endpoint (without authentication)
    - Return branding configuration from database
    - Add caching for performance
    - _Requirements: 7.1_
  
  - [x] 3.2 Create public landing page route
    - Add GET /api/landing-page endpoint (without authentication)
    - Return custom landing page HTML from database
    - Add caching for performance
    - _Requirements: 7.2_
  
  - [x] 3.3 Create public custom links route
    - Add GET /api/custom-links endpoint (without authentication)
    - Return custom navigation links from database
    - Add caching for performance
    - _Requirements: 7.3_
  
  - [x] 3.4 Update route registration in server/index.js
    - Register public routes before admin middleware
    - Ensure admin routes remain protected
    - _Requirements: 7.4, 7.5_

- [x] 4. Improve error messages and responses
  - [x] 4.1 Update error messages to Portuguese
    - Change "Authentication required" to "Autenticação necessária"
    - Change "Admin access required" to "Acesso de administrador necessário"
    - Change "Invalid credentials" to "Credenciais inválidas"
    - _Requirements: 2.5, 4.3, 4.4_
  
  - [x] 4.2 Add structured error responses
    - Include error code in all error responses
    - Include timestamp in all error responses
    - Include detailed error message for debugging
    - _Requirements: 5.1, 5.2_

- [x] 5. Update frontend error handling
  - [x] 5.1 Update AdminSettings.tsx error messages
    - Map 401 errors to "Token de administrador inválido"
    - Map 403 errors to "Acesso negado - verifique as permissões"
    - Map 504 errors to "Timeout: A API WUZAPI não respondeu a tempo"
    - _Requirements: 4.3, 4.4, 4.5_
  
  - [x] 5.2 Update api-client.ts error handling
    - Improve error messages for Portuguese users
    - Add automatic retry for CSRF token expiration
    - Add better logging for debugging
    - _Requirements: 6.3, 6.4_

- [x] 6. Add session status endpoint
  - Create GET /api/auth/session-debug endpoint (development only)
  - Return session state including userId, role, token presence
  - Add security check to only enable in development mode
  - _Requirements: 5.3_

- [ ] 7. Test authentication flow
  - [ ]* 7.1 Test admin login and session creation
    - Verify session cookie is set after login
    - Verify session contains userId, userToken, and role
    - Verify session persists across requests
    - _Requirements: 1.1, 1.2, 1.5_
  
  - [ ]* 7.2 Test admin dashboard access
    - Login as admin and navigate to /admin
    - Verify dashboard statistics load without errors
    - Verify no 401 or 403 errors in console
    - _Requirements: 2.1, 3.1, 3.4_
  
  - [ ]* 7.3 Test admin settings page
    - Navigate to /admin/settings
    - Click "Testar Conexão" button
    - Verify connection test succeeds
    - Verify user count is displayed
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 7.4 Test public branding access
    - Access /api/branding without authentication
    - Verify branding configuration is returned
    - Verify no authentication errors
    - _Requirements: 7.1_
  
  - [ ]* 7.5 Test error scenarios
    - Try accessing /admin without login → Verify 401 redirect
    - Login as user and try /admin → Verify 403 error
    - Test with expired session → Verify 401 error
    - _Requirements: 2.2, 2.3_

- [ ] 8. Update documentation
  - [ ]* 8.1 Document session-based authentication flow
    - Explain how session cookies work
    - Document session data structure
    - Document token extraction from session
    - _Requirements: 1.1, 1.5_
  
  - [ ]* 8.2 Document public vs protected endpoints
    - List all public endpoints
    - List all protected admin endpoints
    - Explain authentication requirements
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
