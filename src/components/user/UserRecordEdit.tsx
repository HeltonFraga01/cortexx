import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { databaseConnectionsService, DatabaseConnection, FieldMapping } from '@/services/database-connections';

const UserRecordEdit = () => {
  const navigate = useNavigate();
  const { connectionId, recordId } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [visibleFields, setVisibleFields] = useState<FieldMapping[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [originalRecord, setOriginalRecord] = useState<any>(null);

  useEffect(() => {
    if (connectionId && recordId && user?.token) {
      loadRecordData();
    }
  }, [connectionId, recordId, user]);

  const loadRecordData = async () => {
    if (!connectionId || !recordId || !user?.token) return;

    setLoading(true);
    try {
      // Carregar conexão e dados do registro
      const [userConnections, tableData] = await Promise.all([
        databaseConnectionsService.getUserConnections(user.token),
        databaseConnectionsService.getUserTableData(user.token, parseInt(connectionId))
      ]);

      // Encontrar a conexão específica
      const currentConnection = userConnections.find(conn => conn.id === parseInt(connectionId));
      if (!currentConnection) {
        throw new Error('Conexão não encontrada');
      }

      setConnection(currentConnection);

      // Configurar campos visíveis
      const fieldMappings = currentConnection.fieldMappings || currentConnection.field_mappings || [];
      const visible = fieldMappings.filter(f => f.visible);
      setVisibleFields(visible);

      // Encontrar o registro específico
      const record = tableData.find(r => r.id.toString() === recordId);
      if (!record) {
        throw new Error('Registro não encontrado');
      }

      setOriginalRecord(record);
      setFormData(record);

    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error(error.message || 'Erro ao carregar dados do registro');
      navigate('/user/database');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectionId || !recordId || !user?.token) return;

    setSaving(true);
    try {
      // Filtrar apenas campos editáveis que foram modificados
      const editableFields = visibleFields.filter(f => f.editable);
      const updatedData: Record<string, any> = {};
      
      editableFields.forEach(field => {
        if (formData[field.columnName] !== originalRecord[field.columnName]) {
          updatedData[field.columnName] = formData[field.columnName];
        }
      });

      if (Object.keys(updatedData).length === 0) {
        toast.info('Nenhuma alteração foi feita');
        navigate('/user/database');
        return;
      }

      await databaseConnectionsService.updateUserTableRecord(
        user.token,
        parseInt(connectionId),
        recordId,
        updatedData
      );

      toast.success('Registro atualizado com sucesso!');
      navigate('/user/database');
    } catch (error: any) {
      console.error('Erro ao atualizar registro:', error);
      toast.error(error.message || 'Erro ao atualizar registro');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/user/database');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando registro...</span>
      </div>
    );
  }

  if (!connection || !originalRecord) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-muted-foreground">Registro não encontrado</p>
          <Button variant="outline" onClick={handleCancel} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Registro</h1>
            <p className="text-muted-foreground">
              Modifique as informações do registro em {connection.name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>{connection.name}</span>
          </CardTitle>
          <CardDescription>
            Editando registro ID: {recordId} na tabela {connection.table_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="text-sm font-medium">Tipo do Banco</Label>
              <p className="text-sm text-muted-foreground">{connection.type}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Tabela</Label>
              <p className="text-sm text-muted-foreground">{connection.table_name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Campo de Vínculo</Label>
              <p className="text-sm text-muted-foreground">{connection.user_link_field}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Registro</CardTitle>
          <CardDescription>
            Campos marcados como somente leitura não podem ser editados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {visibleFields.map((field) => (
                <div key={field.columnName} className="space-y-2">
                  <Label htmlFor={`field-${field.columnName}`}>
                    {field.label}
                    {field.editable ? (
                      <span className="text-green-600 ml-1">(Editável)</span>
                    ) : (
                      <span className="text-muted-foreground ml-1">(Somente leitura)</span>
                    )}
                  </Label>
                  <Input
                    id={`field-${field.columnName}`}
                    value={formData[field.columnName] || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      [field.columnName]: e.target.value 
                    })}
                    placeholder={`Digite ${field.label.toLowerCase()}`}
                    disabled={!field.editable}
                    className={!field.editable ? 'bg-muted' : ''}
                  />
                  {!field.editable && (
                    <p className="text-xs text-muted-foreground">
                      Este campo não pode ser editado
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Summary of changes */}
            {(() => {
              const editableFields = visibleFields.filter(f => f.editable);
              const changedFields = editableFields.filter(field => 
                formData[field.columnName] !== originalRecord[field.columnName]
              );
              
              if (changedFields.length > 0) {
                return (
                  <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm text-blue-800 dark:text-blue-200">
                        Alterações Detectadas ({changedFields.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {changedFields.map(field => (
                          <div key={field.columnName} className="text-sm">
                            <span className="font-medium text-blue-700 dark:text-blue-300">
                              {field.label}:
                            </span>
                            <span className="text-muted-foreground ml-2">
                              "{originalRecord[field.columnName] || '(vazio)'}" → "{formData[field.columnName] || '(vazio)'}"
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserRecordEdit;