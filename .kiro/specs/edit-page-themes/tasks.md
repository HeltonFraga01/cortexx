# Implementation Plan

- [x] 1. Create type definitions and interfaces
  - [x] 1.1 Create EditTheme types and interfaces
    - Create `src/types/edit-themes.ts` with EditThemeProps, EditTheme, and EditThemeConfig interfaces
    - Export types from `src/types/index.ts`
    - _Requirements: 4.1, 4.2_
  - [x] 1.2 Extend ViewConfiguration interface
    - Add `editTheme?: EditThemeConfig` to ViewConfiguration in `src/lib/types.ts`
    - _Requirements: 1.2_
  - [ ]* 1.3 Write property test for Configuration Round-Trip
    - **Property 5: Configuration Persistence Round-Trip**
    - **Validates: Requirements 1.2, 1.4**

- [x] 2. Implement ThemeRegistry
  - [x] 2.1 Create ThemeRegistry class
    - Create `src/components/features/edit-themes/ThemeRegistry.ts`
    - Implement register, unregister, get, getDefault, list, has methods
    - Export singleton instance
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 2.2 Write property test for Theme Registry Consistency
    - **Property 1: Theme Registry Consistency**
    - **Validates: Requirements 2.1, 2.2**
  - [ ]* 2.3 Write property test for Default Theme Fallback
    - **Property 2: Default Theme Fallback**
    - **Validates: Requirements 1.3, 2.3, 3.3, 3.4**
  - [ ]* 2.4 Write property test for Theme Interface Validation
    - **Property 3: Theme Interface Validation**
    - **Validates: Requirements 2.2, 4.1, 4.3**
  - [ ]* 2.5 Write property test for Theme List Completeness
    - **Property 6: Theme List Completeness**
    - **Validates: Requirements 2.4, 5.1**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create DefaultTheme component
  - [x] 4.1 Extract current DirectEditPage logic into DefaultTheme
    - Create `src/components/features/edit-themes/themes/DefaultTheme.tsx`
    - Refactor to accept EditThemeProps
    - Maintain all existing functionality
    - _Requirements: 3.3, 6.1, 6.2, 6.3, 6.4_
  - [x] 4.2 Register DefaultTheme in ThemeRegistry
    - Create `src/components/features/edit-themes/themes/index.ts`
    - Register DefaultTheme as the default theme
    - _Requirements: 2.1_
  - [ ]* 4.3 Write unit tests for DefaultTheme
    - Test rendering with valid props
    - Test field changes trigger onRecordChange
    - Test save button triggers onSave
    - _Requirements: 6.1, 6.2_

- [x] 5. Create ThemeLoader component
  - [x] 5.1 Implement ThemeLoader with error boundary
    - Create `src/components/features/edit-themes/ThemeLoader.tsx`
    - Load theme based on connection's viewConfiguration
    - Implement fallback to DefaultTheme on error
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 5.2 Write property test for Theme Props Completeness
    - **Property 4: Theme Props Completeness**
    - **Validates: Requirements 4.2**
  - [ ]* 5.3 Write unit tests for ThemeLoader
    - Test loading configured theme
    - Test fallback to default when no theme configured
    - Test error boundary catches theme errors
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Refactor DirectEditPage to use ThemeLoader
  - [x] 6.1 Update DirectEditPage to use ThemeLoader
    - Replace inline form rendering with ThemeLoader
    - Pass all required props to ThemeLoader
    - Maintain loading and error states
    - _Requirements: 3.1, 3.2, 6.3, 6.4_
  - [ ]* 6.2 Write property test for Save Logic Consistency
    - **Property 7: Save Logic Consistency**
    - **Validates: Requirements 6.1, 6.2**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Create EditThemeSelector component
  - [x] 8.1 Implement EditThemeSelector UI
    - Create `src/components/features/edit-themes/EditThemeSelector.tsx`
    - Display available themes with previews
    - Handle theme selection
    - Show description on hover
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 8.2 Write unit tests for EditThemeSelector
    - Test theme list display
    - Test selection updates config
    - Test preview display
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 9. Integrate EditThemeSelector into ViewConfigurationSection
  - [x] 9.1 Add EditThemeSelector to ViewConfigurationSection
    - Update `src/components/admin/ViewConfigurationSection.tsx`
    - Add "Tema de Edição" section
    - Wire up theme selection to viewConfiguration state
    - _Requirements: 1.1, 1.2, 1.4_
  - [ ]* 9.2 Write unit tests for ViewConfigurationSection integration
    - Test theme section is displayed
    - Test theme selection persists to viewConfiguration
    - _Requirements: 1.1, 1.2_

- [x] 10. Create additional theme: ProfileCardTheme
  - [x] 10.1 Implement ProfileCardTheme
    - Create `src/components/features/edit-themes/themes/ProfileCardTheme.tsx`
    - Card-based layout with avatar support
    - Register in ThemeRegistry
    - _Requirements: 4.4_
  - [x] 10.2 Add preview image for ProfileCardTheme
    - Create preview image in `public/theme-previews/profile-card.png`
    - _Requirements: 5.1_

- [x] 11. Create additional theme: SectionsTheme
  - [x] 11.1 Implement SectionsTheme
    - Create `src/components/features/edit-themes/themes/SectionsTheme.tsx`
    - Grouped sections layout
    - Register in ThemeRegistry
    - _Requirements: 4.4_
  - [x] 11.2 Add preview image for SectionsTheme
    - Create preview image in `public/theme-previews/sections.png`
    - _Requirements: 5.1_

- [x] 12. Update backend validation
  - [x] 12.1 Update viewConfigurationValidator
    - Update `server/validators/viewConfigurationValidator.js`
    - Add validation for editTheme configuration
    - _Requirements: 1.2, 1.4_
  - [ ]* 12.2 Write unit tests for validator
    - Test valid editTheme configurations
    - Test invalid configurations are rejected
    - _Requirements: 1.2_

- [x] 13. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

