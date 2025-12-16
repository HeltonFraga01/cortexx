# Implementation Plan

- [x] 1. Create UserIdResolver utility
  - [x] 1.1 Create server/utils/userIdResolver.js with resolveUserId function
    - Implement priority-based resolution: session.userId > account.ownerUserId > hash(userToken)
    - Export hashToken and getUserToken helper functions
    - _Requirements: 1.1, 1.4, 9.3_
  - [ ] 1.2 Write property test for consistent user ID resolution
    - **Property 1: Consistent User ID Resolution**
    - **Validates: Requirements 1.1, 1.4**

- [x] 2. Update verifyUserToken middleware
  - [x] 2.1 Import userIdResolver in verifyUserToken middleware
    - Use hashToken to generate consistent userId from token
    - _Requirements: 1.3, 9.1_
  - [x] 2.2 Set session.userId and session.userToken after token validation
    - Ensure both values are set for quota middleware consistency
    - _Requirements: 1.3, 18.1_
  - [ ] 2.3 Write property test for session state consistency
    - **Property 8: Session State Consistency**
    - **Validates: Requirements 1.3, 9.1, 18.1**

- [x] 3. Update quotaEnforcement middleware to use userIdResolver
  - [x] 3.1 Import resolveUserId from userIdResolver
    - Replace inline resolution logic with centralized function
    - _Requirements: 1.4_
  - [x] 3.2 Update resolveUserId to also get userToken for resource counting
    - Pass both userId and userToken to QuotaService methods
    - _Requirements: 18.2_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update QuotaService resource counting methods
  - [x] 5.1 Update countUserWebhooks to accept userToken parameter
    - Query outgoing_webhooks with both userId and userToken
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 5.2 Update countUserCampaigns to accept userToken parameter
    - Query campaigns with both userId and userToken in user_token field
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 5.3 Update countUserBots to accept userToken parameter
    - Query agent_bots with both userId and userToken
    - _Requirements: 18.2_
  - [ ] 5.4 Write property test for resource count consistency
    - **Property 3: Resource Count Consistency**
    - **Validates: Requirements 4.1, 4.2, 5.1, 18.2**

- [x] 6. Update QuotaService account-based counting methods
  - [x] 6.1 Verify countUserAgents uses account.ownerUserId correctly
    - Ensure agents are counted across all accounts owned by user
    - _Requirements: 13.2_
  - [x] 6.2 Verify countUserInboxes uses account.ownerUserId correctly
    - Ensure inboxes are counted across all accounts owned by user
    - _Requirements: 13.3_
  - [x] 6.3 Verify countUserTeams uses account.ownerUserId correctly
    - Ensure teams are counted across all accounts owned by user
    - _Requirements: 13.4_
  - [x] 6.4 Verify countUserConnections uses account.ownerUserId correctly
    - Count inboxes with wuzapi_connected=1 across all accounts
    - _Requirements: 15.1_
  - [ ] 6.5 Write property test for agent count accuracy
    - **Property 4: Agent Count Accuracy**
    - **Validates: Requirements 13.2, 14.1**
  - [ ] 6.6 Write property test for inbox count accuracy
    - **Property 5: Inbox Count Accuracy**
    - **Validates: Requirements 13.3, 14.2**
  - [ ] 6.7 Write property test for connection count accuracy
    - **Property 6: Connection Count Accuracy**
    - **Validates: Requirements 15.1**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add feature middleware to bulk campaign routes
  - [x] 8.1 Import featureMiddleware in bulkCampaignRoutes.js
    - Add featureMiddleware.bulkCampaigns to POST / route
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 8.2 Ensure feature check happens before quota check
    - Order: verifyUserToken → featureMiddleware → quotaMiddleware
    - _Requirements: 2.3, 2.4_

- [x] 9. Add quota middleware to chat routes
  - [x] 9.1 Import quotaMiddleware in chatRoutes.js
    - Add quotaMiddleware.messages to POST /send/text route
    - _Requirements: 3.1_
  - [x] 9.2 Add quotaMiddleware.messages to POST /send/image route
    - _Requirements: 3.2_
  - [x] 9.3 Update verifyUserToken in chatRoutes to set session.userId
    - Use global verifyUserToken middleware or update local one
    - _Requirements: 1.3, 3.4_
  - [ ] 9.4 Write property test for message quota increment
    - **Property 7: Message Quota Increment**
    - **Validates: Requirements 3.4**

- [x] 10. Add feature middleware to webhook routes
  - [x] 10.1 Import featureMiddleware in userWebhookRoutes.js
    - Add featureMiddleware.webhooks to POST / route
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 10.2 Update verifyUserToken to use global middleware
    - Ensure consistent userId resolution
    - _Requirements: 1.1_

- [x] 11. Add feature middleware to bot routes
  - [x] 11.1 Add featureMiddleware.botAutomation to POST / route in userBotRoutes.js
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Add feature middleware to media routes
  - [x] 13.1 Import featureMiddleware in mediaRoutes.js
    - Add featureMiddleware.mediaStorage to POST /upload route
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 14. Add feature middleware to database routes
  - [x] 14.1 Import featureMiddleware in databaseRoutes.js
    - Add featureMiddleware.nocodbIntegration to all routes
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 15. Add feature middleware to report routes
  - [x] 15.1 Import featureMiddleware in reportRoutes.js
    - Add featureMiddleware.advancedReports to all routes
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 16. Add feature middleware to scheduled message routes
  - [x] 16.1 Update chatRoutes.js to check scheduled_messages feature
    - Add feature check when isScheduled=true
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Update account routes to use ownerUserId for quotas
  - [x] 18.1 Verify accountAgentRoutes uses account.ownerUserId for quota
    - Ensure quotaMiddleware.agents uses correct userId
    - _Requirements: 14.1, 17.1, 17.2_
  - [x] 18.2 Verify accountInboxRoutes uses account.ownerUserId for quota
    - Ensure quotaMiddleware.inboxes uses correct userId
    - _Requirements: 14.2, 17.1, 17.2_
  - [x] 18.3 Verify accountTeamRoutes uses account.ownerUserId for quota
    - Ensure quotaMiddleware.teams uses correct userId
    - _Requirements: 14.3, 17.1, 17.2_
  - [ ] 18.4 Write property test for quota attribution to account owner
    - **Property 2: Quota Attribution to Account Owner**
    - **Validates: Requirements 13.1, 16.1, 16.2**

- [x] 19. Update chat routes for agent context
  - [x] 19.1 Add logic to resolve ownerUserId when agent sends message
    - Check if request has agent context and resolve owner
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Integration testing
  - [x] 21.1 Test bulk campaigns feature enforcement
    - Verify feature disabled returns 403
    - Verify feature enabled allows access
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 21.2 Test message quota enforcement
    - Verify quota exceeded returns 429
    - Verify quota available allows send
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 21.3 Test webhook feature and quota enforcement
    - Verify both feature and quota are checked
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 21.4 Test bot feature and quota enforcement
    - Verify both feature and quota are checked
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 22. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
