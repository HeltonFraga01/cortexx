/**
 * Theme Exporter Utility
 * 
 * Exports themes as downloadable files with complete metadata,
 * field mappings, and AI-friendly instructions for reimporting.
 */

import type { Data as PuckData } from '@measured/puck';
import type { ThemeSchema } from '@/types/page-builder';
import type { DatabaseConnection, FieldMetadata } from '@/lib/types';
import { puckDataToThemeSchema } from './schemaConverter';

/**
 * Exported theme file format version
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

/**
 * Field mapping information for export
 */
export interface ExportedFieldMapping {
  fieldName: string;
  fieldType: string;
  label: string;
  description?: string;
  isRequired?: boolean;
  isPrimaryKey?: boolean;
}

/**
 * Connection metadata for export
 */
export interface ExportedConnectionInfo {
  name: string;
  tableName?: string;
  baseUrl?: string;
  fields: ExportedFieldMapping[];
}

/**
 * Complete exported theme package
 */
export interface ExportedThemePackage {
  // Metadata
  _meta: {
    version: string;
    exportedAt: string;
    exportedFrom: string;
    format: 'cortexx-page-builder-theme';
  };
  
  // AI Instructions
  _instructions: {
    description: string;
    architecture: string[];
    importNotes: string[];
    fieldMappingGuide: string;
  };
  
  // Theme data
  theme: {
    name: string;
    description: string;
    puckData: PuckData;
    schema: ThemeSchema;
  };
  
  // Connection info (without sensitive data)
  connection: ExportedConnectionInfo | null;
  
  // Block summary for quick reference
  blockSummary: {
    totalBlocks: number;
    blockTypes: Record<string, number>;
    usedFields: string[];
  };
}

/**
 * Extract field names used in blocks
 */
function extractUsedFields(puckData: PuckData): string[] {
  const fields = new Set<string>();
  
  function extractFromProps(props: Record<string, unknown>) {
    for (const [key, value] of Object.entries(props)) {
      // Check for field-related props
      if (key.endsWith('Field') && typeof value === 'string' && value) {
        fields.add(value);
      }
      // Check for fields array (FormGrid)
      if (key === 'fields' && Array.isArray(value)) {
        value.forEach(f => {
          if (typeof f === 'string') fields.add(f);
        });
      }
    }
  }
  
  // Process root content
  puckData.content.forEach(item => {
    if (item.props) {
      extractFromProps(item.props as Record<string, unknown>);
    }
  });
  
  // Process zones (nested content)
  if (puckData.zones) {
    Object.values(puckData.zones).forEach(zoneContent => {
      zoneContent.forEach(item => {
        if (item.props) {
          extractFromProps(item.props as Record<string, unknown>);
        }
      });
    });
  }
  
  return Array.from(fields).sort();
}

/**
 * Count block types in the theme
 */
function countBlockTypes(puckData: PuckData): Record<string, number> {
  const counts: Record<string, number> = {};
  
  function countItem(item: { type: string }) {
    counts[item.type] = (counts[item.type] || 0) + 1;
  }
  
  // Count root content
  puckData.content.forEach(countItem);
  
  // Count zones
  if (puckData.zones) {
    Object.values(puckData.zones).forEach(zoneContent => {
      zoneContent.forEach(countItem);
    });
  }
  
  return counts;
}

/**
 * Create exportable field mapping from metadata
 */
function createFieldMappings(fields: FieldMetadata[]): ExportedFieldMapping[] {
  return fields.map(field => ({
    fieldName: field.name,
    fieldType: field.type,
    label: field.label || field.name,
    description: field.description,
    isRequired: field.required,
    isPrimaryKey: field.primaryKey,
  }));
}

/**
 * Generate AI-friendly instructions
 */
