import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingSkeleton } from '@/components/ui-custom';
import { ArrowLeft, Loader2, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  databaseConnectionsService, 
  DatabaseConnection,
  DatabaseNavigationError,
  DatabaseNavigationException
} from '@/services/database-connections';
import { ThemeLoader } from '@/components/features/edit-themes/ThemeLoader';

const DirectEditPage = () => {
  const navigate = useNavigate();
  const { connectionId, recordId } = useParams<{ connectionId: string; recordId: string }>();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [record, setRecord] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState<{ type: string; message: string; suggestion?: string } | null>(null);

  useEffect(() => {
    if (connectionId && recordId && user?.token) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, recordId, user?.token]);

  const fetchData = async () => {
    if (!connectionId || !recordId || !user?.token) return;

    setLoading(true);
    setError(null);

    try {
      const conn = await databaseConnectionsService.getUserConnectionById(user.token, Number(connectionId));
      
      if (!conn) {
        setError({
          type: DatabaseNavigationError.CONNECTION_NOT_FOUND,
          message: 'Conexão não encontrada',
          suggestion: 'A conexão pode ter sido removida pelo administrador'
        });
        return;
      }
      
      setConnection(conn);
      
      const specificRecord = await databaseConnectionsService.getUserTableRecordById(
        user.token,
        Number(connectionId),
        recordId
      );
      
      if (!specificRecord) {
        setError({
          type: DatabaseNavigationError.RECORD_NOT_FOUND,
          message: 'Registro não encontrado',
          suggestion: 'O registro pode ter sido removido ou você não tem permissão para acessá-lo'
        });
        return;
      }
      
      setRecord(specificRecord);
      setFormData(specificRecord);
      
    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      
      if (err instanceof DatabaseNavigationException) {
        switch (err.code) {
          case DatabaseNavigationError.CONNECTION_NOT_FOUND:
            setError({
              type: err.code,
              message: err.message,
              suggestion: 'A conexão pode ter sido removida pelo administrador'
            });
            setTimeout(() => navigate('/user'), 3000);
            break;
            
          case DatabaseNavigationError.RECORD_NOT_FOUND:
            setError({
              type: err.code,
              message: err.message,
              suggestion: err.suggestion || 'Entre em contato com o administrador para criar um registro'
            });
            break;
            
          case DatabaseNavigationError.UNAUTHORIZED:
            setError({
              type: err.code,
              message: 'Acesso negado',
              suggestion: 'Sua sessão pode ter expirado. Você será redirecionado para o login.'
            });
            toast.error('Sessão expirada. Faça login novamente.');
            setTimeout(() => {
              logout();
              navigate('/login');
            }, 2000);
            break;
            
          case DatabaseNavigationError.NETWORK_ERROR:
            setError({
              type: err.code,
              message: 'Erro de conexão com o servidor',
              suggestion: 'Verifique sua conexão com a internet e tente novamente'
            });
            break;
            
          default:
            setError({
              type: DatabaseNavigationError.DATABASE_ERROR,
              message: err.message || 'Erro ao carregar dados',
              suggestion: 'Tente novamente mais tarde ou entre em contato com o suporte'
            });
        }
      } else {
        setError({
          type: DatabaseNavigationError.DATABASE_ERROR,
          message: err.message || 'Erro ao carregar dados',
          suggestion: 'Tente novamente mais tarde'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecordChange = (updatedRecord: Record<string, any>) => {
    setFormData(updatedRecord);
  };

  const handleSave = async () => {
    const recordId = record?.Id || record?.id;
    if (!connection?.id || !recordId || !user?.token) {
      return;
    }
    
    setSaving(true);
    try {
      const fieldMappings = connection.fieldMappings || connection.field_mappings || [];
      const editableFields = fieldMappings.filter(f => f.editable);
      
      let nocoColumns: any[] = [];
      if (connection.type === 'NOCODB') {
        try {
          nocoColumns = await databaseConnectionsService.getNocoDBColumns(connection);
        } catch (error) {
          console.error('Failed to fetch NocoDB columns:', error);
        }
      }
      
      const hasChanged = (current: any, original: any): boolean => {
        if (current === original) return false;
        if (current == null && original == null) return false;
        if (current == null || original == null) return true;
        
        if (Array.isArray(current) && Array.isArray(original)) {
          if (current.length !== original.length) return true;
          return !current.every((val, idx) => val === original[idx]);
        }
        
        if (current instanceof Date && original instanceof Date) {
          return current.getTime() !== original.getTime();
        }
        if (current instanceof Date && typeof original === 'string') {
          return current.toISOString() !== original;
        }
        
        return current !== original;
      };
      
      const updatedData: Record<string, any> = {};
      editableFields.forEach(field => {
        const currentValue = formData[field.columnName];
        const originalValue = record[field.columnName];
        
        if (hasChanged(currentValue, originalValue)) {
          let transformedValue = currentValue;
          
          const column = nocoColumns.find(col => col.column_name === field.columnName);
          
          if (column && column.uidt === 'Date' && currentValue instanceof Date) {
            const year = currentValue.getFullYear();
            const month = String(currentValue.getMonth() + 1).padStart(2, '0');
            const day = String(currentValue.getDate()).padStart(2, '0');
            transformedValue = `${year}-${month}-${day}`;
          }
          else if (column && column.uidt === 'DateTime' && currentValue instanceof Date) {
            transformedValue = currentValue.toISOString();
          }
          else if (column && column.colOptions && column.colOptions.options) {
            const options = column.colOptions.options;
            
            if (Array.isArray(currentValue)) {
              const titles = currentValue
                .map(id => {
                  const byId = options.find((opt: any) => opt.id === id);
                  if (byId) return byId.title;
                  const byTitle = options.find((opt: any) => opt.title === id);
                  if (byTitle) return byTitle.title;
                  return id;
                })
                .filter(Boolean);
              
              transformedValue = titles.join(',');
            } else if (typeof currentValue === 'string') {
              const option = options.find((opt: any) => opt.id === currentValue);
              if (option) {
                transformedValue = option.title;
              }
            }
          }
          
          updatedData[field.columnName] = transformedValue;
        }
      });

      if (Object.keys(updatedData).length === 0) {
        toast.info('Nenhuma alteração foi feita');
        return;
      }

      await databaseConnectionsService.updateUserTableRecord(
        user.token,
        connection.id,
        recordId.toString(),
        updatedData
      );
      
      toast.success('Alterações salvas com sucesso!', {
        description: `${Object.keys(updatedData).length} campo(s) atualizado(s)`,
        duration: 3000
      });
      
      await fetchData();
      
    } catch (err: any) {
      console.error('Failed to save:', err);
      
      if (err instanceof DatabaseNavigationException) {
        if (err.code === DatabaseNavigationError.UNAUTHORIZED) {
          toast.error('Sessão expirada. Faça login novamente.');
          setTimeout(() => {
            logout();
            navigate('/login');
          }, 2000);
        } else {
          toast.error(err.message || 'Erro ao salvar alterações');
        }
      } else {
        toast.error(err.message || 'Erro ao salvar alterações');
      }
    } finally {
      setSaving(false);
    }
  };

  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await fetchData();
    setRetrying(false);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // Helper function to check if values are different
  const valueHasChanged = (current: any, original: any): boolean => {
    const normalizedCurrent = (current == null || current === '') ? null : current;
    const normalizedOriginal = (original == null || original === '') ? null : original;
    
    if (normalizedCurrent === normalizedOriginal) return false;
    if (normalizedCurrent === null || normalizedOriginal === null) return true;
    
    if (Array.isArray(current) && Array.isArray(original)) {
      if (current.length !== original.length) return true;
      return !current.every((val, idx) => val === original[idx]);
    }
    
    if (current instanceof Date && original instanceof Date) {
      return current.getTime() !== original.getTime();
    }
    if (current instanceof Date && typeof original === 'string') {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const currentDateStr = `${year}-${month}-${day}`;
      const originalDateStr = original.split('T')[0];
      return currentDateStr !== originalDateStr;
    }
    
    return current !== original;
  };

  // Calculate if there are changes
  const hasChanges = (): boolean => {
    const formDataKeys = Object.keys(formData);
    const recordKeys = Object.keys(record || {});
    const allFieldNames = Array.from(new Set([...formDataKeys, ...recordKeys]));
    const systemFields = ['id', 'Id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order'];
    const userFields = allFieldNames.filter(name => !systemFields.includes(name));
    
    return userFields.some(fieldName => {
      const current = formData[fieldName];
      const original = record[fieldName];
      return valueHasChanged(current, original);
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite" aria-label="Carregando página de edição">
        <LoadingSkeleton variant="card" count={2} />
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto py-4 sm:py-8 px-2 sm:px-0" role="alert" aria-live="assertive">
        <Alert variant={error.type === DatabaseNavigationError.UNAUTHORIZED ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <AlertTitle className="font-semibold text-sm sm:text-base">
            {error.type === DatabaseNavigationError.CONNECTION_NOT_FOUND && 'Conexão Não Encontrada'}
            {error.type === DatabaseNavigationError.RECORD_NOT_FOUND && 'Registro Não Encontrado'}
            {error.type === DatabaseNavigationError.UNAUTHORIZED && 'Acesso Negado'}
            {error.type === DatabaseNavigationError.NETWORK_ERROR && 'Erro de Conexão'}
            {error.type === DatabaseNavigationError.DATABASE_ERROR && 'Erro no Banco de Dados'}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm">
            <p className="break-words">{error.message}</p>
            {error.suggestion && (
              <p className="text-xs sm:text-sm italic break-words">{error.suggestion}</p>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3" role="group" aria-label="Ações de erro">
          <Button 
            variant="outline" 
            onClick={handleGoBack}
            aria-label="Voltar ao dashboard principal"
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            Voltar ao Dashboard
          </Button>
          
          {error.type !== DatabaseNavigationError.UNAUTHORIZED && 
           error.type !== DatabaseNavigationError.CONNECTION_NOT_FOUND && (
            <Button 
              onClick={handleRetry} 
              disabled={retrying}
              aria-label={retrying ? "Tentando novamente..." : "Tentar carregar novamente"}
              className="w-full sm:w-auto"
            >
              {retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Tentar Novamente
            </Button>
          )}
        </div>
      </div>
    );
  }

  // No data state
  if (!connection || !record) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 space-y-4 px-4" role="status">
        <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm sm:text-base text-muted-foreground text-center">Dados não disponíveis</p>
        <Button 
          variant="outline" 
          onClick={handleGoBack}
          aria-label="Voltar ao dashboard"
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          Voltar
        </Button>
      </div>
    );
  }

  // Render using ThemeLoader
  return (
    <ThemeLoader
      connection={connection}
      record={record}
      formData={formData}
      onRecordChange={handleRecordChange}
      onSave={handleSave}
      onBack={handleGoBack}
      saving={saving}
      disabled={saving}
      hasChanges={hasChanges()}
    />
  );
};

export default DirectEditPage;
