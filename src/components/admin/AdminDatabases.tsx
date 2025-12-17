import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom';
import { databaseConnectionsService, DatabaseConnection } from '@/services/database-connections';
import { Plus, RefreshCw, AlertTriangle, Loader2, Database, Pencil, Trash2, Wifi, Info } from 'lucide-react';
import { toast } from 'sonner';

const AdminDatabases = () => {
  const navigate = useNavigate();
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnections, setTestingConnections] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const initializeData = async () => {
      const isOnline = await checkServerStatus();
      await loadDatabases(isOnline ? 'online' : 'offline');
      
      // Testar conexões automaticamente após carregar
      if (isOnline) {
        setTimeout(async () => {
          try {
            await databaseConnectionsService.testAllConnections();
            await loadDatabases('online');
          } catch (error) {
            console.error('Erro no teste automático:', error);
          }
        }, 2000); // Aguardar 2 segundos para não sobrecarregar
      }
    };
    initializeData();
  }, []);

  const checkServerStatus = async () => {
    setServerStatus('checking');
    try {
      const isOnline = await databaseConnectionsService.healthCheck();
      setServerStatus(isOnline ? 'online' : 'offline');
      if (!isOnline) {
        toast.error('Servidor backend não está rodando', {
          description: 'Execute: cd server && npm install && npm run dev'
        });
      }
      return isOnline;
    } catch (error) {
      setServerStatus('offline');
      return false;
    }
  };

  const loadDatabases = async (currentServerStatus?: string) => {
    const status = currentServerStatus || serverStatus;
    if (status === 'offline') return;
    
    setLoading(true);
    try {
      const connections = await databaseConnectionsService.getAllConnections();
      
      setDatabases(connections);
      toast.success(`${connections.length} conexões carregadas`);
    } catch (error: any) {
      console.error('Erro ao carregar bancos:', error);
      toast.error('Erro ao carregar conexões', {
        description: error.message
      });
      setServerStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  const handleNewConnection = () => {
    navigate('/admin/databases/new');
  };

  const handleEditConnection = (connection: DatabaseConnection) => {
    navigate(`/admin/databases/edit/${connection.id}`);
  };

  const handleDeleteConnection = async (id: number, name: string) => {
    if (!confirm(`Tem certeza que deseja deletar a conexão "${name}"?`)) {
      return;
    }

    try {
      await databaseConnectionsService.deleteConnection(id);
      toast.success('Conexão deletada com sucesso!');
      loadDatabases();
    } catch (error: any) {
      toast.error('Erro ao deletar conexão', {
        description: error.message
      });
    }
  };



  const handleTestConnections = async () => {
    setTestingConnections(true);
    try {
      await databaseConnectionsService.testAllConnections();
      toast.success('Teste de conexões concluído!');
      // Recarregar dados após teste
      await loadDatabases();
    } catch (error: any) {
      toast.error('Erro ao testar conexões', {
        description: error.message
      });
    } finally {
      setTestingConnections(false);
    }
  };

  return (
    <div className="space-y-6">
      {serverStatus !== 'online' && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              {serverStatus === 'checking' ? (
                <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              )}
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  {serverStatus === 'checking' ? 'Verificando servidor...' : 'Servidor Backend Offline'}
                </p>
                {serverStatus === 'offline' && (
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    Execute: <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">cd server && npm install && npm run dev</code>
                  </p>
                )}
              </div>
              {serverStatus === 'offline' && (
                <Button size="sm" variant="outline" onClick={checkServerStatus}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Tentar Novamente
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Bancos de Dados</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Gerencie conexões com bancos de dados externos
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => loadDatabases()} 
              disabled={loading || serverStatus !== 'online'}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button 
              variant="outline" 
              onClick={handleTestConnections} 
              disabled={testingConnections || serverStatus !== 'online'}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Wifi className={`h-4 w-4 sm:mr-2 ${testingConnections ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">Testar Conexões</span>
              <span className="sm:hidden">Testar</span>
            </Button>
          </div>
          <Button onClick={handleNewConnection} disabled={serverStatus !== 'online'} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Nova Conexão
          </Button>
        </div>
      </div>

      <Card>
        <CardHeaderWithIcon
          icon={Database}
          iconColor="text-blue-500"
          title={`Conexões Configuradas (${databases.length})`}
        >
          <p className="text-sm text-muted-foreground">Lista de todas as conexões com bancos de dados externos</p>
        </CardHeaderWithIcon>
        <CardContent>
          {loading ? (
            <LoadingSkeleton variant="list" count={3} />
          ) : databases.length === 0 ? (
            <EmptyState
              icon={Database}
              title="Nenhuma conexão configurada"
              description="Clique em 'Nova Conexão' para adicionar uma conexão de banco de dados"
            />
          ) : (
            <div className="space-y-4">
              {databases.map((database) => (
                <div key={database.id} className="border rounded-lg p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-base sm:text-lg truncate">{database.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                          database.status === 'connected' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : database.status === 'error'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : database.status === 'testing'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                          {database.status === 'connected' ? 'Conectado' : 
                           database.status === 'error' ? 'Erro' : 
                           database.status === 'testing' ? 'Testando...' : 
                           'Desconectado'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm text-muted-foreground">
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">
                          {database.type}
                        </span>
                        <span className="truncate">{database.host}:{database.port}</span>
                        {database.database && <span className="truncate">DB: {database.database}</span>}
                        {database.table_name && <span className="truncate hidden sm:inline">Tabela: {database.table_name}</span>}
                      </div>
                      {database.assignedUsers && database.assignedUsers.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground truncate">
                          Usuários: {database.assignedUsers.join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditConnection(database)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteConnection(database.id!, database.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeaderWithIcon
          icon={Info}
          iconColor="text-purple-500"
          title="Como Funciona"
        />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Tipos de Conexão Suportados</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• NocoDB - Interface visual para bancos</li>
                <li>• PostgreSQL - Banco relacional avançado</li>
                <li>• MySQL - Banco relacional</li>
                <li>• API REST - Endpoints personalizados</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Funcionalidades</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Atribuir bancos específicos a usuários</li>
                <li>• Permitir edição de tabelas pelos usuários</li>
                <li>• Sincronização automática de dados</li>
                <li>• Logs de auditoria das alterações</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
};

export default AdminDatabases;
