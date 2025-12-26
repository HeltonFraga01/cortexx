import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatabaseConnection, databaseConnectionsService, SupabaseTable, SupabaseColumn, SupabaseKeyType } from '@/services/database-connections';
import { DatabaseAdvancedTab } from './DatabaseAdvancedTab';
import { Loader2, Database, ArrowLeft, Save, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface NocoDBOption {
  id: string;
  title: string;
  table_name?: string;
}

export function DatabaseConnectionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  const [workspaces, setWorkspaces] = useState<NocoDBOption[]>([]);
  const [projects, setProjects] = useState<NocoDBOption[]>([]);
  const [tables, setTables] = useState<NocoDBOption[]>([]);

  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');

  // Supabase states
  const [supabaseTables, setSupabaseTables] = useState<SupabaseTable[]>([]);
  const [supabaseColumns, setSupabaseColumns] = useState<SupabaseColumn[]>([]);
  const [loadingSupabaseTables, setLoadingSupabaseTables] = useState(false);
  const [loadingSupabaseColumns, setLoadingSupabaseColumns] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedSupabaseTable, setSelectedSupabaseTable] = useState<string>('');

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
    supabase_url: '',
    supabase_key: '',
    supabase_key_type: 'anon',
    supabase_table: '',
    user_link_field: '',
    fieldMappings: [],
    default_view_mode: 'list',
  });

  // Carregar dados da conexão se estiver editando
  useEffect(() => {
    if (isEditing && id) {
      loadConnection(id);
    }
  }, [isEditing, id]);

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

      if (workspaceList.length === 0) {
        loadProjects();
      }
    } catch (error: any) {
      console.error('Erro ao carregar workspaces:', error);
      setWorkspaces([]);
      loadProjects();
    } finally {
      setLoadingWorkspaces(false);
    }
  };

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

  const loadConnection = async (connectionId: string) => {
    setLoading(true);
    try {
      const connection = await databaseConnectionsService.getConnectionById(connectionId);
      if (connection) {
        setFormData(connection);

        if (connection.type === 'NOCODB') {
          const projectId = connection.nocodb_project_id || connection.database || '';
          const tableId = connection.nocodb_table_id || connection.table_name || '';

          setSelectedProject(projectId);
          setSelectedTable(tableId);

          // Carregar projetos e tabelas para popular os dropdowns
          if (connection.host && connection.nocodb_token) {
            // Carregar workspaces primeiro
            try {
              const workspaceList = await databaseConnectionsService.getNocoDBWorkspaces(
                connection.host,
                connection.nocodb_token
              );
              setWorkspaces(workspaceList);
            } catch (error) {
              console.error('Erro ao carregar workspaces:', error);
              setWorkspaces([]);
            }

            // Carregar projetos
            try {
              const projectList = await databaseConnectionsService.getNocoDBProjects(
                connection.host,
                connection.nocodb_token
              );
              setProjects(projectList);
            } catch (error) {
              console.error('Erro ao carregar projetos:', error);
              setProjects([]);
            }

            // Carregar tabelas do projeto selecionado
            if (projectId) {
              try {
                const tableList = await databaseConnectionsService.getNocoDBTables(
                  connection.host,
                  connection.nocodb_token,
                  projectId
                );
                setTables(tableList);
              } catch (error) {
                console.error('Erro ao carregar tabelas:', error);
                setTables([]);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar conexão:', error);
      toast.error('Erro ao carregar conexão');
      navigate('/admin/databases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (formData.type === 'NOCODB' && formData.host && formData.nocodb_token) {
      const timeoutId = setTimeout(() => {
        loadWorkspaces();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [formData.host, formData.nocodb_token, formData.type]);

  const handleTypeChange = (type: string) => {
    const newData: Partial<DatabaseConnection> = {
      ...formData,
      type: type as DatabaseConnection['type'],
    };

    if (type === 'POSTGRES') {
      newData.port = 5432;
    } else if (type === 'MYSQL') {
      newData.port = 3306;
    } else if (type === 'NOCODB') {
      newData.port = 8080;
    } else if (type === 'SUPABASE') {
      newData.port = 443;
    } else if (type === 'API') {
      newData.port = 443;
    }

    setFormData(newData);

    if (type !== 'NOCODB') {
      setWorkspaces([]);
      setProjects([]);
      setTables([]);
      setSelectedWorkspace('');
      setSelectedProject('');
      setSelectedTable('');
    }

    if (type !== 'SUPABASE') {
      setSupabaseTables([]);
      setSupabaseColumns([]);
      setSelectedSupabaseTable('');
      setSupabaseTestResult(null);
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

    setFormData({
      ...formData,
      nocodb_project_id: projectId,
      database: projectId,
    });

    if (projectId) {
      loadTables(projectId);
    }
  };

  const handleTableChange = (tableId: string) => {
    setSelectedTable(tableId);

    const selectedTableData = tables.find(t => t.id === tableId);

    setFormData({
      ...formData,
      nocodb_table_id: tableId,
      table_name: selectedTableData?.table_name || selectedTableData?.title || tableId,
    });
  };

  // ============================================
  // SUPABASE HANDLERS
  // ============================================

  const handleTestSupabaseCredentials = async () => {
    if (!formData.supabase_url || !formData.supabase_key) {
      toast.error('URL e API Key são obrigatórios');
      return;
    }

    setTestingSupabase(true);
    setSupabaseTestResult(null);

    try {
      const result = await databaseConnectionsService.testSupabaseCredentials(
        formData.supabase_url,
        formData.supabase_key,
        formData.supabase_key_type || 'anon'
      );

      setSupabaseTestResult(result);

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      setSupabaseTestResult({ success: false, message: error.message });
      toast.error(error.message || 'Erro ao testar credenciais');
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleLoadSupabaseTables = async () => {
    if (!formData.supabase_url || !formData.supabase_key) {
      toast.error('URL e API Key são obrigatórios');
      return;
    }

    setLoadingSupabaseTables(true);

    try {
      const tables = await databaseConnectionsService.getSupabaseTablesWithCredentials(
        formData.supabase_url,
        formData.supabase_key,
        formData.supabase_key_type || 'anon'
      );

      setSupabaseTables(tables);

      if (tables.length === 0) {
        toast.info('Nenhuma tabela encontrada no schema public');
      } else {
        toast.success(`${tables.length} tabela(s) encontrada(s)`);
      }
    } catch (error: any) {
      console.error('Erro ao carregar tabelas:', error);
      toast.error(error.message || 'Erro ao carregar tabelas');
      setSupabaseTables([]);
    } finally {
      setLoadingSupabaseTables(false);
    }
  };

  const handleSupabaseTableChange = async (tableName: string) => {
    setSelectedSupabaseTable(tableName);
    setFormData({
      ...formData,
      supabase_table: tableName,
      table_name: tableName,
    });

    // Carregar colunas da tabela selecionada
    if (tableName && formData.supabase_url && formData.supabase_key) {
      setLoadingSupabaseColumns(true);
      try {
        const columns = await databaseConnectionsService.getSupabaseColumnsWithCredentials(
          formData.supabase_url,
          formData.supabase_key,
          formData.supabase_key_type || 'anon',
          tableName
        );
        setSupabaseColumns(columns);
      } catch (error: any) {
        console.error('Erro ao carregar colunas:', error);
        setSupabaseColumns([]);
      } finally {
        setLoadingSupabaseColumns(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const connectionData: Omit<DatabaseConnection, 'id' | 'created_at' | 'updated_at'> = {
        ...formData,
        name: formData.name!,
        type: formData.type!,
        host: formData.host!,
        port: formData.port!,
        database: formData.database || '',
        username: formData.username || '',
        password: formData.password || '',
        status: formData.status || 'disconnected',
        assignedUsers: formData.assignedUsers || [],
        default_view_mode: formData.default_view_mode || 'list',
      };

      if (formData.type === 'NOCODB') {
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
      } else if (formData.type === 'SUPABASE') {
        if (!formData.supabase_url) {
          throw new Error('URL do Supabase é obrigatória');
        }
        if (!formData.supabase_key) {
          throw new Error('API Key do Supabase é obrigatória');
        }
        if (!formData.supabase_table && !selectedSupabaseTable) {
          throw new Error('Tabela é obrigatória para Supabase');
        }

        connectionData.host = formData.supabase_url;
        connectionData.database = 'supabase';
        connectionData.username = 'supabase';
        connectionData.password = formData.supabase_key;
        connectionData.table_name = formData.supabase_table || selectedSupabaseTable || '';
        connectionData.supabase_url = formData.supabase_url;
        connectionData.supabase_key = formData.supabase_key;
        connectionData.supabase_key_type = formData.supabase_key_type || 'anon';
        connectionData.supabase_table = formData.supabase_table || selectedSupabaseTable;
      } else {
        connectionData.database = formData.database!;
        connectionData.username = formData.username!;
        connectionData.password = formData.password!;
        connectionData.table_name = formData.table_name || '';
      }

      if (isEditing && id) {
        await databaseConnectionsService.updateConnection(id, connectionData);
        toast.success('Conexão atualizada com sucesso!');
      } else {
        await databaseConnectionsService.createConnection(connectionData);
        toast.success('Conexão criada com sucesso!');
      }

      navigate('/admin/databases');
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar conexão');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/admin/databases');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando conexão...</span>
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
            <h1 className="text-3xl font-bold">
              {isEditing ? 'Editar Conexão' : 'Nova Conexão'}
            </h1>
            <p className="text-muted-foreground">
              Configure uma conexão com banco de dados externo
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
            {isEditing ? 'Atualizar' : 'Criar'} Conexão
          </Button>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-6">
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
                      <SelectItem value="SUPABASE">Supabase</SelectItem>
                      <SelectItem value="API">API REST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* View Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuração de Visualização</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="default_view_mode">Modo de Visualização Padrão</Label>
                      <Select
                        value={formData.default_view_mode || 'list'}
                        onValueChange={(value: 'list' | 'single') => setFormData({ ...formData, default_view_mode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="list">Modo Lista (Tabela de Registros)</SelectItem>
                          <SelectItem value="single">Modo Registro Único (Redirecionar)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        <strong>Modo Lista:</strong> Exibe uma tabela com todos os registros (padrão).<br />
                        <strong>Modo Registro Único:</strong> Redireciona automaticamente para o primeiro registro encontrado (ideal para "Meu Perfil").
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <Tabs defaultValue="connection" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="connection">Conexão</TabsTrigger>
                  <TabsTrigger value="advanced">Avançado</TabsTrigger>
                </TabsList>

                <TabsContent value="connection" className="space-y-6 mt-6">
                  {formData.type === 'NOCODB' ? (
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
                          value={formData.nocodb_token}
                          onChange={(e) => setFormData({ ...formData, nocodb_token: e.target.value })}
                          required
                        />
                      </div>

                      {/* Dropdowns Dinâmicos */}
                      {formData.host && formData.nocodb_token && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                              <Database className="h-4 w-4" />
                              <span>Seleção Dinâmica</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Workspace */}
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

                            {/* Project */}
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

                            {/* Table */}
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

                            {/* Status */}
                            {(selectedProject || formData.nocodb_project_id) && (selectedTable || formData.nocodb_table_id) && (
                              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="font-medium text-green-800 dark:text-green-200 mb-1">Configuração Válida:</div>
                                <div className="text-green-700 dark:text-green-300 text-sm">
                                  Project: {selectedProject || formData.nocodb_project_id}<br />
                                  Table: {selectedTable || formData.nocodb_table_id}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Manual Fields */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Ou preencha manualmente:</CardTitle>
                        </CardHeader>
                        <CardContent>
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
                        </CardContent>
                      </Card>
                    </>
                  ) : formData.type === 'SUPABASE' ? (
                    <>
                      {/* Supabase Configuration */}
                      <div className="space-y-2">
                        <Label htmlFor="supabase_url">URL do Projeto Supabase *</Label>
                        <Input
                          id="supabase_url"
                          placeholder="https://seu-projeto.supabase.co"
                          value={formData.supabase_url}
                          onChange={(e) => setFormData({ ...formData, supabase_url: e.target.value })}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Encontre em: Supabase Dashboard → Settings → API → Project URL
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                          <Label htmlFor="supabase_key">API Key *</Label>
                          <Input
                            id="supabase_key"
                            type="password"
                            value={formData.supabase_key}
                            onChange={(e) => setFormData({ ...formData, supabase_key: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="supabase_key_type">Tipo de Key</Label>
                          <Select
                            value={formData.supabase_key_type || 'anon'}
                            onValueChange={(value: SupabaseKeyType) => setFormData({ ...formData, supabase_key_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="anon">Anon (Pública)</SelectItem>
                              <SelectItem value="service_role">Service Role</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <strong>Anon:</strong> Respeita RLS (Row Level Security) - recomendado para usuários.<br />
                        <strong>Service Role:</strong> Ignora RLS - use apenas para admin.
                      </p>

                      {/* Test Connection Button */}
                      <div className="flex items-center gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTestSupabaseCredentials}
                          disabled={testingSupabase || !formData.supabase_url || !formData.supabase_key}
                        >
                          {testingSupabase ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Testar Conexão
                        </Button>

                        {supabaseTestResult && (
                          <div className={`flex items-center gap-2 text-sm ${supabaseTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                            {supabaseTestResult.success ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {supabaseTestResult.message}
                          </div>
                        )}
                      </div>

                      {/* Dynamic Table Selection */}
                      {formData.supabase_url && formData.supabase_key && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                              <Database className="h-4 w-4" />
                              <span>Seleção de Tabela</span>
                            </CardTitle>
                            <CardDescription>
                              Carregue as tabelas disponíveis no schema public
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleLoadSupabaseTables}
                              disabled={loadingSupabaseTables}
                            >
                              {loadingSupabaseTables ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                              )}
                              Carregar Tabelas
                            </Button>

                            {supabaseTables.length > 0 && (
                              <div className="space-y-2">
                                <Label>Tabela *</Label>
                                <Select
                                  value={selectedSupabaseTable || formData.supabase_table}
                                  onValueChange={handleSupabaseTableChange}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma tabela" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {supabaseTables.map((table) => (
                                      <SelectItem key={table.name} value={table.name}>
                                        {table.name}
                                        {table.rlsEnabled && (
                                          <span className="ml-2 text-xs text-muted-foreground">(RLS)</span>
                                        )}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* Column Preview */}
                            {supabaseColumns.length > 0 && (
                              <div className="space-y-2">
                                <Label>Colunas da Tabela</Label>
                                <div className="p-3 bg-muted rounded-lg max-h-40 overflow-y-auto">
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    {supabaseColumns.map((col) => (
                                      <div key={col.name} className="flex items-center gap-2">
                                        <span className="font-mono">{col.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          ({col.dataType})
                                        </span>
                                        {col.isPrimaryKey && (
                                          <span className="text-xs bg-primary/10 text-primary px-1 rounded">PK</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {loadingSupabaseColumns && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Carregando colunas...
                              </div>
                            )}

                            {/* Status */}
                            {(selectedSupabaseTable || formData.supabase_table) && (
                              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                                <div className="font-medium text-green-800 dark:text-green-200 mb-1">Configuração Válida:</div>
                                <div className="text-green-700 dark:text-green-300 text-sm">
                                  URL: {formData.supabase_url?.replace(/https:\/\/([^.]+).*/, '$1.supabase.co')}<br />
                                  Tabela: {selectedSupabaseTable || formData.supabase_table}<br />
                                  Tipo de Key: {formData.supabase_key_type === 'service_role' ? 'Service Role' : 'Anon'}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Manual Table Input */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Ou preencha manualmente:</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <Label htmlFor="supabase_table">Nome da Tabela</Label>
                            <Input
                              id="supabase_table"
                              placeholder="users"
                              value={formData.supabase_table}
                              onChange={(e) => setFormData({ ...formData, supabase_table: e.target.value, table_name: e.target.value })}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
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
                  )}
                </TabsContent>

                <TabsContent value="advanced" className="mt-6">
                  <DatabaseAdvancedTab
                    formData={formData}
                    onFormDataChange={setFormData}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}