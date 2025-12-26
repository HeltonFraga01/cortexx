/**
 * PuckPageBuilder Component
 * 
 * Main page builder interface using Puck visual editor.
 * Wraps Puck with connection selection, theme metadata, and save functionality.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Puck, type Data as PuckData } from '@measured/puck';
import '@measured/puck/puck.css';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConnectionSelector } from '../ConnectionSelector';
import { createPuckConfig, setRenderContext } from './PuckConfig';
import { setFieldSelectContext } from './fields/FieldSelectField';
import { 
  themeSchemaToPuckData, 
  puckDataToThemeSchema, 
  getEmptyPuckData 
} from './utils/schemaConverter';
import { safeMigrateLegacyTheme } from './utils/legacyMigration';

import type { ThemeSchema } from '@/types/page-builder';
import type { DatabaseConnection, FieldMetadata } from '@/lib/types';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PuckPageBuilderProps {
  initialTheme?: ThemeSchema;
  onSave: (schema: ThemeSchema) => Promise<void>;
  saving?: boolean;
}

export function PuckPageBuilder({ 
  initialTheme, 
  onSave, 
  saving = false 
}: PuckPageBuilderProps) {
  // Theme metadata state
  const [themeName, setThemeName] = useState(initialTheme?.name || '');
  const [themeDescription, setThemeDescription] = useState(initialTheme?.description || '');
  
  // Connection state
  const [connectionId, setConnectionId] = useState<string | null>(initialTheme?.connectionId || null);
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [fields, setFields] = useState<FieldMetadata[]>([]);

  // Puck data state
  const [puckData, setPuckData] = useState<PuckData>(() => {
    if (initialTheme) {
      // Migrate legacy themes if needed
      const migratedTheme = safeMigrateLegacyTheme(initialTheme);
      if (migratedTheme) {
        return themeSchemaToPuckData(migratedTheme);
      }
    }
    return getEmptyPuckData();
  });

  // Create Puck config
  const config = useMemo(() => createPuckConfig(), []);

  // Update field select context when fields change
  useEffect(() => {
    setFieldSelectContext({ fields });
  }, [fields]);

  // Update render context when connection/data changes
  useEffect(() => {
    setRenderContext({
      connection,
      record: {},
      formData: {},
      fieldMetadata: fields,
      onRecordChange: () => {},
      isPreview: true,
    });
  }, [connection, fields]);

  // Handle connection change
  const handleConnectionChange = useCallback((
    newConnection: DatabaseConnection | null,
    newFields: FieldMetadata[]
  ) => {
    setConnectionId(newConnection?.id || null);
    setConnection(newConnection);
    setFields(newFields);
  }, []);

  // Handle Puck data change
  const handlePuckChange = useCallback((data: PuckData) => {
    setPuckData(data);
  }, []);

  // Handle save
  const handleSave = useCallback(async (data: PuckData) => {
    // Validate theme name
    if (!themeName.trim()) {
      toast.error('Nome do tema é obrigatório');
      return;
    }

    // Validate blocks
    if (data.content.length === 0) {
      toast.error('Adicione pelo menos um bloco ao tema');
      return;
    }

    try {
      const schema = puckDataToThemeSchema(data, {
        id: initialTheme?.id,
        name: themeName,
        description: themeDescription,
        connectionId: connectionId || undefined,
        createdAt: initialTheme?.createdAt,
      });

      await onSave(schema);
      toast.success('Tema salvo com sucesso!');
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast.error('Erro ao salvar tema');
    }
  }, [themeName, themeDescription, connectionId, initialTheme, onSave]);

  // Custom header actions for Puck
  const headerActions = useMemo(() => (
    <Button 
      onClick={() => handleSave(puckData)} 
      disabled={saving}
      size="sm"
    >
      {saving ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Salvando...
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          Salvar Tema
        </>
      )}
    </Button>
  ), [puckData, saving, handleSave]);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Theme Metadata Header */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Page Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme-name">Nome do Tema</Label>
              <Input
                id="theme-name"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="theme-description">Descrição</Label>
              <Textarea
                id="theme-description"
                value={themeDescription}
                onChange={(e) => setThemeDescription(e.target.value)}
                rows={1}
                className="resize-none"
              />
            </div>
            <ConnectionSelector
              selectedConnectionId={connectionId}
              onConnectionChange={handleConnectionChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Puck Editor */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <Puck
          config={config}
          data={puckData}
          onChange={handlePuckChange}
          onPublish={handleSave}
          headerActions={headerActions}
          viewports={[
            { width: 360, height: 'auto', label: 'Mobile', icon: 'Smartphone' },
            { width: 768, height: 'auto', label: 'Tablet', icon: 'Tablet' },
            { width: 1280, height: 'auto', label: 'Desktop', icon: 'Monitor' },
          ]}
        />
      </div>
    </div>
  );
}

export default PuckPageBuilder;
