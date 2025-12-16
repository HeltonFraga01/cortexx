/**
 * Edit Page Themes Type Definitions
 * 
 * This module defines the interfaces and types for the Edit Page Themes system,
 * which allows administrators to configure different layouts for the user edit page.
 */

import type { DatabaseConnection, FieldMetadata } from '@/lib/types';

/**
 * Props passed to all theme components
 */
export interface EditThemeProps {
  /** The database connection configuration */
  connection: DatabaseConnection;
  /** The original record data from the database */
  record: Record<string, any>;
  /** The current form data (may differ from record if user made changes) */
  formData: Record<string, any>;
  /** Metadata for all fields including type, validation, and display info */
  fieldMetadata: FieldMetadata[];
  /** Callback when user changes a field value */
  onRecordChange: (updatedRecord: Record<string, any>) => void;
  /** Callback to save the record */
  onSave: () => Promise<void>;
  /** Callback to navigate back */
  onBack: () => void;
  /** Whether a save operation is in progress */
  saving: boolean;
  /** Whether the form should be disabled */
  disabled: boolean;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
}

/**
 * Definition of an edit theme
 */
export interface EditTheme {
  /** Unique identifier for the theme (kebab-case) */
  id: string;
  /** Display name for the theme */
  name: string;
  /** Brief description of the theme layout */
  description: string;
  /** Preview image URL or base64 string */
  preview: string;
  /** The React component that renders the theme */
  component: React.ComponentType<EditThemeProps>;
}

/**
 * Configuration for the edit theme stored in view_configuration
 */
export interface EditThemeConfig {
  /** Whether a custom theme is enabled */
  enabled: boolean;
  /** The ID of the selected theme */
  themeId: string;
  /** Theme-specific options (varies by theme) */
  options?: Record<string, any>;
}

/**
 * Metadata returned when listing available themes
 */
export interface EditThemeMetadata {
  id: string;
  name: string;
  description: string;
  preview: string;
}

/**
 * Validation result for theme registration
 */
export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
}
