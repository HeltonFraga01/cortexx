/**
 * AgentDatabaseEditPage
 * 
 * Page for agents to view/edit a specific database record.
 * Respects access levels: 'view' = read-only, 'full' = read/write
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, AlertCircle, XCircle, Eye, Edit, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAgentDatabaseConnection,
  getAgentDatabaseRecord,
  updateAgentDatabaseRecord,
  getAgentDatabaseColumns,
  type AgentDatabaseConnectionDetails
} from '@/services/agent-auth';
import { ThemeLoader } from '@/components/features/edit-themes/ThemeLoader';

const AgentDatabaseEditPage = () => {
  const navigate = useNavigate();
  const { connectionId, recordId } = useParams<{ connectionId: string; recordId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<AgentDatabaseConnectionDetails | null>(null);
  const [record, setRecord] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [accessLevel, setAccessLevel] = useState<'view' | 'full'>('view');
  const [error, setError] = useState<{ type: string; message: string; suggestion?: string } | null>(null);
  const [nocoColumns, setNocoColumns] = useState<any[]>([]);

  useEffect(() => {
    if (connectionId && recordId) {
      fetchData();
    }
  }, [connectionId, recordId]);

  const fetchData = async () => {
    if (!connectionId || !recordId) return;

    setLoading(true);
    setError(null);

    try {
      // Get connection details
      const conn = await getAgentDatabaseConnection(connectionId);
      setConnection(conn);
      setAccessLevel(conn.accessLevel);

      // Get record
      const { record: rec, accessLevel: recAccess } = await getAgentDatabaseRecord(connectionId, recordId);
      
      if (!rec) {
        setError({
          type: 'RECORD_NOT_FOUND',
          message: 'Registro não encontrado',
          suggestion: 'O registro pode ter sido removido ou você não tem permissão para acessá-lo'
        });
        return;
      }

      setRecord(rec);
      setFormData(rec);
      setAccessLevel(recAccess);

      // Get NocoDB columns for field type info
      try {
        const columns = await getAgentDatabaseColumns(connectionId);
        setNocoColumns(columns);
      } catch (err) {
        console.error('Failed to fetch columns:', err);
      }

    } catch (err: any) {
      console.error('Failed to fetch data:', err);
      
      if (err.message?.includes('Acesso negado')) {
        setError({
          type: 'UNAUTHORIZED',
          message: 'Acesso negado',
          suggestion: 'Você não tem permissão para acessar este banco de dados'
        });
      } else if (err.message?.includes('não encontrad')) {
        setError({
          type: 'NOT_FOUND',
          message: err.message,
          suggestion: 'O recurso pode ter sido removido'
        });
      } else {
        setError({
          type: 'ERROR',
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
    if (!connection?.id || !recordId || accessLevel !== 'full') {
      if (accessLevel === 'view') {
        toast.error('Você não tem permissão para editar este registro');
      }
      return;
    }

    setSaving(true);
    try {
      const fieldMappings = connection.fieldMappings || [];
      const editableFields = fieldMappings.filter(f => f.editable);

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
          } else if (column && column.uidt === 'DateTime' && currentValue instanceof Date) {
            transformedValue = currentValue.toISOString();
          } else if (column && column.colOptions && column.colOptions.options) {
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

      await updateAgentDatabaseRecord(connection.id, recordId, updatedData);

      toast.success('Alterações salvas com sucesso!', {
        description: `${Object.keys(updatedData).length} campo(s) atualizado(s)`,
        duration: 3000
      });

      await fetchData();

    } catch (err: any) {
      console.error('Failed to save:', err);
      toast.error(err.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    if (connectionId) {
      navigate(`/agent/database/${connectionId}`);
    } else {
      navigate('/agent');
    }
  };

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

  const hasChanges = (): boolean => {
    if (!record) return false;
    const formDataKeys = Object.keys(formData);
    const recordKeys = Object.keys(record);
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
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto py-4 sm:py-8 px-2 sm:px-0" role="alert">
        <Alert variant={error.type === 'UNAUTHORIZED' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <AlertTitle className="font-semibold text-sm sm:text-base">
            {error.type === 'NOT_FOUND' && 'Não Encontrado'}
            {error.type === 'UNAUTHORIZED' && 'Acesso Negado'}
            {error.type === 'ERROR' && 'Erro'}
            {error.type === 'RECORD_NOT_FOUND' && 'Registro Não Encontrado'}
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm">
            <p className="break-words">{error.message}</p>
            {error.suggestion && (
              <p className="text-xs sm:text-sm italic break-words">{error.suggestion}</p>
            )}
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button variant="outline" onClick={handleGoBack} className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          {error.type !== 'UNAUTHORIZED' && (
            <Button onClick={fetchData} className="w-full sm:w-auto">
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
        <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
        <p className="text-sm sm:text-base text-muted-foreground text-center">Dados não disponíveis</p>
        <Button variant="outline" onClick={handleGoBack} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const isReadOnly = accessLevel === 'view';

  // Create a modified connection object for ThemeLoader
  // If read-only, mark all fields as non-editable
  const connectionForTheme = isReadOnly
    ? {
        ...connection,
        fieldMappings: connection.fieldMappings.map(f => ({ ...f, editable: false })),
        field_mappings: connection.fieldMappings.map(f => ({ ...f, editable: false }))
      }
    : connection;

  return (
    <div className="space-y-4">
      {/* Access level indicator */}
      {isReadOnly && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Modo Somente Leitura</AlertTitle>
          <AlertDescription>
            Você pode visualizar este registro, mas não tem permissão para editá-lo.
          </AlertDescription>
        </Alert>
      )}

      <ThemeLoader
        connection={connectionForTheme as any}
        record={record}
        formData={formData}
        onRecordChange={handleRecordChange}
        onSave={isReadOnly ? undefined : handleSave}
        onBack={handleGoBack}
        saving={saving}
        disabled={saving || isReadOnly}
        hasChanges={hasChanges() && !isReadOnly}
        isAgentContext={true}
      />
    </div>
  );
};

export default AgentDatabaseEditPage;
