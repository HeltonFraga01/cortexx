# Implementation Plan

- [x] 1. Add max_bots quota to database schema
  - [x] 1.1 Create migration to add max_bots column to plans table
    - Add max_bots INTEGER DEFAULT 3 column
    - Update existing plans with appropriate bot limits
    - _Requirements: 2.1_
  - [x] 1.2 Update default plans migration with max_bots values
    - Free: 1, Basic: 3, Pro: 10, Enterprise: 50
    - _Requirements: 2.1_

- [x] 2. Update QuotaService to support max_bots
  - [x] 2.1 Add MAX_BOTS to QUOTA_TYPES constant
    - Add 'max_bots' to the QUOTA_TYPES object
    - _Requirements: 2.1, 2.4_
  - [x] 2.2 Implement countUserBots method in QuotaService
    - Count bots from agent_bots table by user_id
    - Handle case where table doesn't exist
    - _Requirements: 2.2, 2.4_
  - [x] 2.3 Update getCurrentUsage to handle MAX_BOTS
    - Add case for MAX_BOTS in getCurrentUsage switch
    - _Requirements: 2.2_
  - [x] 2.4 Update getPlanQuotas to include max_bots
    - Add max_bots to the SQL query and return object
    - _Requirements: 2.4_
  - [ ]* 2.5 Write property test for quota enforcement
    - **Property 1: Quota Enforcement for All Resource Types**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2**

- [x] 3. Update quota enforcement middleware
  - [x] 3.1 Add bots middleware to quotaMiddleware exports
    - Add bots: enforceQuota(QuotaService.QUOTA_TYPES.MAX_BOTS)
    - _Requirements: 2.2_
  - [x] 3.2 Update formatQuotaName to include bots
    - Add 'max_bots': 'bots' to the names object
    - _Requirements: 6.3_
  - [ ]* 3.3 Write property test for error response completeness
    - **Property 3: Error Response Completeness**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update BotService with quota enforcement
  - [x] 5.1 Add checkBotQuota method to BotService
    - Count current bots and compare with limit
    - Return { allowed, current, limit }
    - _Requirements: 2.2, 2.3_
  - [x] 5.2 Add quota check to createBot method
    - Call checkBotQuota before creating bot
    - Throw QUOTA_EXCEEDED error if limit reached
    - _Requirements: 2.2, 2.3_
  - [x] 5.3 Add getMaxBots method to BotService
    - Get max_bots from user's plan via subscription
    - _Requirements: 2.2_

- [x] 6. Update bot routes with quota middleware
  - [x] 6.1 Add quotaMiddleware.bots to bot creation route
    - Apply middleware to POST /bots endpoint
    - _Requirements: 2.2_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Fix QuotaService resource counting methods
  - [x] 8.1 Fix countUserWebhooks to use correct table structure
    - Verify webhooks table exists and has correct columns
    - Use outgoing_webhooks table if webhooks doesn't exist
    - _Requirements: 1.4_
  - [x] 8.2 Fix countUserCampaigns to use correct table structure
    - Verify campaigns table exists and has correct columns
    - Use bulk_campaigns table if campaigns doesn't exist
    - _Requirements: 1.5_
  - [x] 8.3 Fix countUserConnections to use correct table structure
    - Verify connections table exists or use alternative
    - Count from inboxes with wuzapi_connected = 1
    - _Requirements: 1.6_
  - [ ]* 8.4 Write property test for quota calculation correctness
    - **Property 2: Quota Calculation Correctness**
    - **Validates: Requirements 3.1, 3.4, 4.3**

- [x] 9. Update PlanService with max_bots support
  - [x] 9.1 Add max_bots to DEFAULT_QUOTAS constant
    - Add maxBots: 3 to DEFAULT_QUOTAS
    - _Requirements: 2.1_
  - [x] 9.2 Update createPlan to include max_bots
    - Add max_bots to INSERT SQL and params
    - _Requirements: 2.1, 5.2_
  - [x] 9.3 Update updatePlan to handle max_bots
    - Add max_bots to UPDATE SQL when provided
    - _Requirements: 5.2_
  - [x] 9.4 Update formatPlan to include max_bots in quotas
    - Add maxBots: row.max_bots to quotas object
    - _Requirements: 5.1_
  - [ ]* 9.5 Write property test for quota value validation
    - **Property 5: Quota Value Validation**
    - **Validates: Requirements 5.4**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update SubscriptionService with max_bots
  - [x] 11.1 Add max_bots to getSubscription SQL query
    - Include p.max_bots in SELECT clause
    - _Requirements: 2.4_
  - [x] 11.2 Add maxBots to quotas object in formatSubscription
    - Add maxBots: row.max_bots to quotas
    - _Requirements: 2.4_

- [x] 12. Update frontend types and components
  - [x] 12.1 Add maxBots to PlanQuotas interface
    - Update src/types/admin-management.ts
    - _Requirements: 5.1_
  - [x] 12.2 Update PlanForm component with max_bots field
    - Add maxBots field to form schema and UI
    - _Requirements: 5.2_
  - [x] 12.3 Update PlanList component to display max_bots
    - Add bots count to plan details display
    - _Requirements: 5.1, 5.3_

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Add storage quota enforcement
  - [x] 14.1 Verify storage tracking in S3Service
    - Check if storage usage is tracked per user
    - _Requirements: 4.4_
  - [x] 14.2 Add storage quota check to media upload route
    - Apply quotaMiddleware.storage to upload endpoint
    - _Requirements: 4.1, 4.2_
  - [ ]* 14.3 Write property test for edge case handling
    - **Property 6: Edge Case Handling**
    - **Validates: Requirements 7.4**

- [x] 15. Add audit logging for quota operations
  - [x] 15.1 Add logging to enforceQuota middleware
    - Log quota check with userId, quotaType, result
    - _Requirements: 7.2, 7.3_
  - [ ]* 15.2 Write property test for audit logging
    - **Property 4: Audit Logging for Quota Operations**
    - **Validates: Requirements 7.2, 7.3**

- [x] 16. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

