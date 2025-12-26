/**
 * Field Multi-Select Custom Field for Puck
 * 
 * A custom Puck field that allows selecting multiple database columns
 * from the current connection's field metadata.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronsUpDown, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFieldSelectContext } from './FieldSelectField';

interface FieldMultiSelectFieldProps {
  field: {
    label?: string;
  };
  name: string;
  value: string[];
  onChange: (value: string[]) => void;
  readOnly?: boolean;
}

export function FieldMultiSelectField({ 
  field, 
  name, 
  value = [], 
  onChange, 
  readOnly 
}: FieldMultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const { fields } = getFieldSelectContext();

  const selectedFields = Array.isArray(value) ? value : [];

  const handleSelect = (fieldName: string) => {
    if (selectedFields.includes(fieldName)) {
      onChange(selectedFields.filter(f => f !== fieldName));
    } else {
      onChange([...selectedFields, fieldName]);
    }
  };

  const handleRemove = (fieldName: string) => {
    onChange(selectedFields.filter(f => f !== fieldName));
  };

  const handleClear = () => {
    onChange([]);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newValue = [...selectedFields];
    [newValue[index - 1], newValue[index]] = [newValue[index], newValue[index - 1]];
    onChange(newValue);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedFields.length - 1) return;
    const newValue = [...selectedFields];
    [newValue[index], newValue[index + 1]] = [newValue[index + 1], newValue[index]];
    onChange(newValue);
  };

  const getFieldLabel = (fieldName: string) => {
    const f = fields.find(field => field.columnName === fieldName);
    return f?.label || fieldName;
  };

  return (
    <div className="space-y-2">
      {field.label && (
        <Label className="text-sm font-medium">{field.label}</Label>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={readOnly || fields.length === 0}
          >
            <span className="truncate">
              {selectedFields.length === 0
                ? fields.length === 0 
                  ? 'Selecione uma conexão primeiro'
                  : 'Selecione campos...'
                : `${selectedFields.length} campo(s) selecionado(s)`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <ScrollArea className="h-[200px]">
            <div className="p-2 space-y-1">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">
                  Nenhum campo disponível
                </p>
              ) : (
                fields.map((f) => (
                  <div
                    key={f.columnName}
                    className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => handleSelect(f.columnName)}
                  >
                    <Checkbox
                      checked={selectedFields.includes(f.columnName)}
                      onCheckedChange={() => handleSelect(f.columnName)}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm truncate">{f.label || f.columnName}</span>
                      <span className="text-xs text-muted-foreground truncate">{f.columnName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Selected fields with reorder */}
      {selectedFields.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Arraste para reordenar
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-xs"
            >
              Limpar
            </Button>
          </div>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {selectedFields.map((fieldName, index) => (
              <div
                key={fieldName}
                className="flex items-center gap-1 p-1 bg-muted rounded-md group"
              >
                <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                <Badge variant="secondary" className="flex-1 justify-start font-normal">
                  {getFieldLabel(fieldName)}
                </Badge>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="h-5 w-5 p-0"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === selectedFields.length - 1}
                    className="h-5 w-5 p-0"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(fieldName)}
                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Selecione uma conexão de banco de dados para ver os campos disponíveis.
        </p>
      )}
    </div>
  );
}

export default FieldMultiSelectField;
