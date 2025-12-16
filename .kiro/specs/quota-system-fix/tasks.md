# Implementation Plan

## Phase 1: Core Infrastructure (Completed)

- [x] 1. Create SubscriptionEnsurer service
  - [x] 1.1 Create `server/services/SubscriptionEnsurer.js` with ensureSubscription method
  - [x] 1.3 Implement migrateUsersWithoutSubscription method

- [x] 2. Checkpoint - Ensure all tests pass

- [x] 3. Enhance session middleware to ensure subscription
  - [x] 3.1 Modify `server/middleware/auth.js` requireUser function

- [x] 4. Enhance QuotaService for consistent responses
  - [x] 4.1 Modify `server/services/QuotaService.js` getUserQuotas method

- [x] 5. Checkpoint - Ensure all tests pass

- [x] 6. Enhance userSubscriptionRoutes for consistent responses
  - [x] 6.1 Modify `/api/user/quotas` endpoint
  - [x] 6.3 Modify `/api/user/account-summary` endpoint

- [x] 7. Checkpoint - Ensure all tests pass

- [x] 8. Create migration script for existing users
  - [x] 8.1 Create `server/scripts/migrate-users-to-default-plan.js`
  - [x] 8.2 Add npm script to package.json

- [x] 9. Verify frontend displays correct data
  - [x] 9.1 Test dashboard quota display manually
  - [x] 9.2 Test account page display manually

- [x] 10. Final Checkpoint - Ensure all tests pass

## Phase 2: Fix User ID Resolution (NEW)

- [x] 11. Fix quota enforcement middleware user identification
  - [x] 11.1 Modify `server/middleware/quotaEnforcement.js` to resolve user ID correctly
    - Add support for `req.account.ownerUserId` (agent routes)
    - Keep support for `req.session.userId` (user routes)
    - Keep fallback to `req.user?.id || req.userId`
    - Add logging when user ID cannot be determined
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 11.2 Write property test for user ID resolution
    - **Property 7: User ID Resolution**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 12. Checkpoint - Ensure all tests pass

## Phase 3: Add Missing Resource Counters (NEW)

- [x] 13. Add resource counting methods to QuotaService
  - [x] 13.1 Add `countUserWebhooks` method to QuotaService
    - Count webhooks via account join
    - _Requirements: 10.4_

  - [x] 13.2 Add `countUserCampaigns` method to QuotaService
    - Count campaigns via account join
    - _Requirements: 11.4_

  - [x] 13.3 Add `countUserConnections` method to QuotaService
    - Count active connections via account join
    - _Requirements: 14.4_

  - [x] 13.4 Update `getCurrentUsage` to use new counting methods
    - Add cases for MAX_WEBHOOKS, MAX_CAMPAIGNS, MAX_CONNECTIONS
    - _Requirements: 10.4, 11.4, 14.4_

  - [ ]* 13.5 Write property test for resource count accuracy
    - **Property 9: Resource Count Accuracy**
    - **Validates: Requirements 7.4, 8.4, 9.4, 10.4, 11.4**

- [x] 14. Checkpoint - Ensure all tests pass

## Phase 4: Apply Quota Enforcement to All Routes (NEW)

- [x] 15. Apply quota middleware to inbox routes
  - [x] 15.1 Add `quotaMiddleware.inboxes` to POST `/api/account/inboxes`
    - Import quotaMiddleware
    - Add middleware before route handler
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 16. Apply quota middleware to team routes
  - [x] 16.1 Add `quotaMiddleware.teams` to POST `/api/account/teams`
    - Import quotaMiddleware
    - Add middleware before route handler
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 17. Apply quota middleware to webhook routes
  - [x] 17.1 Add `quotaMiddleware.webhooks` to POST `/api/account/webhooks`
    - Import quotaMiddleware
    - Add middleware before route handler
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 18. Apply quota middleware to campaign routes
  - [x] 18.1 Add `quotaMiddleware.campaigns` to POST `/api/account/campaigns`
    - Import quotaMiddleware
    - Add middleware before route handler
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 19. Apply quota middleware to connection routes
  - [x] 19.1 Add `quotaMiddleware.connections` to connection creation endpoint
    - Import quotaMiddleware
    - Add middleware before route handler
    - _Requirements: 14.1, 14.2, 14.3_

- [x] 20. Apply quota middleware to message routes
  - [x] 20.1 Add `quotaMiddleware.messages` to message sending endpoints
    - Check both daily and monthly limits
    - Increment usage after successful send
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 20.2 Write property test for agent quota enforcement
    - **Property 8: Agent Quota Enforcement**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 21. Checkpoint - Ensure all tests pass

## Phase 5: Verify Plan Limits Display (NEW)

- [x] 22. Verify plan limits are correctly displayed
  - [x] 22.1 Test that dashboard shows limits from actual plan, not defaults
    - Create user with specific plan
    - Verify quotas endpoint returns plan limits
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 22.2 Test that plan changes are reflected immediately
    - Change user's plan
    - Verify new limits are shown
    - _Requirements: 13.4_

  - [ ]* 22.3 Write property test for plan limits reflection
    - **Property 10: Plan Limits Reflection**
    - **Validates: Requirements 13.3, 13.4**

- [x] 23. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
