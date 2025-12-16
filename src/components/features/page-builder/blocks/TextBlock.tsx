/**
 * Text Block
 * 
 * Displays text content with optional field binding and formatting.
 */

import type { BlockComponentProps } from '@/types/page-builder';
import { cn } from '@/lib/utils';

export function TextBlockComponent({
  block,
  record,
}: BlockComponentProps) {
  const { 
    textField,
    staticText,
    variant = 'body',
    alignment = 'left',
    color = 'default',
  } = block.props;

  // Get text from field or use static text
  const text = textField ? String(record[textField] || '') : (staticText || '');

  if (!text) return null;

  const variantClasses = {
    heading1: 'text-3xl font-bold',
    heading2: 'text-2xl font-semibold',
    heading3: 'text-xl font-semibold',
    body: 'text-base',
    small: 'text-sm',
    caption: 'text-xs text-muted-foreground',
  };

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const colorClasses = {
    default: '',
    muted: 'text-muted-foreground',
    primary: 'text-primary',
    destructive: 'text-destructive',
  };

  return (
    <p className={cn(
      variantClasses[variant as keyof typeof variantClasses] || variantClasses.body,
      alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.left,
      colorClasses[color as keyof typeof colorClasses] || colorClasses.default,
    )}>
      {text}
    </p>
  );
}

export default TextBlockComponent;
