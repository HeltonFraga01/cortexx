import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Calendar as CalendarIcon, Columns3, AlertCircle, Plus } from 'lucide-react';
import { DatabaseConnection, databaseConnectionsService } from '@/services/database-connections';
import { toast } from 'sonner';
import RecordForm from './RecordForm';
import { CalendarView } from './CalendarView';
import { KanbanView } from './KanbanView';

type ViewType = 'form' | 'calendar' | 'kanban';

export function UserDatabaseView() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<DatabaseConnection | null>(null);
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [selectedView, setSelectedView] = useState<ViewType>('form');
  const [saving, setSaving] = useState(false);
  const [hasMultipleRecords, setHasMultipleRecords] = useState(false);

  // Carregar dados da conexão e registro do usuário
  useEffect(() => {
    if (connectionId) {
      loadConnectionAndRecord();
    }
  }, [connectionId]);

  // Carregar preferência de visualização salva
  useEffect(() => {
    if (connection?.id) {
      const savedView = loadViewPreference(connection.id);
      
      // Verificar se a view salva ainda está disponível
      if (savedView && isViewAvailable(savedView)) {
        setSelectedView(savedView);
      } else {
        // Se a view salva não está disponível, usar form
        setSelectedView('form');
      }
    }
  }, [connection]);

  const loadConnectionAndRecord = async () => {
    setLoading(true);
    try {
      const userToken = localStorage.getItem('userToken');
      if (!userToken) {
        toast.error('Token de autenticação não encontrado');
        navigate('/login');
        return;
      }

      // Buscar detalhes da conexão com validação de acesso do usuário
      const connectionData = await databaseConnectionsService.getUserConnectionById(
        userToken,
        parseInt(connectionId!)
      );

      // Buscar dados da conexão e registro do usuário
      const userRecord = await databaseConnectionsService.getUserRecord(
        userToken,
        parseInt(connectionId!)
      );

      // Buscar todos os registros para visualizações Calendar e Kanban
      const allRecords = await databaseConnectionsService.getUserTableData(
        userToken,
        parseInt(connectionId!)
      );

      setConnection(connectionData);
      setRecord(userRecord);
      setRecords(allRecords);
      setHasMultipleRecords(allRecords.length > 1);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error(error.message || 'Erro ao carregar dados da conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = () => {
    if (!connection?.id) {
      toast.error('Conexão não selecionada');
      return;
    }
    navigate(`/user/database/${connection.id}/add`);
  };

  const handleRecordChange = (updatedRecord: Record<string, any>) => {
    setRecord(updatedRecord);
  };

  const handleSave = async () => {
    if (!connection?.id || !record) return;

    setSaving(true);
    try {
      const userToken = localStorage.getItem('userToken');
      if (!userToken) {
        toast.error('Token de autenticação não encontrado');
        return;
      }

      await databaseConnectionsService.updateUserTableRecord(
        userToken,
        connection.id,
        record.id || record.Id,
        record
      );

      toast.success('Registro atualizado com sucesso!');
      
      // Recarregar dados
      await loadConnectionAndRecord();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleViewChange = (view: string) => {
    const newView = view as ViewType;
    setSelectedView(newView);
    
    // Salvar preferência
    if (connection?.id) {
      saveViewPreference(connection.id, newView);
    }
  };

  // Verificar se uma visualização está disponível
  const isViewAvailable = (view: ViewType): boolean => {
    if (view === 'form') return true; // Form sempre disponível
    
    const viewConfig = connection?.viewConfiguration || connection?.view_configuration;
    if (!viewConfig) return false;

    if (view === 'calendar') {
      return viewConfig.calendar?.enabled && !!viewConfig.calendar?.dateField;
    }
    
    if (view === 'kanban') {
      return viewConfig.kanban?.enabled && !!viewConfig.kanban?.statusField;
    }

    return false;
  };

  // Salvar preferência de visualização no localStorage
  const saveViewPreference = (connectionId: number, view: ViewType) => {
    try {
      localStorage.setItem(`db-view-${connectionId}`, view);
    } catch (error) {
      console.error('Erro ao salvar preferência de visualização:', error);
    }
  };

  // Carregar preferência de visualização do localStorage
  const loadViewPreference = (connectionId: number): ViewType | null => {
    try {
      const saved = localStorage.getItem(`db-view-${connectionId}`);
      return (saved as ViewType) || null;
    } catch (error) {
      console.error('Erro ao carregar preferência de visualização:', error);
      return null;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!connection || !record) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Erro ao carregar dados</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Não foi possível carregar os dados da conexão. Verifique suas permissões ou entre em contato com o administrador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const viewConfig = connection.viewConfiguration || connection.view_configuration;
  const calendarAvailable = isViewAvailable('calendar');
  const kanbanAvailable = isViewAvailable('kanban');

  const userToken = localStorage.getItem('userToken');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{connection.name}</h1>
          <p className="text-muted-foreground">
            Visualize e edite seus dados
            {hasMultipleRecords && ` • ${records.length} registros`}
          </p>
        </div>
        {hasMultipleRecords && (
          <Button onClick={handleAddRecord}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Registro
          </Button>
        )}
      </div>

      {/* View Tabs */}
      <Tabs value={selectedView} onValueChange={handleViewChange}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto">
          <TabsTrigger value="form" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Formulário</span>
            <span className="sm:hidden">Form</span>
          </TabsTrigger>
          
          {calendarAvailable && (
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Calendário</span>
              <span className="sm:hidden">Cal</span>
            </TabsTrigger>
          )}
          
          {kanbanAvailable && (
            <TabsTrigger value="kanban" className="flex items-center gap-2">
              <Columns3 className="h-4 w-4" />
              <span>Kanban</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Form View */}
        <TabsContent value="form" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <RecordForm
                connection={connection}
                record={record}
                onRecordChange={handleRecordChange}
                disabled={saving}
                loading={false}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </TabsContent>

        {/* Calendar View */}
        {calendarAvailable && (
          <TabsContent value="calendar">
            <CalendarView
              connection={connection}
              records={records}
              dateField={viewConfig?.calendar?.dateField || ''}
              onRecordClick={(clickedRecord) => {
                setRecord(clickedRecord);
                setSelectedView('form');
              }}
              onRefresh={loadConnectionAndRecord}
            />
          </TabsContent>
        )}

        {/* Kanban View */}
        {kanbanAvailable && (
          <TabsContent value="kanban">
            <KanbanView
              connection={connection}
              records={records}
              statusField={viewConfig?.kanban?.statusField || ''}
              onRecordUpdate={async (recordId, updates) => {
                const userToken = localStorage.getItem('userToken');
                if (!userToken || !connection.id) return;

                await databaseConnectionsService.updateUserTableRecord(
                  userToken,
                  connection.id,
                  recordId,
                  updates
                );

                // Recarregar dados
                await loadConnectionAndRecord();
              }}
              onRecordClick={(clickedRecord) => {
                setRecord(clickedRecord);
                setSelectedView('form');
              }}
              onRefresh={loadConnectionAndRecord}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