function generateInstructions(): ExportedThemePackage['_instructions'] {
  return {
    description: `Este arquivo contém um tema exportado do Cortexx Page Builder. 
O tema define a estrutura visual de uma página de edição de registros, 
com blocos configuráveis que mapeiam campos de um banco de dados.`,
    
    architecture: [
      'O tema usa a biblioteca Puck (https://puckeditor.com) para renderização visual',
      'Cada bloco tem um "type" que define o componente React a ser usado',
      'As "props" de cada bloco contêm configurações e mapeamentos de campos',
      'Props que terminam em "Field" (ex: titleField, imageField) referenciam colunas do banco',
      'Blocos de layout (Columns, Container, Card) podem conter outros blocos via "zones"',
      'O campo "zones" no puckData contém blocos aninhados, indexados por zona (ex: "column-0")',
    ],
    
    importNotes: [
      'Para importar este tema, use a função de upload no Page Builder',
      'A conexão de banco de dados deve ser reconfigurada após importação',
      'Verifique se os campos mapeados existem na nova conexão',
      'Campos não encontrados serão exibidos como vazios até serem remapeados',
      'O ID do tema será regenerado na importação para evitar conflitos',
    ],
    
    fieldMappingGuide: `Os campos são mapeados através de props específicas:
- titleField, subtitleField: Campos de texto para cabeçalhos
- imageField: Campo com URL de imagem
- fields (array): Lista de campos para FormGrid
- fieldName: Campo único para SingleField
- valueField, labelField: Campos para componentes Stats
- textField: Campo de texto para componentes Text/Badge
- urlField: Campo com URL para LinkButton
- arrayField: Campo com array para List`,
  };
}

/**
 * Export theme as downloadable package
 */
export function exportThemePackage(
  puckData: PuckData,
  themeName: string,
  themeDescription: string,
  connection: DatabaseConnection | null,
  fields: FieldMetadata[],
  existingThemeId?: string
): ExportedThemePackage {
  // Convert to ThemeSchema
  const schema = puckDataToThemeSchema(puckData, {
    id: existingThemeId,
    name: themeName,
    description: themeDescription,
    connectionId: connection?.id,
  });
  
  // Build connection info (without sensitive data like tokens)
  const connectionInfo: ExportedConnectionInfo | null = connection ? {
    name: connection.name,
    tableName: connection.table_name,
    baseUrl: connection.base_url,
    fields: createFieldMappings(fields),
  } : null;
  
  // Build block summary
  const usedFields = extractUsedFields(puckData);
  const blockTypes = countBlockTypes(puckData);
  
  return {
    _meta: {
      version: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      exportedFrom: 'Cortexx Page Builder',
      format: 'cortexx-page-builder-theme',
    },
    _instructions: generateInstructions(),
    theme: {
      name: themeName,
      description: themeDescription,
      puckData,
      schema,
    },
    connection: connectionInfo,
    blockSummary: {
      totalBlocks: puckData.content.length + 
        (puckData.zones ? Object.values(puckData.zones).reduce((sum, z) => sum + z.length, 0) : 0),
      blockTypes,
      usedFields,
    },
  };
}

/**
 * Download theme as JSON file
 */
export function downloadThemeAsJson(themePackage: ExportedThemePackage): void {
  const fileName = `${themePackage.theme.name.toLowerCase().replace(/\s+/g, '-')}-theme.json`;
  const jsonContent = JSON.stringify(themePackage, null, 2);
  
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Validate imported theme package
 */
export function validateImportedTheme(data: unknown): { 
  valid: boolean; 
  errors: string[];
  package?: ExportedThemePackage;
} {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Arquivo inválido: não é um objeto JSON'] };
  }
  
  const pkg = data as Record<string, unknown>;
  
  // Check meta
  if (!pkg._meta || typeof pkg._meta !== 'object') {
    errors.push('Metadados ausentes (_meta)');
  } else {
    const meta = pkg._meta as Record<string, unknown>;
    if (meta.format !== 'cortexx-page-builder-theme') {
      errors.push('Formato de arquivo não reconhecido');
    }
  }
  
  // Check theme
  if (!pkg.theme || typeof pkg.theme !== 'object') {
    errors.push('Dados do tema ausentes');
  } else {
    const theme = pkg.theme as Record<string, unknown>;
    if (!theme.name) errors.push('Nome do tema ausente');
    if (!theme.puckData) errors.push('Dados do Puck ausentes');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return { 
    valid: true, 
    errors: [],
    package: data as ExportedThemePackage,
  };
}

/**
 * Import theme from package (returns PuckData and metadata)
 */
export function importThemeFromPackage(pkg: ExportedThemePackage): {
  puckData: PuckData;
  name: string;
  description: string;
  usedFields: string[];
  connectionInfo: ExportedConnectionInfo | null;
} {
  return {
    puckData: pkg.theme.puckData,
    name: pkg.theme.name,
    description: pkg.theme.description,
    usedFields: pkg.blockSummary.usedFields,
    connectionInfo: pkg.connection,
  };
}
