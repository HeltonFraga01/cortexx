/**
 * Legacy Theme Migration Utilities
 * 
 * Handles detection and migration of legacy theme formats
 * to ensure backward compatibility with existing themes.
 */

import type { ThemeSchema, ThemeBlock, BlockType } from '@/types/page-builder';

/**
 * Check if a schema is in the legacy format
 * Legacy format characteristics:
 * - May have different property names
 * - May use different block type naming
 * - May lack certain metadata fields
 */
export function isLegacyTheme(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  const s = schema as Record<string, unknown>;

  // Check for legacy indicators
  // 1. Missing required fields that newer schemas have
  if (!s.updatedAt && s.blocks) {
    return true;
  }

  // 2. Old block type naming (e.g., 'formGrid' instead of 'form-grid')
  if (Array.isArray(s.blocks)) {
    const hasLegacyBlockTypes = (s.blocks as any[]).some(block => {
      if (!block || typeof block !== 'object') return false;
      const type = block.type as string;
      // Check for camelCase block types (legacy)
      return type && /^[a-z]+[A-Z]/.test(type);
    });
    if (hasLegacyBlockTypes) {
      return true;
    }
  }

  return false;
}

/**
 * Map legacy block type names to current format
 */
const LEGACY_BLOCK_TYPE_MAP: Record<string, BlockType> = {
  // camelCase to kebab-case
  'formGrid': 'form-grid',
  'singleField': 'single-field',
  'saveButton': 'save-button',
  'infoCard': 'info-card',
  'linkButton': 'link-button',
  // Other potential legacy names
  'headerBlock': 'header',
  'avatarBlock': 'avatar',
  'sectionBlock': 'section',
  'dividerBlock': 'divider',
  'textBlock': 'text',
  'imageBlock': 'image',
  'badgeBlock': 'badge',
  'statsBlock': 'stats',
  'listBlock': 'list',
  'tabsBlock': 'tabs',
  'rowBlock': 'row',
};

/**
 * Normalize a block type to current format
 */
function normalizeBlockType(type: string): BlockType {
  // Check if it's a known legacy type
  if (LEGACY_BLOCK_TYPE_MAP[type]) {
    return LEGACY_BLOCK_TYPE_MAP[type];
  }
  
  // Convert camelCase to kebab-case
  const kebabCase = type.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  
  // Validate it's a known block type
  const validTypes: BlockType[] = [
    'header', 'form-grid', 'single-field', 'avatar', 'section', 'divider',
    'save-button', 'info-card', 'text', 'image', 'badge', 'stats',
    'link-button', 'tabs', 'list', 'row'
  ];
  
  if (validTypes.includes(kebabCase as BlockType)) {
    return kebabCase as BlockType;
  }
  
  // Return as-is if we can't normalize (will be handled by validation)
  return type as BlockType;
}

/**
 * Migrate a legacy block to current format
 */
function migrateLegacyBlock(legacyBlock: Record<string, any>): ThemeBlock {
  const { type, props = {}, children, columnIndex, visibility, ...rest } = legacyBlock;
  
  const migratedBlock: ThemeBlock = {
    id: legacyBlock.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: normalizeBlockType(type),
    props: { ...props },
  };

  // Migrate children recursively
  if (children && Array.isArray(children)) {
    migratedBlock.children = children.map(migrateLegacyBlock);
  }

  // Preserve columnIndex
  if (columnIndex !== undefined) {
    migratedBlock.columnIndex = columnIndex;
  }

  // Preserve visibility
  if (visibility) {
    migratedBlock.visibility = visibility;
  }

  // Handle legacy prop names
  migrateBlockProps(migratedBlock);

  return migratedBlock;
}

/**
 * Migrate legacy prop names within a block
 */
function migrateBlockProps(block: ThemeBlock): void {
  const { type, props } = block;

  // Handle specific block type migrations
  switch (type) {
    case 'form-grid':
      // Legacy might have 'fieldList' instead of 'fields'
      if (props.fieldList && !props.fields) {
        props.fields = props.fieldList;
        delete props.fieldList;
      }
      break;

    case 'single-field':
      // Legacy might have 'field' instead of 'fieldName'
      if (props.field && !props.fieldName) {
        props.fieldName = props.field;
        delete props.field;
      }
      break;

    case 'header':
      // Legacy might have 'title' instead of 'titleField'
      if (props.title && !props.titleField && typeof props.title === 'string') {
        // If it looks like a field name, migrate it
        if (!props.title.includes(' ')) {
          props.titleField = props.title;
          delete props.title;
        }
      }
      break;

    case 'save-button':
      // Legacy might have 'text' instead of 'label'
      if (props.text && !props.label) {
        props.label = props.text;
        delete props.text;
      }
      break;
  }
}

/**
 * Migrate a legacy theme schema to current format
 */
export function migrateLegacyTheme(legacySchema: Record<string, any>): ThemeSchema {
  const {
    id,
    name = '',
    description = '',
    connectionId,
    connection_id, // Legacy snake_case
    blocks = [],
    createdAt,
    created_at, // Legacy snake_case
    updatedAt,
    updated_at, // Legacy snake_case
  } = legacySchema;

  const migratedSchema: ThemeSchema = {
    id: id || `migrated-${Date.now()}`,
    name,
    description,
    connectionId: connectionId || connection_id,
    blocks: blocks.map(migrateLegacyBlock),
    createdAt: createdAt || created_at || new Date().toISOString(),
    updatedAt: updatedAt || updated_at || new Date().toISOString(),
  };

  return migratedSchema;
}

/**
 * Safely migrate a theme, returning original if migration fails
 */
export function safeMigrateLegacyTheme(schema: unknown): ThemeSchema | null {
  try {
    if (!schema || typeof schema !== 'object') {
      return null;
    }

    if (isLegacyTheme(schema)) {
      return migrateLegacyTheme(schema as Record<string, any>);
    }

    // Already in current format
    return schema as ThemeSchema;
  } catch (error) {
    console.error('Failed to migrate legacy theme:', error);
    return null;
  }
}

/**
 * Validate migrated theme has all required fields
 */
export function validateMigratedTheme(schema: ThemeSchema): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];

  if (!schema.id) {
    errors.push('Theme must have an id');
  }

  if (!schema.name) {
    errors.push('Theme must have a name');
  }

  if (!Array.isArray(schema.blocks)) {
    errors.push('Theme must have a blocks array');
  } else {
    schema.blocks.forEach((block, index) => {
      if (!block.id) {
        errors.push(`Block at index ${index} must have an id`);
      }
      if (!block.type) {
        errors.push(`Block at index ${index} must have a type`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
