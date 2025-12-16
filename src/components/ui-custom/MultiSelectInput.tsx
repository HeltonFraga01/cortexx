import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SelectOption } from '@/lib/types';

export interface MultiSelectInputProps {
  value?: string[] | null;
  onChange?: (values: string[]) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  maxSelections?: number;
  searchable?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const MultiSelectInput = React.forwardRef<HTMLDivElement, MultiSelectInputProps>(
  (
    {
      value = [],
      onChange,
      options,
      disabled = false,
      placeholder = 'Selecione opções',
      className,
      variant = 'default',
      size = 'md',
      maxSelections,
      searchable = true,
      onValidationChange
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const selectedValues = value || [];

    const filteredOptions = React.useMemo(() => {
      if (!searchable || !searchQuery) {
        return options;
      }

      const query = searchQuery.toLowerCase();
      return options.filter((option) =>
        option.title.toLowerCase().includes(query)
      );
    }, [options, searchQuery, searchable]);

    const handleToggle = (optionId: string) => {
      let newValues: string[];

      if (selectedValues.includes(optionId)) {
        // Remove from selection
        newValues = selectedValues.filter((id) => id !== optionId);
      } else {
        // Add to selection
        if (maxSelections && selectedValues.length >= maxSelections) {
          if (onValidationChange) {
            onValidationChange(false, `Máximo de ${maxSelections} seleções permitidas`);
          }
          return;
        }
        newValues = [...selectedValues, optionId];
      }

      if (onChange) {
        onChange(newValues);
      }

      if (onValidationChange) {
        onValidationChange(true);
      }
    };

    const handleRemove = (optionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newValues = selectedValues.filter((id) => id !== optionId);
      if (onChange) {
        onChange(newValues);
      }
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onChange) {
        onChange([]);
      }
      if (onValidationChange) {
        onValidationChange(true);
      }
    };

    const getSelectedOptions = () => {
      return options.filter((opt) => selectedValues.includes(opt.id));
    };

    const selectedOptions = getSelectedOptions();

    const variantClasses = {
      default: 'border-input',
      success: 'border-green-500',
      error: 'border-red-500',
      warning: 'border-yellow-500'
    };

    const sizeClasses = {
      sm: 'min-h-8 text-sm',
      md: 'min-h-10 text-base md:text-sm',
      lg: 'min-h-12 text-lg'
    };

    return (
      <div ref={ref} className={cn('w-full', className)}>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                'w-full justify-between font-normal',
                variantClasses[variant],
                sizeClasses[size],
                selectedOptions.length === 0 && 'text-muted-foreground'
              )}
              disabled={disabled}
            >
              <div className="flex flex-wrap gap-1 flex-1 items-center">
                {selectedOptions.length === 0 ? (
                  <span>{placeholder}</span>
                ) : (
                  selectedOptions.map((option) => (
                    <Badge
                      key={option.id}
                      variant="secondary"
                      className="mr-1"
                      style={option.color ? { backgroundColor: option.color } : undefined}
                    >
                      {option.title}
                      <button
                        type="button"
                        onClick={(e) => handleRemove(option.id, e)}
                        className="ml-1 rounded-full outline-none hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                {selectedOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-full outline-none hover:bg-muted p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <div className="flex flex-col">
              {searchable && (
                <div className="p-2 border-b">
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8"
                  />
                </div>
              )}
              <div className="max-h-64 overflow-y-auto p-1">
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Nenhuma opção encontrada
                  </div>
                ) : (
                  filteredOptions.map((option) => {
                    const isSelected = selectedValues.includes(option.id);
                    return (
                      <div
                        key={option.id}
                        className={cn(
                          'flex items-center gap-2 px-2 py-2 cursor-pointer rounded-sm hover:bg-accent',
                          isSelected && 'bg-accent'
                        )}
                        onClick={() => handleToggle(option.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggle(option.id)}
                        />
                        <span className="flex-1">{option.title}</span>
                        {isSelected && <Check className="h-4 w-4" />}
                      </div>
                    );
                  })
                )}
              </div>
              {maxSelections && (
                <div className="border-t p-2 text-xs text-muted-foreground text-center">
                  {selectedValues.length} / {maxSelections} selecionados
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

MultiSelectInput.displayName = 'MultiSelectInput';
