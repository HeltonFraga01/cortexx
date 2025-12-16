# Implementation Plan

- [x] 1. Refactor FeatureFlagService to separate user and admin features
  - [x] 1.1 Update FEATURE_FLAGS constant to remove chatwoot_integration and typebot_integration
    - Remove CHATWOOT_INTEGRATION and TYPEBOT_INTEGRATION from FEATURE_FLAGS object
    - Remove corresponding entries from DEFAULT_FEATURES
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Create USER_FEATURES and ADMIN_FEATURES constants
    - Define USER_FEATURES with 8 valid user features
    - Define ADMIN_FEATURES with page_builder and custom_branding
    - Export both constants for use in other modules
    - _Requirements: 2.1, 2.2, 3.1_
  - [ ]* 1.3 Write property test for feature classification
    - **Property 1: No Invalid Features in System**
    - **Property 2: Admin Features Excluded from User Features**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
  - [x] 1.4 Update getUserFeatures to return only USER_FEATURES
    - Filter out admin features from returned list
    - Ensure only valid user features are included
    - _Requirements: 2.3, 3.2_
  - [ ]* 1.5 Write property test for getUserFeatures
    - **Property 3: User Features List Completeness**
    - **Validates: Requirements 2.3, 3.2**

- [x] 2. Update feature enforcement middleware
  - [x] 2.1 Add admin feature check to requireFeature middleware
    - Check if feature is in ADMIN_FEATURES
    - Return 403 with ADMIN_FEATURE code for non-admin users
    - _Requirements: 2.4_
  - [ ]* 2.2 Write property test for admin feature denial
    - **Property 4: Admin Feature Denial for Non-Admin Users**
    - **Validates: Requirements 2.4**
  - [x] 2.3 Update featureMiddleware exports to remove chatwoot and typebot
    - Remove chatwootIntegration and typebotIntegration from exports
    - Keep only valid feature middleware
    - _Requirements: 5.3, 5.4_
  - [ ]* 2.4 Write property test for feature override precedence
    - **Property 5: Feature Override Precedence**
    - **Validates: Requirements 4.3**
  - [ ]* 2.5 Write property test for admin user bypass
    - **Property 6: Admin User Feature Bypass**
    - **Validates: Requirements 4.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Refactor PlanService to use only user features
  - [x] 4.1 Update DEFAULT_FEATURES constant in PlanService
    - Remove chatwoot_integration and typebot_integration
    - Remove page_builder and custom_branding
    - Keep only 8 valid user features
    - _Requirements: 1.1, 1.2, 2.1, 2.2_
  - [x] 4.2 Add feature validation to createPlan and updatePlan
    - Validate that only USER_FEATURES are included
    - Reject plans with invalid features
    - _Requirements: 1.4_
  - [ ]* 4.3 Write property test for plan feature validation
    - **Property 9: Plan Feature Validation**
    - **Validates: Requirements 1.4**

- [x] 5. Update default plans migration
  - [x] 5.1 Update migration 067 to use correct feature configurations
    - Remove chatwoot_integration and typebot_integration from all plans
    - Remove page_builder and custom_branding from all plans
    - Set correct defaults per plan tier
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Clean up frontend TypeScript types
  - [x] 7.1 Update FeatureName type in admin-management.ts
    - Remove chatwoot_integration and typebot_integration
    - Create separate UserFeatureName and AdminFeatureName types
    - _Requirements: 5.5_
  - [x] 7.2 Update PlanFeatures interface
    - Remove chatwootIntegration and typebotIntegration
    - Remove pageBuilder and customBranding
    - _Requirements: 5.5_

- [x] 8. Clean up frontend components
  - [x] 8.1 Update UserFeaturesCard component
    - Remove chatwoot_integration and typebot_integration from featureLabels
    - Remove page_builder and custom_branding from featureLabels
    - _Requirements: 5.1, 5.2_
  - [x] 8.2 Update FeaturesList component
    - Remove chatwoot_integration and typebot_integration from FEATURE_LABELS
    - Remove page_builder and custom_branding from FEATURE_LABELS
    - _Requirements: 5.1, 5.2_

- [x] 9. Add agent quota enforcement
  - [x] 9.1 Create quota check in AgentService.createAgentDirect
    - Check current agent count against max_agents quota
    - Return error if quota exceeded
    - _Requirements: 6.1, 6.2_
  - [ ]* 9.2 Write property test for agent quota enforcement
    - **Property 7: Agent Quota Enforcement**
    - **Validates: Requirements 6.1, 6.2**
  - [ ]* 9.3 Write property test for agent deletion count update
    - **Property 8: Agent Deletion Updates Count**
    - **Validates: Requirements 6.4**

- [x] 10. Update property tests in existing test files
  - [x] 10.1 Update PlanService.property.test.js
    - Remove chatwoot_integration and typebot_integration from feature generators
    - Update test expectations for valid features
    - _Requirements: 1.1, 1.2_

- [x] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

