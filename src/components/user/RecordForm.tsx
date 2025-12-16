import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { DatabaseConnection, FieldMapping, databaseConnectionsService } from '@/services/database-connections';
import { FieldMetadata, NocoDBColumnMetadata } from '@/lib/types';
import { FieldTypeResolver } from '@/utils/fieldTypeResolver';
import { TypeAwareFieldInput } from './TypeAwareFieldInput';
import { validateFieldValue } from '@/utils/fieldValidation';
import { connectionCache } from '@/services/cache/connectionCache';
import { cn } from '@/lib/utils';

interface RecordFormProps {
  connection: DatabaseConnection;
  record: Record<string, any>;
  onRecordChange: (updatedRecord: Record<string, any>) => void;
  disabled?: boolean;
  loading?: boolean;
}

export interface RecordFormRef {
  validateAllFields: () => boolean;
  getValidationErrors: () => string[];
}

interface FieldValidation {
  [fieldName: string]: {
    isValid: boolean;
    error?: string;
  };
}

// Use the singleton instance for proper mocking in tests
const databaseService = databaseConnectionsService;

/**
 * Merge NocoDB metadata with existing FieldMapping configuration
 * Preserves custom labels, visibility, editability from FieldMapping
 */
function mergeFieldConfiguration(
  metadata: FieldMetadata[],
  fieldMappings: FieldMapping[]
): FieldMetadata[] {
  return metadata.map(meta => {
    const mapping = fieldMappings.find(m => m.columnName === meta.columnName);
    
    if (mapping) {
      return {
        ...meta,
        label: mapping.label || meta.label,
        visible: mapping.visible,
        editable: mapping.editable && meta.editable, // Both must be true
        helperText: mapping.helperText || meta.helperText
      };
    }
    
    return meta;
  }).sort((a, b) => {
    const orderA = a.displayOrder ?? 999;
    const orderB = b.displayOrder ?? 999;
    return orderA - orderB;
  });
}

/**
 * Create fallback metadata from FieldMapping when NocoDB fetch fails
 * All fields will be rendered as text inputs
 */
function createFallbackMetadata(fieldMappings: FieldMapping[]): FieldMetadata[] {
  return fieldMappings.map((mapping, index) => ({
    columnName: mapping.columnName,
    label: mapping.label,
    type: 'text' as any, // Fallback to text type
    uidt: 'SingleLineText',
    required: false,
    editable: mapping.editable,
    visible: mapping.visible,
    helperText: mapping.helperText,
    displayOrder: index
  }));
}

