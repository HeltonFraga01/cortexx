import * as React from 'react';
import { Link, Check, X, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isValidUrl, normalizeUrl } from '@/utils/fieldTypeResolver';

export interface UrlInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'value'> {
  value?: string | null;
  onChange?: (value: string) => void;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showValidationIcon?: boolean;
  autoNormalize?: boolean;
  showOpenLink?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const UrlInput = React.forwardRef<HTMLInputElement, UrlInputProps>(
  (
    {
      value = '',
      onChange,
      variant = 'default',
      size = 'md',
      showValidationIcon = true,
      autoNormalize = true,
      showOpenLink = true,
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

    const validateUrl = React.useCallback((url: string): boolean => {
      if (!url) {
        return true; // Empty is valid (use required prop for mandatory fields)
      }
      return isValidUrl(url);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      
      if (onChange) {
        onChange(newValue);
      }

      // Validate on change if already touched
      if (isTouched) {
        const valid = validateUrl(newValue);
        setIsValid(valid);
        
        if (onValidationChange) {
          onValidationChange(valid, valid ? undefined : 'URL inválida');
        }
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsTouched(true);
      
      let finalValue = inputValue;
      
      // Auto-normalize on blur if enabled
      if (autoNormalize && inputValue && !inputValue.startsWith('http')) {
        finalValue = normalizeUrl(inputValue);
        setInputValue(finalValue);
        
        if (onChange) {
          onChange(finalValue);
        }
      }
      
      const valid = validateUrl(finalValue);
      setIsValid(valid);
      
      if (onValidationChange) {
        onValidationChange(valid, valid ? undefined : 'URL inválida');
      }
      
      if (onBlur) {
        onBlur(e);
      }
    };

    const handleOpenLink = () => {
      if (inputValue && isValid) {
        const url = inputValue.startsWith('http') ? inputValue : normalizeUrl(inputValue);
        window.open(url, '_blank', 'noopener,noreferrer');
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

    const getRightIcon = () => {
      const validationIcon = getValidationIcon();
      
      if (showOpenLink && inputValue && isValid && isTouched) {
        return (
          <div className="flex items-center gap-1">
            {validationIcon}
            <button
              type="button"
              onClick={handleOpenLink}
              className="hover:bg-muted rounded p-1"
              title="Abrir link"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        );
      }
      
      return validationIcon;
    };

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type="url"
          inputMode="url"
          autoComplete="url"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          variant={getVariant()}
          size={size}
          leftIcon={<Link className="h-4 w-4" />}
          rightIcon={getRightIcon()}
          placeholder="https://exemplo.com"
          className={className}
          {...props}
        />
      </div>
    );
  }
);

UrlInput.displayName = 'UrlInput';
