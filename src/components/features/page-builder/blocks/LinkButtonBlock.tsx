/**
 * Link Button Block
 * 
 * Displays a button that links to a URL (static or from field).
 */

import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import type { BlockComponentProps } from '@/types/page-builder';
import { cn } from '@/lib/utils';

export function LinkButtonBlockComponent({
  block,
  record,
}: BlockComponentProps) {
  const { 
    urlField,
    staticUrl,
    labelField,
    staticLabel,
    variant = 'default',
    size = 'default',
    alignment = 'left',
    showIcon = true,
    openInNewTab = true,
  } = block.props;

  // Get URL from field or use static URL
  const url = urlField ? String(record[urlField] || '') : (staticUrl || '');
  const label = labelField ? String(record[labelField] || '') : (staticLabel || 'Abrir Link');

  if (!url) return null;

  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  const handleClick = () => {
    if (openInNewTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  };

  return (
    <div className={cn(
      'flex',
      alignmentClasses[alignment as keyof typeof alignmentClasses] || alignmentClasses.left
    )}>
      <Button
        variant={variant as 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'}
        size={size as 'default' | 'sm' | 'lg' | 'icon'}
        onClick={handleClick}
      >
        {label}
        {showIcon && <ExternalLink className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}

export default LinkButtonBlockComponent;
