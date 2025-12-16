# Implementation Plan

- [x] 1. Set up database schema and migrations
  - Create `message_variations` table with indexes for tracking variation usage
  - Add `has_variations` column to `message_templates` table
  - Write migration file in `server/migrations/` following existing pattern
  - _Requirements: 3.3, 7.1, 7.2_

- [x] 2. Implement backend variation processing services
- [x] 2.1 Create VariationParser service
  - Write `server/services/VariationParser.js` with parse(), validate(), and calculateCombinations() methods
  - Implement validation rules: minimum 2 variations, no empty blocks, maximum 10 per block
  - Return structured ParsedMessage with blocks, errors, and warnings
  - _Requirements: 1.1, 5.1, 5.2, 5.3_

- [x] 2.2 Create RandomSelector service
  - Write `server/services/RandomSelector.js` with selectVariations() method
  - Use crypto.randomInt() for uniform random distribution
  - Ensure each block gets exactly one selection
  - _Requirements: 1.2, 6.2_

- [x] 2.3 Create TemplateProcessor service
  - Write `server/services/TemplateProcessor.js` with process() and generatePreview() methods
  - Implement processing order: parse variations → select random → replace blocks → apply {{variables}}
  - Return ProcessedMessage with final message and metadata
  - _Requirements: 1.3, 1.5, 3.4, 6.1, 6.3_

- [x] 2.4 Create VariationTracker service
  - Write `server/services/VariationTracker.js` with logVariation(), getStats(), and exportData() methods
  - Implement database logging of selected variations
  - Calculate distribution statistics and percentages
  - _Requirements: 3.3, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 2.5 Write unit tests for backend services
  - Test VariationParser validation rules and edge cases
  - Test RandomSelector distribution uniformity
  - Test TemplateProcessor end-to-end processing with variables
  - Test VariationTracker statistics calculations
  - _Requirements: All backend requirements_

- [x] 3. Create backend API endpoints
- [x] 3.1 Add validation endpoint
  - Create POST `/api/user/messages/validate-variations` in `server/routes/userMessageRoutes.js`
  - Use VariationParser to validate and return structured feedback
  - Return blocks, totalCombinations, errors, and warnings
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3.2 Add preview generation endpoint
  - Create POST `/api/user/messages/preview-variations` in `server/routes/userMessageRoutes.js`
  - Use TemplateProcessor.generatePreview() with variables
  - Return preview message and selected variations
  - _Requirements: 2.3, 2.4_

- [x] 3.3 Add statistics endpoint
  - Create GET `/api/user/campaigns/:campaignId/variation-stats` in `server/routes/userMessageRoutes.js`
  - Use VariationTracker.getStats() to fetch distribution data
  - Include delivery metrics from existing campaign data
  - _Requirements: 7.2, 7.3, 7.5_

- [x] 3.4 Update message send endpoint
  - Modify existing POST `/api/user/messages/send` to process variations
  - Integrate TemplateProcessor before WUZAPI send
  - Call VariationTracker.logVariation() after successful send
  - _Requirements: 1.2, 1.3, 3.3_

- [ ]* 3.5 Write integration tests for API endpoints
  - Test validation endpoint with valid and invalid inputs
  - Test preview generation with variables
  - Test statistics endpoint data accuracy
  - Test message send flow with variations
  - _Requirements: All API requirements_

- [x] 4. Implement frontend variation editor component
- [x] 4.1 Create MessageVariationEditor component
  - Write `src/components/user/MessageVariationEditor.tsx` with inline editing
  - Implement syntax highlighting for variation blocks using regex
  - Add real-time validation with visual feedback (red highlight for errors)
  - Display error tooltips with suggestions
  - _Requirements: 1.1, 2.1, 2.2, 5.1, 5.2, 5.3, 5.4_

- [x] 4.2 Add variation counter and combinations display
  - Calculate and display total possible combinations
  - Show number of blocks and variations per block
  - Update in real-time as user types
  - _Requirements: 2.5_

