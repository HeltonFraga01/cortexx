/**
 * Stats Block
 * 
 * Displays a numerical value with label and formatting options.
 */

import { Card, CardContent } from '@/components/ui/card';
import type { BlockComponentProps } from '@/types/page-builder';
import { cn } from '@/lib/utils';

/**
 * Format a number based on the specified format type
 */
function formatValue(value: unknown, format: string): string {
  if (value === null || value === undefined) return '-';
  
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  
  if (isNaN(num)) return String(value);

  switch (format) {
    case 'number':
      return num.toLocaleString('pt-BR');
    case 'currency':
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    case 'percentage':
      return `${num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
    case 'decimal':
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    default:
      return String(value);
  }
}

export function StatsBlockComponent({
  block,
  record,
}: BlockComponentProps) {
  const { 
    valueField,
    labelField,
    staticLabel,
    format = 'number',
    size = 'medium',
    showCard = true,
    alignment = 'center',
  } = block.props;

  const value = valueField ? record[valueField] : null;
  const label = labelField ? String(record[labelField] || '') : (staticLabel || '');
  const formattedValue = formatValue(value, format);

  const sizeClasses = {
    small: { value: 'text-xl font-bold', label: 'text-xs' },
    medium: { value: 'text-3xl font-bold', label: 'text-sm' },
    large: { value: 'text-4xl font-bold', label: 'text-base' },
  };

  const alignmentClasses = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  };

  const sizes = sizeClasses[size as keyof typeof sizeClasses] || sizeClasses.medium;
  const align = alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.center;

  const content = (
    <div className={cn('flex flex-col gap-1', align)}>
      <span className={cn(sizes.value, 'text-primary')}>
        {formattedValue}
      </span>
      {label && (
        <span className={cn(sizes.label, 'text-muted-foreground')}>
          {label}
        </span>
      )}
    </div>
  );

  if (showCard) {
    return (
      <Card>
        <CardContent className="pt-6">
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
}

export default StatsBlockComponent;
