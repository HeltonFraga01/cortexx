/**
 * BuilderCanvas Component
 * 
 * Drop zone for blocks with reordering support.
 * Shows visual feedback during drag operations.
 */

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { blockRegistry } from './BlockRegistry';
import type { ThemeBlock } from '@/types/page-builder';
import { GripVertical, Trash2, Settings, AlertTriangle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableBlockProps {
  block: ThemeBlock;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  hasWarning?: boolean;
}

function SortableBlock({ 
  block, 
  isSelected, 
  onSelect, 
  onDelete,
  onDuplicate,
  hasWarning = false,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const definition = blockRegistry.get(block.type);
  if (!definition) return null;

  const Icon = definition.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative border rounded-lg bg-background transition-all',
        isSelected && 'ring-2 ring-primary border-primary',
        isDragging && 'shadow-lg',
        !isSelected && 'hover:border-muted-foreground/50'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 p-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate">{definition.name}</span>
          {hasWarning && (
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            title="Configurar"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplicar"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Block preview/summary */}
      <div className="px-3 pb-3 pt-0">
        <BlockPreview block={block} />
      </div>
    </div>
  );
}

function BlockPreview({ block }: { block: ThemeBlock }) {
  const { type, props } = block;
  
  // Show column assignment indicator
  const columnIndicator = props?.parentRowId ? (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 ml-1">
      Col {(block.columnIndex ?? 0) + 1}
    </span>
  ) : null;

  switch (type) {
    case 'header':
      return (
        <div className="text-xs text-muted-foreground">
          {props.titleField ? `Título: ${props.titleField}` : 'Título padrão'}
        </div>
      );
    case 'form-grid':
      return (
        <div className="text-xs text-muted-foreground">
          {props.fields?.length > 0 
            ? `${props.fields.length} campo(s) em ${props.columns || 2} coluna(s)`
            : 'Nenhum campo selecionado'}
        </div>
      );
    case 'single-field':
      return (
        <div className="text-xs text-muted-foreground flex items-center">
          <span>{props.fieldName || 'Campo não selecionado'}</span>
          {columnIndicator}
        </div>
      );
    case 'avatar':
      return (
        <div className="text-xs text-muted-foreground flex items-center">
          <span>{props.nameField ? `Nome: ${props.nameField}` : 'Configurar campos'}</span>
          {columnIndicator}
        </div>
      );
    case 'section':
      return (
        <div className="text-xs text-muted-foreground">
          {props.title || 'Seção sem título'}
          {props.collapsible && ' (colapsável)'}
        </div>
      );
    case 'save-button':
      return (
        <div className="text-xs text-muted-foreground">
          {props.label || 'Salvar'}
        </div>
      );
    case 'info-card':
      return (
        <div className="text-xs text-muted-foreground">
          {props.showConnectionInfo ? 'Info da conexão' : props.fieldName || 'Configurar'}
        </div>
      );
    case 'text':
      return (
        <div className="text-xs text-muted-foreground flex items-center">
          <span>{props.textField ? `Campo: ${props.textField}` : (props.staticText ? 'Texto estático' : 'Configurar texto')}</span>
          {columnIndicator}
        </div>
      );
    case 'image':
      return (
        <div className="text-xs text-muted-foreground flex items-center">
          <span>{props.imageField ? `Imagem: ${props.imageField}` : 'Configurar imagem'}</span>
          {columnIndicator}
        </div>
      );
    case 'badge':
      return (
        <div className="text-xs text-muted-foreground">
          {props.textField ? `Campo: ${props.textField}` : (props.staticText || 'Configurar badge')}
        </div>
      );
    case 'stats':
      return (
        <div className="text-xs text-muted-foreground flex items-center">
          <span>{props.valueField ? `Valor: ${props.valueField}` : 'Configurar estatística'}</span>
          {columnIndicator}
        </div>
      );
    case 'link-button':
      return (
        <div className="text-xs text-muted-foreground">
          {props.staticLabel || props.labelField || 'Botão link'}
        </div>
      );
    case 'list':
      return (
        <div className="text-xs text-muted-foreground">
          {props.arrayField ? `Lista: ${props.arrayField}` : 'Configurar lista'}
        </div>
      );
    case 'tabs':
      return (
        <div className="text-xs text-muted-foreground">
          {props.tabs?.length || 0} aba(s)
        </div>
      );
    case 'row':
      return (
        <div className="text-xs text-muted-foreground">
          {props.columns || 2} coluna(s)
        </div>
      );
    default:
      return null;
  }
}

interface BuilderCanvasProps {
  blocks: ThemeBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (blockId: string) => void;
  fieldNames: string[];
}

export function BuilderCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onDuplicateBlock,
  fieldNames,
}: BuilderCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas',
  });

  // Check if block has field binding warnings
  const hasFieldWarning = (block: ThemeBlock): boolean => {
    const { type, props } = block;
    
    if (type === 'single-field' && props.fieldName) {
      return !fieldNames.includes(props.fieldName);
    }
    
    if (type === 'form-grid' && props.fields?.length > 0) {
      return props.fields.some((f: string) => !fieldNames.includes(f));
    }
    
    if (type === 'header') {
      if (props.titleField && !fieldNames.includes(props.titleField)) return true;
      if (props.subtitleField && !fieldNames.includes(props.subtitleField)) return true;
    }
    
    if (type === 'avatar') {
      if (props.imageField && !fieldNames.includes(props.imageField)) return true;
      if (props.nameField && !fieldNames.includes(props.nameField)) return true;
      if (props.statusField && !fieldNames.includes(props.statusField)) return true;
    }
    
    return false;
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-medium">Canvas</h3>
        <p className="text-xs text-muted-foreground">
          {blocks.length} bloco(s) • Clique para editar
        </p>
      </div>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          <div
            ref={setNodeRef}
            className={cn(
              'min-h-full p-4 transition-colors',
              isOver && 'bg-primary/5',
              blocks.length === 0 && 'flex items-center justify-center'
            )}
          >
            {blocks.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <p className="text-sm">Arraste blocos aqui</p>
                <p className="text-xs mt-1">para começar a construir seu tema</p>
              </div>
            ) : (
              <SortableContext
                items={blocks.map(b => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {blocks.map((block) => (
                    <SortableBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedBlockId === block.id}
                      onSelect={() => onSelectBlock(block.id)}
                      onDelete={() => onDeleteBlock(block.id)}
                      onDuplicate={() => onDuplicateBlock(block.id)}
                      hasWarning={hasFieldWarning(block)}
                    />
                  ))}
                  {/* Drop zone indicator at the end */}
                  <div 
                    className={cn(
                      'h-16 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors',
                      isOver ? 'border-primary bg-primary/5' : 'border-muted'
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      Arraste mais blocos aqui
                    </p>
                  </div>
                </div>
              </SortableContext>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
