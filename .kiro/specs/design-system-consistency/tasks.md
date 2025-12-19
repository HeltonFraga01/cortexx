# Implementation Plan: Design System Consistency

## Summary

Este plano de implementação cobre a aplicação consistente do Design System Guide em todo o painel de Superadmin. As tarefas focam em atualizar os componentes existentes para seguir os padrões visuais definidos.

## Current State Analysis

**Componentes a atualizar:**
- `src/pages/superadmin/TenantDetails.tsx` - Stats cards precisam de gradientes
- `src/components/superadmin/TenantManagePanel.tsx` - Já segue parcialmente o design
- `src/components/superadmin/TenantAccountsTab.tsx` - Precisa de ajustes em botões e empty states
- `src/components/superadmin/TenantAgentsTab.tsx` - Precisa de ajustes similares
- `src/components/superadmin/TenantBrandingTab.tsx` - Botões precisam de orange accent
- `src/components/superadmin/TenantPlansTab.tsx` - Precisa de ajustes em cards e botões
- `src/components/superadmin/TenantSettingsTab.tsx` - Já segue o design system

---

## Tasks

- [x] 1. Update TenantDetails page stats cards
  - [x] 1.1 Apply gradient backgrounds to stats cards
    - Add `border-0 bg-gradient-to-br from-{color}-500/10 to-{color}-500/5` to each card
    - Use blue for Accounts, green for MRR, purple for Agents, orange for Inboxes
    - Update icon containers to use `p-3 rounded-xl bg-{color}-500/20`
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Update header styling
    - Ensure tenant icon uses orange gradient with shadow
    - Verify action buttons use correct styling (orange for primary)
    - _Requirements: 1.4, 1.5_

- [x] 2. Update TenantAccountsTab component
  - [x] 2.1 Update button styling
    - Change "Create Account" button to use `bg-orange-500 hover:bg-orange-600 text-white`
    - Update form submit buttons to use orange accent
    - _Requirements: 1.5, 4.2_
  - [x] 2.2 Update empty state styling
    - Ensure empty state follows centered pattern with muted icon
    - Add proper spacing and text styling
    - _Requirements: 3.2_
  - [x] 2.3 Update loading skeleton
    - Verify skeleton uses `animate-pulse` and `bg-muted` classes
    - _Requirements: 3.3_

- [x] 3. Update TenantAgentsTab component
  - [x] 3.1 Update button styling
    - Change "Create Agent" button to use orange accent
    - Update form submit buttons
    - _Requirements: 1.5, 4.2_
  - [x] 3.2 Update empty state and loading skeleton
    - Apply consistent empty state pattern
    - Verify loading skeleton styling
    - _Requirements: 3.2, 3.3_

- [x] 4. Update TenantBrandingTab component
  - [x] 4.1 Update button styling
    - Change "Save Changes" button to use orange accent
    - Keep "Reset" button as outline variant
    - _Requirements: 1.5, 4.2_
  - [x] 4.2 Update form card styling
    - Ensure proper spacing with `space-y-4` or `space-y-6`
    - Verify label styling uses `text-sm font-medium`
    - _Requirements: 4.1, 4.4_

- [x] 5. Update TenantPlansTab component
  - [x] 5.1 Update button styling
    - Change "Create Plan" button to use orange accent
    - Update form submit buttons
    - _Requirements: 1.5, 4.2_
  - [x] 5.2 Update plan cards styling
    - Apply gradient backgrounds to plan cards if applicable
    - Update status badges to use semantic colors
    - _Requirements: 5.1_
  - [x] 5.3 Update empty state and loading skeleton
    - Apply consistent patterns
    - _Requirements: 3.2, 3.3_

- [x] 6. Verify TenantManagePanel styling
  - [x] 6.1 Verify tabs styling
    - Confirm TabsList uses `bg-muted/50 p-1 rounded-xl` ✓
    - Confirm active tabs use `data-[state=active]:bg-orange-500` ✓
    - _Requirements: 2.1, 2.2_
  - [x] 6.2 Verify header styling
    - Confirm tenant icon uses orange gradient ✓
    - Confirm status badge uses semantic colors ✓
    - _Requirements: 1.4, 5.1_

- [x] 7. Verify TenantSettingsTab styling
  - [x] 7.1 Verify stats cards
    - Confirm gradient backgrounds are applied correctly ✓
    - Confirm icon containers follow pattern ✓
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 7.2 Verify export button styling
    - Confirm uses orange accent ✓
    - _Requirements: 1.5_

- [x] 8. Update page-level spacing
  - [x] 8.1 Verify consistent spacing
    - Ensure all pages use `space-y-6` between major sections ✓
    - Verify grid layouts use responsive breakpoints ✓
    - _Requirements: 6.1, 6.3_

- [x] 9. Checkpoint - Visual verification
  - Test all pages in light and dark mode
  - Verify all stats cards have gradients
  - Verify all primary buttons are orange
  - Verify all empty states are centered
  - Verify all loading skeletons animate
  - Ask the user if questions arise.

- [x] 10. Build and deploy
  - [x] 10.1 Build frontend
    - Run `npm run build` to compile changes ✓
    - _Requirements: All_
  - [x] 10.2 Verify no regressions
    - Check for TypeScript errors ✓
    - Check for styling issues ✓
    - _Requirements: All_

## Notes

- Tasks focus on CSS class updates, no logic changes required
- TenantSettingsTab already follows most design patterns
- TenantManagePanel already has correct tab styling
- Main focus is on TenantDetails stats cards and button colors across all tabs
