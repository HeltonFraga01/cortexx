import { useState, useMemo } from 'react';
import { DateTime } from 'luxon';
import { Calendar, AlertCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

import 'react-datepicker/dist/react-datepicker.css';

export interface SchedulingInputProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  minDate?: Date;
  disabled?: boolean;
  className?: string;
  showSummary?: boolean;
  timezone?: string;
}

/**
 * SchedulingInput - Componente compartilhado para seleção de data/hora com validação
 * 
 * Features:
 * - Detecção automática de dispositivo (mobile vs desktop)
 * - Validação em tempo real
 * - Feedback visual imediato
 * - Formatação brasileira
 * - Suporte a timezone
 * 
 * @example
 * ```tsx
 * <SchedulingInput
 *   value={scheduledDateTime}
 *   onChange={setScheduledDateTime}
 *   onValidationChange={setIsSchedulingValid}
 *   showSummary={true}
 * />
 * ```
 */
export function SchedulingInput({
  value,
  onChange,
  onValidationChange,
  minDate = new Date(),
  disabled = false,
  className,
  showSummary = true,
  timezone = 'America/Sao_Paulo',
}: SchedulingInputProps) {
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Extract time from value prop using Luxon (controlled component)
  const time = useMemo(() => {
    if (!value) return '12:00';
    return DateTime.fromJSDate(value).setZone(timezone).toFormat('HH:mm');
  }, [value, timezone]);

  // Validation logic - only called on blur or date change
  const validateDateTime = (date: Date | null, timeValue: string) => {
    if (!date) {
      setError('Selecione uma data');
      onValidationChange?.(false, 'Selecione uma data');
      return false;
    }

    if (!timeValue || !/^\d{2}:\d{2}$/.test(timeValue)) {
      setError('Selecione um horário válido');
      onValidationChange?.(false, 'Selecione um horário válido');
      return false;
    }

    const [hours, minutes] = timeValue.split(':').map(Number);
    const dateTime = DateTime.fromJSDate(date)
      .setZone(timezone)
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    const now = DateTime.now().setZone(timezone);

    if (dateTime <= now) {
      setError('O horário deve ser no futuro');
      onValidationChange?.(false, 'O horário deve ser no futuro');
      return false;
    }

    setError(null);
    onValidationChange?.(true);
    return true;
  };

  // Handle date change - validate immediately
  const handleDateChange = (newDate: Date | null) => {
    if (!newDate) {
      onChange(null);
      setError('Selecione uma data');
      onValidationChange?.(false, 'Selecione uma data');
      return;
    }

    // Preserve existing time or use default
    const [hours, minutes] = time.split(':').map(Number);
    const dateTime = DateTime.fromJSDate(newDate)
      .setZone(timezone)
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    onChange(dateTime.toJSDate());
    validateDateTime(newDate, time);
  };

  // Handle time change - update immediately, validate on blur
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    
    if (!value) {
      // If no date selected yet, just show error
      setError('Selecione uma data primeiro');
      return;
    }

    // Update the time in the existing date
    const [hours, minutes] = newTime.split(':').map(Number);
    const dateTime = DateTime.fromJSDate(value)
      .setZone(timezone)
      .set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

    onChange(dateTime.toJSDate());
  };

  // Handle time blur - validate
  const handleTimeBlur = () => {
    if (value) {
      validateDateTime(value, time);
    }
  };

  // Format display date - memoized to avoid recalculation
  const displayDate = useMemo(() => {
    if (!value || error) return null;
    
    return DateTime.fromJSDate(value)
      .setZone(timezone)
      .toFormat("dd/MM/yyyy 'às' HH:mm");
  }, [value, error, timezone]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Date Input */}
      <div className="space-y-2">
        <Label htmlFor="schedule-date">Data</Label>
        {isMobile ? (
          <Input
            id="schedule-date"
            type="date"
            value={value ? format(value, 'yyyy-MM-dd') : ''}
            onChange={(e) =>
              handleDateChange(e.target.value ? new Date(e.target.value) : null)
            }
            min={format(minDate, 'yyyy-MM-dd')}
            disabled={disabled}
            className={cn(error && 'border-destructive')}
            aria-invalid={!!error}
            aria-describedby="date-help"
          />
        ) : (
          <DatePicker
            selected={value}
            onChange={handleDateChange}
            minDate={minDate}
            disabled={disabled}
            locale={ptBR}
            dateFormat="dd/MM/yyyy"
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive'
            )}
          />
        )}
        <p id="date-help" className="text-xs text-muted-foreground">
          Selecione uma data futura
        </p>
      </div>

      {/* Time Input */}
      <div className="space-y-2">
        <Label htmlFor="schedule-time">Hora</Label>
        <Input
          id="schedule-time"
          type="time"
          value={time}
          onChange={handleTimeChange}
          onBlur={handleTimeBlur}
          disabled={disabled}
          className={cn(error && 'border-destructive')}
          aria-invalid={!!error}
          aria-describedby="time-help"
        />
        <p id="time-help" className="text-xs text-muted-foreground">
          Horário de Brasília (GMT-3)
        </p>
      </div>

      {/* Error Feedback */}
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary */}
      {showSummary && displayDate && !error && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            <strong>Agendado para:</strong> {displayDate}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
