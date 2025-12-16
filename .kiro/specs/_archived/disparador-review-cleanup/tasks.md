# Implementation Plan

## 1. Security Improvements

- [x] 1.1 Implement TokenValidator middleware
  - Create `server/middleware/tokenValidator.js`
  - Validate token ownership against authenticated user
  - Allow admin bypass for token validation
  - Return generic error messages without exposing token details
  - _Requirements: 1.1, 1.3_

- [ ]* 1.2 Write property test for token validation security
  - **Property 1: Token Validation Security**
  - **Property 2: Error Response Privacy**
  - **Validates: Requirements 1.1, 1.3**

- [x] 1.3 Implement RateLimiter middleware for campaign routes
  - Create `server/middleware/campaignRateLimiter.js`
  - Configure 10 requests per minute limit
  - Apply to POST `/api/user/bulk-campaigns` route
  - _Requirements: 1.4_

- [ ]* 1.4 Write property test for rate limiting
  - **Property 3: Rate Limiting Enforcement**
  - **Validates: Requirements 1.4**

- [x] 1.5 Remove debug logs exposing tokens in frontend
  - Audit `DisparadorWrapper.tsx` for console.log statements
  - Remove or sanitize any token logging
  - _Requirements: 1.2_

- [x] 1.6 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 2. Database Schema Updates

- [x] 2.1 Create campaign_audit_logs table
  - Add migration for new table with id, campaign_id, user_id, action, details, created_at
  - Create indexes for campaign_id and created_at
  - _Requirements: 8.1, 8.4_

- [x] 2.2 Create campaign_error_logs table
  - Add migration for new table with id, campaign_id, contact_id, error_type, error_message, stack_trace, created_at
  - Create indexes for campaign_id and created_at
  - _Requirements: 3.4, 8.2_

- [x] 2.3 Add processing lock columns to campaigns table
  - Add processing_lock and lock_acquired_at columns
  - _Requirements: 2.2_

- [x] 2.4 Add performance indexes
  - Create index on campaigns(status)
  - Create index on campaigns(scheduled_at)
  - Create index on campaign_contacts(campaign_id, status)
  - Create index on campaign_contacts(campaign_id, processing_order)
  - _Requirements: 5.2_

## 3. AuditLogger Service

- [x] 3.1 Create AuditLogger service
  - Create `server/services/AuditLogger.js`
  - Implement log() method for recording operations
  - Implement getHistory() method for retrieving campaign history
  - Implement cleanup() method for retention policy
  - _Requirements: 8.1, 8.2_

- [ ]* 3.2 Write property test for audit logging
  - **Property 17: Audit Log Completeness**
  - **Property 18: Audit Retention After Deletion**
  - **Validates: Requirements 8.1, 8.4**

- [x] 3.3 Integrate AuditLogger with campaign routes
  - Add audit logging to create, pause, resume, cancel, delete operations
  - _Requirements: 8.1_

## 4. Enhanced PhoneValidationService

- [x] 4.1 Implement cache size limit
  - Add MAX_CACHE_SIZE constant (10,000)
  - Implement LRU eviction when cache exceeds limit
  - _Requirements: 5.4_

- [ ]* 4.2 Write property test for cache size limit
  - **Property 12: Cache Size Limit**
  - **Validates: Requirements 5.4**

- [x] 4.3 Implement phone number normalization improvements
  - Add normalizePhoneInput() for multi-format support
  - Add suggestCorrection() for format suggestions
  - _Requirements: 7.2, 7.3_

- [ ]* 4.4 Write property test for phone normalization
  - **Property 16: Phone Number Normalization Round-Trip**
  - **Validates: Requirements 7.2, 7.3**

- [x] 4.5 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 5. Enhanced QueueManager

- [x] 5.1 Implement batch processing for large campaigns
  - Add processContactsBatch() method
  - Process contacts in batches of 100 when total > 1000
  - _Requirements: 5.3_

- [ ]* 5.2 Write property test for batch processing
  - **Property 11: Batch Processing for Large Campaigns**
  - **Validates: Requirements 5.3**

- [x] 5.3 Implement enhanced progress tracking
  - Add getEnhancedProgress() method
  - Calculate estimatedTimeRemaining in human-readable format
  - Calculate averageSpeed (messages/minute)
  - Track recentErrors (last 5)
  - _Requirements: 6.1, 6.2, 6.3_

- [ ]* 5.4 Write property tests for progress tracking
  - **Property 13: Progress Time Estimation Format**
  - **Property 14: Speed Calculation Accuracy**
  - **Property 15: Recent Errors Limit**
  - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 5.5 Implement error persistence
  - Log errors to campaign_error_logs table
  - Include campaign_id, contact_id, error_type, error_message
  - _Requirements: 3.4_

