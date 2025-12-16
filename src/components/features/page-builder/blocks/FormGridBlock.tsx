/**
 * Form Grid Block
 * 
 * Displays a grid of form fields from the selected fields.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TypeAwareFieldInput } from '@/components/user/TypeAwareFieldInput';
import type { BlockComponentProps } from '@/types/page-builder';

export function FormGridBlockComponent({
  block,
  connection,
  record,
  formData,
  fieldMetadata,
  onRecordChange,
  disabled,
  isPreview,
}: BlockComponentProps) {
  const { 
    columns = 2, 
    fields = [], 
    title,
    showCard = true,
    spacing = 'normal'
  } = block.props;

  // Filter field metadata to only include selected fields
  const selectedFields = fields.length > 0
    ? fieldMetadata.filter(f => fields.includes(f.columnName))
    : fieldMetadata.filter(f => f.visible);

  // Sort fields by the order in the fields array
  if (fields.length > 0) {
    selectedFields.sort((a, b) => {
      const indexA = fields.indexOf(a.columnName);
      const indexB = fields.indexOf(b.columnName);
      return indexA - indexB;
    });
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    onRecordChange({
      ...formData,
      [fieldName]: value,
    });
  };

  const gridClass = columns === 1 
    ? 'grid-cols-1' 
    : columns === 3 
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  const gapClass = spacing === 'compact' 
    ? 'gap-4' 
    : spacing === 'relaxed' 
      ? 'gap-8' 
      : 'gap-6';

  const content = (
    <div className={`grid ${gridClass} ${gapClass}`}>
      {selectedFields.map((field) => (
        <TypeAwareFieldInput
          key={field.columnName}
          field={field}
          value={formData[field.columnName]}
          onChange={(value) => handleFieldChange(field.columnName, value)}
          disabled={disabled || isPreview || !field.editable}
        />
      ))}
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? '' : 'pt-6'}>
        {content}
      </CardContent>
    </Card>
  );
}

export default FormGridBlockComponent;
