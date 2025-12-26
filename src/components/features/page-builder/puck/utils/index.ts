/**
 * Puck Utilities Index
 * 
 * Export all utility functions for Puck integration.
 */

export {
  themeSchemaToPuckData,
  puckDataToThemeSchema,
  blockTypeToPuckComponent,
  puckComponentToBlockType,
  getEmptyPuckData,
  validateBlockTypeCoverage,
} from './schemaConverter';

export {
  isLegacyTheme,
  migrateLegacyTheme,
  safeMigrateLegacyTheme,
  validateMigratedTheme,
} from './legacyMigration';