const RecordForm = forwardRef<RecordFormRef, RecordFormProps>(({ 
  connection, 
  record, 
  onRecordChange,
  disabled = false,
  loading = false
}, ref) => {
  const [formData, setFormData] = useState<Record<string, any>>(record);
  const [validation, setValidation] = useState<FieldValidation>({});
  const [originalRecord, setOriginalRecord] = useState<Record<string, any>>(record);
  const [fieldMetadata, setFieldMetadata] = useState<FieldMetadata[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  // Update form data and original record when record prop changes
  // This ensures the "Changes Detected" section is cleared after save
  // Use JSON.stringify to compare record content and avoid infinite loops
  const recordKey = JSON.stringify(record);
  useEffect(() => {
    setFormData(record);
    setOriginalRecord(record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordKey]);

  /**
   * Validate all editable fields before submission
   * Returns true if all fields are valid, false otherwise
   */
  const validateAllFieldsInternal = (): boolean => {
    const editableFields = visibleFields.filter(f => f.editable);
    const newValidation: FieldValidation = {};
    let hasErrors = false;

    editableFields.forEach(field => {
      const value = formData[field.columnName];
      const result = validateField(field, value);
      newValidation[field.columnName] = result;
      
      if (!result.isValid) {
        hasErrors = true;
      }
    });

    setValidation(newValidation);
    
    // Focus first invalid field
    if (hasErrors) {
      const firstInvalidField = editableFields.find(
        field => !newValidation[field.columnName]?.isValid
      );
      
      if (firstInvalidField) {
        const element = document.getElementById(`field-${firstInvalidField.columnName}`);
        if (element) {
          element.focus();
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    return !hasErrors;
  };

  /**
   * Get validation error summary
   */
  const getValidationErrorsInternal = (): string[] => {
    return Object.entries(validation)
      .filter(([_, result]) => !result.isValid)
      .map(([fieldName, result]) => {
        const field = visibleFields.find(f => f.columnName === fieldName);
        const label = field?.label || fieldName;
        return `${label}: ${result.error}`;
      });
  };

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    validateAllFields: validateAllFieldsInternal,
    getValidationErrors: getValidationErrorsInternal
  }));

  // Fetch field metadata from NocoDB on component mount
  useEffect(() => {
    const fetchFieldMetadata = async () => {
      // Only fetch for NocoDB connections
      if (connection.type !== 'NOCODB') {
        return;
      }

      setMetadataLoading(true);
      setMetadataError(null);

      try {
        // Check cache first
        const cacheKey = `field-metadata:${connection.id}:${connection.nocodb_table_id || connection.table_name}`;
        const cached = connectionCache.get<NocoDBColumnMetadata[]>(cacheKey);

        let columns: NocoDBColumnMetadata[];
        
        if (cached) {
          console.log('✅ Field metadata loaded from cache');
          columns = cached;
        } else {
          // Fetch from NocoDB
          columns = await databaseService.getNocoDBColumns(connection) as NocoDBColumnMetadata[];
        }

        // Convert NocoDB columns to FieldMetadata
        const metadata = columns.map(col => FieldTypeResolver.columnToFieldMetadata(col));
        
        // Merge with existing field mappings
        const mergedMetadata = mergeFieldConfiguration(metadata, connection.fieldMappings || connection.field_mappings || []);
        
        setFieldMetadata(mergedMetadata);
      } catch (error: any) {
        console.error('❌ Error fetching field metadata:', error);
        setMetadataError(error.message || 'Erro ao carregar metadados dos campos');
        
        // Create fallback metadata from field mappings
        const fallbackMetadata = createFallbackMetadata(connection.fieldMappings || connection.field_mappings || []);
        setFieldMetadata(fallbackMetadata);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchFieldMetadata();
  }, [connection]);

  // Get field mappings from connection
  const fieldMappings = connection.fieldMappings || connection.field_mappings || [];
  
  // Use fieldMetadata if available (for NocoDB), otherwise fall back to fieldMappings
  const visibleFields = fieldMetadata.length > 0
    ? fieldMetadata.filter(f => f.visible)
    : fieldMappings
        .filter(f => f.visible)
        .sort((a, b) => {
          const orderA = (a as any).displayOrder ?? 999;
          const orderB = (b as any).displayOrder ?? 999;
          return orderA - orderB;
        });

  // Show skeleton loading state while loading or fetching metadata
  if (loading || (connection.type === 'NOCODB' && metadataLoading)) {
    return (
      <div className="space-y-6" role="status" aria-live="polite" aria-label="Carregando formulário">
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" aria-hidden="true" />
              <Skeleton className="h-10 w-full" aria-hidden="true" />
            </div>
          ))}
        </div>
        <span className="sr-only">Carregando campos do formulário...</span>
      </div>
    );
  }

  /**
   * Validate a single field based on its configuration and type
   */
  const validateField = (field: FieldMapping | FieldMetadata, value: any): { isValid: boolean; error?: string } => {
    // Check if this is FieldMetadata (has type property)
    const isFieldMetadata = 'type' in field;

    if (isFieldMetadata) {
      // Use type-specific validation for fields with metadata
      return validateFieldValue(field as FieldMetadata, value);
    } else {
      // Fallback validation for fields without metadata
      if (field.editable && (value === null || value === undefined || value === '')) {
        return {
          isValid: false,
          error: `${field.label} é obrigatório`
        };
      }
      return { isValid: true };
    }
  };

  /**
   * Handle field change with validation
   */
  const handleFieldChange = (fieldName: string, value: any) => {
    const field = visibleFields.find(f => f.columnName === fieldName);
    
    if (!field) return;

    // Update form data
    const updatedData = {
      ...formData,
      [fieldName]: value
    };
    setFormData(updatedData);

    // Validate field on blur (validation will be triggered by TypeAwareFieldInput)
    // We still validate here for backward compatibility with plain inputs
    const validationResult = validateField(field, value);
    setValidation(prev => ({
      ...prev,
      [fieldName]: validationResult
    }));

    // Notify parent component
    onRecordChange(updatedData);
  };

  /**
   * Calculate changed fields for display
   */
  const getChangedFields = (): (FieldMapping | FieldMetadata)[] => {
    const editableFields = visibleFields.filter(f => f.editable);
    return editableFields.filter(field => 
      formData[field.columnName] !== originalRecord[field.columnName]
    );
  };

  const changedFields = getChangedFields();

  return (
    <form className="space-y-4 sm:space-y-6" onSubmit={(e) => e.preventDefault()}>
      {/* Metadata Error Alert */}
      {metadataError && connection.type === 'NOCODB' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar os tipos de campo. Usando campos de texto como alternativa.
            {metadataError && ` (${metadataError})`}
          </AlertDescription>
        </Alert>
      )}

      {/* Form Fields */}
      <fieldset 
        className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2"
        disabled={disabled || metadataLoading}
        aria-label="Campos do registro"
      >
        <legend className="sr-only">Formulário de edição de registro</legend>
        {visibleFields.map((field) => {
          const fieldValue = formData[field.columnName];
          const fieldValidation = validation[field.columnName];
          const hasError = fieldValidation && !fieldValidation.isValid;

          // Check if this is FieldMetadata (has type property) or FieldMapping
          const isFieldMetadata = 'type' in field;

          return (
            <div key={field.columnName} className="min-w-0">
              {isFieldMetadata ? (
                // Use TypeAwareFieldInput for fields with metadata
                <TypeAwareFieldInput
                  field={field as FieldMetadata}
                  value={fieldValue}
                  onChange={(value) => handleFieldChange(field.columnName, value)}
                  error={hasError ? fieldValidation.error : undefined}
                  disabled={disabled}
                  onValidationChange={(isValid, error) => {
                    setValidation(prev => ({
                      ...prev,
                      [field.columnName]: { isValid, error }
                    }));
                  }}
                />
              ) : (
                // Fallback to plain Input for fields without metadata
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label 
                      htmlFor={`field-${field.columnName}`}
                      className="text-sm font-medium"
                    >
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    
                    {field.helperText && (
                      <p 
                        id={`${field.columnName}-helper`}
                        className="text-xs text-muted-foreground leading-relaxed"
                      >
                        {field.helperText}
                      </p>
                    )}
                  </div>
                  
                  <Input
                    id={`field-${field.columnName}`}
                    name={field.columnName}
                    value={fieldValue || ''}
                    onChange={(e) => handleFieldChange(field.columnName, e.target.value)}
                    placeholder=""
                    disabled={!field.editable || disabled}
                    className={cn(
                      "w-full",
                      !field.editable && "bg-muted cursor-not-allowed",
                      hasError && "border-destructive focus-visible:ring-destructive",
                      disabled && field.editable && "opacity-60 cursor-wait"
                    )}
                    aria-invalid={hasError}
                    aria-required={field.editable}
                    aria-readonly={!field.editable}
                    type="text"
                  />
                  
                  {hasError && (
                    <p 
                      id={`${field.columnName}-error`}
                      className="text-xs text-destructive break-words"
                      role="alert"
                      aria-live="polite"
                    >
                      {fieldValidation.error}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      {/* Changes Summary */}
      {changedFields.length > 0 ? (
        <Card 
          className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
          role="status"
          aria-live="polite"
          aria-label={`${changedFields.length} alterações detectadas`}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base text-blue-800 dark:text-blue-200">
              Alterações Detectadas ({changedFields.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2" aria-label="Lista de alterações">
              {changedFields.map(field => {
                const formatValue = (val: any) => {
                  if (val === null || val === undefined || val === '') return '(vazio)';
                  if (val instanceof Date) return val.toLocaleDateString('pt-BR');
                  if (Array.isArray(val)) return val.join(', ');
                  if (typeof val === 'object') return JSON.stringify(val);
                  return String(val);
                };
                
                return (
                  <li key={field.columnName} className="text-xs sm:text-sm break-words">
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      {field.label}:
                    </span>
                    <span className="text-muted-foreground ml-2 break-all">
                      "{formatValue(originalRecord[field.columnName])}" → "{formatValue(formData[field.columnName])}"
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/50 border-muted" role="status">
          <CardContent className="pt-6">
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Nenhuma alteração foi feita ainda. Modifique os campos editáveis acima para salvar.
            </p>
          </CardContent>
        </Card>
      )}
    </form>
  );
});

RecordForm.displayName = 'RecordForm';

export default RecordForm;