- [x] 4.3 Integrate validation API calls
  - Call `/api/user/messages/validate-variations` on input change (debounced)
  - Display validation errors and warnings inline
  - Block form submission if validation fails
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Implement frontend preview panel component
- [x] 5.1 Create VariationPreviewPanel component
  - Write `src/components/user/VariationPreviewPanel.tsx` as expandable inline panel
  - Add "Gerar Preview" button to generate new samples
  - Display processed message with highlighted varied parts
  - Show which variations were selected
  - _Requirements: 2.1, 2.3, 2.4_

- [x] 5.2 Integrate preview API calls
  - Call `/api/user/messages/preview-variations` on button click
  - Pass current template and variables
  - Display loading state during generation
  - _Requirements: 2.3, 2.4_

- [x] 6. Integrate variation system with existing message forms
- [x] 6.1 Update single message send form
  - Add MessageVariationEditor to existing message form in `src/components/user/MessageSender.tsx`
  - Add VariationPreviewPanel below editor
  - Maintain existing variable substitution functionality
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3_

- [x] 6.2 Update bulk message dispatcher
  - Integrate MessageVariationEditor into bulk campaign form
  - Ensure variations work with CSV contact data
  - Process each message individually with different variations
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 6.3 Update message template system
  - Add variation indicator to template list items
  - Preserve variations when saving and loading templates
  - Validate variations on template save
  - Set `has_variations` flag in database
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Implement variation statistics and tracking
- [x] 7.1 Create VariationStatsCard component
  - Write `src/components/user/VariationStatsCard.tsx` as inline expandable card
  - Display distribution chart using existing chart library
  - Show percentage and count for each variation
  - Add expand/collapse functionality (no modal)
  - _Requirements: 7.2, 7.3_

- [x] 7.2 Integrate stats into campaign dashboard
  - Add "Variações" tab to existing campaign stats view
  - Fetch data from `/api/user/campaigns/:campaignId/variation-stats`
  - Display VariationStatsCard for each variation block
  - Show delivery metrics alongside variation data
  - _Requirements: 7.2, 7.3, 7.5_

- [x] 7.3 Add export functionality
  - Add "Exportar" button to VariationStatsCard
  - Call VariationTracker.exportData() with format selection (JSON/CSV)
  - Trigger browser download of exported file
  - _Requirements: 7.4_

- [x] 8. Optimize performance for bulk processing
- [x] 8.1 Implement template parsing cache
  - Add LRU cache to VariationParser for parsed templates
  - Set cache TTL to 1 hour with max 1000 entries
  - Measure and log cache hit rate
  - _Requirements: 6.3_

- [x] 8.2 Add async processing for bulk campaigns
  - Integrate variation processing into existing CampaignScheduler queue
  - Process variations asynchronously for each message
  - Maintain existing progress tracking
  - _Requirements: 3.1, 6.4, 6.5_

- [x] 8.3 Optimize database queries
  - Add indexes to `message_variations` table (campaign_id, user_id, sent_at)
  - Implement aggregated statistics caching for large campaigns
  - Batch insert variation logs for bulk sends
  - _Requirements: 6.1, 6.5_

- [ ]* 8.4 Write performance tests
  - Test processing 1000 messages completes in under 10 seconds
  - Verify cache hit rate above 70%
  - Measure statistics query performance for 10k records
  - _Requirements: 6.1, 6.5_

- [ ]* 9. Add end-to-end tests
  - Write Cypress test for complete user flow: edit → preview → send
  - Test variation syntax validation and error display
  - Test preview generation with multiple clicks
  - Test statistics viewing after campaign completion
  - _Requirements: All user-facing requirements_

- [x] 10. Add error handling and user feedback
- [x] 10.1 Implement frontend error display
  - Add toast notifications for API errors
  - Display inline validation errors with suggestions
  - Show loading states during API calls
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 10.2 Implement backend error handling
  - Wrap all variation endpoints in try-catch with Winston logger
  - Return structured error responses with codes
  - Log errors with context (userId, template, error details)
  - _Requirements: All backend requirements_

- [x] 11. Update documentation
  - Add variation syntax guide to user documentation
  - Document API endpoints in `docs/api/`
  - Add examples to `docs/examples/`
  - Update CHANGELOG.md with new feature
  - _Requirements: All requirements_
