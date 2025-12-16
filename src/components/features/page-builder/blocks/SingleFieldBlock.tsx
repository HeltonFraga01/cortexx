/**
 * Single Field Block
 * 
 * Displays a single form field with optional label customization.
 */

import { TypeAwareFieldInput } from '@/components/user/TypeAwareFieldInput';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { BlockComponentProps } from '@/types/page-builder';

export function SingleFieldBlockComponent({
  block,
  formData,
  fieldMetadata,
  onRecordChange,
  disabled,
  isPreview,
}: BlockComponentProps) {
  const { 
    fieldName, 
    customLabel,
    fullWidth = false,
    showLabel = true,
  } = block.props;

  // Find the field metadata
  const field = fieldMetadata.find(f => f.columnName === fieldName);

  const handleFieldChange = (value: any) => {
    onRecordChange({
      ...formData,
      [fieldName]: value,
    });
  };

  // If field not found, show placeholder in preview mode
  if (!field) {
    if (isPreview) {
      return (
        <div className={fullWidth ? 'col-span-full' : ''}>
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {customLabel || fieldName || 'Campo não selecionado'}
            </Label>
            <Input disabled placeholder="Campo não encontrado" />
          </div>
        </div>
      );
    }
    return null;
  }

  // Override label if custom label is provided
  const displayField = customLabel 
    ? { ...field, label: customLabel }
    : field;

  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <TypeAwareFieldInput
        field={displayField}
        value={formData[fieldName]}
        onChange={handleFieldChange}
        disabled={disabled || isPreview || !field.editable}
      />
    </div>
  );
}

export default SingleFieldBlockComponent;
