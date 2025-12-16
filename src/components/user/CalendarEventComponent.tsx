import { CalendarEvent, FieldMapping } from '@/services/database-connections';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Props for the CalendarEventComponent
 */
export interface CalendarEventComponentProps {
  event: CalendarEvent;
  fieldMappings: FieldMapping[];
}

/**
 * Custom component for rendering calendar events with field filtering
 * 
 * This component displays calendar events with only the fields marked as
 * showInCard: true and visible: true, following the same pattern used in
 * Grid, List, and Kanban views.
 * 
 * Requirements: 5.1, 5.2
 */
export function CalendarEventComponent({ 
  event, 
  fieldMappings 
}: CalendarEventComponentProps) {
  // Get the record data from the event resource
  const record = event.resource;

  // Filter fields by showInCard: true AND visible: true
  const cardFields = (fieldMappings || []).filter(
    (f) => f.showInCard && f.visible
  );

  // Generate event title
  const title = getEventTitle(record, cardFields);

  // Truncate title for display (max 50 characters)
  const displayTitle = truncateText(title, 50);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className="calendar-event"
            title={title}
            role="button"
            tabIndex={0}
            aria-label={`Evento: ${title}`}
          >
            {displayTitle}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs" side="top" align="center">
          <div className="space-y-1">
            {cardFields.length === 0 ? (
              <div className="text-sm">
                <span className="font-medium">ID:</span>{' '}
                <span>{record.id || record.Id}</span>
              </div>
            ) : (
              cardFields.map((field) => {
                const value = record[field.columnName];
                
                // Skip fields with null/undefined/empty values
                if (value === null || value === undefined || value === '') {
                  return null;
                }

                return (
                  <div key={field.columnName} className="text-sm">
                    <span className="font-medium">{field.label}:</span>{' '}
                    <span>{formatValue(value)}</span>
                  </div>
                );
              })
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Generate event title based on fields marked with showInCard: true
 */
function getEventTitle(record: any, cardFields: FieldMapping[]): string {
  if (cardFields.length === 0) {
    return `Registro #${record.id || record.Id}`;
  }

  const values = cardFields
    .map((field) => record[field.columnName])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => formatValue(value))
    .join(' - ');

  return values || `Registro #${record.id || record.Id}`;
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format value based on type
 */
function formatValue(value: any): string {
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR');
  }
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }
  // Handle date strings
  if (typeof value === 'string' && !isNaN(Date.parse(value))) {
    const date = new Date(value);
    // Only format as date if it looks like a date (has time component or is ISO format)
    if (value.includes('T') || value.includes('-')) {
      return date.toLocaleDateString('pt-BR');
    }
  }
  return String(value);
}
