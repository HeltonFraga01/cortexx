import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DatabaseConnection, KanbanColumn } from '@/services/database-connections';
import { KanbanCard } from './KanbanCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Columns3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface KanbanViewProps {
  connection: DatabaseConnection;
  records: any[];
  statusField: string;
  onRecordUpdate: (recordId: string, updates: any) => Promise<void>;
  onRecordClick: (record: any) => void;
  onRefresh?: () => void;
}

/**
 * KanbanView Component
 * 
 * Displays records in a Kanban board layout with drag-and-drop functionality.
 * 
 * Data Validation:
 * - Validates and normalizes fieldMappings to ensure it's always a valid array
 * - Prevents errors from missing or malformed connection data
 * - Provides safe defaults for all data structures
 * 
 * Field Mappings:
 * - Passes validated fieldMappings to KanbanCard components
 * - Ensures consistency across all cards in the board
 */
export function KanbanView({
  connection,
  records,
  statusField,
  onRecordUpdate,
  onRecordClick,
  onRefresh,
}: KanbanViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Validar e normalizar fieldMappings
  // Garantir que sempre seja um array válido para evitar erros no KanbanCard
  const validFieldMappings = useMemo(() => {
    if (!connection.fieldMappings || !Array.isArray(connection.fieldMappings)) {
      return [];
    }
    return connection.fieldMappings;
  }, [connection.fieldMappings]);

  // Gerar colunas do Kanban
  const columns = useMemo(() => {
    return generateKanbanColumns(records, statusField);
  }, [records, statusField]);

  // Encontrar o record ativo durante o drag
  const activeRecord = useMemo(() => {
    if (!activeId) return null;
    return records.find((r) => String(r.id || r.Id) === activeId);
  }, [activeId, records]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const recordId = String(active.id);
    let newStatus = String(over.id);

    // Se over.id é um record ID, encontrar a coluna desse record
    const overRecord = records.find((r) => String(r.id || r.Id) === newStatus);
    if (overRecord) {
      newStatus = String(overRecord[statusField] || '__uncategorized__');
    }

    // Verificar se é uma coluna válida
    const targetColumn = columns.find((col) => col.id === newStatus);
    if (!targetColumn) {
      return;
    }

    // Encontrar o record
    const record = records.find((r) => String(r.id || r.Id) === recordId);
    if (!record) {
      return;
    }

    const currentStatus = String(record[statusField] || '__uncategorized__');

    // Verificar se o status realmente mudou
    if (currentStatus === newStatus) {
      return;
    }

    // Atualização otimista
    setUpdating(recordId);

    try {
      // Determinar o valor correto baseado no tipo do campo
      let statusValue: any;
      
      // Buscar o fieldMapping (pode usar 'name' ou 'columnName' dependendo da estrutura)
      const fieldMapping = connection.fieldMappings?.find(
        f => f.name === statusField || f.columnName === statusField
      );
      const fieldType = fieldMapping?.type?.toLowerCase() || fieldMapping?.uidt?.toLowerCase();
      
      if (newStatus === '__uncategorized__') {
        // Para campos booleanos, usar false; para outros, usar string vazia ou null
        if (fieldType === 'checkbox' || fieldType === 'boolean') {
          statusValue = false;
        } else if (typeof record[statusField] === 'boolean') {
          // Fallback: se o valor atual do record é boolean, usar false
          statusValue = false;
        } else {
          statusValue = '';
        }
      } else {
        // Converter o valor para o tipo correto
        if (fieldType === 'checkbox' || fieldType === 'boolean') {
          // Para booleanos, converter string para boolean
          statusValue = newStatus === 'true' || newStatus === '1' || newStatus === 'yes';
        } else if (typeof record[statusField] === 'boolean') {
          // Fallback: se o valor atual do record é boolean, converter
          statusValue = newStatus === 'true' || newStatus === '1' || newStatus === 'yes';
        } else if (fieldType === 'number' || fieldType === 'decimal' || fieldType === 'percent') {
          // Para números, converter para número
          statusValue = Number(newStatus);
        } else {
          // Para outros tipos, manter como string
          statusValue = newStatus;
        }
      }
      
      await onRecordUpdate(recordId, { [statusField]: statusValue });
      
      // Recarregar dados para refletir a mudança
      if (onRefresh) {
        await onRefresh();
      }
      
      toast.success('Status atualizado com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao atualizar status no Kanban:', error);
      toast.error(error.message || 'Erro ao atualizar status');
      
      // Recarregar dados em caso de erro
      if (onRefresh) {
        onRefresh();
      }
    } finally {
      setUpdating(null);
    }
  };

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Columns3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum registro encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Não há registros para exibir no quadro Kanban.
            </p>
            {onRefresh && (
              <Button onClick={onRefresh} variant="outline">
                Atualizar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (columns.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Columns3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma coluna disponível</h3>
            <p className="text-muted-foreground">
              O campo <strong>{statusField}</strong> não possui valores únicos para criar colunas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Buscar o label do campo de status
  const statusFieldLabel = connection.fieldMappings?.find(
    f => f.name === statusField || f.columnName === statusField
  )?.label || statusField;

  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            Organizando por: <span className="font-medium text-foreground">{statusFieldLabel}</span>
          </p>
          <p>
            {records.length} registro(s) em {columns.length} coluna(s)
          </p>
          <p className="text-xs">
            Arraste os cards entre as colunas para atualizar o campo
          </p>
        </div>
        {onRefresh && (
          <Button onClick={onRefresh} variant="outline" size="sm">
            Atualizar
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <SortableContext
              key={column.id}
              id={column.id}
              items={column.records.map((r) => String(r.id || r.Id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex-shrink-0 w-80">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{column.title}</span>
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {column.records.length}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                    {column.records.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <p>Nenhum card nesta coluna</p>
                        <p className="text-xs mt-1">Arraste cards para cá</p>
                      </div>
                    ) : (
                      column.records.map((record) => {
                        const recordId = String(record.id || record.Id);
                        const isUpdating = updating === recordId;

                        return (
                          <div key={recordId} className="relative">
                            {isUpdating && (
                              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
                                <Loader2 className="h-4 w-4 animate-spin" />
                              </div>
                            )}
                            <KanbanCard
                              record={record}
                              fieldMappings={validFieldMappings}
                              onClick={() => onRecordClick(record)}
                            />
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </SortableContext>
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && activeRecord ? (
            <div className="rotate-3 opacity-80">
              <KanbanCard
                record={activeRecord}
                fieldMappings={validFieldMappings}
                onClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/**
 * Gerar colunas do Kanban baseadas em valores únicos do campo de status
 */
function generateKanbanColumns(records: any[], statusField: string): KanbanColumn[] {
  // Extrair valores únicos do campo de status
  const uniqueStatuses = Array.from(
    new Set(
      records
        .map((r) => r[statusField])
        .filter((status) => {
          // Incluir valores booleanos false, mas excluir null, undefined e string vazia
          if (typeof status === 'boolean') return true;
          return status !== null && status !== undefined && status !== '';
        })
    )
  );

  // Criar colunas
  const columns: KanbanColumn[] = uniqueStatuses.map((status) => {
    // Para booleanos, criar títulos mais amigáveis
    let title = String(status);
    if (typeof status === 'boolean') {
      title = status ? 'Sim' : 'Não';
    }
    
    return {
      id: String(status),
      title: title,
      records: records.filter((r) => r[statusField] === status),
    };
  });

  // Adicionar coluna "Sem Status" para registros sem valor (null, undefined ou string vazia)
  const recordsWithoutStatus = records.filter((r) => {
    const value = r[statusField];
    // Não incluir false aqui, pois false é um valor válido para booleanos
    return value === null || value === undefined || value === '';
  });

  if (recordsWithoutStatus.length > 0) {
    columns.push({
      id: '__uncategorized__',
      title: 'Sem Status',
      records: recordsWithoutStatus,
    });
  }

  return columns;
}
