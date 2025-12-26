/**
 * PuckThemeRenderer Component
 * 
 * Renders a saved theme using Puck's Render component.
 * Used for displaying themes in the record edit page.
 */

import { useEffect, useMemo } from 'react';
import { Render } from '@measured/puck';
import { createPuckConfig, setRenderContext } from './PuckConfig';
import { setFieldSelectContext } from './fields/FieldSelectField';
import { themeSchemaToPuckData } from './utils/schemaConverter';
import { safeMigrateLegacyTheme } from './utils/legacyMigration';

import type { ThemeSchema } from '@/types/page-builder';
import type { DatabaseConnection, FieldMetadata } from '@/lib/types';

interface PuckThemeRendererProps {
  theme: ThemeSchema;
  connection: DatabaseConnection;
  record: Record<string, any>;
  formData: Record<string, any>;
  fieldMetadata: FieldMetadata[];
  onRecordChange: (data: Record<string, any>) => void;
  onSave?: () => Promise<void>;
  onBack?: () => void;
  saving?: boolean;
  disabled?: boolean;
  hasChanges?: boolean;
}

export function PuckThemeRenderer({
  theme,
  connection,
  record,
  formData,
  fieldMetadata,
  onRecordChange,
  onSave,
  onBack,
  saving,
  disabled,
  hasChanges,
}: PuckThemeRendererProps) {
  // Create Puck config
  const config = useMemo(() => createPuckConfig(), []);

  // Convert theme to Puck data
  const puckData = useMemo(() => {
    const migratedTheme = safeMigrateLegacyTheme(theme);
    if (migratedTheme) {
      return themeSchemaToPuckData(migratedTheme);
    }
    return { root: { props: {} }, content: [], zones: {} };
  }, [theme]);

  // Update field select context
  useEffect(() => {
    setFieldSelectContext({ fields: fieldMetadata });
  }, [fieldMetadata]);

  // Update render context with actual data
  useEffect(() => {
    setRenderContext({
      connection,
      record,
      formData,
      fieldMetadata,
      onRecordChange,
      onSave,
      onBack,
      saving,
      disabled,
      hasChanges,
      isPreview: false, // Not preview mode - actual rendering
    });
  }, [
    connection,
    record,
    formData,
    fieldMetadata,
    onRecordChange,
    onSave,
    onBack,
    saving,
    disabled,
    hasChanges,
  ]);

  return (
    <div className="puck-theme-renderer space-y-6">
      <Render config={config} data={puckData} />
    </div>
  );
}

export default PuckThemeRenderer;
