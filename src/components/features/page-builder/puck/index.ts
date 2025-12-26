/**
 * Puck Page Builder Module
 * 
 * Exports all Puck-related components and utilities.
 */

// Main components
export { PuckPageBuilder } from './PuckPageBuilder';
export { PuckThemeRenderer } from './PuckThemeRenderer';

// Configuration
export { createPuckConfig, puckConfig, setRenderContext, getRenderContext } from './PuckConfig';
export type { PuckRenderContext } from './PuckConfig';

// Custom fields
export { 
  FieldSelectField, 
  setFieldSelectContext, 
  getFieldSelectContext 
} from './fields/FieldSelectField';
export { FieldMultiSelectField } from './fields/FieldMultiSelectField';

// Utilities
export {
  themeSchemaToPuckData as themeSchemaToPuckData,
  puckDataToThemeSchema,
  blockTypeToPuckComponent,
  puckComponentToBlockType,
  getEmptyPuckData,
  validateBlockTypeCoverage,
} from './utils/schemaConverter';

export {
  isLegacyTheme,
  migrateLegacyTheme,
  safeMigrateLegacyTheme,
  validateMigratedTheme,
} from './utils/legacyMigration';
