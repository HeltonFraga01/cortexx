# Implementation Plan

- [x] 1. Create core types and utilities for field type resolution
  - Create `FieldType` enum and related interfaces in `src/lib/types.ts`
  - Implement `FieldTypeResolver` utility class in `src/utils/fieldTypeResolver.ts` with methods to map NocoDB types to internal types and extract select options
  - Add validation helper functions for email, phone, URL formats
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 2. Implement specialized input components
- [x] 2.1 Create NumberInput component
  - Implement `src/components/ui-custom/NumberInput.tsx` with support for integers and decimals
  - Add numeric validation and formatting
  - Support for currency and percent display modes
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 2.2 Create DateTimePicker component
  - Implement `src/components/ui-custom/DateTimePicker.tsx` combining date and time selection
  - Use shadcn/ui Calendar component with time input
  - Handle ISO datetime string formatting
  - _Requirements: 1.7, 1.8, 3.1, 3.2_

- [x] 2.3 Create TimePicker component
  - Implement `src/components/ui-custom/TimePicker.tsx` for time-only selection
  - Support hour and minute selection with AM/PM or 24h format
  - _Requirements: 3.3, 3.4_

- [x] 2.4 Create MultiSelectInput component
  - Implement `src/components/ui-custom/MultiSelectInput.tsx` with checkbox dropdown
  - Use shadcn/ui Popover and Checkbox components
  - Handle array of selected values
  - Display selected items as badges
  - _Requirements: 1.4, 1.5_

- [x] 2.5 Create EmailInput component
  - Implement `src/components/ui-custom/EmailInput.tsx` with email validation
  - Show validation feedback inline
  - Support autocomplete for email
  - _Requirements: 3.5_

- [x] 2.6 Create PhoneInput component
  - Implement `src/components/ui-custom/PhoneInput.tsx` with phone number formatting
  - Support Brazilian phone format (optional: international formats)
  - Validate phone number structure
  - _Requirements: 3.6_

- [x] 2.7 Create UrlInput component
  - Implement `src/components/ui-custom/UrlInput.tsx` with URL validation
  - Auto-add https:// protocol if missing
  - Validate URL structure
  - _Requirements: 3.7_

- [x] 3. Create TypeAwareFieldInput orchestrator component
  - Implement `src/components/user/TypeAwareFieldInput.tsx` that receives field metadata and renders appropriate input
  - Add switch statement to route to correct input component based on field type
  - Handle value formatting and parsing for each type
  - Implement common props interface for all input types
  - Add error display and helper text support
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Enhance RecordForm component with metadata fetching
- [x] 4.1 Add metadata state and fetching logic
  - Add state for `fieldMetadata`, `metadataLoading`, `metadataError` in RecordForm
  - Implement `fetchFieldMetadata` function that calls `databaseConnectionsService.getNocoDBColumns()`
  - Add useEffect to fetch metadata on component mount for NocoDB connections
  - Implement caching logic using connectionCache with 10-minute TTL
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.2 Merge metadata with existing FieldMapping
  - Implement `mergeFieldConfiguration` function to combine NocoDB metadata with FieldMapping settings
  - Preserve custom labels, visibility, editability from FieldMapping
  - Add field ordering based on displayOrder
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 4.3 Implement fallback for metadata fetch failures
  - Add error handling in fetchFieldMetadata with try-catch
  - Create `createFallbackMetadata` function that generates text-only field metadata from FieldMapping
  - Display user-friendly error message when metadata fetch fails
  - Ensure form remains functional with text inputs as fallback
  - _Requirements: 4.4_

- [x] 4.4 Update RecordForm render logic
  - Replace existing Input components with TypeAwareFieldInput
  - Pass field metadata, value, onChange, validation to TypeAwareFieldInput
  - Maintain existing validation and change tracking logic
  - Keep loading skeleton and changes summary sections
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 5. Enhance field validation logic
- [x] 5.1 Implement type-specific validation functions
  - Create validation functions for email, phone, URL, number, date formats
  - Add validation for single-select and multi-select against available options
  - Implement required field validation
  - _Requirements: 5.1, 5.2_

- [x] 5.2 Update validateField method in RecordForm
  - Enhance existing validateField to use type-specific validators
  - Add user-friendly error messages for each validation type
  - Implement validation on blur and before submission
  - _Requirements: 5.1, 5.2_

- [x] 5.3 Add pre-submission validation
  - Implement validateAllFields function that checks all editable fields
  - Prevent form submission if any field has validation errors
  - Focus first invalid field on validation failure
  - Display summary of validation errors
  - _Requirements: 5.2, 5.3_

- [x] 6. Update database-connections service for metadata caching
  - Add cache key generation for field metadata: `field-metadata:${connectionId}:${tableId}`
  - Implement cache get/set in getUserRecord and related methods
  - Add cache invalidation when connection configuration changes
  - Set cache TTL to 10 minutes (600000ms)
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 7. Handle value formatting for submission
  - Implement value serialization for each field type before API submission
  - Convert dates to ISO strings
  - Ensure multi-select values are arrays
  - Format numbers with proper precision
  - Sanitize text inputs
  - _Requirements: 5.3, 5.4_

- [x] 8. Add accessibility features
  - Add proper ARIA labels to all new input components
  - Implement keyboard navigation for select and multi-select
  - Add aria-invalid and aria-required attributes
  - Ensure focus management for validation errors
  - Test with screen readers
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 9. Update backend validation (if needed)
  - Review backend validation in `server/routes/userRoutes.js` for user record updates
  - Ensure backend validates field types and constraints
  - Add proper error messages for type mismatches
  - Test with various invalid inputs
  - _Requirements: 5.4_

- [x] 10. Add error handling and user feedback
  - Implement toast notifications for metadata fetch errors
  - Add inline error messages for field validation
  - Display loading states during metadata fetch
  - Show fallback message when using text-only inputs
  - _Requirements: 4.4, 5.2, 5.4_

- [x] 11. Implement performance optimizations
  - Add debouncing to validation on input change (300ms)
  - Implement lazy loading of metadata (only when RecordForm renders)
  - Optimize re-renders with useMemo and useCallback
  - Add request deduplication for concurrent metadata fetches
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 12. Add backward compatibility layer
  - Implement feature flag `ENABLE_TYPE_AWARE_INPUTS` for gradual rollout
  - Create fallback to text inputs for non-NocoDB connections
  - Ensure existing FieldMapping configuration continues to work
  - Test with connections that don't have metadata
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13. Write unit tests for new components
  - Write tests for FieldTypeResolver utility
  - Write tests for each specialized input component (NumberInput, DateTimePicker, etc.)
  - Write tests for TypeAwareFieldInput component
  - Write tests for validation functions
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 14. Write integration tests for RecordForm
  - Write tests for metadata fetching and caching
  - Write tests for field rendering based on types
  - Write tests for validation flow
  - Write tests for fallback behavior
  - Write tests for backward compatibility
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ]*  15. Write E2E tests for user workflows
  - Write Cypress test for editing record with date picker
  - Write Cypress test for editing record with single select
  - Write Cypress test for editing record with multi select
  - Write Cypress test for validation errors
  - Write Cypress test for successful record save
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x]  16. Update documentation
  - Update `docs/USER_DATABASE_NAVIGATION_GUIDE.md` with new field types
  - Add screenshots of new input components
  - Document validation rules for each field type
  - Add troubleshooting section for metadata fetch issues
  - _Requirements: All_
