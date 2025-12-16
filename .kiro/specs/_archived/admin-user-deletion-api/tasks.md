# Implementation Plan

- [x] 1. Verify WuzAPIClient deletion methods exist
  - Check if deleteUser and deleteUserFull methods are implemented in utils/wuzapiClient.js
  - Verify method signatures and return formats match expected interface
  - Test methods work correctly with WuzAPI service
  - _Requirements: 1.3, 2.3_

- [x] 2. Implement DELETE /api/admin/users/:userId endpoint
  - [x] 2.1 Add basic route structure with middleware chain
    - Create DELETE route handler in server/routes/adminRoutes.js
    - Add validateAdminTokenFormat middleware to route
    - Implement basic request/response structure following existing patterns
    - _Requirements: 1.1, 1.2, 5.1_

  - [x] 2.2 Implement userId validation and admin token verification
    - Add userId format validation (non-empty string)
    - Integrate adminValidator.validateAdminToken for token verification
    - Handle validation errors with appropriate HTTP status codes
    - _Requirements: 1.2, 4.1, 4.4_

  - [x] 2.3 Integrate WuzAPI deleteUser call and response handling
    - Call wuzapiClient.deleteUser with validated userId
    - Handle WuzAPI success and error responses
    - Return appropriate JSON response with success/error status
    - _Requirements: 1.3, 1.4, 3.3_

  - [x] 2.4 Add comprehensive logging and error handling
    - Implement detailed logging for success and error scenarios
    - Add request timing and audit information (IP, User-Agent)
    - Handle specific error types (404, 401, 502, 500) with descriptive messages
    - _Requirements: 1.5, 3.1, 3.2, 3.4, 4.2, 4.3_

- [x] 3. Implement DELETE /api/admin/users/:userId/full endpoint
  - [x] 3.1 Add full deletion route with same middleware pattern
    - Create DELETE route handler for /users/:userId/full path
    - Reuse same middleware chain and validation logic from basic deletion
    - Implement identical request/response structure
    - _Requirements: 2.1, 2.2, 5.2_

  - [x] 3.2 Integrate WuzAPI deleteUserFull call
    - Call wuzapiClient.deleteUserFull instead of deleteUser
    - Handle response and errors identically to basic deletion
    - Add logging to distinguish between deletion types in logs
    - _Requirements: 2.3, 2.4, 2.5_

- [ ] 4. Add JSDoc documentation for new endpoints
  - Write comprehensive JSDoc comments for both DELETE endpoints
  - Document request/response formats, error codes, and examples
  - Follow same documentation pattern as existing endpoints in adminRoutes.js
  - _Requirements: 5.5_

- [ ] 5. Test the implementation
  - [ ] 5.1 Write unit tests for deletion endpoints
    - Test successful deletion scenarios for both endpoints
    - Test validation errors (invalid userId, invalid token)
    - Test WuzAPI error handling and appropriate HTTP responses
    - _Requirements: 1.1, 2.1, 3.1, 3.2_

  - [ ] 5.2 Write integration tests for complete deletion flow
    - Test end-to-end deletion flow with valid admin token
    - Test error scenarios with mocked WuzAPI failures
    - Verify logging output and audit trail functionality
    - _Requirements: 4.2, 4.3, 4.5_

- [ ] 6. Verify frontend integration works correctly
  - Test that existing frontend deletion functionality now works
  - Verify error messages are properly displayed to users
  - Confirm both database and full deletion options work as expected
  - _Requirements: 1.4, 2.4, 3.4_