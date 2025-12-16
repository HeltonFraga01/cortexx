import * as React from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export interface TimePickerProps {
  value?: string | null; // Format: "HH:mm" or "HH:mm:ss"
  onChange?: (time: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  format?: '12h' | '24h';
  includeSeconds?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const TimePicker = React.forwardRef<HTMLDivElement, TimePickerProps>(
  (
    {
      value,
      onChange,
      disabled = false,
      placeholder = 'Selecione horário',
      className,
      variant = 'default',
      size = 'md',
      format = '24h',
      includeSeconds = false,
      onValidationChange
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [hours, setHours] = React.useState<number>(0);
    const [minutes, setMinutes] = React.useState<number>(0);
    const [seconds, setSeconds] = React.useState<number>(0);
    const [period, setPeriod] = React.useState<'AM' | 'PM'>('AM');

    // Parse value prop
    React.useEffect(() => {
      if (value) {
        const parts = value.split(':');
        let h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parts[2] ? parseInt(parts[2], 10) : 0;

        if (format === '12h') {
          if (h >= 12) {
            setPeriod('PM');
            if (h > 12) h -= 12;
          } else {
            setPeriod('AM');
            if (h === 0) h = 12;
          }
        }

        setHours(h);
        setMinutes(m);
        setSeconds(s);
      } else {
        setHours(format === '12h' ? 12 : 0);
        setMinutes(0);
        setSeconds(0);
        setPeriod('AM');
      }
    }, [value, format]);

    const validateTime = React.useCallback(
      (h: number, m: number, s: number): { isValid: boolean; error?: string } => {
        if (format === '24h') {
          if (h < 0 || h > 23) {
            return { isValid: false, error: 'Hora deve estar entre 0 e 23' };
          }
        } else {
          if (h < 1 || h > 12) {
            return { isValid: false, error: 'Hora deve estar entre 1 e 12' };
          }
        }

        if (m < 0 || m > 59) {
          return { isValid: false, error: 'Minutos devem estar entre 0 e 59' };
        }

        if (s < 0 || s > 59) {
          return { isValid: false, error: 'Segundos devem estar entre 0 e 59' };
        }

        return { isValid: true };
      },
      [format]
    );

    const formatTimeString = React.useCallback(
      (h: number, m: number, s: number, p: 'AM' | 'PM'): string => {
        let hour24 = h;

        if (format === '12h') {
          if (p === 'PM' && h !== 12) {
            hour24 = h + 12;
          } else if (p === 'AM' && h === 12) {
            hour24 = 0;
          }
        }

        const hourStr = String(hour24).padStart(2, '0');
        const minStr = String(m).padStart(2, '0');
        const secStr = String(s).padStart(2, '0');

        return includeSeconds ? `${hourStr}:${minStr}:${secStr}` : `${hourStr}:${minStr}`;
      },
      [format, includeSeconds]
    );

    const handleTimeChange = React.useCallback(
      (newHours: number, newMinutes: number, newSeconds: number, newPeriod: 'AM' | 'PM') => {
        const validation = validateTime(newHours, newMinutes, newSeconds);

        if (validation.isValid) {
          setHours(newHours);
          setMinutes(newMinutes);
          setSeconds(newSeconds);
          setPeriod(newPeriod);

          const timeString = formatTimeString(newHours, newMinutes, newSeconds, newPeriod);

          if (onChange) {
            onChange(timeString);
          }

          if (onValidationChange) {
            onValidationChange(true);
          }
        } else {
          if (onValidationChange) {
            onValidationChange(false, validation.error);
          }
        }
      },
      [validateTime, formatTimeString, onChange, onValidationChange]
    );

    const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10) || 0;
      handleTimeChange(val, minutes, seconds, period);
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10) || 0;
      handleTimeChange(hours, val, seconds, period);
    };

    const handleSecondChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10) || 0;
      handleTimeChange(hours, minutes, val, period);
    };

    const handlePeriodToggle = () => {
      const newPeriod = period === 'AM' ? 'PM' : 'AM';
      handleTimeChange(hours, minutes, seconds, newPeriod);
    };

    const handleClear = () => {
      setHours(format === '12h' ? 12 : 0);
      setMinutes(0);
      setSeconds(0);
      setPeriod('AM');
      if (onChange) {
        onChange(null);
      }
      if (onValidationChange) {
        onValidationChange(true);
      }
    };

    const displayValue = value
      ? format === '12h'
        ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${includeSeconds ? ':' + String(seconds).padStart(2, '0') : ''} ${period}`
        : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${includeSeconds ? ':' + String(seconds).padStart(2, '0') : ''}`
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
                !value && 'text-muted-foreground',
                variantClasses[variant],
                sizeClasses[size]
              )}
              disabled={disabled}
            >
              <Clock className="mr-2 h-4 w-4" />
              {displayValue || placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Hora</label>
                  <Input
                    type="number"
                    min={format === '12h' ? 1 : 0}
                    max={format === '12h' ? 12 : 23}
                    value={hours}
                    onChange={handleHourChange}
                    className="w-16 text-center"
                  />
                </div>
                <span className="text-2xl font-bold mt-5">:</span>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Min</label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={handleMinuteChange}
                    className="w-16 text-center"
                  />
                </div>
                {includeSeconds && (
                  <>
                    <span className="text-2xl font-bold mt-5">:</span>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Seg</label>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={seconds}
                        onChange={handleSecondChange}
                        className="w-16 text-center"
                      />
                    </div>
                  </>
                )}
                {format === '12h' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">&nbsp;</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePeriodToggle}
                      className="w-16"
                    >
                      {period}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClear} className="flex-1">
                  Limpar
                </Button>
                <Button size="sm" onClick={() => setOpen(false)} className="flex-1">
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

TimePicker.displayName = 'TimePicker';
