import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatabaseConnection, databaseConnectionsService } from '@/services/database-connections';
import { DatabaseAdvancedTab } from './DatabaseAdvancedTab';
import { Loader2, Database } from 'lucide-react';

interface DatabaseConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (connection: Omit<DatabaseConnection, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  connection?: DatabaseConnection;
}

interface NocoDBOption {
  id: string;
  title: string;
  table_name?: string;
}

export function DatabaseConnectionDialog({ open, onOpenChange, onSave, connection }: DatabaseConnectionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  
  const [workspaces, setWorkspaces] = useState<NocoDBOption[]>([]);
  const [projects, setProjects] = useState<NocoDBOption[]>([]);
  const [tables, setTables] = useState<NocoDBOption[]>([]);
  
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  
  const [formData, setFormData] = useState<Partial<DatabaseConnection>>({
    name: '',
    type: 'API',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    table_name: '',
    status: 'disconnected',
    assignedUsers: [],
    nocodb_token: '',
    nocodb_project_id: '',
    nocodb_table_id: '',
  });

  // Atualizar formData quando connection mudar
  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name || '',
        type: connection.type || 'API',
        host: connection.host || '',
        port: connection.port || 5432,
        database: connection.database || '',
        username: connection.username || '',
        password: connection.password || '',
        table_name: connection.table_name || '',
        status: connection.status || 'disconnected',
        assignedUsers: connection.assignedUsers || [],
        nocodb_token: connection.nocodb_token || '',
        nocodb_project_id: connection.nocodb_project_id || '',
        nocodb_table_id: connection.nocodb_table_id || '',
      });
      
      // Para edição, definir valores selecionados
      if (connection.type === 'NOCODB') {
        setSelectedProject(connection.nocodb_project_id || connection.database || '');
        setSelectedTable(connection.nocodb_table_id || connection.table_name || '');
      }
    } else {
      // Reset form quando não há connection
      setFormData({
        name: '',
        type: 'API',
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
        table_name: '',
        status: 'disconnected',
        assignedUsers: [],
        nocodb_token: '',
        nocodb_project_id: '',
        nocodb_table_id: '',
      });
      
      // Reset dropdowns
      setWorkspaces([]);
      setProjects([]);
      setTables([]);
      setSelectedWorkspace('');
      setSelectedProject('');
      setSelectedTable('');
    }
  }, [connection, open]);

  // Carregar workspaces quando host e token estiverem disponíveis
  const loadWorkspaces = async () => {
    if (!formData.host || !formData.nocodb_token) return;
    
    setLoadingWorkspaces(true);
    try {
      const workspaceList = await databaseConnectionsService.getNocoDBWorkspaces(
        formData.host,
        formData.nocodb_token
      );
      setWorkspaces(workspaceList);
      
      // Se não há workspaces ou falhou, carregar projetos diretos
      if (workspaceList.length === 0) {
        loadProjects();
      }
    } catch (error: any) {
      console.error('Erro ao carregar workspaces:', error);
      // Se falhar, tentar carregar projetos diretos (NocoDB pode não ter workspaces)
      setWorkspaces([]);
      loadProjects();
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  // Carregar projetos
  const loadProjects = async (workspaceId?: string) => {
    if (!formData.host || !formData.nocodb_token) return;
    
    setLoadingProjects(true);
    try {
      const projectList = await databaseConnectionsService.getNocoDBProjects(
        formData.host,
        formData.nocodb_token,
        workspaceId
      );
      setProjects(projectList);
    } catch (error: any) {
      console.error('Erro ao carregar projetos:', error);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Carregar tabelas
  const loadTables = async (projectId: string) => {
    if (!formData.host || !formData.nocodb_token || !projectId) return;
    
    setLoadingTables(true);
    try {
      const tableList = await databaseConnectionsService.getNocoDBTables(
        formData.host,
        formData.nocodb_token,
        projectId
      );
      setTables(tableList);
    } catch (error: any) {
      console.error('Erro ao carregar tabelas:', error);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  // Trigger para carregar workspaces quando host/token mudam
  useEffect(() => {
    if (formData.type === 'NOCODB' && formData.host && formData.nocodb_token) {
      const timeoutId = setTimeout(() => {
        loadWorkspaces();
      }, 500); // Debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [formData.host, formData.nocodb_token, formData.type]);

  const handleTypeChange = (type: string) => {
    const newData: Partial<DatabaseConnection> = {
      ...formData,
      type: type as DatabaseConnection['type'],
    };

    // Ajustar porta padrão baseado no tipo
    if (type === 'POSTGRES') {
      newData.port = 5432;
    } else if (type === 'MYSQL') {
      newData.port = 3306;
    } else if (type === 'NOCODB') {
      newData.port = 8080;
    } else if (type === 'API') {
      newData.port = 443;
    }

    setFormData(newData);
    
    // Reset dropdowns quando mudar tipo
    if (type !== 'NOCODB') {
      setWorkspaces([]);
      setProjects([]);
      setTables([]);
      setSelectedWorkspace('');
      setSelectedProject('');
      setSelectedTable('');
    }
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    setSelectedWorkspace(workspaceId);
    setSelectedProject('');
    setSelectedTable('');
    setProjects([]);
    setTables([]);
    
    if (workspaceId) {
      loadProjects(workspaceId);
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedTable('');
    setTables([]);
    
    // Atualizar formData com o project ID
    setFormData({
      ...formData,
      nocodb_project_id: projectId,
      database: projectId, // Para compatibilidade
    });
    
    if (projectId) {
      loadTables(projectId);
    }
  };

  const handleTableChange = (tableId: string) => {
    setSelectedTable(tableId);
    
    // Encontrar a tabela selecionada para pegar o table_name
    const selectedTableData = tables.find(t => t.id === tableId);
    
    // Atualizar formData com o table ID
    setFormData({
      ...formData,
      nocodb_table_id: tableId,
      table_name: selectedTableData?.table_name || selectedTableData?.title || tableId,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Preparar dados baseado no tipo de conexão
      const connectionData: Omit<DatabaseConnection, 'id' | 'created_at' | 'updated_at'> = {
        ...formData,
        name: formData.name!,
        type: formData.type!,
        host: formData.host!,
        port: formData.port!,
        status: formData.status || 'disconnected',
        assignedUsers: formData.assignedUsers || [],
      };

      // Para NocoDB, ajustar campos obrigatórios
      if (formData.type === 'NOCODB') {
        // Validar campos obrigatórios do NocoDB
        if (!formData.nocodb_token) {
          throw new Error('Token de API é obrigatório para NocoDB');
        }
        if (!formData.nocodb_project_id && !selectedProject) {
          throw new Error('Project ID é obrigatório para NocoDB');
        }
        if (!formData.nocodb_table_id && !selectedTable) {
          throw new Error('Table ID é obrigatório para NocoDB');
        }

        connectionData.database = formData.nocodb_project_id || selectedProject || '';
        connectionData.username = 'nocodb';
        connectionData.password = formData.nocodb_token || '';
        connectionData.table_name = formData.nocodb_table_id || selectedTable || '';
        connectionData.nocodb_token = formData.nocodb_token;
        connectionData.nocodb_project_id = formData.nocodb_project_id || selectedProject;
        connectionData.nocodb_table_id = formData.nocodb_table_id || selectedTable;
      } else {
        connectionData.database = formData.database!;
        connectionData.username = formData.username!;
        connectionData.password = formData.password!;
        connectionData.table_name = formData.table_name || '';
      }

      await onSave(connectionData);
      // Reset form
      setFormData({
        name: '',
        type: 'API',
        host: '',
        port: 5432,
        database: '',
        username: '',
        password: '',
        table_name: '',
        status: 'disconnected',
        assignedUsers: [],
        nocodb_token: '',
        nocodb_project_id: '',
        nocodb_table_id: '',
      });
      setLoading(false);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{connection ? 'Editar Conexão' : 'Nova Conexão de Banco de Dados'}</DialogTitle>
          <DialogDescription>
            Configure uma nova conexão com banco de dados externo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Conexão *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Banco *</Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POSTGRES">PostgreSQL</SelectItem>
                    <SelectItem value="MYSQL">MySQL</SelectItem>
                    <SelectItem value="NOCODB">NocoDB</SelectItem>
                    <SelectItem value="API">API REST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue="connection" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="connection">Conexão</TabsTrigger>
                <TabsTrigger value="advanced">Avançado</TabsTrigger>
              </TabsList>

              <TabsContent value="connection" className="space-y-4">
                {formData.type !== 'NOCODB' ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label htmlFor="host">Host *</Label>
                        <Input
                          id="host"
                          value={formData.host}
                          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="port">Porta *</Label>
                        <Input
                          id="port"
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="database">Nome do Banco *</Label>
                      <Input
                        id="database"
                        value={formData.database}
                        onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Usuário *</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Senha *</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="table_name">Nome da Tabela</Label>
                      <Input
                        id="table_name"
                        value={formData.table_name}
                        onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="nocodb_host">URL do NocoDB *</Label>
                      <Input
                        id="nocodb_host"
                        placeholder="https://nocodb.wasend.com.br"
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nocodb_token">Token de API *</Label>
                      <Input
                        id="nocodb_token"
                        type="password"
                        placeholder="Token do NocoDB"
                        value={formData.nocodb_token}
                        onChange={(e) => setFormData({ ...formData, nocodb_token: e.target.value })}
                        required
                      />
                    </div>

                    {/* Dropdowns Dinâmicos */}
                    {formData.host && formData.nocodb_token && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                        <div className="flex items-center space-x-2">
                          <Database className="h-4 w-4" />
                          <span className="text-sm font-medium">Seleção Dinâmica</span>
                        </div>

                        {/* Workspace Dropdown - Mostrar sempre, mas pode estar vazio */}
                        <div className="space-y-2">
                          <Label>Workspace {workspaces.length > 0 && '*'}</Label>
                          <Select 
                            value={selectedWorkspace} 
                            onValueChange={handleWorkspaceChange}
                            disabled={loadingWorkspaces || workspaces.length === 0}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={
                                loadingWorkspaces ? "Carregando workspaces..." : 
                                workspaces.length === 0 ? "Sem workspaces (carregando projetos diretos)" :
                                "Selecione um workspace"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {workspaces.map((workspace) => (
                                <SelectItem key={workspace.id} value={workspace.id}>
                                  {workspace.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {workspaces.length === 0 && !loadingWorkspaces && (
                            <p className="text-xs text-muted-foreground">
                              Este NocoDB não usa workspaces, carregando projetos diretos.
                            </p>
                          )}
                        </div>

                        {/* Project/Base Dropdown */}
                        <div className="space-y-2">
                          <Label>Projeto/Base *</Label>
                          <Select value={selectedProject} onValueChange={handleProjectChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingProjects ? "Carregando..." : "Selecione um projeto"} />
                            </SelectTrigger>
                            <SelectContent>
                              {projects.map((project) => (
                                <SelectItem key={project.id} value={project.id}>
                                  {project.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Table Dropdown */}
                        <div className="space-y-2">
                          <Label>Tabela *</Label>
                          <Select value={selectedTable} onValueChange={handleTableChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={loadingTables ? "Carregando..." : "Selecione uma tabela"} />
                            </SelectTrigger>
                            <SelectContent>
                              {tables.map((table) => (
                                <SelectItem key={table.id} value={table.id}>
                                  {table.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Status de Validação */}
                        <div className="space-y-2">
                          <div className="text-xs space-y-1">
                            <div className={`flex items-center space-x-2 ${formData.host && formData.nocodb_token ? 'text-green-600' : 'text-red-600'}`}>
                              {formData.host && formData.nocodb_token ? '✅' : '❌'} 
                              <span>Credenciais preenchidas</span>
                            </div>
                            <div className={`flex items-center space-x-2 ${selectedProject || formData.nocodb_project_id ? 'text-green-600' : 'text-orange-600'}`}>
                              {selectedProject || formData.nocodb_project_id ? '✅' : '⚠️'} 
                              <span>Projeto selecionado</span>
                            </div>
                            <div className={`flex items-center space-x-2 ${selectedTable || formData.nocodb_table_id ? 'text-green-600' : 'text-orange-600'}`}>
                              {selectedTable || formData.nocodb_table_id ? '✅' : '⚠️'} 
                              <span>Tabela selecionada</span>
                            </div>
                          </div>
                          
                          {(selectedProject || formData.nocodb_project_id) && (selectedTable || formData.nocodb_table_id) && (
                            <div className="text-xs p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                              <div className="font-medium text-green-800 dark:text-green-200 mb-1">Configuração Válida:</div>
                              <div className="text-green-700 dark:text-green-300">
                                Project: {selectedProject || formData.nocodb_project_id}<br />
                                Table: {selectedTable || formData.nocodb_table_id}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Campos manuais como fallback */}
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-muted-foreground">Ou preencha manualmente:</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="nocodb_project_id">Project ID</Label>
                          <Input
                            id="nocodb_project_id"
                            placeholder="p1234567890"
                            value={formData.nocodb_project_id}
                            onChange={(e) => setFormData({ ...formData, nocodb_project_id: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="nocodb_table_id">Table ID</Label>
                          <Input
                            id="nocodb_table_id"
                            placeholder="m1234567890"
                            value={formData.nocodb_table_id}
                            onChange={(e) => setFormData({ ...formData, nocodb_table_id: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <DatabaseAdvancedTab 
                  formData={formData}
                  onFormDataChange={setFormData}
                />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connection ? 'Atualizar' : 'Criar Conexão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
