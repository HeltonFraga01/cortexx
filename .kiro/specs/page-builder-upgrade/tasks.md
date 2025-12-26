# Implementation Tasks

## Task 1: Setup Puck Library and Base Structure

**Requirements:** REQ-1 (Integração da Biblioteca Puck)

### Subtasks:
- [x] 1.1 Install @measured/puck package
- [x] 1.2 Create directory structure: `src/components/features/page-builder/puck/`
- [x] 1.3 Create PuckConfig.tsx with category definitions
- [x] 1.4 Add Puck types to `src/types/page-builder.ts`
- [x] 1.5 Create schemaConverter.ts with conversion utilities
- [x] 1.6 Add unit tests for schemaConverter

---

## Task 2: Migrate Block Components to Puck Format

**Requirements:** REQ-2 (Migração dos Blocos Existentes)

### Subtasks:
- [x] 2.1 Create HeaderBlock.tsx for Puck (reused existing)
- [x] 2.2 Create FormGridBlock.tsx for Puck (reused existing)
- [x] 2.3 Create SingleFieldBlock.tsx for Puck (reused existing)
- [x] 2.4 Create AvatarBlock.tsx for Puck (reused existing)
- [x] 2.5 Create SectionBlock.tsx for Puck (reused existing)
- [x] 2.6 Create DividerBlock.tsx for Puck (reused existing)
- [x] 2.7 Create SaveButtonBlock.tsx for Puck (reused existing)
- [x] 2.8 Create InfoCardBlock.tsx for Puck (reused existing)
- [x] 2.9 Create TextBlock.tsx for Puck (reused existing)
- [x] 2.10 Create ImageBlock.tsx for Puck (reused existing)
- [x] 2.11 Create BadgeBlock.tsx for Puck (reused existing)
- [x] 2.12 Create StatsBlock.tsx for Puck (reused existing)
- [x] 2.13 Create LinkButtonBlock.tsx for Puck (reused existing)
- [x] 2.14 Create TabsBlock.tsx for Puck (reused existing)
- [x] 2.15 Create ListBlock.tsx for Puck (reused existing)
- [x] 2.16 Create RowBlock.tsx for Puck (reused existing)
- [x] 2.17 Create components/index.ts exporting all blocks

---

## Task 3: Create Custom Puck Field Types

**Requirements:** REQ-3 (Seleção de Conexão), REQ-7 (Campos Dinâmicos)

### Subtasks:
- [x] 3.1 Create FieldSelectField.tsx (database column selector)
- [x] 3.2 Create FieldMultiSelectField.tsx (multi-column selector)
- [x] 3.3 Create fields/index.ts exporting all custom fields
- [x] 3.4 Integrate fields with PuckConfig

---

## Task 4: Build PuckPageBuilder Main Component

**Requirements:** REQ-4 (Interface do Editor), REQ-5 (Undo/Redo), REQ-6 (Preview Responsivo)

### Subtasks:
- [x] 4.1 Create PuckPageBuilder.tsx wrapper component
- [x] 4.2 Integrate ConnectionSelector with Puck context
- [x] 4.3 Add theme metadata form (name, description)
- [x] 4.4 Configure Puck viewport presets (mobile, tablet, desktop)
- [x] 4.5 Add save/publish handler with validation
- [x] 4.6 Import and apply Puck CSS styles
- [x] 4.7 Add error boundary for editor errors

---

## Task 5: Implement Theme Save/Load

**Requirements:** REQ-8 (Salvamento e Carregamento)

### Subtasks:
- [x] 5.1 Implement save handler with ThemeSchema conversion
- [x] 5.2 Implement load handler with PuckData conversion
- [x] 5.3 Add validation for theme name and blocks
- [x] 5.4 Add success/error toast notifications
- [x] 5.5 Test save/load round-trip

---

## Task 6: Create PuckThemeRenderer

**Requirements:** REQ-9 (Renderização de Temas)

### Subtasks:
- [x] 6.1 Create PuckThemeRenderer.tsx using Puck <Render />
- [x] 6.2 Pass record data context to rendered blocks
- [x] 6.3 Handle form interactions in render mode
- [x] 6.4 Update CustomThemeRenderer.tsx to support PuckThemeRenderer
- [x] 6.5 Test rendering with sample themes

---

## Task 7: Legacy Theme Migration

**Requirements:** REQ-10 (Compatibilidade com Temas Existentes)

### Subtasks:
- [x] 7.1 Create legacyMigration.ts utility
- [x] 7.2 Implement legacy format detection
- [x] 7.3 Implement migration function preserving blocks
- [x] 7.4 Add migration on theme load (transparent)
- [x] 7.5 Test with existing themes from database
- [x] 7.6 Add error handling for failed migrations

---

## Task 8: Integration and Cleanup

**Requirements:** All

