import * as React from 'react';
import { Mail, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isValidEmail } from '@/utils/fieldTypeResolver';

export interface EmailInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'value'> {
  value?: string | null;
  onChange?: (value: string) => void;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showValidationIcon?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  (
    {
      value = '',
      onChange,
      variant = 'default',
      size = 'md',
      showValidationIcon = true,
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

    const validateEmail = React.useCallback((email: string): boolean => {
      if (!email) {
        return true; // Empty is valid (use required prop for mandatory fields)
      }
      return isValidEmail(email);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      
      if (onChange) {
        onChange(newValue);
      }

      // Validate on change if already touched
      if (isTouched) {
        const valid = validateEmail(newValue);
        setIsValid(valid);
        
        if (onValidationChange) {
          onValidationChange(valid, valid ? undefined : 'Email inválido');
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsTouched(true);
      
      const valid = validateEmail(inputValue);
      setIsValid(valid);
      
      if (onValidationChange) {
        onValidationChange(valid, valid ? undefined : 'Email inválido');
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
          type="email"
          inputMode="email"
          autoComplete="email"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          variant={getVariant()}
          size={size}
          leftIcon={<Mail className="h-4 w-4" />}
          rightIcon={getValidationIcon()}
          className={className}
          {...props}
        />
      </div>
    );
  }
);

EmailInput.displayName = 'EmailInput';
