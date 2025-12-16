import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { DatabaseConnection, FieldMapping, databaseConnectionsService } from '@/services/database-connections';
import { cn } from '@/lib/utils';

export function AddRecordPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConnection();
  }, [connectionId]);

  const loadConnection = async () => {
    setLoading(true);
    try {
      if (!user?.token) {
        toast.error('Token de autenticação não encontrado');
        navigate('/login');
        return;
      }
      
      const userToken = user.token;

      // Buscar detalhes da conexão com validação de acesso do usuário
      const connectionData = await databaseConnectionsService.getUserConnectionById(
        userToken,
        parseInt(connectionId!)
      );

      setConnection(connectionData);

      // Inicializar formulário com valores padrão
      const fieldMappings = connectionData.fieldMappings || connectionData.field_mappings || [];
      const initialData: Record<string, any> = {};
      
      // Preencher campos não editáveis com valores padrão
      fieldMappings.forEach(field => {
        if (!field.editable) {
          initialData[field.columnName] = '';
        }
      });

      // Preencher campo de vínculo com o token do usuário
      const userLinkField = connectionData.user_link_field || connectionData.userLinkField;
      if (userLinkField) {
        initialData[userLinkField] = userToken;
      }

      setFormData(initialData);
    } catch (error: any) {
      console.error('Erro ao carregar conexão:', error);
      toast.error(error.message || 'Erro ao carregar dados da conexão');
      navigate('/user/database');
    } finally {
      setLoading(false);
    }
  };

  // Get field mappings
  const fieldMappings = connection?.fieldMappings || connection?.field_mappings || [];
  const editableFields = fieldMappings
    .filter(f => f.visible && f.editable)
    .sort((a, b) => {
      const orderA = a.displayOrder ?? 999;
      const orderB = b.displayOrder ?? 999;
      return orderA - orderB;
    });

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

  const handleBlur = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    validateField(fieldName);
  };

  const validateField = (fieldName: string): boolean => {
    const field = editableFields.find(f => f.columnName === fieldName);
    if (!field) return true;

    const value = formData[fieldName];
    
    if (!value || value.toString().trim() === '') {
      setErrors(prev => ({
        ...prev,
        [fieldName]: `${field.label} é obrigatório`
      }));
      return false;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
    return true;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    editableFields.forEach(field => {
      const value = formData[field.columnName];
      if (!value || value.toString().trim() === '') {
        newErrors[field.columnName] = `${field.label} é obrigatório`;
        isValid = false;
      }
    });

    setErrors(newErrors);
    
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    editableFields.forEach(field => {
      allTouched[field.columnName] = true;
    });
    setTouched(allTouched);

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (!user?.token || !connection?.id) {
        toast.error('Dados de autenticação não encontrados');
        return;
      }
      
      const userToken = user.token;

      await databaseConnectionsService.createUserTableRecord(
        userToken,
        connection.id,
        formData
      );

      toast.success('Registro criado com sucesso!');
      navigate(`/user/database?connection=${connection.id}`);
    } catch (error: any) {
      console.error('Erro ao criar registro:', error);
      toast.error(error.message || 'Erro ao criar registro');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/user/database?connection=${connection?.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (!connection) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <h3 className="font-semibold text-destructive mb-2">Erro ao carregar conexão</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Não foi possível carregar os dados da conexão.
            </p>
            <Button onClick={() => navigate('/user/database')}>
              Voltar para Lista
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={saving}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Adicionar Novo Registro</h1>
            <p className="text-muted-foreground">
              {connection.name}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações do Registro</CardTitle>
            <CardDescription>
              Preencha os campos abaixo para criar um novo registro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form Fields */}
            <div className="grid gap-6 md:grid-cols-2">
              {editableFields.map((field) => {
                const fieldValue = formData[field.columnName] || '';
                const hasError = touched[field.columnName] && !!errors[field.columnName];

                return (
                  <div key={field.columnName} className="space-y-2">
                    <Label 
                      htmlFor={`field-${field.columnName}`}
                      className="text-sm font-medium"
                    >
                      {field.label}
                      <span className="text-destructive ml-1">*</span>
                    </Label>
                    
                    <Input
                      id={`field-${field.columnName}`}
                      name={field.columnName}
                      value={fieldValue}
                      onChange={(e) => handleFieldChange(field.columnName, e.target.value)}
                      onBlur={() => handleBlur(field.columnName)}
                      placeholder={`Digite ${field.label.toLowerCase()}`}
                      disabled={saving}
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
            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Nota:</strong> Campos não editáveis e o campo de vínculo do usuário serão preenchidos automaticamente pelo sistema.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Criando...' : 'Criar Registro'}
          </Button>
        </div>
      </form>
    </div>
  );
}
