import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { DatabaseConnection, FieldMapping } from '@/services/database-connections';
import { cn } from '@/lib/utils';

interface AddRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: DatabaseConnection;
  userToken: string;
  onSuccess: () => void;
}

export function AddRecordDialog({ 
  open, 
  onOpenChange, 
  connection, 
  userToken,
  onSuccess 
}: AddRecordDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get field mappings
  const fieldMappings = connection.fieldMappings || connection.field_mappings || [];
  const editableFields = fieldMappings
    .filter(f => f.visible && f.editable)
    .sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });

  // Initialize form with defaults
  useEffect(() => {
    if (open) {
      const initialData: Record<string, any> = {};
      
      // Preencher campos não editáveis com valores padrão
      fieldMappings.forEach(field => {
        if (!field.editable) {
          // Campos não editáveis ficam vazios ou com valor padrão do banco
          initialData[field.columnName] = '';
        }
      });

      // Preencher campo de vínculo com o token do usuário
      const userLinkField = connection.user_link_field || connection.userLinkField;
      if (userLinkField) {
        initialData[userLinkField] = userToken;
      }

      setFormData(initialData);
      setErrors({});
    }
  }, [open, connection, userToken, fieldMappings]);

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    editableFields.forEach(field => {
      const value = formData[field.columnName];
      if (!value || value.toString().trim() === '') {
        newErrors[field.columnName] = `${field.label} é obrigatório`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const { databaseConnectionsService } = await import('@/services/database-connections');
      
      await databaseConnectionsService.createUserTableRecord(
        userToken,
        connection.id!,
        formData
      );

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao criar registro:', error);
      setErrors({ _general: error.message || 'Erro ao criar registro' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Adicionar Novo Registro
          </DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para criar um novo registro em {connection.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* General Error */}
          {errors._general && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{errors._general}</p>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid gap-4 md:grid-cols-2">
            {editableFields.map((field) => {
              const fieldValue = formData[field.columnName] || '';
              const hasError = !!errors[field.columnName];

              return (
                <div key={field.columnName} className="space-y-2">
                  <Label 
                    htmlFor={`add-field-${field.columnName}`}
                    className="text-sm font-medium"
                  >
                    {field.label}
                    <span className="text-destructive ml-1">*</span>
                  </Label>
                  
                  <Input
                    id={`add-field-${field.columnName}`}
                    name={field.columnName}
                    value={fieldValue}
                    onChange={(e) => handleFieldChange(field.columnName, e.target.value)}
                    placeholder={`Digite ${field.label.toLowerCase()}`}
                    disabled={loading}
                    className={cn(
                      hasError && "border-destructive focus-visible:ring-destructive"
                    )}
                    aria-invalid={hasError}
                    aria-describedby={
                      [
                        hasError && `${field.columnName}-error`,
                        field.helperText && `${field.columnName}-helper`
                      ].filter(Boolean).join(' ') || undefined
                    }
                  />
                  
                  {/* Helper Text */}
                  {field.helperText && !hasError && (
                    <p 
                      id={`${field.columnName}-helper`}
                      className="text-xs text-muted-foreground"
                    >
                      {field.helperText}
                    </p>
                  )}
                  
                  {/* Error Message */}
                  {hasError && (
                    <p 
                      id={`${field.columnName}-error`}
                      className="text-xs text-destructive"
                    >
                      {errors[field.columnName]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Info about auto-filled fields */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Nota:</strong> Campos não editáveis e o campo de vínculo do usuário serão preenchidos automaticamente pelo sistema.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {loading ? 'Criando...' : 'Criar Registro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
