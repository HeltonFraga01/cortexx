# Implementation Plan: Tenant Webhook Configuration

## Overview

Este plano implementa o sistema de configuração de webhooks multi-tenant, permitindo que cada tenant configure sua própria instância WUZAPI e que cada inbox tenha configuração de webhook independente.

## Tasks

- [x] 1. Database Schema Updates
  - [x] 1.1 Create migration for inboxes webhook_config column
    - Add `webhook_config JSONB DEFAULT '{}'::jsonb` to inboxes table
    - Add index for webhook_config queries
    - _Requirements: 2.3_
  - [x] 1.2 Verify tenant_settings table structure
    - Ensure JSONB settings column supports wuzapi config
    - Verify RLS policies are in place
    - _Requirements: 1.3, 4.1_

- [x] 2. Backend Services - TenantSettingsService
  - [x] 2.1 Create TenantSettingsService with encryption utilities
    - Implement `encryptToken()` and `decryptToken()` using AES-256-GCM
    - Use `crypto` module with secure key derivation
    - _Requirements: 1.4_
  - [ ]* 2.2 Write property test for encryption round-trip
    - **Property 2: Settings Persistence Round-Trip**
    - **Validates: Requirements 1.3, 1.4, 2.3**
  - [x] 2.3 Implement `getWuzapiConfig()` with fallback logic
    - Query tenant_settings by tenant_id
    - Decrypt admin token
    - Fall back to env vars if not configured
    - _Requirements: 1.6, 6.4_
  - [ ]* 2.4 Write property test for configuration resolution
    - **Property 3: Tenant Configuration Resolution**
    - **Validates: Requirements 1.6, 2.2, 5.3**
  - [x] 2.5 Implement `saveWuzapiConfig()` with validation
    - Validate URL is HTTPS
    - Encrypt admin token
    - Upsert to tenant_settings
    - _Requirements: 1.2, 1.3_
  - [ ]* 2.6 Write property test for URL validation
    - **Property 1: URL Validation**
    - **Validates: Requirements 1.2**
  - [x] 2.7 Implement `testConnection()` for WUZAPI connectivity
    - Make health check request to WUZAPI
    - Return success/failure with response time
    - _Requirements: 1.5_

- [x] 3. Checkpoint - TenantSettingsService Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend Services - InboxWebhookService
  - [x] 4.1 Create InboxWebhookService
    - Implement `generateWebhookUrl()` using tenant's main domain
    - Extract main domain from subdomain (e.g., tenant.example.com → example.com)
    - _Requirements: 2.1, 5.2_
  - [ ]* 4.2 Write property test for webhook URL uniqueness
    - **Property 4: Webhook URL Uniqueness**
    - **Validates: Requirements 2.1, 5.2**
  - [x] 4.3 Implement `configureWebhook()` using tenant credentials
    - Get tenant's WUZAPI config via TenantSettingsService
    - Call WUZAPI API to register webhook
    - Update inbox webhook_config
    - _Requirements: 2.2, 2.5_
  - [x] 4.4 Implement `getWebhookStatus()` for inbox
    - Query WUZAPI for current webhook status
    - Return combined status from DB and API
    - _Requirements: 5.1_
  - [x] 4.5 Implement `updateInboxWebhookConfig()` 
    - Update inbox webhook_config JSONB
    - _Requirements: 2.3_

- [x] 5. Checkpoint - InboxWebhookService Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend Services - WebhookAccountRouter Enhancement
  - [x] 6.1 Enhance `routeWebhook()` with tenant config lookup
    - Get tenant's WUZAPI config for processing
    - Set tenant context before database operations
    - _Requirements: 3.4_
  - [ ]* 6.2 Write property test for webhook routing accuracy
    - **Property 5: Webhook Routing Accuracy**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  - [x] 6.3 Implement `getTenantWuzapiConfig()` 
    - Delegate to TenantSettingsService
    - Cache config for performance
    - _Requirements: 3.1_
  - [x] 6.4 Implement `logRoutingDecision()` for audit
    - Log tenant_id, inbox_id, event type, result
    - _Requirements: 3.5_
  - [ ]* 6.5 Write property test for tenant isolation
    - **Property 6: Tenant Isolation**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [x] 7. Checkpoint - WebhookAccountRouter Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Backend Routes - Admin API Settings
  - [x] 8.1 Create admin route for tenant API settings
    - GET `/api/admin/tenant/api-settings` - Get current config
    - PUT `/api/admin/tenant/api-settings` - Save config
    - POST `/api/admin/tenant/api-settings/test` - Test connection
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 8.2 Add validation middleware for API settings
    - Validate URL format
    - Validate token presence
    - _Requirements: 1.2_
  - [x] 8.3 Add tenant ownership verification
    - Verify admin belongs to tenant
    - _Requirements: 4.4_

- [x] 9. Backend Routes - Inbox Webhook Configuration
  - [x] 9.1 Create/update inbox webhook routes
    - GET `/api/session/inboxes/:id/webhook` - Get webhook status
    - POST `/api/session/inboxes/:id/webhook/configure` - Configure webhook
    - _Requirements: 5.1, 5.5_
  - [x] 9.2 Update webhook event handler to use tenant config
    - Modify `/api/webhook/events` to use tenant's WUZAPI config
    - _Requirements: 3.1, 3.4_

- [x] 10. Checkpoint - Backend Routes Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend - Admin API Settings Component
  - [x] 11.1 Create TenantApiSettings component
    - Form for baseUrl, adminToken, timeout
    - Connection test button
    - Save functionality
    - _Requirements: 1.1_
  - [x] 11.2 Create API settings service
    - `src/services/tenant-api-settings.ts`
    - Functions: getSettings, saveSettings, testConnection
    - _Requirements: 1.1_
  - [x] 11.3 Add TenantApiSettings to admin settings page
    - Integrate into existing admin settings UI
    - _Requirements: 1.1_

- [x] 12. Frontend - Inbox Webhook Configuration Enhancement
  - [x] 12.1 Update IncomingWebhookConfig to use tenant context ✅
    - Get tenant's main domain for webhook URL from backend
    - Use tenant's WUZAPI credentials for configuration via InboxWebhookService
    - Uses useInbox hook to get current inbox context
    - _Requirements: 5.2, 5.3_
  - [x] 12.2 Add error handling for missing tenant config ✅
    - Show message if tenant API not configured (WEBHOOK_URL_NOT_CONFIGURED)
    - Show message if no inbox selected
    - _Requirements: 5.4_
  - [x] 12.3 Update webhook status display ✅
    - Show configuration status from inbox record via getInboxWebhookStatus
    - Display WUZAPI status and events
    - _Requirements: 5.1, 5.5_

- [x] 13. Checkpoint - Frontend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Migration and Fallback
  - [x] 14.1 Create migration utility for existing settings
    - Check for global WUZAPI settings in env vars
    - Offer migration to tenant_settings
    - _Requirements: 6.1, 6.2_
  - [ ]* 14.2 Write property test for fallback configuration
    - **Property 7: Fallback Configuration**
    - **Validates: Requirements 6.4, 6.5**
  - [x] 14.3 Implement settings migration script
    - Preserve existing webhook configurations
    - _Requirements: 6.3_
  - [ ]* 14.4 Write property test for migration preservation
    - **Property 8: Migration Preservation**
    - **Validates: Requirements 6.3**

- [x] 15. Final Checkpoint - All Tests Pass
  - Ensure all tests pass, ask the user if questions arise.
  - Verify multi-tenant isolation
  - Test webhook flow end-to-end

## Notes

- Tasks marked with `*` are optional property-based tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases

