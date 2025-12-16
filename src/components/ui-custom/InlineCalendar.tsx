import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface InlineCalendarProps {
  value?: Date | null;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: boolean;
}

export const InlineCalendar = React.forwardRef<HTMLDivElement, InlineCalendarProps>(
  (
    {
      value,
      onChange,
      disabled = false,
      placeholder = 'Selecione uma data',
      className,
      error = false
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

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

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onChange) {
        onChange(undefined);
      }
    };

    return (
      <div ref={ref} className={cn('relative w-full', className)}>
        <div ref={containerRef}>
          <Button

            type="button"
            variant="outline"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground',
              error && 'border-red-500',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
            {value && !disabled && (
              <X
                className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
          </Button>

          {isOpen && !disabled && (
            <div className="absolute z-50 mt-2 rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
              <Calendar
                mode="single"
                selected={value || undefined}
                onSelect={(date) => {
                  if (onChange) {
                    onChange(date);
                  }
                  setIsOpen(false);
                }}
                initialFocus
                locale={ptBR}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

InlineCalendar.displayName = 'InlineCalendar';
