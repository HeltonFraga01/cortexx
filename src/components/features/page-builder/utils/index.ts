/**
 * Page Builder Utilities
 * 
 * Export all utility functions and classes for the Page Builder.
 */

export { HistoryManager, historyManager, MAX_HISTORY_SIZE } from './HistoryManager';
export { 
  evaluateVisibility, 
  evaluateAllConditions, 
  evaluateAnyCondition,
  getOperatorOptions,
  operatorRequiresValue,
} from './VisibilityEvaluator';
export { 
  TemplateStorage, 
  templateStorage, 
  generateTemplateId,
  createTemplateFromBlock,
} from './TemplateStorage';
export {
  generateBlockId,
  duplicateBlock,
  findBlockById,
  findParentBlock,
  removeBlockById,
  updateBlockById,
  moveBlockUp,
  moveBlockDown,
  insertBlockAfter,
  getAllBlockIds,
  countBlocks,
  blockSupportsChildren,
  validateColumnWidths,
  getDefaultColumnWidths,
  clampColumnCount,
} from './blockUtils';
