/**
 * PuckPageBuilder Component
 * 
 * Main page builder interface using Puck visual editor.
 * Wraps Puck with connection selection, theme metadata, and save functionality.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Puck, type Data as PuckData } from '@measured/puck';
import '@measured/puck/puck.css';
import './puck-overrides.css';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConnectionSelector } from '../ConnectionSelector';
import { PreviewRecordSelector } from '../PreviewRecordSelector';
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
import { Save, Loader2, Database, FileText, Blocks, Eye, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { 
  exportThemePackage, 
  downloadThemeAsJson,
  validateImportedTheme,
  importThemeFromPackage,
} from './utils/themeExporter';

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
  
  // Preview record state
  const [previewRecord, setPreviewRecord] = useState<Record<string, unknown> | null>(null);

  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      record: previewRecord || {},
      formData: previewRecord || {},
      fieldMetadata: fields,
      onRecordChange: () => {},
      isPreview: true,
    });
  }, [connection, fields, previewRecord]);

  // Handle connection change
  const handleConnectionChange = useCallback((
    newConnection: DatabaseConnection | null,
    newFields: FieldMetadata[]
  ) => {
    setConnectionId(newConnection?.id || null);
    setConnection(newConnection);
    setFields(newFields);
    // Reset preview record when connection changes
    setPreviewRecord(null);
  }, []);

  // Handle preview record change
  const handlePreviewRecordChange = useCallback((record: Record<string, unknown> | null) => {
    setPreviewRecord(record);
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

  // Handle download/export
  const handleDownload = useCallback(() => {
    if (!themeName.trim()) {
      toast.error('Defina um nome para o tema antes de exportar');
      return;
    }

    if (puckData.content.length === 0) {
      toast.error('Adicione pelo menos um bloco antes de exportar');
      return;
    }

    try {
      const themePackage = exportThemePackage(
        puckData,
        themeName,
        themeDescription,
        connection,
        fields,
        initialTheme?.id
      );
      
      downloadThemeAsJson(themePackage);
      toast.success('Tema exportado com sucesso!');
    } catch (error) {
      console.error('Failed to export theme:', error);
      toast.error('Erro ao exportar tema');
    }
  }, [puckData, themeName, themeDescription, connection, fields, initialTheme?.id]);

  // Handle import click
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file import
  const handleFileImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        const validation = validateImportedTheme(data);
        if (!validation.valid) {
          toast.error(`Arquivo inválido: ${validation.errors.join(', ')}`);
          return;
        }

        const imported = importThemeFromPackage(validation.package!);
        
        // Update state with imported data
        setPuckData(imported.puckData);
        setThemeName(imported.name);
        setThemeDescription(imported.description);
        
        // Show info about used fields
        if (imported.usedFields.length > 0) {
          toast.info(
            `Tema importado! Campos utilizados: ${imported.usedFields.join(', ')}. ` +
            'Selecione uma conexão para mapear os campos.'
          );
        } else {
          toast.success('Tema importado com sucesso!');
        }
      } catch (error) {
        console.error('Failed to import theme:', error);
        toast.error('Erro ao importar tema: arquivo JSON inválido');
      }
    };
    
    reader.readAsText(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  }, []);

  // Custom header actions for Puck
  const headerActions = useMemo(() => (
    <div className="flex items-center gap-3">
      {/* Block count indicator */}
      <Badge variant="secondary" className="gap-1.5 font-normal">
        <Blocks className="h-3 w-3" />
        {puckData.content.length} {puckData.content.length === 1 ? 'bloco' : 'blocos'}
      </Badge>
      
      {/* Connection indicator */}
      {connection && (
        <Badge variant="outline" className="gap-1.5 font-normal">
          <Database className="h-3 w-3" />
          {connection.name}
        </Badge>
      )}

      {/* Preview record indicator */}
      {previewRecord && (
        <Badge variant="outline" className="gap-1.5 font-normal bg-primary/10">
          <Eye className="h-3 w-3" />
          Preview ativo
        </Badge>
      )}

      {/* Import button */}
      <Button 
        onClick={handleImportClick}
        variant="outline"
        size="sm"
        className="gap-2"
        title="Importar tema de arquivo"
      >
        <Upload className="h-4 w-4" />
        <span className="hidden sm:inline">Importar</span>
      </Button>

      {/* Download/Export button */}
      <Button 
        onClick={handleDownload}
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={!themeName.trim() || puckData.content.length === 0}
        title="Exportar tema como arquivo"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Exportar</span>
      </Button>
      
      {/* Save button */}
      <Button 
        onClick={() => handleSave(puckData)} 
        disabled={saving || !themeName.trim()}
        size="sm"
        className="gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Salvar Tema
          </>
        )}
      </Button>
    </div>
  ), [puckData, saving, handleSave, handleDownload, handleImportClick, themeName, connection, previewRecord]);

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Compact Theme Metadata Header */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-4">
            {/* Theme name - primary input */}
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                id="theme-name"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder="Nome do tema..."
                className="h-8 text-sm"
              />
            </div>
            
            {/* Description - secondary input */}
            <div className="flex-1 max-w-md hidden md:block">
              <Input
                id="theme-description"
                value={themeDescription}
                onChange={(e) => setThemeDescription(e.target.value)}
                placeholder="Descrição (opcional)..."
                className="h-8 text-sm"
              />
            </div>
            
            {/* Connection selector */}
            <div className="w-56 shrink-0">
              <ConnectionSelector
                selectedConnectionId={connectionId}
                onConnectionChange={handleConnectionChange}
                compact
              />
            </div>

            {/* Preview record selector - only show when connection is selected */}
            {connection && (
              <div className="w-56 shrink-0">
                <PreviewRecordSelector
                  connection={connection}
                  onRecordSelect={handlePreviewRecordChange}
                  compact
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Puck Editor - Full height */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-card">
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
