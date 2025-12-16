/**
 * List Block
 * 
 * Displays a list of items from an array field.
 */

import type { BlockComponentProps } from '@/types/page-builder';
import { cn } from '@/lib/utils';

/**
 * Parse array data from various formats
 */
function parseArrayData(value: unknown): string[] {
  if (!value) return [];
  
  if (Array.isArray(value)) {
    return value.map(item => String(item));
  }
  
  if (typeof value === 'string') {
    // Try JSON parse first
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item));
      }
    } catch {
      // Not JSON, try comma-separated
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  
  return [String(value)];
}

export function ListBlockComponent({
  block,
  record,
}: BlockComponentProps) {
  const { 
    arrayField,
    listStyle = 'bullet',
    alignment = 'left',
    spacing = 'normal',
  } = block.props;

  const items = arrayField ? parseArrayData(record[arrayField]) : [];

  if (items.length === 0) return null;

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const spacingClasses = {
    compact: 'space-y-0.5',
    normal: 'space-y-1',
    relaxed: 'space-y-2',
  };

  const listStyleClasses = {
    bullet: 'list-disc list-inside',
    numbered: 'list-decimal list-inside',
    none: 'list-none',
  };

  const ListTag = listStyle === 'numbered' ? 'ol' : 'ul';

  return (
    <ListTag className={cn(
      listStyleClasses[listStyle as keyof typeof listStyleClasses] || listStyleClasses.bullet,
      alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.left,
      spacingClasses[spacing as keyof typeof spacingClasses] || spacingClasses.normal,
    )}>
      {items.map((item, index) => (
        <li key={index} className="text-sm">
          {item}
        </li>
      ))}
    </ListTag>
  );
}

export default ListBlockComponent;
