/**
 * Page Builder Type Definitions
 * 
 * Types and interfaces for the visual theme page builder system.
 */

import type { DatabaseConnection, FieldMetadata } from '@/lib/types';

/**
 * Available block types in the page builder
 */
export type BlockType =
  // Existing blocks
  | 'header'
  | 'form-grid'
  | 'single-field'
  | 'avatar'
  | 'section'
  | 'divider'
  | 'save-button'
  | 'info-card'
  // New blocks
  | 'text'
  | 'image'
  | 'badge'
  | 'stats'
  | 'link-button'
  | 'tabs'
  | 'list'
  | 'row';

/**
 * Block categories for organization in the library
 */
export type BlockCategory = 'layout' | 'fields' | 'display' | 'actions';

/**
 * A single block instance in the theme
 */
export interface ThemeBlock {
  id: string;
  type: BlockType;
  props: Record<string, any>;
  children?: ThemeBlock[];
  columnIndex?: number; // Which column this block belongs to in parent Row
  visibility?: VisibilityCondition; // Conditional visibility
}

/**
 * Complete theme schema stored in database
 */
export interface ThemeSchema {
  id: string;
  name: string;
  description: string;
  connectionId?: number;
  blocks: ThemeBlock[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Custom theme record from database
 */
export interface CustomTheme {
  id: number;
  name: string;
  description: string;
  connection_id?: number;
  schema: ThemeSchema;
  preview_image?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Property schema for block configuration
 */
export interface PropSchema {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'field-select' | 'field-multi-select';
  options?: { value: string; label: string }[];
  defaultValue?: any;
  required?: boolean;
  helperText?: string;
}

/**
 * Block definition for registration
 */
export interface BlockDefinition {
  type: BlockType;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: BlockCategory;
  defaultProps: Record<string, any>;
  propsSchema: PropSchema[];
  component: React.ComponentType<BlockComponentProps>;
  allowChildren?: boolean;
}

/**
 * Props passed to block components when rendering
 */
export interface BlockComponentProps {
  block: ThemeBlock;
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
  isPreview?: boolean;
  children?: React.ReactNode;
}

/**
 * Page builder state
 */
export interface PageBuilderState {
  connectionId: number | null;
  connection: DatabaseConnection | null;
  fields: FieldMetadata[];
  blocks: ThemeBlock[];
  selectedBlockId: string | null;
  isDragging: boolean;
  themeName: string;
  themeDescription: string;
}

/**
 * Drag item data for @dnd-kit
 */
export interface DragItem {
  id: string;
  type: 'library-block' | 'canvas-block';
  blockType?: BlockType;
  index?: number;
}

/**
 * Block validation result
 */
export interface BlockValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

// ============================================
// New Types for Page Builder Modernization
// ============================================

/**
 * Row/Container block props for multi-column layouts
 */
export interface RowBlockProps {
  columns: 1 | 2 | 3 | 4;
  columnWidths: string[]; // e.g., ['50%', '50%'] or ['1fr', '2fr']
  gap: 'none' | 'small' | 'medium' | 'large';
  verticalAlign: 'top' | 'center' | 'bottom' | 'stretch';
  stackOnMobile: boolean;
}

/**
 * History state for undo/redo
 */
export interface HistoryState {
  blocks: ThemeBlock[];
  selectedBlockId: string | null;
}

/**
 * History manager interface
 */
export interface IHistoryManager {
  push(state: HistoryState): void;
  undo(): HistoryState | null;
  redo(): HistoryState | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}

/**
 * Block template for saving/loading configurations
 */
export interface BlockTemplate {
  id: string;
  name: string;
  blockType: BlockType;
  props: Record<string, any>;
  children?: BlockTemplate[];
  createdAt: string;
}

/**
 * Template storage interface
 */
export interface ITemplateStorage {
  save(template: BlockTemplate): void;
  load(id: string): BlockTemplate | null;
  list(): BlockTemplate[];
  delete(id: string): void;
}

/**
 * Comparison operators for visibility conditions
 */
export type ComparisonOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'is_empty' 
  | 'is_not_empty';

/**
 * Visibility condition for conditional block display
 */
export interface VisibilityCondition {
  field: string;
  operator: ComparisonOperator;
  value?: string | number | boolean;
}

/**
 * Spacing size options
 */
export type SpacingSize = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Horizontal alignment options
 */
export type HorizontalAlign = 'left' | 'center' | 'right' | 'stretch';

/**
 * Vertical alignment options
 */
export type VerticalAlign = 'top' | 'center' | 'bottom' | 'stretch';

/**
 * Spacing configuration for blocks
 */
export interface SpacingConfig {
  marginTop: SpacingSize;
  marginBottom: SpacingSize;
  marginLeft: SpacingSize;
  marginRight: SpacingSize;
  paddingTop: SpacingSize;
  paddingBottom: SpacingSize;
  paddingLeft: SpacingSize;
  paddingRight: SpacingSize;
  horizontalAlign: HorizontalAlign;
}

/**
 * Extended block definition with container support
 */
export interface ExtendedBlockDefinition extends BlockDefinition {
  maxChildren?: number; // Limit children count
  acceptedChildTypes?: BlockType[]; // Restrict child types
}

/**
 * Preview data fetcher interface
 */
export interface IPreviewDataFetcher {
  fetchRecords(connectionId: number, limit?: number): Promise<Record<string, any>[]>;
  fetchRecord(connectionId: number, recordId: string): Promise<Record<string, any>>;
}
