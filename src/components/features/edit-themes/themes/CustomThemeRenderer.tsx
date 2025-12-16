/**
 * CustomThemeRenderer
 * 
 * Renders a custom theme by parsing ThemeSchema and rendering blocks dynamically.
 */

import { useState, useEffect } from 'react';
import { blockRegistry } from '@/components/features/page-builder/BlockRegistry';
import type { ThemeSchema, ThemeBlock } from '@/types/page-builder';
import type { EditThemeProps } from '@/types/edit-themes';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Ensure blocks are registered
import '@/components/features/page-builder/blocks';

interface CustomThemeRendererProps extends EditThemeProps {
  schema: ThemeSchema;
}

function BlockRenderer({
  block,
  themeProps,
}: {
  block: ThemeBlock;
  themeProps: EditThemeProps;
}) {
  const definition = blockRegistry.get(block.type);

  if (!definition) {
    return (
      <div className="p-4 border border-dashed border-destructive rounded-md">
        <p className="text-sm text-destructive">
          Bloco desconhecido: {block.type}
        </p>
      </div>
    );
  }

  const Component = definition.component;

  return (
    <Component
      block={block}
      connection={themeProps.connection}
      record={themeProps.record}
      formData={themeProps.formData}
      fieldMetadata={themeProps.fieldMetadata}
      onRecordChange={themeProps.onRecordChange}
      onSave={themeProps.onSave}
      onBack={themeProps.onBack}
      saving={themeProps.saving}
      disabled={themeProps.disabled}
      hasChanges={themeProps.hasChanges}
      isPreview={false}
    />
  );
}

/**
 * Process blocks to organize children into their parent Row blocks
 */
function processBlocksWithParentRows(blocks: ThemeBlock[]): ThemeBlock[] {
  // Separate Row blocks and blocks with parentRowId
  const rowBlocks = blocks.filter(b => b.type === 'row');
  const blocksWithParent = blocks.filter(b => b.props?.parentRowId);
  const rootBlocks = blocks.filter(b => b.type !== 'row' && !b.props?.parentRowId);
  
  // Create a map of Row blocks with their children
  const processedRows = rowBlocks.map(row => {
    const children = blocksWithParent.filter(b => b.props?.parentRowId === row.id);
    return {
      ...row,
      children: [...(row.children || []), ...children],
    };
  });
  
  // Return processed blocks: rows with children + root blocks (excluding blocks assigned to rows)
  const result: ThemeBlock[] = [];
  
  for (const block of blocks) {
    if (block.type === 'row') {
      // Find the processed version of this row
      const processedRow = processedRows.find(r => r.id === block.id);
      if (processedRow) {
        result.push(processedRow);
      }
    } else if (!block.props?.parentRowId) {
      // Only include blocks that are not assigned to a row
      result.push(block);
    }
  }
  
  return result;
}

export function CustomThemeRenderer({
  schema,
  ...themeProps
}: CustomThemeRendererProps) {
  if (!schema || !schema.blocks) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Schema do tema inválido ou não encontrado.
        </AlertDescription>
      </Alert>
    );
  }

  if (schema.blocks.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Este tema não possui blocos configurados.
        </AlertDescription>
      </Alert>
    );
  }

  // Process blocks to organize children into Row blocks
  const processedBlocks = processBlocksWithParentRows(schema.blocks);

  return (
    <div className="space-y-4">
      {processedBlocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          themeProps={themeProps}
        />
      ))}
    </div>
  );
}

/**
 * Wrapper component that loads schema from API
 */
interface CustomThemeLoaderProps extends EditThemeProps {
  themeId: number;
  isAgentContext?: boolean;
}

export function CustomThemeLoader({ themeId, isAgentContext = false, ...themeProps }: CustomThemeLoaderProps) {
  const [schema, setSchema] = useState<ThemeSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTheme = async () => {
      setLoading(true);
      setError(null);

      try {
        let response;
        
        if (isAgentContext) {
          // Use agent route for fetching themes
          const { getAgentCustomTheme } = await import('@/services/agent-auth');
          response = await getAgentCustomTheme(themeId);
        } else {
          // Use user route for fetching themes (read-only access)
          const { getUserCustomTheme } = await import('@/services/custom-themes');
          response = await getUserCustomTheme(themeId);
        }

        if (response.success && response.data) {
          setSchema(response.data.schema);
        } else {
          setError('Falha ao carregar tema');
        }
      } catch (err) {
        setError('Erro ao carregar tema customizado');
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [themeId, isAgentContext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !schema) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || 'Tema não encontrado'}</AlertDescription>
      </Alert>
    );
  }

  return <CustomThemeRenderer schema={schema} {...themeProps} />;
}

export default CustomThemeRenderer;
