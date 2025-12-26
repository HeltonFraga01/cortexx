# Implementation Plan: Toast API Compatibility Fix

## Overview

This plan implements a compatibility wrapper for the toast system that allows both legacy `toast({ title, description })` and native sonner `toast.success()` API formats to work simultaneously, fixing the React rendering error.

## Tasks

- [x] 1. Create the compatibility wrapper
  - [x] 1.1 Update `src/hooks/use-toast.ts` with compatibility wrapper implementation
    - Define `LegacyToastOptions` interface
    - Implement `formatMessage()` helper function
    - Implement `getDefaultDuration()` helper function
    - Create `createCompatibleToast()` factory function
    - Export wrapped toast and useToast hook
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 1.2 Remove duplicate `src/components/ui/use-toast.ts` and update imports
    - Delete `src/components/ui/use-toast.ts`
    - Update any imports pointing to `@/components/ui/use-toast` to use `@/hooks/use-toast`
    - _Requirements: 2.3_

- [x] 2. Checkpoint - Verify toast functionality
  - Ensure the application loads without the React rendering error
  - Test a few toast calls manually to verify both formats work
  - Ask the user if questions arise

- [ ]* 3. Add property-based tests
  - [ ]* 3.1 Write property test for message formatting
    - **Property 1: Message Formatting Consistency**
    - **Validates: Requirements 1.1, 1.4, 1.5**

  - [ ]* 3.2 Write property test for variant mapping
    - **Property 2: Variant Mapping Correctness**
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 3.3 Write property test for native API passthrough
    - **Property 3: Native API Passthrough**
    - **Validates: Requirements 1.6, 2.2**

  - [ ]* 3.4 Write property test for duration configuration
    - **Property 4: Duration Configuration**
    - **Validates: Requirements 3.1, 3.3**

- [x] 4. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The core fix (task 1) should immediately resolve the React rendering error
- Property tests validate the wrapper behaves correctly across all input combinations
