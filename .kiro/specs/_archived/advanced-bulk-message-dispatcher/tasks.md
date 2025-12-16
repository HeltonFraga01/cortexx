# Implementation Plan

- [x] 1. Setup database schema and migrations
  - Create migration file for campaigns, campaign_contacts, and campaign_reports tables
  - Add indexes for performance optimization
  - Test migration with sample data
  - _Requirements: 1.5, 4.3, 4.4, 11.1, 13.7_

- [ ] 2. Implement backend services layer
  - [x] 2.1 Create HumanizationEngine service
    - Implement calculateDelay with normal distribution
    - Implement shuffleContacts with Fisher-Yates algorithm
    - Add normalRandom helper using Box-Muller transform
    - _Requirements: 5.4, 6.3_
  
  - [x] 2.2 Create QueueManager service
    - Implement queue initialization and state management
    - Implement start, pause, resume, cancel methods
    - Implement processContact with variable substitution
    - Add progress tracking and persistence
    - Integrate with HumanizationEngine for delays
    - Implement retry logic for temporary failures
    - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 2.3 Create CampaignScheduler service
    - Implement periodic check for scheduled campaigns (every 1 minute)
    - Validate WUZAPI connection before starting campaigns
    - Integrate with QueueManager to start campaigns
    - Add error handling and notifications
    - _Requirements: 4.3, 4.4, 12.4, 12.5_
  
  - [x] 2.4 Create ReportGenerator service
    - Implement generateReport method with statistics calculation
    - Implement error categorization by type
    - Implement exportToCSV method
    - Implement compareCampaigns method
    - _Requirements: 11.2, 11.3, 11.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.8_

- [ ] 3. Implement backend API routes
  - [x] 3.1 Create bulkCampaignRoutes.js
    - POST /api/user/bulk-campaigns - Create campaign
    - GET /api/user/bulk-campaigns/active - List active campaigns
    - GET /api/user/bulk-campaigns/:id/progress - Get progress
    - POST /api/user/bulk-campaigns/:id/pause - Pause campaign
    - POST /api/user/bulk-campaigns/:id/resume - Resume campaign
    - POST /api/user/bulk-campaigns/:id/cancel - Cancel campaign
    - GET /api/user/bulk-campaigns/history - List history with pagination
    - GET /api/user/bulk-campaigns/:id/report - Get report
    - GET /api/user/bulk-campaigns/:id/report/export - Export CSV
    - POST /api/user/bulk-campaigns/compare - Compare campaigns
    - Add authentication middleware to all routes
    - Add input validation for all endpoints
    - _Requirements: 4.1, 4.2, 4.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 11.1, 11.2, 11.3, 11.4, 11.5, 13.5, 13.8_
  
  - [x] 3.2 Create contactImportRoutes.js
    - GET /api/user/contacts/import/wuzapi - Import from WUZAPI
    - POST /api/user/contacts/validate-csv - Validate CSV file
    - POST /api/user/contacts/validate-manual - Validate manual numbers
    - Add file upload handling for CSV
    - Add phone number validation logic
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Implement frontend services
  - [x] 4.1 Create bulkCampaignService.ts
    - Implement API client methods for all campaign endpoints
    - Add error handling and response transformation
    - Add TypeScript interfaces for all data models
    - _Requirements: All requirements (service layer)_
  
  - [x] 4.2 Create contactImportService.ts
    - Implement importFromWuzapi method
    - Implement validateCSV method with file parsing
    - Implement validateManualNumbers method
    - Add CSV parser utility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Implement ContactImporter component
  - Create ContactImporter.tsx with tabs for each import source
  - Implement WUZAPI import tab with contact selection
  - Implement CSV upload tab with validation and preview
  - Implement manual entry tab with number validation
  - Add contact preview table with selection controls
  - Add custom variables detection from CSV
  - Add inline error display for invalid contacts
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Implement CampaignBuilder component
  - Create CampaignBuilder.tsx with inline form
  - Add campaign name input
  - Add message type selector (text/media)
  - Add text message editor with variable insertion
  - Add media configuration (URL, type, caption)
  - Add humanization controls (delay min/max, randomize toggle)
  - Add scheduling controls (date/time picker)
  - Add campaign preview section
  - Add validation for all fields
  - Integrate with ContactImporter for contact selection
  - _Requirements: 4.1, 4.2, 5.1, 5.2, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 7. Implement CampaignProgressMonitor component
  - Create CampaignProgressMonitor.tsx with real-time updates
  - Add progress bar with percentage
  - Add statistics cards (total, sent, pending, failed)
  - Add current contact display
  - Add estimated time remaining
  - Add pause/resume/cancel controls
  - Add error list with expandable details
  - Implement polling mechanism (every 2 seconds)
  - Add visual indicators for campaign status
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Implement CampaignReportViewer component
  - Create CampaignReportViewer.tsx with report display
  - Add campaign summary section
  - Add statistics visualization (charts)
  - Add error breakdown by type
  - Add detailed error list with filters
  - Add export to CSV button
  - Add campaign comparison feature
  - Implement pagination for error list
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [x] 9. Implement BulkDispatcherDashboard component
  - Create BulkDispatcherDashboard.tsx as main container
  - Add tabs for: New Campaign, Active Campaigns, History, Reports
  - Integrate ContactImporter in New Campaign tab
  - Integrate CampaignBuilder in New Campaign tab
  - Integrate CampaignProgressMonitor in Active Campaigns tab
  - Integrate CampaignReportViewer in Reports tab
  - Add campaign history list in History tab
  - Add WUZAPI connection status indicator
  - Add navigation between tabs
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 10. Integrate with existing DisparadorList component
  - Update DisparadorList.tsx to include new bulk dispatcher tab
  - Add "Disparo Avançado" tab alongside existing tabs
  - Ensure backward compatibility with existing functionality
  - Add feature flag to enable/disable advanced dispatcher
  - _Requirements: All requirements (integration)_

