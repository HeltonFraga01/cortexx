/**
 * PropertiesPanel Component
 * 
 * Panel for editing properties of the selected block.
 * Dynamically renders form fields based on block's propsSchema.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { blockRegistry } from './BlockRegistry';
import type { ThemeBlock, PropSchema } from '@/types/page-builder';
import type { FieldMetadata } from '@/lib/types';
import { Settings2 } from 'lucide-react';

interface PropertiesPanelProps {
  selectedBlock: ThemeBlock | null;
  fields: FieldMetadata[];
  onUpdateBlock: (blockId: string, props: Record<string, any>) => void;
  onUpdateBlockMeta?: (blockId: string, meta: { columnIndex?: number }) => void;
  parentBlock?: ThemeBlock | null;
  rowBlocks?: ThemeBlock[];
}

export function PropertiesPanel({
  selectedBlock,
  fields,
  onUpdateBlock,
  onUpdateBlockMeta,
  parentBlock,
  rowBlocks = [],
}: PropertiesPanelProps) {
  if (!selectedBlock) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex flex-col items-center justify-center text-center p-6">
          <Settings2 className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Selecione um bloco no canvas para editar suas propriedades
          </p>
        </CardContent>
      </Card>
    );
  }

  const definition = blockRegistry.get(selectedBlock.type);
  if (!definition) {
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <p className="text-sm text-destructive">
            Bloco desconhecido: {selectedBlock.type}
          </p>
        </CardContent>
      </Card>
    );
  }

  const Icon = definition.icon;

  const handlePropChange = (propName: string, value: any) => {
    onUpdateBlock(selectedBlock.id, {
      ...selectedBlock.props,
      [propName]: value,
    });
  };

  const renderPropField = (schema: PropSchema) => {
    const currentValue = selectedBlock.props[schema.name] ?? schema.defaultValue;

    switch (schema.type) {
      case 'string':
        return (
          <Input
            id={schema.name}
            value={currentValue || ''}
            onChange={(e) => handlePropChange(schema.name, e.target.value)}
          />
        );

      case 'number':
        return (
          <Input
            id={schema.name}
            type="number"
            value={currentValue || ''}
            onChange={(e) => handlePropChange(schema.name, parseInt(e.target.value, 10))}
          />
        );

      case 'boolean':
        return (
          <Switch
            id={schema.name}
            checked={currentValue || false}
            onCheckedChange={(checked) => handlePropChange(schema.name, checked)}
          />
        );

      case 'select':
        return (
          <Select
            value={String(currentValue || '')}
            onValueChange={(value) => handlePropChange(schema.name, value)}
          >
            <SelectTrigger id={schema.name}>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {schema.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'field-select':
        const selectedField = fields.find(f => f.columnName === currentValue);
        return (
          <div className="space-y-1">
            <Select
              value={currentValue || '__none__'}
              onValueChange={(value) => handlePropChange(schema.name, value === '__none__' ? '' : value)}
            >
              <SelectTrigger id={schema.name}>
                <SelectValue placeholder="Selecione um campo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {fields.map((field) => (
                  <SelectItem key={field.columnName} value={field.columnName}>
                    <div className="flex items-center gap-2">
                      <span>{field.label || field.columnName}</span>
                      <span className="text-xs text-muted-foreground">({field.type})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedField && (
              <p className="text-xs text-muted-foreground">
                Campo vinculado: <code className="bg-muted px-1 rounded">{selectedField.columnName}</code>
              </p>
            )}
          </div>
        );

      case 'field-multi-select':
        const selectedFields: string[] = currentValue || [];
        return (
          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">
                Nenhum campo disponível
              </p>
            ) : (
              fields.map((field) => (
                <div key={field.columnName} className="flex items-center gap-2">
                  <Checkbox
                    id={`${schema.name}-${field.columnName}`}
                    checked={selectedFields.includes(field.columnName)}
                    onCheckedChange={(checked) => {
                      const newFields = checked
                        ? [...selectedFields, field.columnName]
                        : selectedFields.filter((f) => f !== field.columnName);
                      handlePropChange(schema.name, newFields);
                    }}
                  />
                  <Label
                    htmlFor={`${schema.name}-${field.columnName}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {field.label || field.columnName}
                  </Label>
                </div>
              ))
            )}
          </div>
        );

      default:
        return (
          <Input
            id={schema.name}
            value={String(currentValue || '')}
            onChange={(e) => handlePropChange(schema.name, e.target.value)}
          />
        );
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <CardTitle className="text-base">{definition.name}</CardTitle>
        </div>
        <Badge variant="secondary" className="w-fit text-xs">
          {definition.category}
        </Badge>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-340px)]">
          <div className="px-4 pb-4 space-y-4">
            {/* Row/Column assignment section */}
            {rowBlocks.length > 0 && selectedBlock.type !== 'row' && (
              <div className="space-y-3 pb-3 border-b">
                <Label className="text-sm font-medium">Posicionamento em Container</Label>
                
                {/* Row selector */}
                <div className="space-y-1">
                  <Label htmlFor="parentRowId" className="text-xs text-muted-foreground">
                    Container (Row)
                  </Label>
                  <Select
                    value={selectedBlock.props?.parentRowId || '__none__'}
                    onValueChange={(value) => {
                      const newProps = { ...selectedBlock.props };
                      if (value === '__none__') {
                        delete newProps.parentRowId;
                        onUpdateBlock(selectedBlock.id, newProps);
                        if (onUpdateBlockMeta) {
                          onUpdateBlockMeta(selectedBlock.id, { columnIndex: undefined });
                        }
                      } else {
                        newProps.parentRowId = value;
                        onUpdateBlock(selectedBlock.id, newProps);
                        if (onUpdateBlockMeta) {
                          onUpdateBlockMeta(selectedBlock.id, { columnIndex: 0 });
                        }
                      }
                    }}
                  >
                    <SelectTrigger id="parentRowId">
                      <SelectValue placeholder="Selecione um container..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum (raiz)</SelectItem>
                      {rowBlocks.map((row, index) => (
                        <SelectItem key={row.id} value={row.id}>
                          Row {index + 1} ({row.props.columns || 2} colunas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Column selector - only show if a Row is selected */}
                {selectedBlock.props?.parentRowId && (
                  <div className="space-y-1">
                    <Label htmlFor="columnIndex" className="text-xs text-muted-foreground">
                      Coluna
                    </Label>
                    <Select
                      value={String(selectedBlock.columnIndex ?? 0)}
                      onValueChange={(value) => {
                        if (onUpdateBlockMeta) {
                          onUpdateBlockMeta(selectedBlock.id, { columnIndex: parseInt(value, 10) });
                        }
                      }}
                    >
                      <SelectTrigger id="columnIndex">
                        <SelectValue placeholder="Selecione a coluna..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const parentRow = rowBlocks.find(r => r.id === selectedBlock.props?.parentRowId);
                          const columns = parentRow?.props?.columns || 2;
                          return Array.from({ length: columns }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              Coluna {i + 1}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Associe este bloco a um container Row para posicioná-lo em uma coluna específica
                </p>
              </div>
            )}
            
            {definition.propsSchema.map((schema) => (
              <div key={schema.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={schema.name} className="text-sm">
                    {schema.label}
                    {schema.required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  {schema.type === 'boolean' && renderPropField(schema)}
                </div>
                {schema.type !== 'boolean' && renderPropField(schema)}
                {schema.helperText && (
                  <p className="text-xs text-muted-foreground">
                    {schema.helperText}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
