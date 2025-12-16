import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isValidNumber, isValidDecimal } from '@/utils/fieldTypeResolver';

export interface NumberInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'value'> {
  value?: number | string | null;
  onChange?: (value: number | null) => void;
  mode?: 'integer' | 'decimal' | 'currency' | 'percent';
  precision?: number; // Decimal places for decimal/currency mode
  min?: number;
  max?: number;
  allowNegative?: boolean;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      mode = 'integer',
      precision = 2,
      min,
      max,
      allowNegative = true,
      variant = 'default',
      size = 'md',
      className,
      onValidationChange,
      onBlur,
      disabled,
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState<string>('');
    const [isFocused, setIsFocused] = React.useState(false);

    // Format value for display
    const formatValue = React.useCallback(
      (val: number | string | null | undefined): string => {
        if (val === null || val === undefined || val === '') {
          return '';
        }

        const numValue = typeof val === 'string' ? parseFloat(val) : val;
        
        if (isNaN(numValue)) {
          return '';
        }

        // When focused, show raw number for editing
        if (isFocused) {
          return String(numValue);
        }

        // Format based on mode
        switch (mode) {
          case 'currency':
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: precision,
              maximumFractionDigits: precision
            }).format(numValue);
          
          case 'percent':
            return new Intl.NumberFormat('pt-BR', {
              style: 'percent',
              minimumFractionDigits: precision,
              maximumFractionDigits: precision
            }).format(numValue / 100);
          
          case 'decimal':
            return new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: precision,
              maximumFractionDigits: precision
            }).format(numValue);
          
          case 'integer':
          default:
            return new Intl.NumberFormat('pt-BR', {
              maximumFractionDigits: 0
            }).format(numValue);
        }
      },
      [mode, precision, isFocused]
    );

    // Update display value when value prop changes
    React.useEffect(() => {
      setDisplayValue(formatValue(value));
    }, [value, formatValue]);

    // Validate the input value
    const validateValue = React.useCallback(
      (val: string): { isValid: boolean; error?: string; numValue?: number } => {
        if (val === '' || val === '-') {
          return { isValid: true, numValue: null as any };
        }

        // Check if it's a valid number
        if (!isValidNumber(val)) {
          return { isValid: false, error: 'Valor numérico inválido' };
        }

        const numValue = parseFloat(val);

        // Check negative values
        if (!allowNegative && numValue < 0) {
          return { isValid: false, error: 'Valores negativos não são permitidos' };
        }

        // Check min/max
        if (min !== undefined && numValue < min) {
          return { isValid: false, error: `Valor mínimo é ${min}` };
        }

        if (max !== undefined && numValue > max) {
          return { isValid: false, error: `Valor máximo é ${max}` };
        }

        // Check decimal precision for decimal/currency modes
        if ((mode === 'decimal' || mode === 'currency') && !isValidDecimal(val, precision)) {
          return { isValid: false, error: `Máximo de ${precision} casas decimais` };
        }

        // Integer mode should not have decimals
        if (mode === 'integer' && val.includes('.')) {
          return { isValid: false, error: 'Apenas números inteiros são permitidos' };
        }

        return { isValid: true, numValue };
      },
      [mode, precision, min, max, allowNegative]
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Allow empty, minus sign, and valid number characters
      const sanitized = inputValue.replace(/[^\d.-]/g, '');
      
      setDisplayValue(sanitized);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      
      const validation = validateValue(displayValue);
      
      if (validation.isValid) {
        const numValue = validation.numValue;
        
        // Update with formatted value
        setDisplayValue(formatValue(numValue));
        
        // Call onChange with the numeric value
        if (onChange) {
          onChange(numValue);
        }
        
        if (onValidationChange) {
          onValidationChange(true);
        }
      } else {
        if (onValidationChange) {
          onValidationChange(false, validation.error);
        }
      }
      
      if (onBlur) {
        onBlur(e);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      
      // Convert formatted value back to raw number for editing
      if (value !== null && value !== undefined && value !== '') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (!isNaN(numValue)) {
          setDisplayValue(String(numValue));
        }
      }
      
      // Select all text on focus for easy editing
      e.target.select();
    };

    // Determine prefix/suffix based on mode
    const getPrefix = () => {
      if (mode === 'currency' && !isFocused) {
        return 'R$';
      }
      return null;
    };

    const getSuffix = () => {
      if (mode === 'percent' && !isFocused) {
        return '%';
      }
      return null;
    };

    const prefix = getPrefix();
    const suffix = getSuffix();

    return (
      <div className="relative w-full">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          variant={variant}
          size={size}
          disabled={disabled}
          className={cn(
            prefix && 'pl-10',
            suffix && 'pr-10',
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';
