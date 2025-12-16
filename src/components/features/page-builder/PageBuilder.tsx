/**
 * PageBuilder Component
 * 
 * Main page builder interface integrating all sub-components.
 * Manages builder state and drag-and-drop operations.
 * Includes undo/redo functionality via HistoryManager.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  useSensor,
  useSensors,
  CollisionDetection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConnectionSelector } from './ConnectionSelector';
import { BlockLibrary } from './BlockLibrary';
import { BuilderCanvas } from './BuilderCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { ThemePreview } from './ThemePreview';
import { blockRegistry } from './BlockRegistry';
import { HistoryManager } from './utils/HistoryManager';
import { duplicateBlock } from './utils/blockUtils';
import type { 
  ThemeBlock, 
  PageBuilderState, 
  ThemeSchema,
  BlockType,
} from '@/types/page-builder';
import type { DatabaseConnection, FieldMetadata } from '@/lib/types';
import { Eye, Save, Loader2, Undo2, Redo2, Copy } from 'lucide-react';
import { toast } from 'sonner';

// Import blocks to ensure registration
import './blocks';

interface PageBuilderProps {
  initialTheme?: ThemeSchema;
  onSave: (schema: ThemeSchema) => Promise<void>;
  saving?: boolean;
}

function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function PageBuilder({ initialTheme, onSave, saving = false }: PageBuilderProps) {
  const [state, setState] = useState<PageBuilderState>({
    connectionId: initialTheme?.connectionId || null,
    connection: null,
    fields: [],
    blocks: initialTheme?.blocks || [],
    selectedBlockId: null,
    isDragging: false,
    themeName: initialTheme?.name || '',
    themeDescription: initialTheme?.description || '',
  });

  const [showPreview, setShowPreview] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // History manager for undo/redo
  const historyRef = useRef(new HistoryManager());
  const isUndoRedoRef = useRef(false);

  // Update history state indicators
  const updateHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  // Push state to history when blocks change (but not during undo/redo)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    
    historyRef.current.push({
      blocks: state.blocks,
      selectedBlockId: state.selectedBlockId,
    });
    updateHistoryState();
  }, [state.blocks, updateHistoryState]);

  // Undo handler
  const handleUndo = useCallback(() => {
    const previousState = historyRef.current.undo();
    if (previousState) {
      isUndoRedoRef.current = true;
      setState(prev => ({
        ...prev,
        blocks: previousState.blocks,
        selectedBlockId: previousState.selectedBlockId,
      }));
      updateHistoryState();
    }
  }, [updateHistoryState]);

  // Redo handler
  const handleRedo = useCallback(() => {
    const nextState = historyRef.current.redo();
    if (nextState) {
      isUndoRedoRef.current = true;
      setState(prev => ({
        ...prev,
        blocks: nextState.blocks,
        selectedBlockId: nextState.selectedBlockId,
      }));
      updateHistoryState();
    }
  }, [updateHistoryState]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Custom collision detection that prioritizes canvas for library blocks
  const customCollisionDetection: CollisionDetection = (args) => {
    const { active } = args;
    const activeData = active.data.current;
    
    // For library blocks, use pointerWithin to detect canvas
    if (activeData?.type === 'library-block') {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        return pointerCollisions;
      }
      // Fallback to rectIntersection
      return rectIntersection(args);
    }
    
    // For canvas blocks (reordering), use rectIntersection
    return rectIntersection(args);
  };

  // Handle connection change
  const handleConnectionChange = useCallback((
    connection: DatabaseConnection | null,
    fields: FieldMetadata[]
  ) => {
    setState(prev => ({
      ...prev,
      connectionId: connection?.id || null,
      connection,
      fields,
    }));
  }, []);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setState(prev => ({ ...prev, isDragging: true }));
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setState(prev => ({ ...prev, isDragging: false }));

    if (!over) return;

    const activeData = active.data.current;

    // Dropping from library to canvas (either on canvas itself or on an existing block)
    if (activeData?.type === 'library-block') {
      // Accept drop on canvas or on any existing block
      const isDropOnCanvas = over.id === 'canvas';
      const isDropOnBlock = state.blocks.some(b => b.id === over.id);
      
      if (isDropOnCanvas || isDropOnBlock) {
        const blockType = activeData.blockType as BlockType;
        const definition = blockRegistry.get(blockType);
        
        if (definition) {
          const newBlock: ThemeBlock = {
            id: generateBlockId(),
            type: blockType,
            props: { ...definition.defaultProps },
          };

          setState(prev => {
            // If dropped on a block, insert after that block
            if (isDropOnBlock) {
              const targetIndex = prev.blocks.findIndex(b => b.id === over.id);
              const newBlocks = [...prev.blocks];
              newBlocks.splice(targetIndex + 1, 0, newBlock);
              return {
                ...prev,
                blocks: newBlocks,
                selectedBlockId: newBlock.id,
              };
            }
            
            // If dropped on canvas, add to end
            return {
              ...prev,
              blocks: [...prev.blocks, newBlock],
              selectedBlockId: newBlock.id,
            };
          });
        }
        return;
      }
    }

    // Reordering within canvas
    if (active.id !== over.id) {
      setState(prev => {
        const oldIndex = prev.blocks.findIndex(b => b.id === active.id);
        const newIndex = prev.blocks.findIndex(b => b.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          return {
            ...prev,
            blocks: arrayMove(prev.blocks, oldIndex, newIndex),
          };
        }
        return prev;
      });
    }
  };

  // Select block
  const handleSelectBlock = useCallback((blockId: string | null) => {
    setState(prev => ({ ...prev, selectedBlockId: blockId }));
  }, []);

  // Delete block
  const handleDeleteBlock = useCallback((blockId: string) => {
    setState(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId),
      selectedBlockId: prev.selectedBlockId === blockId ? null : prev.selectedBlockId,
    }));
  }, []);

  // Duplicate block
  const handleDuplicateBlock = useCallback((blockId: string) => {
    setState(prev => {
      const blockToDuplicate = prev.blocks.find(b => b.id === blockId);
      if (!blockToDuplicate) return prev;

      const duplicated = duplicateBlock(blockToDuplicate);
      const index = prev.blocks.findIndex(b => b.id === blockId);
      const newBlocks = [...prev.blocks];
      newBlocks.splice(index + 1, 0, duplicated);

      return {
        ...prev,
        blocks: newBlocks,
        selectedBlockId: duplicated.id,
      };
    });
    toast.success('Bloco duplicado');
  }, []);

  // Update block props
  const handleUpdateBlock = useCallback((blockId: string, props: Record<string, any>) => {
    setState(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, props } : b
      ),
    }));
  }, []);

  // Update block metadata (columnIndex, visibility, etc.)
  const handleUpdateBlockMeta = useCallback((blockId: string, meta: { columnIndex?: number }) => {
    setState(prev => ({
      ...prev,
      blocks: prev.blocks.map(b =>
        b.id === blockId ? { ...b, ...meta } : b
      ),
    }));
  }, []);

  // Find parent Row block for the selected block
  // A block is considered inside a Row if it has a columnIndex set
  // or if it's a child of a Row block
  const findParentBlock = useCallback((blockId: string | null): ThemeBlock | null => {
    if (!blockId) return null;
    
    const selectedBlock = state.blocks.find(b => b.id === blockId);
    if (!selectedBlock) return null;
    
    // Check if any Row block has this block as a child
    for (const block of state.blocks) {
      if (block.type === 'row' && block.children?.some(child => child.id === blockId)) {
        return block;
      }
    }
    
    // If the block has a parentRowId, find that Row
    if (selectedBlock.props?.parentRowId) {
      return state.blocks.find(b => b.id === selectedBlock.props.parentRowId) || null;
    }
    
    return null;
  }, [state.blocks]);

  // Get all Row blocks for column assignment
  const rowBlocks = state.blocks.filter(b => b.type === 'row');

  // Save theme
  const handleSave = async () => {
    if (!state.themeName.trim()) {
      toast.error('Nome do tema é obrigatório');
      return;
    }

    if (state.blocks.length === 0) {
      toast.error('Adicione pelo menos um bloco ao tema');
      return;
    }

    const schema: ThemeSchema = {
      id: initialTheme?.id || `custom-${Date.now()}`,
      name: state.themeName,
      description: state.themeDescription,
      connectionId: state.connectionId || undefined,
      blocks: state.blocks,
      createdAt: initialTheme?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSave(schema);
  };

  const selectedBlock = state.blocks.find(b => b.id === state.selectedBlockId) || null;
  const fieldNames = state.fields.map(f => f.columnName);

  // Get active block definition for drag overlay
  const getActiveBlockName = () => {
    if (!activeId) return null;
    
    if (activeId.startsWith('library-')) {
      const blockType = activeId.replace('library-', '') as BlockType;
      const def = blockRegistry.get(blockType);
      return def?.name || blockType;
    }
    
    const block = state.blocks.find(b => b.id === activeId);
    if (block) {
      const def = blockRegistry.get(block.type);
      return def?.name || block.type;
    }
    
    return null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col gap-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Page Builder</CardTitle>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <div className="flex items-center gap-1 mr-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleUndo}
                          disabled={!canUndo}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleRedo}
                          disabled={!canRedo}
                        >
                          <Redo2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Refazer (Ctrl+Shift+Z)</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                  disabled={state.blocks.length === 0}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Tema
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="theme-name">Nome do Tema</Label>
                <Input
                  id="theme-name"
                  value={state.themeName}
                  onChange={(e) => setState(prev => ({ ...prev, themeName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme-description">Descrição</Label>
                <Textarea
                  id="theme-description"
                  value={state.themeDescription}
                  onChange={(e) => setState(prev => ({ ...prev, themeDescription: e.target.value }))}
                  rows={1}
                  className="resize-none"
                />
              </div>
              <ConnectionSelector
                selectedConnectionId={state.connectionId}
                onConnectionChange={handleConnectionChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Builder Area */}
        <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
          {/* Block Library */}
          <div className="col-span-3 min-w-[280px]">
            <BlockLibrary disabled={!state.connection} />
          </div>

          {/* Canvas */}
          <div className="col-span-5">
            <BuilderCanvas
              blocks={state.blocks}
              selectedBlockId={state.selectedBlockId}
              onSelectBlock={handleSelectBlock}
              onDeleteBlock={handleDeleteBlock}
              onDuplicateBlock={handleDuplicateBlock}
              fieldNames={fieldNames}
            />
          </div>

          {/* Properties Panel */}
          <div className="col-span-4">
            <PropertiesPanel
              selectedBlock={selectedBlock}
              fields={state.fields}
              onUpdateBlock={handleUpdateBlock}
              onUpdateBlockMeta={handleUpdateBlockMeta}
              parentBlock={findParentBlock(state.selectedBlockId)}
              rowBlocks={rowBlocks}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && (
          <div className="bg-primary text-primary-foreground px-3 py-2 rounded-md shadow-lg text-sm font-medium">
            {getActiveBlockName()}
          </div>
        )}
      </DragOverlay>

      {/* Preview Modal */}
      {showPreview && state.connection && (
        <ThemePreview
          blocks={state.blocks}
          connection={state.connection}
          fields={state.fields}
          onClose={() => setShowPreview(false)}
        />
      )}
    </DndContext>
  );
}
