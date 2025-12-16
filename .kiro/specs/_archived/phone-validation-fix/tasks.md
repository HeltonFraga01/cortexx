# Implementation Plan

- [x] 1. Add extractPhoneFromWebhook function to phoneUtils
  - Create new function to extract phone from webhook events
  - Handle @lid suffix by using SenderAlt field
  - Handle normal chats by using Chat field
  - Normalize extracted number
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]* 1.1 Write property test for extractPhoneFromWebhook
  - **Property 7: JID Extraction with LID Handling**
  - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 2. Add normalization to QueueManager
  - Import normalizePhoneNumber in QueueManager.js
  - Normalize phone before creating WUZAPI payload
  - Add logging to track normalization
  - Handle all message types (text, image, video, document)
  - _Requirements: 2.1, 2.2, 5.1, 5.2_

- [ ]* 2.1 Write property test for QueueManager normalization
  - **Property 2: Normalization Consistency**
  - **Validates: Requirements 1.3, 1.4, 1.5**

- [x] 3. Add normalization to CampaignScheduler
  - Normalize phones when loading contacts from database
  - Ensure QueueManager receives normalized numbers
  - Add validation before starting campaign
  - _Requirements: 2.1, 3.5_

- [x] 4. Add normalization to Chat Routes
  - Import normalizePhoneNumber in chatRoutes.js
  - Normalize phone before sending to WUZAPI for text messages
  - Normalize phone before sending to WUZAPI for image messages
  - Add validation and error handling
  - _Requirements: 2.1, 5.1, 5.2, 5.3_

- [ ]* 4.1 Write property test for chat routes normalization
  - **Property 3: Numeric-Only Output**
  - **Validates: Requirements 1.2, 5.1, 5.2, 5.3**

- [x] 5. Create database migration script
  - Create script to normalize existing phone numbers
  - Update all phone numbers in contacts table
  - Update all phone numbers in campaign_contacts table
  - Add logging to track migration progress
  - Verify data integrity after migration
  - _Requirements: 2.3_

- [x] 6. Add webhook phone extraction
  - Use extractPhoneFromWebhook in webhook routes
  - Handle @s.whatsapp.net (chat individual) - usar Chat
  - Handle @g.us (grupo) - usar Sender
  - Handle @lid (linked device) - resolver via API /user/lid
  - Normalize extracted numbers
  - Add error handling for missing fields
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6.1 Add resolveLidToPhone function
  - Create function to call GET /user/lid/{phone}
  - Extract JID from response and convert to phone number
  - Add caching for LID resolutions
  - Handle API errors gracefully
  - _Requirements: 4.3, 4.6_

- [x] 6.2 Write property test for webhook extraction
  - **Property 7: JID Extraction with LID Handling**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Add remaining property-based tests
  - Install fast-check library if not present
  - Create test generators (validBrazilianPhoneGenerator, etc)
  - Implement Property 1: Suffix Removal Idempotence
  - Implement Property 4: DDD Zero Removal
  - Implement Property 5: Normalization Preservation
  - Implement Property 6: Validation Rejection
  - Implement Property 8: Round-Trip Display Format
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

- [x] 9. Add unit tests for edge cases
  - Test empty phone number
  - Test phone with only special characters
  - Test phone with invalid DDD (01, 00, 100)
  - Test phone with wrong length
  - Test phone with 9 digits not starting with 9
  - Test phone with multiple @ symbols
  - Test webhook with missing Info field
  - Test webhook with missing Chat and SenderAlt
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.5_

- [x] 10. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
