/**
 * Header Block
 * 
 * Displays a page header with title, subtitle, and optional back button.
 */

import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { BlockComponentProps } from '@/types/page-builder';

export function HeaderBlockComponent({
  block,
  connection,
  record,
  onBack,
  isPreview,
}: BlockComponentProps) {
  const { titleField, subtitleField, showBackButton = true } = block.props;
  
  // Get title from field or use connection name
  const title = titleField && record[titleField] 
    ? String(record[titleField]) 
    : `Editar Registro - ${connection.name}`;
  
  // Get subtitle from field or use default
  const subtitle = subtitleField && record[subtitleField]
    ? String(record[subtitleField])
    : 'Modifique as informações do seu registro';

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
        {showBackButton && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={isPreview ? undefined : onBack}
            disabled={isPreview}
            className="self-start sm:self-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>
    </header>
  );
}

export default HeaderBlockComponent;
