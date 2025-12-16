/**
 * Divider Block
 * 
 * A visual divider/separator between sections.
 */

import { Separator } from '@/components/ui/separator';
import type { BlockComponentProps } from '@/types/page-builder';

export function DividerBlockComponent({
  block,
}: BlockComponentProps) {
  const { 
    spacing = 'normal',
    showLine = true,
  } = block.props;

  const spacingClasses = {
    compact: 'my-2',
    normal: 'my-4',
    relaxed: 'my-8',
  };

  if (!showLine) {
    return <div className={spacingClasses[spacing as keyof typeof spacingClasses] || spacingClasses.normal} />;
  }

  return (
    <div className={spacingClasses[spacing as keyof typeof spacingClasses] || spacingClasses.normal}>
      <Separator />
    </div>
  );
}

export default DividerBlockComponent;
