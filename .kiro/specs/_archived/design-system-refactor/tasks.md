# Implementation Plan

- [x] 1. Update CSS variables and global styles
  - [x] 1.1 Update src/index.css with new color palette for light and dark modes
    - Add sidebar-specific CSS variables
    - Update ring color to orange for dark mode
    - Add scrollbar custom styles
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4_
  - [x] 1.2 Verify theme transitions work smoothly
    - Test light/dark mode switching
    - _Requirements: 4.3, 4.4_

- [x] 2. Create GradientCard component
  - [x] 2.1 Create src/components/ui-custom/GradientCard.tsx
    - Implement GRADIENT_CLASSES mapping for all variants
    - Export GradientCardProps interface
    - Use cn() for class merging
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ]* 2.2 Write property test for GradientCard variant mapping
    - **Property 1: Gradient variant class mapping**
    - **Validates: Requirements 2.1, 2.2, 8.2**

- [x] 3. Create StatsCard component
  - [x] 3.1 Create src/components/ui-custom/StatsCard.tsx
    - Use GradientCard as base
    - Implement icon container with variant colors
    - Display title, value, and optional trend
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]* 3.2 Write property test for StatsCard structure
    - **Property 2: Stats card structure**
    - **Validates: Requirements 2.3**

- [x] 4. Create ListItem component
  - [x] 4.1 Create src/components/ui-custom/ListItem.tsx
    - Implement icon, content area, badge, and value sections
    - Add hover state with transition
    - Implement valueVariant coloring (positive/negative/neutral)
    - _Requirements: 3.1, 3.3, 3.4_
  - [ ]* 4.2 Write property tests for ListItem
    - **Property 5: List item badge rendering**
    - **Property 6: List item value coloring**
    - **Property 7: List item structure**
    - **Validates: Requirements 3.1, 3.3, 3.4**

- [x] 5. Create EmptyState component
  - [x] 5.1 Create src/components/ui-custom/EmptyState.tsx
    - Implement centered layout with icon, title, description
    - Add optional action button
    - Apply opacity-20 to icon
    - _Requirements: 7.1, 7.4_
  - [ ]* 5.2 Write property test for EmptyState rendering
    - **Property 9: Empty state rendering**
    - **Validates: Requirements 7.1, 7.4**

- [x] 6. Create CardHeader component with icon support
  - [x] 6.1 Create src/components/ui-custom/CardHeaderWithIcon.tsx
    - Implement flex layout with icon, title, action button
    - Style action button as ghost with orange text
    - Apply consistent padding
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 6.2 Write property test for CardHeader structure
    - **Property 8: Card header structure**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 7. Create LoadingSkeleton component
  - [x] 7.1 Create src/components/ui-custom/LoadingSkeleton.tsx
    - Implement skeleton with animate-pulse
    - Create variants for card, list item, stats
    - _Requirements: 7.2, 7.3_
  - [ ]* 7.2 Write property test for skeleton animation
    - **Property 10: Skeleton loading animation**
    - **Validates: Requirements 7.2, 7.3**

- [x] 8. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Refactor AdminLayout sidebar
  - [x] 9.1 Update src/components/admin/AdminLayout.tsx
    - Add logo area with orange gradient background
    - Update navigation item active state to orange classes
    - Apply consistent spacing (px-3 py-2 rounded-lg)
    - Update hover states
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ]* 9.2 Write property tests for navigation item states
    - **Property 3: Navigation item active state**
    - **Property 4: Navigation item consistent styling**
    - **Validates: Requirements 1.2, 1.4**

- [x] 10. Refactor UserLayout sidebar
  - [x] 10.1 Update src/components/user/UserLayout.tsx
    - Apply same sidebar styling as AdminLayout
    - Add logo area with orange gradient background
    - Update navigation item active state to orange classes
    - Apply consistent spacing
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 11. Update AdminOverview dashboard
  - [x] 11.1 Refactor src/components/admin/AdminOverview.tsx
    - Replace existing stats cards with StatsCard component
    - Use appropriate color variants (green, blue, orange, purple)
    - Apply responsive grid layout
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 12. Update UserOverview dashboard
  - [x] 12.1 Refactor src/components/user/UserOverview.tsx
    - Replace existing stats cards with StatsCard component
    - Use CardHeaderWithIcon for card headers
    - Apply ListItem component for list displays
    - Add EmptyState for empty data scenarios
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 6.1, 7.1_

- [x] 13. Create component exports index
  - [x] 13.1 Create src/components/ui-custom/index.ts
    - Export all new components from central location
    - _Requirements: 8.4_

- [ ] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