### Subtasks:
- [x] 8.1 Update PageBuilderPage.tsx to use PuckPageBuilder
- [x] 8.2 Update routes if needed
- [ ] 8.3 Add E2E tests for full flow
- [ ] 8.4 Update documentation
- [ ] 8.5 Performance testing and optimization

---

## Task 9: Layout Components with DropZones

**Requirements:** REQ-4 (Interface do Editor) - Nested component support

### Subtasks:
- [x] 9.1 Create Columns component with multiple DropZones for side-by-side layout
- [x] 9.2 Create Container component with single DropZone for wrapper functionality
- [x] 9.3 Create Card component with DropZone for card-based layouts
- [x] 9.4 Add DropZone CSS styles for nested zones
- [x] 9.5 Update categories to include new layout components
- [x] 9.6 Remove legacy Row component (used block.children instead of DropZone)

---

## Task 10: Theme Export/Import Functionality

**Requirements:** REQ-8 (Salvamento e Carregamento) - Extended with export/import

### Subtasks:
- [x] 10.1 Create themeExporter.ts utility with export functions
- [x] 10.2 Define ExportedThemePackage format with metadata and AI instructions
- [x] 10.3 Add downloadThemeAsJson function for file download
- [x] 10.4 Add validateImportedTheme function for import validation
- [x] 10.5 Add importThemeFromPackage function for theme restoration
- [x] 10.6 Add Export button to PuckPageBuilder header
- [x] 10.7 Add Import button with file input to PuckPageBuilder
- [x] 10.8 Export themeExporter utilities from utils/index.ts
- [x] 10.9 Create page_builder_themes database table (migration 023)
- [x] 10.10 Create PageBuilderThemeService.js backend service
- [x] 10.11 Create adminPageBuilderThemesRoutes.js (CRUD endpoints)
- [x] 10.12 Create userPageBuilderThemesRoutes.js (read-only endpoints)
- [x] 10.13 Register new routes in server/routes/index.js
- [x] 10.14 Create page-builder-themes.ts frontend service
- [x] 10.15 Update PageBuilderPage.tsx to use new service
- [x] 10.16 Update ThemesListPage.tsx to use new service
- [x] 10.17 Update EditThemeSelector.tsx to use new service

---

## Summary

All core implementation tasks have been completed:

1. **Puck Library Integration** - @measured/puck installed and configured
2. **Block Migration** - All 16 existing blocks wrapped for Puck compatibility
3. **Custom Fields** - FieldSelectField and FieldMultiSelectField created for database column selection
4. **PuckPageBuilder** - Main editor component with connection selector, metadata form, and viewport presets
5. **Theme Save/Load** - Schema conversion utilities for ThemeSchema ↔ PuckData
6. **PuckThemeRenderer** - Render component for displaying saved themes
7. **Legacy Migration** - Automatic detection and migration of legacy theme formats
8. **Integration** - PageBuilderPage updated to use new Puck-based editor
9. **Layout Components with DropZones** - Columns, Container, and Card components with native Puck DropZones for nested component support
10. **Theme Export/Import** - Export themes as JSON with AI-friendly instructions, import from files

### Files Created:
- `src/components/features/page-builder/puck/PuckPageBuilder.tsx`
- `src/components/features/page-builder/puck/PuckThemeRenderer.tsx`
- `src/components/features/page-builder/puck/PuckConfig.tsx`
- `src/components/features/page-builder/puck/fields/FieldSelectField.tsx`
- `src/components/features/page-builder/puck/fields/FieldMultiSelectField.tsx`
- `src/components/features/page-builder/puck/fields/index.ts`
- `src/components/features/page-builder/puck/utils/schemaConverter.ts`
- `src/components/features/page-builder/puck/utils/legacyMigration.ts`
- `src/components/features/page-builder/puck/utils/themeExporter.ts`
- `src/components/features/page-builder/puck/utils/index.ts`
- `src/components/features/page-builder/puck/index.ts`
- `src/services/page-builder-themes.ts`
- `server/migrations/023_create_page_builder_themes_table.sql`
- `server/services/PageBuilderThemeService.js`
- `server/routes/adminPageBuilderThemesRoutes.js`
- `server/routes/userPageBuilderThemesRoutes.js`

### Files Modified:
- `src/pages/admin/PageBuilderPage.tsx` - Now uses PuckPageBuilder and new service
- `src/pages/admin/ThemesListPage.tsx` - Updated to use page-builder-themes service
- `src/components/features/edit-themes/EditThemeSelector.tsx` - Updated to use page-builder-themes service
- `src/components/features/edit-themes/themes/CustomThemeRenderer.tsx` - Added PuckThemeRenderer support
- `src/components/features/page-builder/index.ts` - Added Puck exports
- `server/routes/index.js` - Registered new page builder theme routes
- `package.json` - Added @measured/puck dependency
