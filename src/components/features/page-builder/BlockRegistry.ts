/**
 * Block Registry
 * 
 * Singleton registry for managing page builder blocks.
 * Blocks are organized by category and can be retrieved by type.
 */

import type { BlockDefinition, BlockType, BlockCategory } from '@/types/page-builder';

/**
 * Validates that an object implements the BlockDefinition interface
 */
export function validateBlockDefinition(block: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!block || typeof block !== 'object') {
    return { valid: false, errors: ['Block must be an object'] };
  }

  const b = block as Record<string, unknown>;

  if (typeof b.type !== 'string' || b.type.trim() === '') {
    errors.push('Block must have a non-empty string type');
  }

  if (typeof b.name !== 'string' || b.name.trim() === '') {
    errors.push('Block must have a non-empty string name');
  }

  if (typeof b.description !== 'string') {
    errors.push('Block must have a string description');
  }

  // Check if icon is a valid React component (function or object with $$typeof)
  const isValidIcon = typeof b.icon === 'function' || 
    (b.icon && typeof b.icon === 'object' && '$$typeof' in b.icon);
  if (!isValidIcon) {
    errors.push('Block must have an icon component');
  }

  if (!['layout', 'fields', 'display', 'actions'].includes(b.category as string)) {
    errors.push('Block must have a valid category (layout, fields, display, actions)');
  }

  if (typeof b.defaultProps !== 'object' || b.defaultProps === null) {
    errors.push('Block must have a defaultProps object');
  }

  if (!Array.isArray(b.propsSchema)) {
    errors.push('Block must have a propsSchema array');
  }

  if (typeof b.component !== 'function') {
    errors.push('Block must have a component function');
  }

  return { valid: errors.length === 0, errors };
}

class BlockRegistry {
  private blocks = new Map<BlockType, BlockDefinition>();

  /**
   * Register a block definition
   * Logs warning if block is invalid instead of throwing
   */
  register(definition: BlockDefinition): void {
    const validation = validateBlockDefinition(definition);
    if (!validation.valid) {
      console.error(`Invalid block definition: ${validation.errors.join(', ')}`);
      return; // Skip invalid blocks instead of throwing
    }

    if (this.blocks.has(definition.type)) {
      console.warn(`Block "${definition.type}" is already registered, overwriting`);
    }

    this.blocks.set(definition.type, definition);
  }

  /**
   * Unregister a block
   */
  unregister(type: BlockType): boolean {
    return this.blocks.delete(type);
  }

  /**
   * Get a block definition by type
   */
  get(type: BlockType): BlockDefinition | undefined {
    return this.blocks.get(type);
  }

  /**
   * Check if a block type is registered
   */
  has(type: BlockType): boolean {
    return this.blocks.has(type);
  }

  /**
   * List all registered blocks
   */
  list(): BlockDefinition[] {
    return Array.from(this.blocks.values());
  }

  /**
   * List blocks by category
   */
  listByCategory(category: BlockCategory): BlockDefinition[] {
    return this.list().filter(block => block.category === category);
  }

  /**
   * Get all categories with their blocks
   */
  getCategories(): { category: BlockCategory; blocks: BlockDefinition[] }[] {
    const categories: BlockCategory[] = ['layout', 'fields', 'display', 'actions'];
    return categories.map(category => ({
      category,
      blocks: this.listByCategory(category),
    }));
  }

  /**
   * Clear all blocks (useful for testing)
   */
  clear(): void {
    this.blocks.clear();
  }
}

// Export singleton instance
export const blockRegistry = new BlockRegistry();

// Export class for testing
export { BlockRegistry };
