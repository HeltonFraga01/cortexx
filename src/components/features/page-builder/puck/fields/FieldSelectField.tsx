/**
 * Field Select Custom Field for Puck
 * 
 * A custom Puck field that allows selecting database columns
 * from the current connection's field metadata.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { FieldMetadata } from '@/lib/types';

interface FieldSelectFieldProps {
  field: {
    label?: string;
  };
  name: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

// Context will be injected by PuckPageBuilder
interface PuckEditorContext {
  fields: FieldMetadata[];
}

// Global context reference (set by PuckPageBuilder)
let editorContext: PuckEditorContext = { fields: [] };

export function setFieldSelectContext(context: PuckEditorContext) {
  editorContext = context;
}

export function getFieldSelectContext(): PuckEditorContext {
  return editorContext;
}

export function FieldSelectField({ 
  field, 
  name, 
  value, 
  onChange, 
  readOnly 
}: FieldSelectFieldProps) {
  const { fields } = editorContext;

  const handleChange = (newValue: string) => {
    // Handle "none" selection as empty string
    onChange(newValue === '__none__' ? '' : newValue);
  };

  return (
    <div className="space-y-2">
      {field.label && (
        <Label className="text-sm font-medium">{field.label}</Label>
      )}
      <Select
        value={value || '__none__'}
        onValueChange={handleChange}
        disabled={readOnly || fields.length === 0}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={fields.length === 0 ? 'Selecione uma conexão primeiro' : 'Selecione um campo'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">Nenhum</span>
          </SelectItem>
          {fields.map((f) => (
            <SelectItem key={f.columnName} value={f.columnName}>
              <div className="flex items-center gap-2">
                <span>{f.label || f.columnName}</span>
                <span className="text-xs text-muted-foreground">({f.columnName})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Selecione uma conexão de banco de dados para ver os campos disponíveis.
        </p>
      )}
    </div>
  );
}

export default FieldSelectField;
