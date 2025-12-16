/**
 * Badge Block
 * 
 * Displays a badge/tag with field binding and variant options.
 */

import { Badge } from '@/components/ui/badge';
import type { BlockComponentProps } from '@/types/page-builder';
import { cn } from '@/lib/utils';

export function BadgeBlockComponent({
  block,
  record,
}: BlockComponentProps) {
  const { 
    textField,
    staticText,
    variant = 'default',
    alignment = 'left',
  } = block.props;

  // Get text from field or use static text
  const text = textField ? String(record[textField] || '') : (staticText || '');

  if (!text) return null;

  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div className={cn(
      'flex',
      alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.left
    )}>
      <Badge variant={variant as 'default' | 'secondary' | 'destructive' | 'outline'}>
        {text}
      </Badge>
    </div>
  );
}

export default BadgeBlockComponent;