- [x] 11. Initialize CampaignScheduler on server startup
  - Update server/index.js to start CampaignScheduler
  - Add graceful shutdown handling for scheduler
  - Add logging for scheduler operations
  - _Requirements: 4.3, 4.4, 12.4_

- [x] 12. Add validation and error handling
  - Add comprehensive input validation on backend
  - Add user-friendly error messages on frontend
  - Implement retry logic in QueueManager
  - Add error recovery strategies
  - Add logging for all errors
  - _Requirements: 12.1, 12.2, 12.3, 12.5_

- [x] 13. Write backend unit tests
  - Test HumanizationEngine delay calculation and randomization
  - Test QueueManager queue processing and state management
  - Test CampaignScheduler scheduling logic
  - Test ReportGenerator report generation and export
  - _Requirements: All requirements (testing)_

- [ ]* 14. Write frontend component tests
  - Test ContactImporter import from all sources
  - Test CampaignBuilder validation and configuration
  - Test CampaignProgressMonitor progress updates
  - Test CampaignReportViewer report display and export
  - _Requirements: All requirements (testing)_

- [ ]* 15. Write integration tests
  - Test complete campaign flow (create → execute → report)
  - Test scheduling flow (create scheduled → auto-execute)
  - Test pause/resume flow
  - Test error handling and recovery
  - _Requirements: All requirements (testing)_

- [ ]* 16. Write E2E tests with Cypress
  - Test creating and executing bulk campaign
  - Test pausing and resuming campaign
  - Test importing contacts from different sources
  - Test viewing reports and exporting CSV
  - _Requirements: All requirements (testing)_

- [ ] 17. Add documentation
  - Update user documentation with new features
  - Add API documentation for new endpoints
  - Add developer guide for extending functionality
  - Add troubleshooting guide
  - _Requirements: All requirements (documentation)_

- [ ] 18. Performance optimization and cleanup
  - Add database indexes for query optimization
  - Implement batch updates for progress tracking
  - Add caching for frequently accessed data
  - Add cleanup job for old campaigns
  - Profile and optimize slow operations
  - _Requirements: All requirements (performance)_
