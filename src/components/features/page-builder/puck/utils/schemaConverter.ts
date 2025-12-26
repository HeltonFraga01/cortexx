/**
 * Schema Converter Utilities
 * 
 * Converts between ThemeSchema (our format) and Puck Data format.
 * Ensures round-trip compatibility for save/load operations.
 */

import type { Data as PuckData, Content as PuckContent } from '@measured/puck';
import type { ThemeSchema, ThemeBlock, BlockType } from '@/types/page-builder';

/**
 * Map our BlockType to Puck component names (PascalCase)
 */
const BLOCK_TYPE_TO_PUCK: Record<BlockType, string> = {
  'header': 'Header',
  'form-grid': 'FormGrid',
  'single-field': 'SingleField',
  'avatar': 'Avatar',
  'section': 'Section',
  'divider': 'Divider',
  'save-button': 'SaveButton',
  'info-card': 'InfoCard',
  'text': 'Text',
  'image': 'Image',
  'badge': 'Badge',
  'stats': 'Stats',
  'link-button': 'LinkButton',
  'tabs': 'Tabs',
  'list': 'List',
  'row': 'Row',
};

/**
 * Map Puck component names back to our BlockType
 */
const PUCK_TO_BLOCK_TYPE: Record<string, BlockType> = Object.entries(BLOCK_TYPE_TO_PUCK)
  .reduce((acc, [blockType, puckName]) => {
    acc[puckName] = blockType as BlockType;
    return acc;
  }, {} as Record<string, BlockType>);

/**
 * Convert BlockType to Puck component name
 */
export function blockTypeToPuckComponent(type: BlockType): string {
  return BLOCK_TYPE_TO_PUCK[type] || type;
}

/**
 * Convert Puck component name to BlockType
 */
export function puckComponentToBlockType(puckName: string): BlockType {
  return PUCK_TO_BLOCK_TYPE[puckName] || (puckName.toLowerCase() as BlockType);
}

/**
 * Convert a ThemeBlock to Puck content item
 */
function themeBlockToPuckContent(block: ThemeBlock): PuckContent[number] {
  return {
    type: blockTypeToPuckComponent(block.type),
    props: {
      id: block.id,
      ...block.props,
      // Preserve metadata
      ...(block.columnIndex !== undefined && { _columnIndex: block.columnIndex }),
      ...(block.visibility && { _visibility: block.visibility }),
      ...(block.children && { _children: block.children.map(themeBlockToPuckContent) }),
    },
  };
}

/**
 * Convert Puck content item back to ThemeBlock
 */
function puckContentToThemeBlock(content: PuckContent[number]): ThemeBlock {
  const { id, _columnIndex, _visibility, _children, ...props } = content.props as Record<string, any>;
  
  const block: ThemeBlock = {
    id: id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: puckComponentToBlockType(content.type),
    props,
  };

  if (_columnIndex !== undefined) {
    block.columnIndex = _columnIndex;
  }

  if (_visibility) {
    block.visibility = _visibility;
  }

  if (_children && Array.isArray(_children)) {
    block.children = _children.map(puckContentToThemeBlock);
  }

  return block;
}

/**
 * Convert ThemeSchema to Puck Data format
 */
export function themeSchemaToPuckData(schema: ThemeSchema): PuckData {
  return {
    root: { 
      props: {
        // Store theme metadata in root props
        _themeId: schema.id,
        _themeName: schema.name,
        _themeDescription: schema.description,
        _connectionId: schema.connectionId,
      } 
    },
    content: schema.blocks.map(themeBlockToPuckContent),
    zones: {},
  };
}

/**
 * Convert Puck Data back to ThemeSchema format
 */
export function puckDataToThemeSchema(
  data: PuckData,
  metadata?: { 
    id?: string; 
    name?: string; 
    description?: string; 
    connectionId?: string;
    createdAt?: string;
  }
): ThemeSchema {
  const rootProps = (data.root?.props || {}) as Record<string, any>;
  
  return {
    id: metadata?.id || rootProps._themeId || `custom-${Date.now()}`,
    name: metadata?.name || rootProps._themeName || '',
    description: metadata?.description || rootProps._themeDescription || '',
    connectionId: metadata?.connectionId || rootProps._connectionId,
    blocks: data.content.map(puckContentToThemeBlock),
    createdAt: metadata?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create empty Puck data structure
 */
export function getEmptyPuckData(): PuckData {
  return {
    root: { props: {} },
    content: [],
    zones: {},
  };
}

/**
 * Validate that all required block types are present in config
 */
export function validateBlockTypeCoverage(registeredTypes: string[]): { 
  valid: boolean; 
  missing: BlockType[] 
} {
  const requiredTypes = Object.keys(BLOCK_TYPE_TO_PUCK) as BlockType[];
  const registeredPuckNames = new Set(registeredTypes);
  
  const missing = requiredTypes.filter(
    type => !registeredPuckNames.has(BLOCK_TYPE_TO_PUCK[type])
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}
