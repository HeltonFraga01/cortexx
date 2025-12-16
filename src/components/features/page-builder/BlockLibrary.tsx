/**
 * BlockLibrary Component
 * 
 * Panel displaying available blocks organized by category.
 * Blocks are draggable using @dnd-kit.
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { blockRegistry } from './BlockRegistry';
import type { BlockDefinition, BlockCategory } from '@/types/page-builder';
import { GripVertical } from 'lucide-react';

interface DraggableBlockProps {
  definition: BlockDefinition;
}

function DraggableBlock({ definition }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${definition.type}`,
    data: {
      type: 'library-block',
      blockType: definition.type,
      definition,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = definition.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center gap-3 p-3 bg-background border rounded-lg cursor-grab hover:border-primary hover:bg-accent/50 transition-colors active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex items-center gap-2 flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{definition.name}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{definition.description}</p>
      </div>
    </div>
  );
}

const categoryLabels: Record<BlockCategory, string> = {
  layout: 'Layout',
  fields: 'Campos',
  display: 'Exibição',
  actions: 'Ações',
};

const categoryColors: Record<BlockCategory, string> = {
  layout: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  fields: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  display: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  actions: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

interface BlockLibraryProps {
  disabled?: boolean;
}

export function BlockLibrary({ disabled = false }: BlockLibraryProps) {
  const categories = blockRegistry.getCategories();

  return (
    <Card className="h-full flex flex-col relative overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-base">Blocos</CardTitle>
        <p className="text-xs text-muted-foreground">
          Arraste os blocos para o canvas
        </p>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-3 pb-4 space-y-4">
            {categories.map(({ category, blocks }) => (
              blocks.length > 0 && (
                <div key={category} className="space-y-2">
                  <Badge 
                    variant="secondary" 
                    className={`${categoryColors[category]} border-0`}
                  >
                    {categoryLabels[category]}
                  </Badge>
                  <div className="space-y-2">
                    {blocks.map((block) => (
                      <DraggableBlock
                        key={block.type}
                        definition={block}
                      />
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      {disabled && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Selecione uma conexão primeiro
          </p>
        </div>
      )}
    </Card>
  );
}