- [ ]* 5.6 Write property test for error persistence
  - **Property 9: Error Persistence**
  - **Validates: Requirements 3.4, 8.2**

- [x] 5.7 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 6. Enhanced CampaignScheduler

- [x] 6.1 Implement processing lock mechanism
  - Add processingLocks Map
  - Implement acquireLock() and releaseLock() methods
  - Use database lock column for distributed safety
  - _Requirements: 2.2_

- [ ]* 6.2 Write property test for processing lock
  - **Property 5: Processing Lock Exclusivity**
  - **Validates: Requirements 2.2**

- [x] 6.3 Implement queue cleanup after completion
  - Add cleanupQueue() method
  - Remove from activeQueues Map after completion/cancellation
  - Clear processing lock
  - _Requirements: 2.4_

- [ ]* 6.4 Write property test for queue cleanup
  - **Property 6: Queue Cleanup After Completion**
  - **Validates: Requirements 2.4**

- [x] 6.5 Implement auto-pause on disconnection
  - Detect DISCONNECTED/UNAUTHORIZED errors
  - Automatically pause campaign
  - Log the disconnection event
  - _Requirements: 3.3_

- [ ]* 6.6 Write property test for auto-pause
  - **Property 8: Auto-Pause on Disconnection**
  - **Validates: Requirements 3.3**

## 7. StateSynchronizer Service

- [x] 7.1 Create StateSynchronizer service
  - Create `server/services/StateSynchronizer.js`
  - Implement startSync() with 30-second interval
  - Implement stopSync() for graceful shutdown
  - _Requirements: 4.4_

- [ ]* 7.2 Write property test for state synchronization
  - **Property 10: State Synchronization**
  - **Validates: Requirements 4.4**

- [x] 7.3 Implement campaign restoration after restart
  - Implement restoreRunningCampaigns() method
  - Mark running campaigns as paused on startup
  - Allow manual resume
  - _Requirements: 2.1, 4.1_

- [ ]* 7.4 Write property test for campaign restoration
  - **Property 4: Campaign State Restoration**
  - **Validates: Requirements 2.1, 4.1**

- [x] 7.5 Implement inconsistency detection and auto-correction
  - Implement detectInconsistencies() method
  - Implement autoCorrect() method
  - Log all corrections
  - _Requirements: 4.3_

- [x] 7.6 Integrate StateSynchronizer with server startup
  - Initialize on server start
  - Call restoreRunningCampaigns() on startup
  - Start sync interval
  - _Requirements: 2.1, 4.1, 4.4_

- [ ] 7.7 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 8. Error Handling Improvements

- [x] 8.1 Enhance error categorization in QueueManager
  - Review and improve categorizeError() function
  - Ensure consistent categorization for all error types
  - _Requirements: 3.1_

- [ ]* 8.2 Write property test for error categorization
  - **Property 7: Error Categorization Consistency**
  - **Validates: Requirements 3.1**

- [x] 8.3 Create frontend error handler utility
  - Create `src/lib/errorHandler.ts`
  - Implement handleApiError() with specific messages
  - Add retry suggestions for retryable errors
  - _Requirements: 3.1, 3.2_

- [x] 8.4 Update useSingleMessageSender hook with improved error handling
  - Differentiate error types (network, validation, API)
  - Show specific error messages
  - Offer retry option for retryable errors
  - _Requirements: 3.1, 3.2_

## 9. Frontend Improvements

- [x] 9.1 Enhance CampaignProgressMonitor component
  - Display estimatedTimeRemaining in human-readable format
  - Show averageSpeed (messages/minute)
  - Display last 5 errors in real-time
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9.2 Improve phone validation feedback in DisparadorUnico
  - Add visual indicator during validation
  - Show format suggestions for invalid numbers
  - Display clear error messages
  - _Requirements: 7.1, 7.2, 7.4_

## 10. Log Rotation and Cleanup

- [x] 10.1 Implement log rotation for audit logs
  - Add cleanup job for logs older than 30 days
  - Preserve audit logs for deleted campaigns for 90 days
  - _Requirements: 8.3, 8.4_

- [x] 10.2 Implement error log cleanup
  - Add cleanup job for error logs older than 30 days
  - _Requirements: 8.3_

## 11. Final Integration and Testing

- [ ] 11.1 Integration testing
  - Test complete campaign flow with all improvements
  - Test pause/resume with state restoration
  - Test rate limiting behavior
  - Test token validation
  - _Requirements: All_

- [ ] 11.2 Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
