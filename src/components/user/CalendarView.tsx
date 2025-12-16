import { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, View, Event, Components } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { DatabaseConnection, FieldMapping, CalendarEvent } from '@/services/database-connections';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { CalendarEventComponent } from './CalendarEventComponent';
import './CalendarView.css';

const locales = {
  'pt-BR': ptBR,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface CalendarViewProps {
  connection: DatabaseConnection;
  records: any[];
  dateField: string;
  onRecordClick: (record: any) => void;
  onRefresh?: () => void;
}

export function CalendarView({
  connection,
  records,
  dateField,
  onRecordClick,
  onRefresh,
}: CalendarViewProps) {
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());

  // Mapear records para eventos do calendário
  const events = useMemo(() => {
    return mapRecordsToEvents(records, dateField, connection.fieldMappings || []);
  }, [records, dateField, connection.fieldMappings]);

  const handleSelectEvent = (event: Event) => {
    const calendarEvent = event as CalendarEvent;
    if (calendarEvent.resource) {
      onRecordClick(calendarEvent.resource);
    }
  };

  const handleNavigate = (newDate: Date) => {
    setDate(newDate);
  };

  const handleViewChange = (newView: View) => {
    setView(newView);
  };

  const goToToday = () => {
    setDate(new Date());
  };

  const goToPrevious = () => {
    const newDate = new Date(date);
    if (view === 'month') {
      newDate.setMonth(date.getMonth() - 1);
    } else if (view === 'week') {
      newDate.setDate(date.getDate() - 7);
    } else {
      newDate.setDate(date.getDate() - 1);
    }
    setDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(date);
    if (view === 'month') {
      newDate.setMonth(date.getMonth() + 1);
    } else if (view === 'week') {
      newDate.setDate(date.getDate() + 7);
    } else {
      newDate.setDate(date.getDate() + 1);
    }
    setDate(newDate);
  };

  // Custom components for react-big-calendar
  const components: Components<CalendarEvent> = useMemo(
    () => ({
      event: ({ event }) => (
        <CalendarEventComponent
          event={event}
          fieldMappings={connection.fieldMappings || []}
        />
      ),
    }),
    [connection.fieldMappings]
  );

  // Mensagens em português
  const messages = {
    allDay: 'Dia inteiro',
    previous: 'Anterior',
    next: 'Próximo',
    today: 'Hoje',
    month: 'Mês',
    week: 'Semana',
    day: 'Dia',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'Não há eventos neste período.',
    showMore: (total: number) => `+ ${total} mais`,
  };

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum registro encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Não há registros para exibir no calendário.
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

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Custom Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrevious}
              aria-label="Período anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={goToToday}>
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={goToNext}
              aria-label="Próximo período"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-lg font-semibold">
            {format(date, view === 'month' ? 'MMMM yyyy' : 'dd MMMM yyyy', { locale: ptBR })}
          </h2>

          <div className="flex gap-2">
            <Button
              variant={view === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewChange('month')}
            >
              Mês
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewChange('week')}
            >
              Semana
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleViewChange('day')}
            >
              Dia
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <div className="calendar-container" style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={handleViewChange}
            date={date}
            onNavigate={handleNavigate}
            onSelectEvent={handleSelectEvent}
            culture="pt-BR"
            messages={messages}
            toolbar={false} // Usando toolbar customizado
            popup
            selectable
            className="rounded-lg border"
            components={components}
          />
        </div>

        {/* Info */}
        <div className="mt-4 text-sm text-muted-foreground">
          <p>
            Exibindo {events.length} evento(s) organizados por{' '}
            <strong>{dateField}</strong>
          </p>
          <p className="mt-1">
            Clique em um evento para visualizar ou editar o registro.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mapear records para eventos do calendário
 */
function mapRecordsToEvents(
  records: any[],
  dateField: string,
  fieldMappings: FieldMapping[]
): CalendarEvent[] {
  // Validação de entrada
  if (!records || !Array.isArray(records)) {
    console.warn('mapRecordsToEvents: records inválidos', records);
    return [];
  }

  if (!dateField) {
    console.warn('mapRecordsToEvents: dateField não fornecido');
    return [];
  }

  // Tentar encontrar o campo de data com diferentes variações
  const findDateField = (record: any, fieldName: string): any => {
    if (!record || typeof record !== 'object') {
      return undefined;
    }

    // Tentar o nome exato primeiro
    if (record[fieldName] !== undefined && record[fieldName] !== null && record[fieldName] !== '') {
      return record[fieldName];
    }
    
    // Tentar variações comuns do nome do campo
    const variations = [
      fieldName,
      fieldName.toLowerCase(),
      fieldName.toUpperCase(),
      fieldName.replace(/_/g, ''), // sem underscore: created_at -> createdat
      fieldName.charAt(0).toUpperCase() + fieldName.slice(1), // PascalCase: created_at -> Created_at
      fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), // camelCase: created_at -> createdAt
      // Variações específicas para campos comuns
      'CreatedAt',
      'createdAt',
      'created_time',
      'CreatedTime',
      'createdTime',
    ];
    
    for (const variation of variations) {
      if (record[variation] !== undefined && record[variation] !== null && record[variation] !== '') {
        return record[variation];
      }
    }
    
    return undefined;
  };

  const events = records
    .filter((record) => {
      // Filtrar registros que têm o campo de data
      try {
        const dateValue = findDateField(record, dateField);
        return dateValue && !isNaN(new Date(dateValue).getTime());
      } catch (error) {
        console.warn('Erro ao processar registro para calendário:', error, record);
        return false;
      }
    })
    .map((record) => {
      try {
        const rawDateValue = findDateField(record, dateField);
        
        // Parse date as local time to avoid timezone issues
        let dateValue: Date;
        
        if (typeof rawDateValue === 'string') {
          // Check if it's an ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
          if (rawDateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
            // Extract date parts to create local date
            const dateParts = rawDateValue.split(/[-T:]/);
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2], 10);
            
            // Create date in local timezone
            dateValue = new Date(year, month, day);
          } else {
            // For other formats, try parsing normally
            dateValue = new Date(rawDateValue);
          }
        } else {
          dateValue = new Date(rawDateValue);
        }
        
        return {
          id: record.id || record.Id,
          title: getRecordTitle(record, fieldMappings || []),
          start: dateValue,
          end: dateValue,
          resource: record,
        };
      } catch (error) {
        console.error('Erro ao mapear registro para evento:', error, record);
        // Retornar evento com dados mínimos em caso de erro
        return {
          id: record.id || record.Id || 'unknown',
          title: 'Erro ao carregar evento',
          start: new Date(),
          end: new Date(),
          resource: record,
        };
      }
    });

  return events;
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

/**
 * Gerar título do evento baseado nos campos marcados como "Show in Card"
 */
function getRecordTitle(record: any, fieldMappings: FieldMapping[]): string {
  const cardFields = fieldMappings.filter((f) => f.showInCard && f.visible);

  if (cardFields.length === 0) {
    // Se não há campos marcados, usar ID
    return `Registro #${record.id || record.Id}`;
  }

  // Concatenar valores dos campos marcados com formatação
  const values = cardFields
    .map((field) => record[field.columnName])
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => formatValue(value))
    .join(' - ');

  return values || `Registro #${record.id || record.Id}`;
}
