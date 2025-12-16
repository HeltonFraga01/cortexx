# Implementation Plan

- [x] 1. Create database migration for support_phone column
  - Create `server/migrations/018_add_support_phone.js`
  - Add `support_phone TEXT DEFAULT NULL` column to branding_config table
  - Follow existing migration patterns (002-017)
  - _Requirements: 3.1_

- [x] 2. Update backend database layer
  - [x] 2.1 Update getBrandingConfig to include supportPhone field
    - Modify SQL query in `server/database.js` to select support_phone
    - Map snake_case to camelCase in response object
    - _Requirements: 3.2_
  - [x] 2.2 Update updateBrandingConfig to handle supportPhone
    - Add supportPhone to merge logic and SQL UPDATE statement
    - _Requirements: 1.3, 3.3_
  - [x] 2.3 Add phone validation function
    - Create validateSupportPhone in database.js or validators
    - Validate: only digits, 10-15 characters
    - _Requirements: 1.2, 1.5_
  - [ ]* 2.4 Write property test for phone validation
    - **Property 1: Phone number validation accepts only valid formats**
    - **Validates: Requirements 1.2, 1.5**

- [x] 3. Update branding routes
  - [x] 3.1 Update PUT /api/branding to accept supportPhone
    - Add supportPhone to request body handling
    - Apply validation before saving
    - _Requirements: 1.2, 1.3_
  - [x] 3.2 Update GET /api/branding/public to include supportPhone
    - Add supportPhone to publicBrandingData response
    - _Requirements: 3.4_
  - [ ]* 3.3 Write property test for persistence round-trip
    - **Property 2: Support phone persistence round-trip**
    - **Validates: Requirements 1.3**

- [x] 4. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update frontend types
  - [x] 5.1 Update BrandingConfig interface in src/types/branding.ts
    - Add `supportPhone: string | null` field
    - Update BrandingConfigUpdate interface
    - _Requirements: 3.2_

- [x] 6. Update BrandingSettings component
  - [x] 6.1 Add supportPhone to form state
    - Add field to FormData interface
    - Add to lastSavedConfig tracking
    - Sync with config on load
    - _Requirements: 1.1_
  - [x] 6.2 Add phone input field to UI
    - Add Input component with phone icon
    - Add validation error display
    - Add helper text explaining format
    - _Requirements: 1.1, 1.2_
  - [x] 6.3 Add frontend validation
    - Validate format on change/blur
    - Display error for invalid formats
    - Allow empty value (to disable button)
    - _Requirements: 1.2, 1.5_
  - [x] 6.4 Include supportPhone in save payload
    - Add to BrandingConfigUpdate object in handleSave
    - _Requirements: 1.3_

- [x] 7. Create SupportButton component
  - [x] 7.1 Create component file
    - Create `src/components/shared/SupportButton.tsx`
    - Accept phoneNumber prop
    - Render fixed-position button (bottom-right)
    - _Requirements: 2.1, 2.4, 2.5_
  - [x] 7.2 Implement WhatsApp link generation
    - Generate URL: `https://wa.me/{phoneNumber}`
    - Open in new tab on click
    - _Requirements: 2.2_
  - [x] 7.3 Style button to match reference
    - Green background (#25D366)
    - WhatsApp icon (MessageCircle from lucide-react)
    - Text "Suporte"
    - Rounded corners, shadow
    - _Requirements: 2.1, 2.5_
  - [ ]* 7.4 Write property test for URL generation
    - **Property 3: WhatsApp URL generation**
    - **Validates: Requirements 2.2**

- [x] 8. Integrate SupportButton globally
  - [x] 8.1 Add SupportButton to App.tsx or layout
    - Import from BrandingContext
    - Conditionally render when supportPhone is set
    - _Requirements: 2.1, 2.3_
  - [x] 8.2 Handle null/empty supportPhone
    - Hide button when supportPhone is null or empty
    - _Requirements: 1.4, 2.3_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 10. Write integration tests
  - [ ]* 10.1 Test admin flow: save phone → button appears
    - _Requirements: 1.3, 2.1_
  - [ ]* 10.2 Test admin flow: clear phone → button disappears
    - _Requirements: 1.4, 2.3_

- [ ] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
