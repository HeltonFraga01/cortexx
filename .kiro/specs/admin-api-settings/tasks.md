# Implementation Plan

- [x] 1. Create ApiSettingsService for backend configuration management
  - [x] 1.1 Create `server/services/ApiSettingsService.js` with core structure
    - Define KEYS constants for global_settings table
    - Implement constructor with cache initialization
    - Add encryption/decryption methods using AES-256-GCM
    - _Requirements: 1.3, 3.3, 3.4_
  - [ ]* 1.2 Write property test for token encryption security
    - **Property 5: Token Encryption Security**
    - **Validates: Requirements 3.3**
  - [x] 1.3 Implement `getSetting()` method with database/env fallback
    - Query global_settings table for key
    - Return env fallback if not found in database
    - Include source indicator in response
    - _Requirements: 1.4, 1.5, 5.1_
  - [ ]* 1.4 Write property test for configuration precedence
    - **Property 3: Configuration Precedence**
    - **Validates: Requirements 1.4, 4.1**
  - [x] 1.5 Implement `getApiSettings()` method
    - Load all API settings with sources
    - Mask token value for display
    - _Requirements: 1.1, 5.1_
  - [ ]* 1.6 Write property test for source indication accuracy
    - **Property 4: Source Indication Accuracy**
    - **Validates: Requirements 5.1**
  - [x] 1.7 Implement `updateApiSettings()` method
    - Validate input before saving
    - Encrypt token before storage
    - Invalidate cache after update
    - _Requirements: 1.2, 1.3, 3.3_
  - [ ]* 1.8 Write property test for settings persistence round-trip
    - **Property 2: Settings Persistence Round-Trip**
    - **Validates: Requirements 1.3, 3.3, 3.4**
  - [x] 1.9 Implement `testConnection()` method
    - Use current settings to test WUZAPI connectivity
    - Return success/failure with details
    - Handle timeout within 15 seconds
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 2. Create validation utilities for API settings
  - [x] 2.1 Create `server/validators/apiSettingsValidator.js`
    - Implement URL validation (HTTP/HTTPS only)
    - Implement timeout validation (1000-120000ms range)
    - Implement token validation (non-empty)
    - _Requirements: 1.2_
  - [ ]* 2.2 Write property test for settings validation
    - **Property 1: Settings Validation**
    - **Validates: Requirements 1.2**

- [x] 3. Create admin routes for API settings
  - [x] 3.1 Create `server/routes/adminApiSettingsRoutes.js`
    - GET /api/admin/api-settings endpoint
    - PUT /api/admin/api-settings endpoint
    - POST /api/admin/api-settings/test endpoint
    - Apply admin authentication middleware
    - _Requirements: 1.1, 1.2, 1.3, 2.1_
  - [x] 3.2 Register routes in `server/routes/index.js`
    - Import and mount adminApiSettingsRoutes
    - _Requirements: 1.1_

- [x] 4. Modify WuzAPIClient to use dynamic configuration
  - [x] 4.1 Update `server/utils/wuzapiClient.js`
    - Import ApiSettingsService
    - Add `reloadConfig()` method
    - Modify constructor to load from ApiSettingsService
    - Add cache with TTL for configuration
    - _Requirements: 4.1, 4.2_
  - [ ]* 4.2 Write unit tests for WuzAPIClient configuration loading
    - Test dynamic config reload
    - Test fallback behavior
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create frontend API settings form component
  - [x] 6.1 Create `src/components/admin/ApiSettingsForm.tsx`
    - Form with fields for baseUrl, adminToken, timeout
    - Source indicators for each field
    - Token masking with reveal toggle
    - Save and test connection buttons
    - _Requirements: 1.1, 3.1, 3.2, 5.1, 5.2_
  - [x] 6.2 Create `src/services/api-settings.ts` frontend service
    - getApiSettings() function
    - updateApiSettings() function
    - testApiConnection() function
    - _Requirements: 1.1, 2.1_

- [x] 7. Integrate ApiSettingsForm into AdminSettings page
  - [x] 7.1 Update `src/components/admin/AdminSettings.tsx`
    - Replace static API settings card with ApiSettingsForm
    - Add loading and error states
    - _Requirements: 1.1, 5.3_

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Implementation Status

**COMPLETED** - All core implementation tasks are done and tested:

1. ✅ Backend service (`server/services/ApiSettingsService.js`) with AES-256-GCM encryption
2. ✅ Validator (`server/validators/apiSettingsValidator.js`) with Zod schemas
3. ✅ Routes (`server/routes/adminApiSettingsRoutes.js`) with GET/PUT/POST/DELETE endpoints
4. ✅ Routes registered in `server/index.js` at `/api/admin/api-settings`
5. ✅ Frontend service (`src/services/api-settings.ts`) - Updated to use `backendApi` client with CSRF token support
6. ✅ Form component (`src/components/admin/ApiSettingsForm.tsx`) with source badges (Env/Banco)
7. ✅ Integration in `src/components/admin/AdminSettings.tsx`

**Tested Features:**
- ✅ Test Connection button - works correctly (shows "Conexão OK" with response time)
- ✅ Save Settings - saves to database, badge changes from "Env" to "Banco"
- ✅ Revert to .env - deletes database setting, badge changes back to "Env"
- ✅ CSRF token handling - all POST/PUT/DELETE requests include CSRF token automatically

