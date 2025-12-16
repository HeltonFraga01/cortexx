import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isValidDate } from '@/utils/fieldTypeResolver';

export interface DateTimePickerProps {
  value?: Date | string | null;
  onChange?: (date: Date | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  minDate?: Date;
  maxDate?: Date;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const DateTimePicker = React.forwardRef<HTMLDivElement, DateTimePickerProps>(
  (
    {
      value,
      onChange,
      disabled = false,
      placeholder = 'Selecione data e hora',
      className,
      variant = 'default',
      size = 'md',
      minDate,
      maxDate,
      onValidationChange
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState<Date | undefined>();
    const [timeValue, setTimeValue] = React.useState<string>('00:00');

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
          onChange(null);
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

    const handleClear = () => {
      setSelectedDate(undefined);
      setTimeValue('00:00');
      if (onChange) {
        onChange(null);
      }
      if (onValidationChange) {
        onValidationChange(true);
      }
    };

    const displayValue = selectedDate
      ? format(selectedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
      : '';

    const variantClasses = {
      default: 'border-input',
      success: 'border-green-500',
      error: 'border-red-500',
      warning: 'border-yellow-500'
    };

    const sizeClasses = {
      sm: 'h-8 text-sm',
      md: 'h-10 text-base md:text-sm',
      lg: 'h-12 text-lg'
    };

    return (
      <div ref={ref} className={cn('flex flex-col gap-2', className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !selectedDate && 'text-muted-foreground',
                variantClasses[variant],
                sizeClasses[size]
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {displayValue || placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
                  onClick={() => setOpen(false)}
                  className="flex-1"
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

DateTimePicker.displayName = 'DateTimePicker';
