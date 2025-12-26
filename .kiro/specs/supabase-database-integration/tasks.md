# Implementation Plan: Supabase Database Integration

## Overview

This implementation adds native Supabase support to the Database Navigation system, following the established patterns for NocoDB while leveraging Supabase's unique capabilities.

## Tasks

- [x] 1. Phase 1 - Foundation
  - [x] 1.1 Create database migration to add Supabase fields to database_connections table
    - Add supabase_url, supabase_key, supabase_key_type, supabase_table columns
    - Update type column constraint to include 'SUPABASE'
    - _Requirements: 1.1, 1.6_
  - [x] 1.2 Create Supabase validators
    - validateSupabaseUrl, validateSupabaseKey, validateSupabaseKeyType, validateSupabaseConnection
    - _Requirements: 7.3_
  - [x] 1.3 Create TypeScript types for Supabase integration
    - SupabaseTable, SupabaseColumn, SupabaseKeyType interfaces
    - _Requirements: 2.2, 3.1, 3.2_

- [x] 2. Phase 2 - Backend Core
  - [x] 2.1 Create SupabaseConnectionService
    - createClient, listTables, getTableColumns, fetchRecords, createRecord, updateRecord, deleteRecord, testConnection
    - _Requirements: 6.1, 6.3, 6.4, 6.5_
  - [x] 2.2 Create PostgreSQL type mapping utilities
    - Map PostgreSQL types to UI input types
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - [x] 2.3 Create error handling and circuit breaker utilities
    - Error translation, retry logic, circuit breaker pattern
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 3. Phase 3 - API Layer
  - [x] 3.1 Extend database routes for Supabase operations
    - POST test-supabase, GET tables, GET columns endpoints
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 3.2 Extend user routes for Supabase data operations
    - CRUD operations with user filter and pagination
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 3.3 Implement credential security
    - API key masking, encryption, audit logging
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 4. Phase 4 - Frontend
  - [x] 4.1 Extend frontend database connections service
    - testSupabaseConnection, getSupabaseTables, getSupabaseColumns methods
    - _Requirements: 1.2, 1.3, 2.1_
  - [x] 4.2 Extend DatabaseConnectionForm for Supabase
    - Supabase configuration section, table/column selectors, loading states
    - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [ ] 5. Phase 5 - Quality
  - [ ] 5.1 Write unit tests for Supabase functionality
    - Test validators, type mapping, error handling
    - _Requirements: All_
  - [ ] 5.2 Write integration tests
    - Test connection flow, CRUD operations, error scenarios
    - _Requirements: All_
  - [ ] 5.3 Create documentation
    - Document setup process, permissions, error codes
    - _Requirements: All_

- [x] 6. Phase 6 - NocoDB Connection Testing Fix
  - [x] 6.1 Create NocoDBConnectionService backend service
    - Server-side connection testing to avoid CORS issues
    - Error handling with Portuguese messages
    - Support for testing credentials before saving
  - [x] 6.2 Add NocoDB test endpoints to databaseRoutes
    - POST /:id/test-nocodb - Test existing connection
    - POST /test-nocodb-credentials - Test credentials before saving
    - Updated POST /:id/test to support both NocoDB and Supabase
  - [x] 6.3 Update frontend database-connections service
    - Changed testNocoDBConnection to use backend endpoint
    - Added testNocoDBCredentials method
    - Updated testAndUpdateConnectionStatus to use backend for NocoDB

## Notes

- Follow existing patterns from NocoDB integration
- Use CommonJS for backend, ES modules for frontend
- All error messages in Portuguese
- Property tests use fast-check library
