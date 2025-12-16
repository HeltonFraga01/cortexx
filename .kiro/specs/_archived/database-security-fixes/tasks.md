# Implementation Plan

## Database Security Fixes

- [x] 1. Remove hardcoded admin token from auth middleware
  - [x] 1.1 Update `server/middleware/auth.js` to remove fallback token `'UeH7cZ2c1K3zVUBFi7SginSC'`
    - Return 500 error with `ADMIN_TOKEN_NOT_CONFIGURED` code when `VITE_ADMIN_TOKEN` is not set
    - Log warning about missing configuration
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Create credential sanitizer utility
  - [x] 2.1 Create `server/utils/credentialSanitizer.js`
    - Implement `sanitizeConnection(connection)` function that masks `password` and `nocodb_token` with `'********'`
    - Implement `sanitizeConnections(connections)` function for arrays
    - Return `null` for fields that are already null/undefined
    - _Requirements: 2.1, 2.2, 2.3, 6.2_
  - [ ]* 2.2 Write property test for credential masking consistency
    - **Property 3: Credential Masking Consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3, 6.2**

- [x] 3. Create database connection validator
  - [x] 3.1 Create `server/validators/databaseConnectionValidator.js`
    - Validate `name` length (1-100 characters)
    - Validate `type` is one of `['POSTGRES', 'MYSQL', 'NOCODB', 'API', 'SQLITE']`
    - Validate `host` format (valid URL or localhost)
    - Validate `port` range (1-65535) when provided
    - Return `{ valid: boolean, errors: string[] }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 3.2 Write property tests for input validation
    - **Property 5: Input Validation - Name Length**
    - **Property 6: Input Validation - Type Enum**
    - **Property 7: Input Validation - Port Range**
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 4. Secure database connection routes
  - [x] 4.1 Update `server/routes/databaseRoutes.js` to add authentication
    - Import `requireAdmin` from `../middleware/auth`
    - Import `adminLimiter` from `../middleware/rateLimiter`
    - Apply `router.use(adminLimiter)` and `router.use(requireAdmin)` to all routes
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 4.2 Add credential sanitization to GET endpoints
    - Import `sanitizeConnection`, `sanitizeConnections` from `../utils/credentialSanitizer`
    - Apply `sanitizeConnections()` to `GET /` response
    - Apply `sanitizeConnection()` to `GET /:id` response
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 4.3 Add input validation to POST/PUT endpoints
    - Import `validateConnectionData` from `../validators/databaseConnectionValidator`
    - Validate input before processing in `POST /` and `PUT /:id`
    - Return 400 with specific error messages on validation failure
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 4.4 Implement password preservation on update
    - When updating a connection without password field, preserve existing password from database
    - Fetch existing connection before update to get current credentials
    - _Requirements: 6.3_
  - [ ]* 4.5 Write property test for authentication enforcement
    - **Property 1: Authentication Enforcement**
    - **Validates: Requirements 1.1**
  - [ ]* 4.6 Write property test for password preservation
    - **Property 8: Password Preservation on Update**
    - **Validates: Requirements 6.3**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add security logging for credential access
  - [x] 6.1 Add logging when credentials are accessed internally
    - Use `securityLogger.logSensitiveDataAccess()` when unmasked credentials are retrieved
    - Ensure log entries never contain actual credential values
    - _Requirements: 5.3_
  - [ ]* 6.2 Write property test for log credential safety
    - **Property 10: Security Log Credential Safety**
    - **Validates: Requirements 5.3**

- [x] 7. Clean up debug console.log statements
  - [x] 7.1 Review and remove console.log from `server/routes/databaseRoutes.js`
    - Replace any remaining `console.log` with `logger.debug()` calls
    - Ensure debug logs are suppressed in production mode
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
