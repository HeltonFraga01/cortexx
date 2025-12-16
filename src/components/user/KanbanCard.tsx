import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { FieldMapping } from '@/services/database-connections';
import { GripVertical } from 'lucide-react';

interface KanbanCardProps {
  record: any;
  fieldMappings?: FieldMapping[];
  onClick: () => void;
}

/**
 * KanbanCard Component
 * 
 * Displays a draggable card in the Kanban view with filtered field data.
 * 
 * Field Display Logic:
 * 1. Primary: Shows fields with showInCard: true and visible: true
 * 2. Fallback: If no fields have showInCard: true, shows first 3 visible non-technical fields
 * 3. Final Fallback: If no visible fields, shows record ID only
 * 
 * Value Handling:
 * - Skips null, undefined, and empty string values
 * - Keeps boolean false and number 0 (valid values)
 * - Formats booleans as "Sim"/"Não"
 * - Formats numbers with locale formatting
 * - Formats dates with locale date formatting
 */
export function KanbanCard({ record, fieldMappings = [], onClick }: KanbanCardProps) {
  const recordId = String(record.id || record.Id);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recordId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Filtrar campos para exibir no card
  // Prioridade: campos com showInCard: true e visible: true
  let cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);
  
  // Fallback melhorado: se nenhum campo tem showInCard: true,
  // mostrar os primeiros 3 campos visíveis (exceto campos técnicos)
  if (cardFields.length === 0) {
    const technicalFields = ['id', 'Id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order'];
    cardFields = fieldMappings
      .filter((f) => f.visible && !technicalFields.includes(f.columnName))
      .slice(0, 3);
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow bg-card"
        onClick={onClick}
      >
        <CardContent className="p-4">
          {/* Drag Handle */}
          <div className="flex items-start gap-2">
            <button
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-1"
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              aria-label="Arrastar card"
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <div className="flex-1 space-y-2 min-w-0">
              {/* Card Fields */}
              {cardFields.length > 0 ? (
                cardFields.map((field) => {
                  // Verificar se o campo existe no record
                  if (!(field.columnName in record)) return null;
                  
                  const value = record[field.columnName];
                  
                  // Pular valores nulos, undefined ou strings vazias
                  // Mas manter valores booleanos false e números 0
                  if (value === null || value === undefined || value === '') return null;

                  // Formatar valor baseado no tipo
                  let displayValue: string;
                  if (typeof value === 'boolean') {
                    displayValue = value ? 'Sim' : 'Não';
                  } else if (typeof value === 'number') {
                    displayValue = value.toLocaleString('pt-BR');
                  } else if (value instanceof Date) {
                    displayValue = value.toLocaleDateString('pt-BR');
                  } else {
                    displayValue = String(value);
                  }

                  return (
                    <div key={field.columnName} className="space-y-1">
                      <p className="text-xs text-muted-foreground truncate">
                        {field.label}
                      </p>
                      <p className="text-sm font-medium break-words line-clamp-3">
                        {displayValue}
                      </p>
                    </div>
                  );
                })
              ) : (
                // Fallback final: mostrar apenas ID se não há campos visíveis
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ID</p>
                  <p className="text-sm font-medium">
                    #{recordId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
