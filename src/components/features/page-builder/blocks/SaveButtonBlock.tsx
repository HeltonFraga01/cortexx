/**
 * Save Button Block
 * 
 * Displays the save button for the form.
 */

import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import type { BlockComponentProps } from '@/types/page-builder';

export function SaveButtonBlockComponent({
  block,
  onSave,
  saving,
  hasChanges,
  isPreview,
}: BlockComponentProps) {
  const { 
    label = 'Salvar Alterações',
    position = 'right',
    variant = 'default',
    fullWidth = false,
  } = block.props;

  const positionClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div className={`flex ${positionClasses[position as keyof typeof positionClasses] || positionClasses.right} pt-4`}>
      <Button 
        onClick={isPreview ? undefined : onSave}
        disabled={saving || !hasChanges || isPreview}
        variant={variant}
        className={fullWidth ? 'w-full' : ''}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
    </div>
  );
}

export default SaveButtonBlockComponent;
