/**
 * Row Block
 * 
 * Container block that supports 1-4 columns with configurable widths.
 * Stacks vertically on mobile for responsive behavior.
 */

import type { BlockComponentProps, ThemeBlock } from '@/types/page-builder';
import { blockRegistry } from '../BlockRegistry';
import { cn } from '@/lib/utils';
import { clampColumnCount, getDefaultColumnWidths } from '../utils/blockUtils';

export function RowBlockComponent({
  block,
  connection,
  record,
  formData,
  fieldMetadata,
  onRecordChange,
  onSave,
  onBack,
  saving,
  disabled,
  hasChanges,
  isPreview,
}: BlockComponentProps) {
  const { 
    columns = 2,
    columnWidths,
    gap = 'medium',
    verticalAlign = 'top',
    stackOnMobile = true,
  } = block.props;

  const children = block.children || [];
  
  // Clamp columns to valid range
  const validColumns = clampColumnCount(columns);
  
  // Get column widths or use defaults
  const widths: string[] = Array.isArray(columnWidths) && columnWidths.length === validColumns
    ? columnWidths
    : getDefaultColumnWidths(validColumns);

  // Gap classes
  const gapClasses = {
    none: 'gap-0',
    small: 'gap-2',
    medium: 'gap-4',
    large: 'gap-6',
  };

  // Vertical alignment classes
  const verticalAlignClasses = {
    top: 'items-start',
    center: 'items-center',
    bottom: 'items-end',
    stretch: 'items-stretch',
  };

  // Group children by column index
  const getChildrenForColumn = (columnIndex: number): ThemeBlock[] => {
    return children.filter(child => (child.columnIndex || 0) === columnIndex);
  };

  // Render a child block
  const renderChildBlock = (childBlock: ThemeBlock) => {
    const definition = blockRegistry.get(childBlock.type);
    if (!definition) return null;

    const BlockComponent = definition.component;
    return (
      <BlockComponent
        key={childBlock.id}
        block={childBlock}
        connection={connection}
        record={record}
        formData={formData}
        fieldMetadata={fieldMetadata}
        onRecordChange={onRecordChange}
        onSave={onSave}
        onBack={onBack}
        saving={saving}
        disabled={disabled}
        hasChanges={hasChanges}
        isPreview={isPreview}
      />
    );
  };

  // Generate grid template columns style
  const gridTemplateColumns = widths.join(' ');

  return (
    <div
      className={cn(
        'grid',
        gapClasses[gap as keyof typeof gapClasses] || gapClasses.medium,
        verticalAlignClasses[verticalAlign as keyof typeof verticalAlignClasses] || verticalAlignClasses.top,
        stackOnMobile && 'grid-cols-1 md:grid-cols-none'
      )}
      style={{
        gridTemplateColumns: stackOnMobile ? undefined : gridTemplateColumns,
      }}
      // Apply responsive grid on md breakpoint
      data-columns={validColumns}
    >
      <style>
        {stackOnMobile && `
          @media (min-width: 768px) {
            [data-columns="${validColumns}"] {
              grid-template-columns: ${gridTemplateColumns};
            }
          }
        `}
      </style>
      
      {Array.from({ length: validColumns }, (_, columnIndex) => {
        const columnChildren = getChildrenForColumn(columnIndex);
        
        return (
          <div 
            key={columnIndex} 
            className="space-y-4 min-h-[50px]"
            style={{ width: stackOnMobile ? '100%' : undefined }}
          >
            {columnChildren.length > 0 ? (
              columnChildren.map(renderChildBlock)
            ) : (
              <div className="h-full min-h-[50px] border-2 border-dashed border-muted rounded-lg flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  Coluna {columnIndex + 1}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default RowBlockComponent;
