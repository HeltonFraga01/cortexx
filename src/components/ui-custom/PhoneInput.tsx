import * as React from 'react';
import { Phone, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isValidPhone, formatPhoneNumber } from '@/utils/fieldTypeResolver';

export interface PhoneInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'value'> {
  value?: string | null;
  onChange?: (value: string) => void;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showValidationIcon?: boolean;
  autoFormat?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value = '',
      onChange,
      variant = 'default',
      size = 'md',
      showValidationIcon = true,
      autoFormat = true,
      onValidationChange,
      onBlur,
      className,
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState(value || '');
    const [isValid, setIsValid] = React.useState<boolean | null>(null);
    const [isTouched, setIsTouched] = React.useState(false);

    React.useEffect(() => {
      setInputValue(value || '');
    }, [value]);

    const validatePhone = React.useCallback((phone: string): boolean => {
      if (!phone) {
        return true; // Empty is valid (use required prop for mandatory fields)
      }
      return isValidPhone(phone);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;
      
      // Allow only numbers, spaces, parentheses, hyphens, and plus sign
      newValue = newValue.replace(/[^\d\s()\-+]/g, '');
      
      setInputValue(newValue);
      
      if (onChange) {
        onChange(newValue);
      }

      // Validate on change if already touched
      if (isTouched) {
        const valid = validatePhone(newValue);
        setIsValid(valid);
        
        if (onValidationChange) {
          onValidationChange(valid, valid ? undefined : 'Telefone inválido');
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsTouched(true);
      
      let finalValue = inputValue;
      
      // Auto-format on blur if enabled
      if (autoFormat && inputValue) {
        finalValue = formatPhoneNumber(inputValue);
        setInputValue(finalValue);
        
        if (onChange) {
          onChange(finalValue);
        }
      }
      
      const valid = validatePhone(finalValue);
      setIsValid(valid);
      
      if (onValidationChange) {
        onValidationChange(valid, valid ? undefined : 'Telefone inválido');
      }
      
      if (onBlur) {
        onBlur(e);
      }
    };

    const getVariant = (): 'default' | 'success' | 'error' | 'warning' => {
      if (!isTouched || isValid === null) {
        return variant;
      }
      return isValid ? 'success' : 'error';
    };

    const getValidationIcon = () => {
      if (!showValidationIcon || !isTouched || isValid === null || !inputValue) {
        return null;
      }
      
      return isValid ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-red-500" />
      );
    };

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          variant={getVariant()}
          size={size}
          leftIcon={<Phone className="h-4 w-4" />}
          rightIcon={getValidationIcon()}
          placeholder="(00) 00000-0000"
          className={className}
          {...props}
        />
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
