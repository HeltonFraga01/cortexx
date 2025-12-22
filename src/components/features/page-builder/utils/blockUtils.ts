/**
 * Block Utilities
 * 
 * Utility functions for block manipulation in the Page Builder.
 */

import type { ThemeBlock, BlockType } from '@/types/page-builder';

/**
 * Generate a unique block ID
 */
export function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Duplicate a block with a new unique ID.
 * Performs a deep copy of props and recursively duplicates children.
 */
export function duplicateBlock(block: ThemeBlock): ThemeBlock {
  const newBlock: ThemeBlock = {
    id: generateBlockId(),
    type: block.type,
    props: JSON.parse(JSON.stringify(block.props)), // Deep clone props
  };

  // Recursively duplicate children if present
  if (block.children && block.children.length > 0) {
    newBlock.children = block.children.map(child => duplicateBlock(child));
  }

  // Copy columnIndex if present
  if (block.columnIndex !== undefined) {
    newBlock.columnIndex = block.columnIndex;
  }

  // Copy visibility condition if present (deep clone)
  if (block.visibility) {
    newBlock.visibility = JSON.parse(JSON.stringify(block.visibility));
  }

  return newBlock;
}

/**
 * Find a block by ID in a block tree
 */
export function findBlockById(
  blocks: ThemeBlock[],
  id: string
): ThemeBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.children) {
      const found = findBlockById(block.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find parent block of a given block ID
 */
export function findParentBlock(
  blocks: ThemeBlock[],
  childId: string,
  parent: ThemeBlock | null = null
): ThemeBlock | null {
  for (const block of blocks) {
    if (block.id === childId) return parent;
    if (block.children) {
      const found = findParentBlock(block.children, childId, block);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * Remove a block by ID from a block tree
 */
export function removeBlockById(
  blocks: ThemeBlock[],
  id: string
): ThemeBlock[] {
  return blocks
    .filter(block => block.id !== id)
    .map(block => ({
      ...block,
      children: block.children ? removeBlockById(block.children, id) : undefined,
    }));
}

/**
 * Update a block by ID in a block tree
 */
export function updateBlockById(
  blocks: ThemeBlock[],
  id: string,
  updates: Partial<ThemeBlock>
): ThemeBlock[] {
  return blocks.map(block => {
    if (block.id === id) {
      return { ...block, ...updates };
    }
    if (block.children) {
      return {
        ...block,
        children: updateBlockById(block.children, id, updates),
      };
    }
    return block;
  });
}

/**
 * Move a block up in the list (decrease index)
 */
export function moveBlockUp(blocks: ThemeBlock[], id: string): ThemeBlock[] {
  const index = blocks.findIndex(b => b.id === id);
  if (index <= 0) return blocks; // Already at top or not found
  
  const newBlocks = [...blocks];
  [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
  return newBlocks;
}

/**
 * Move a block down in the list (increase index)
 */
export function moveBlockDown(blocks: ThemeBlock[], id: string): ThemeBlock[] {
  const index = blocks.findIndex(b => b.id === id);
  if (index < 0 || index >= blocks.length - 1) return blocks; // At bottom or not found
  
  const newBlocks = [...blocks];
  [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
  return newBlocks;
}

/**
 * Insert a block after another block
 */
export function insertBlockAfter(
  blocks: ThemeBlock[],
  afterId: string,
  newBlock: ThemeBlock
): ThemeBlock[] {
  const index = blocks.findIndex(b => b.id === afterId);
  if (index < 0) return [...blocks, newBlock]; // Not found, append
  
  const newBlocks = [...blocks];
  newBlocks.splice(index + 1, 0, newBlock);
  return newBlocks;
}

/**
 * Get all block IDs in a block tree (including nested)
 */
export function getAllBlockIds(blocks: ThemeBlock[]): string[] {
  const ids: string[] = [];
  
  function collect(blockList: ThemeBlock[]) {
    for (const block of blockList) {
      ids.push(block.id);
      if (block.children) {
        collect(block.children);
      }
    }
  }
  
  collect(blocks);
  return ids;
}

/**
 * Count total blocks including nested children
 */
export function countBlocks(blocks: ThemeBlock[]): number {
  return getAllBlockIds(blocks).length;
}

/**
 * Check if a block type supports children
 */
export function blockSupportsChildren(type: BlockType): boolean {
  return ['row', 'section', 'tabs'].includes(type);
}

/**
 * Validate column widths for Row block
 * Returns true if widths are valid (sum to 100% or valid fr units)
 */
export function validateColumnWidths(widths: string[], columns: number): boolean {
  if (widths.length !== columns) return false;
  
  // Check for percentage widths
  const percentagePattern = /^(\d+(?:\.\d+)?)%$/;
  const allPercentages = widths.every(w => percentagePattern.test(w));
  
  if (allPercentages) {
    const sum = widths.reduce((acc, w) => {
      const match = percentagePattern.exec(w);
      return acc + (match ? parseFloat(match[1]) : 0);
    }, 0);
    return Math.abs(sum - 100) < 0.01; // Allow small floating point errors
  }
  
  // Check for fr units
  const frPattern = /^(\d+(?:\.\d+)?)fr$/;
  const allFr = widths.every(w => frPattern.test(w));
  
  return allFr;
}

/**
 * Generate default column widths for a given column count
 */
export function getDefaultColumnWidths(columns: number): string[] {
  const width = `${100 / columns}%`;
  return Array(columns).fill(width);
}

/**
 * Clamp column count to valid range (1-4)
 */
export function clampColumnCount(count: number): 1 | 2 | 3 | 4 {
  return Math.max(1, Math.min(4, Math.round(count))) as 1 | 2 | 3 | 4;
}
