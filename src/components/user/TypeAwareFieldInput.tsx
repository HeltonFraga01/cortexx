import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NumberInput } from '@/components/ui-custom/NumberInput';
import { InlineDateTimePicker } from '@/components/ui-custom/InlineDateTimePicker';
import { InlineTimePicker } from '@/components/ui-custom/InlineTimePicker';
import { InlineMultiSelect } from '@/components/ui-custom/InlineMultiSelect';
import { InlineCalendar } from '@/components/ui-custom/InlineCalendar';
import { EmailInput } from '@/components/ui-custom/EmailInput';
import { PhoneInput } from '@/components/ui-custom/PhoneInput';
import { UrlInput } from '@/components/ui-custom/UrlInput';
import { cn } from '@/lib/utils';
import { FieldType, FieldMetadata } from '@/lib/types';

export interface TypeAwareFieldInputProps {
  field: FieldMetadata;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const TypeAwareFieldInput: React.FC<TypeAwareFieldInputProps> = ({
  field,
  value,
  onChange,
  error,
  disabled = false,
  className,
  onValidationChange
}) => {
  // Common props for custom inputs that support validation
  const customInputProps = {
    disabled: disabled || !field.editable,
    className,
    variant: error ? ('error' as const) : ('default' as const),
    onValidationChange
  };

  // Common props for basic inputs (without onValidationChange)
  const basicInputProps = {
    disabled: disabled || !field.editable,
    className,
    variant: error ? ('error' as const) : ('default' as const)
  };

  // Parse and format value based on field type
  const parseValue = (val: any, type: FieldType): any => {
    if (val === null || val === undefined) return null;
    
    switch (type) {
      case FieldType.DATE:
        // For DATE fields, parse as local date to avoid timezone issues
        if (val instanceof Date) return val;
        if (!val) return null;
        // Parse date string as local date (YYYY-MM-DD)
        if (typeof val === 'string') {
          const [year, month, day] = val.split('T')[0].split('-').map(Number);
          return new Date(year, month - 1, day);
        }
        return new Date(val);
      case FieldType.DATETIME:
        return val instanceof Date ? val : val ? new Date(val) : null;
      case FieldType.NUMBER:
      case FieldType.DECIMAL:
      case FieldType.CURRENCY:
      case FieldType.PERCENT:
        return val === '' ? null : val;
      case FieldType.CHECKBOX:
        return Boolean(val);
      case FieldType.MULTI_SELECT:
        if (Array.isArray(val)) return val;
        if (!val) return [];
        // Handle comma-separated string values from database
        if (typeof val === 'string') {
          return val.split(',').map(v => v.trim()).filter(v => v);
        }
        return [val];
      default:
        return val;
    }
  };

  const parsedValue = parseValue(value, field.type);

  // Render appropriate input based on field type
  const renderInput = () => {
    switch (field.type) {
      case FieldType.TEXT:
        return (
          <Input
            type="text"
            value={parsedValue || ''}
            onChange={(e) => onChange(e.target.value)}
            {...basicInputProps}
          />
        );

      case FieldType.LONG_TEXT:
        return (
          <Textarea
            value={parsedValue || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            {...basicInputProps}
          />
        );

      case FieldType.NUMBER:
        return (
          <NumberInput
            value={parsedValue}
            onChange={onChange}
            mode="integer"
            placeholder=""
            {...customInputProps}
          />
        );

      case FieldType.DECIMAL:
        return (
          <NumberInput
            value={parsedValue}
            onChange={onChange}
            mode="decimal"
            precision={2}
            placeholder=""
            {...customInputProps}
          />
        );

      case FieldType.CURRENCY:
        return (
          <NumberInput
            value={parsedValue}
            onChange={onChange}
            mode="currency"
            precision={2}
            placeholder=""
            {...customInputProps}
          />
        );

      case FieldType.PERCENT:
        return (
          <NumberInput
            value={parsedValue}
            onChange={onChange}
            mode="percent"
            precision={2}
            placeholder=""
            {...customInputProps}
          />
        );

      case FieldType.EMAIL:
        return (
          <EmailInput
            value={parsedValue || ''}
            onChange={onChange}
            placeholder="email@exemplo.com"
            disabled={customInputProps.disabled}
            variant={error ? 'error' : 'default'}
            className={className}
            onValidationChange={onValidationChange}
          />
        );

      case FieldType.PHONE:
        return (
          <PhoneInput
            value={parsedValue || ''}
            onChange={onChange}
            placeholder="(00) 00000-0000"
            disabled={customInputProps.disabled}
            variant={error ? 'error' : 'default'}
            className={className}
            onValidationChange={onValidationChange}
          />
        );

      case FieldType.URL:
        return (
          <UrlInput
            value={parsedValue || ''}
            onChange={onChange}
            placeholder="https://exemplo.com"
            disabled={customInputProps.disabled}
            variant={error ? 'error' : 'default'}
            className={className}
            onValidationChange={onValidationChange}
          />
        );

      case FieldType.DATE:
        return (
          <InlineCalendar
            value={parsedValue}
            onChange={onChange}
            placeholder="Selecione uma data"
            disabled={customInputProps.disabled}
            error={!!error}
            className={className}
          />
        );

      case FieldType.DATETIME:
        return (
          <InlineDateTimePicker
            value={parsedValue}
            onChange={onChange}
            placeholder="Selecione data e hora"
            disabled={customInputProps.disabled}
            error={!!error}
            className={className}
            onValidationChange={onValidationChange}
          />
        );

      case FieldType.TIME:
        return (
          <InlineTimePicker
            value={parsedValue}
            onChange={onChange}
            placeholder="Selecione horário"
            format="24h"
            disabled={customInputProps.disabled}
            error={!!error}
            className={className}
            onValidationChange={onValidationChange}
          />
        );

      case FieldType.YEAR:
        return (
          <Input
            type="number"
            min={1900}
            max={2100}
            value={parsedValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="YYYY"
            {...basicInputProps}
          />
        );

      case FieldType.SINGLE_SELECT:
        if (!field.options || field.options.length === 0) {
          return (
            <Input
              type="text"
              value={parsedValue || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Nenhuma opção disponível"
              {...basicInputProps}
            />
          );
        }
        
        // Find the option by title if value is a title, otherwise use as ID
        const findOptionValue = (val: any): string => {
          if (!val) return '';
          
          // Check if value is already an ID
          const byId = field.options?.find(opt => opt.id === val);
          if (byId) return val;
          
          // Check if value is a title
          const byTitle = field.options?.find(opt => opt.title === val);
          if (byTitle) return byTitle.id;
          
          // Return as-is if not found
          return val;
        };
        
        // Convert title to ID when saving
        const handleSelectChange = (selectedId: string) => {
          const option = field.options?.find(opt => opt.id === selectedId);
          // Save the title to match NocoDB's expected format
          onChange(option ? option.title : selectedId);
        };
        
        return (
          <Select
            value={findOptionValue(parsedValue)}
            onValueChange={handleSelectChange}
            disabled={basicInputProps.disabled}
          >
            <SelectTrigger className={cn(error && 'border-red-500', className)}>
              <SelectValue placeholder="Selecione uma opção" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case FieldType.MULTI_SELECT:
        if (!field.options || field.options.length === 0) {
          return (
            <Input
              type="text"
              value={Array.isArray(parsedValue) ? parsedValue.join(', ') : ''}
              onChange={(e) => onChange(e.target.value.split(',').map(v => v.trim()))}
              placeholder="Nenhuma opção disponível"
              {...basicInputProps}
            />
          );
        }
        return (
          <InlineMultiSelect
            value={parsedValue}
            onChange={onChange}
            options={field.options}
            placeholder="Selecione opções"
            variant={error ? 'error' : 'default'}
            {...customInputProps}
          />
        );

      case FieldType.CHECKBOX:
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.columnName}
              checked={parsedValue}
              onCheckedChange={onChange}
              disabled={basicInputProps.disabled}
            />
            <Label
              htmlFor={field.columnName}
              className="text-sm font-normal cursor-pointer"
            >
              {field.helperText || 'Ativar'}
            </Label>
          </div>
        );

      case FieldType.RATING:
        return (
          <Input
            type="number"
            min={0}
            max={5}
            step={1}
            value={parsedValue || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder="0-5"
            {...basicInputProps}
          />
        );

      case FieldType.DURATION:
        return (
          <Input
            type="text"
            value={parsedValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="HH:MM:SS"
            {...basicInputProps}
          />
        );

      case FieldType.JSON:
        return (
          <Textarea
            value={typeof parsedValue === 'string' ? parsedValue : JSON.stringify(parsedValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                onChange(e.target.value);
              }
            }}
            placeholder="{}"
            rows={6}
            className="font-mono text-xs"
            {...basicInputProps}
          />
        );

      case FieldType.ATTACHMENT:
      case FieldType.USER:
        return (
          <Input
            type="text"
            value={parsedValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`${field.type} (não suportado ainda)`}
            disabled
            {...basicInputProps}
          />
        );

      default:
        return (
          <Input
            type="text"
            value={parsedValue || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder=""
            {...basicInputProps}
          />
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={field.columnName} className="text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {field.helperText && field.type !== FieldType.CHECKBOX && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {field.helperText}
          </p>
        )}
      </div>
      {renderInput()}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
