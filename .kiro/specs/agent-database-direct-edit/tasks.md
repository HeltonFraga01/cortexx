# Implementation Plan

## Overview

Esta implementação modifica o componente `AgentLayout.tsx` para adicionar navegação direta para a página de edição quando há apenas um registro associado ao agente, replicando o comportamento do `DynamicDatabaseItems` do dashboard do usuário.

## Tasks

- [x] 1. Analyze existing implementation
  - [x] 1.1 Review DynamicDatabaseItems component to understand the existing navigation logic
    - Locate and analyze `src/components/user/DynamicDatabaseItems.tsx`
    - Document the navigation decision logic and error handling patterns
    - _Requirements: 3.1, 3.2_
  - [x] 1.2 Review AgentLayout component to understand current database menu implementation
    - Locate and analyze `src/components/agent/AgentLayout.tsx`
    - Identify where database items are rendered in the sidebar
    - _Requirements: 1.1, 1.2_

- [x] 2. Implement navigation logic in AgentLayout
  - [x] 2.1 Add loading state management for database items
    - Add `loadingId` state to track which database item is loading
    - Implement guard against multiple clicks during loading
    - _Requirements: 1.4, 2.1_
  - [x] 2.2 Implement handleDatabaseClick handler
    - Fetch records using `getAgentDatabaseData`
    - Implement navigation decision based on record count (0, 1, N)
    - Navigate to edit page for single record, listing for multiple
    - _Requirements: 1.1, 1.2, 1.3, 3.1_
  - [x] 2.3 Update database menu item rendering
    - Show spinner when item is loading
    - Disable all items during loading
    - Replace direct navigation with click handler
    - _Requirements: 1.4, 2.1, 2.2_
  - [x] 2.4 Implement error handling with toast notifications
    - Handle zero records case with error toast
    - Handle API errors with appropriate messages
    - Ensure loading state is reset on error
    - _Requirements: 1.3, 2.3, 3.2_
  - [ ]* 2.5 Write property test for navigation decision
    - **Property 1: Navigation Decision Based on Record Count**
    - **Validates: Requirements 1.1, 1.2, 1.3, 3.1**
  - [ ]* 2.6 Write property test for loading state lifecycle
    - **Property 2: Loading State Lifecycle and Item Disabled State**
    - **Validates: Requirements 1.4, 2.1, 2.2**
  - [ ]* 2.7 Write property test for error handling
    - **Property 3: Error Handling Consistency**
    - **Validates: Requirements 2.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 4. Write unit tests for AgentLayout database navigation
  - [ ]* 4.1 Test rendering of database items with loading state
    - Verify spinner appears when loadingId matches connection id
    - Verify items are disabled during loading
    - _Requirements: 1.4, 2.1_
  - [ ]* 4.2 Test navigation behavior
    - Test navigation to edit page with single record
    - Test navigation to listing with multiple records
    - Test no navigation with zero records
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ]* 4.3 Test error handling
    - Test toast notification on API error
    - Test loading state reset on error
    - _Requirements: 2.3_

- [x] 5. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
