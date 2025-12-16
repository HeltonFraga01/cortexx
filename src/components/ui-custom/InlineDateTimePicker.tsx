import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { isValidDate } from '@/utils/fieldTypeResolver';

export interface InlineDateTimePickerProps {
  value?: Date | string | null;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: boolean;
  minDate?: Date;
  maxDate?: Date;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const InlineDateTimePicker = React.forwardRef<HTMLDivElement, InlineDateTimePickerProps>(
  (
    {
      value,
      onChange,
      disabled = false,
      placeholder = 'Selecione data e hora',
      className,
      error = false,
      minDate,
      maxDate,
      onValidationChange
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
    const [timeValue, setTimeValue] = React.useState<string>('00:00');
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Initialize from value prop
    React.useEffect(() => {
      if (value) {
        const date = value instanceof Date ? value : new Date(value);
        if (isValidDate(date)) {
          setSelectedDate(date);
          setTimeValue(format(date, 'HH:mm'));
        }
      } else {
        setSelectedDate(undefined);
        setTimeValue('00:00');
      }
    }, [value]);

    // Close calendar when clicking outside
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    // Validate date against min/max constraints
    const validateDate = React.useCallback(
      (date: Date): { isValid: boolean; error?: string } => {
        if (!isValidDate(date)) {
          return { isValid: false, error: 'Data inválida' };
        }

        if (minDate && date < minDate) {
          return {
            isValid: false,
            error: `Data deve ser após ${format(minDate, 'dd/MM/yyyy', { locale: ptBR })}`
          };
        }

        if (maxDate && date > maxDate) {
          return {
            isValid: false,
            error: `Data deve ser antes de ${format(maxDate, 'dd/MM/yyyy', { locale: ptBR })}`
          };
        }

        return { isValid: true };
      },
      [minDate, maxDate]
    );

    const handleDateSelect = (date: Date | undefined) => {
      if (!date) {
        setSelectedDate(undefined);
        if (onChange) {
          onChange(undefined);
        }
        return;
      }

      // Combine selected date with current time
      const [hours, minutes] = timeValue.split(':').map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);

      const validation = validateDate(newDate);
      
      if (validation.isValid) {
        setSelectedDate(newDate);
        
        if (onChange) {
          onChange(newDate);
        }
        
        if (onValidationChange) {
          onValidationChange(true);
        }
      } else {
        if (onValidationChange) {
          onValidationChange(false, validation.error);
        }
      }
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = e.target.value;
      setTimeValue(newTime);

      if (selectedDate) {
        const [hours, minutes] = newTime.split(':').map(Number);
        const newDate = new Date(selectedDate);
        newDate.setHours(hours, minutes, 0, 0);

        const validation = validateDate(newDate);
        
        if (validation.isValid) {
          setSelectedDate(newDate);
          
          if (onChange) {
            onChange(newDate);
          }
          
          if (onValidationChange) {
            onValidationChange(true);
          }
        } else {
          if (onValidationChange) {
            onValidationChange(false, validation.error);
          }
        }
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedDate(undefined);
      setTimeValue('00:00');
      if (onChange) {
        onChange(undefined);
      }
      if (onValidationChange) {
        onValidationChange(true);
      }
    };

    const handleConfirm = () => {
      setIsOpen(false);
    };

    const displayValue = selectedDate
      ? format(selectedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : '';

    return (
      <div ref={ref} className={cn('relative w-full', className)}>
        <div ref={containerRef}>
          <Button
            type="button"
            variant="outline"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground',
              error && 'border-red-500',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue || placeholder}
            {selectedDate && !disabled && (
              <X
                className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
          </Button>

          {isOpen && !disabled && (
            <div className="absolute z-50 mt-2 rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
              <div className="flex flex-col">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => {
                    if (minDate && date < minDate) return true;
                    if (maxDate && date > maxDate) return true;
                    return false;
                  }}
                  initialFocus
                  locale={ptBR}
                />
                <div className="border-t p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      value={timeValue}
                      onChange={handleTimeChange}
                      className="flex-1"
                      disabled={!selectedDate}
                    />
                  </div>
                </div>
                <div className="border-t p-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="flex-1"
                  >
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirm}
                    className="flex-1"
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

InlineDateTimePicker.displayName = 'InlineDateTimePicker';
