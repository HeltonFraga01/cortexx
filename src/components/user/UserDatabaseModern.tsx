/**
 * UserDatabaseModern
 * 
 * Requirements: 7.3 - Feature gating for NocoDB integration
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  Edit,
  Search,
  Loader2,
  RefreshCw,
  Grid3x3,
  List,
  Filter,
  X,
  User,
  Calendar,
  Hash,
  Mail,
  Phone,
  MapPin,
  FileText,
  Tag,
  Clock,
  Calendar as CalendarIcon,
  Columns3,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { databaseConnectionsService, DatabaseConnection, FieldMapping } from '@/services/database-connections';
import { CalendarView } from './CalendarView';
import { KanbanView } from './KanbanView';
import { Label } from '@/components/ui/label';
import { FeatureGate } from '@/components/user/FeatureGate';

// Mapeamento de ícones por tipo de campo
const getFieldIcon = (columnName: string) => {
  const name = columnName.toLowerCase();

  if (name.includes('user') || name.includes('nome') || name.includes('name')) return User;
  if (name.includes('email') || name.includes('mail')) return Mail;
  if (name.includes('phone') || name.includes('telefone') || name.includes('celular')) return Phone;
  if (name.includes('date') || name.includes('data') || name.includes('created') || name.includes('updated')) return Calendar;
  if (name.includes('address') || name.includes('endereco') || name.includes('cidade') || name.includes('estado')) return MapPin;
  if (name.includes('description') || name.includes('descricao') || name.includes('obs')) return FileText;
  if (name.includes('status') || name.includes('situacao') || name.includes('tipo')) return Tag;
  if (name.includes('id') || name.includes('codigo') || name.includes('number')) return Hash;
  if (name.includes('time') || name.includes('hora')) return Clock;

  return FileText;
};

type ViewMode = 'grid' | 'list';
type ViewType = 'table' | 'calendar' | 'kanban';

const UserDatabaseModern = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Estados para dados
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<DatabaseConnection | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<FieldMapping[]>([]);

  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedView, setSelectedView] = useState<ViewType>('table');
  const [filterField, setFilterField] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Carregar conexões do usuário
  useEffect(() => {
    if (user?.token) {
      loadUserConnections();
    }
  }, [user]);

  // Carregar dados quando uma conexão for selecionada
  useEffect(() => {
    if (selectedConnection && user?.token) {
      loadTableData();
    }
  }, [selectedConnection, user]);

  // Carregar preferência de visualização salva
  useEffect(() => {
    if (selectedConnection?.id) {
      const savedView = loadViewPreference(selectedConnection.id);

      // Verificar se a view salva ainda está disponível
      if (savedView && isViewAvailable(savedView)) {
        setSelectedView(savedView);
      } else {
        // Se a view salva não está disponível, usar table
        setSelectedView('table');
      }
    }
  }, [selectedConnection]);

  const loadUserConnections = async () => {
    if (!user?.token) return;

    setLoading(true);
    try {
      const userConnections = await databaseConnectionsService.getUserConnections(user.token);
      setConnections(userConnections);

      // Check if there's a connection ID in the URL
      const connectionIdParam = searchParams.get('connection');

      if (connectionIdParam) {
        // Find and select the connection from URL parameter
        const connectionId = parseInt(connectionIdParam, 10);
        const targetConnection = userConnections.find(c => c.id === connectionId);

        if (targetConnection) {
          setSelectedConnection(targetConnection);

          // Configurar campos visíveis
          const fieldMappings = targetConnection.fieldMappings || targetConnection.field_mappings || [];
          const visible = fieldMappings.filter(f => f.visible);
          setVisibleFields(visible);
        } else {
          toast.error('Conexão não encontrada');
          // Fallback to first connection
          if (userConnections.length > 0) {
            setSelectedConnection(userConnections[0]);
            const fieldMappings = userConnections[0].fieldMappings || userConnections[0].field_mappings || [];
            const visible = fieldMappings.filter(f => f.visible);
            setVisibleFields(visible);
          }
        }
      } else {
        // Selecionar a primeira conexão automaticamente se não houver parâmetro
        if (userConnections.length > 0) {
          setSelectedConnection(userConnections[0]);

          // Configurar campos visíveis
          const fieldMappings = userConnections[0].fieldMappings || userConnections[0].field_mappings || [];
          const visible = fieldMappings.filter(f => f.visible);
          setVisibleFields(visible);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar conexões:', error);
      toast.error('Erro ao carregar suas conexões de banco de dados');
    } finally {
      setLoading(false);
    }
  };

  // Efeito para lidar com o redirecionamento do modo "single"
  useEffect(() => {
    const handleSingleRecordRedirect = async () => {
      if (selectedConnection && selectedConnection.default_view_mode === 'single' && user?.token) {
        // Evitar loop se já estiver carregando
        if (loadingRecords) return;

        try {
          setLoadingRecords(true);
          // Buscar dados para encontrar o primeiro registro
          const data = await databaseConnectionsService.getUserTableData(user.token, selectedConnection.id);

          if (data && data.length > 0) {
            const firstRecord = data[0];
            const recordId = firstRecord.Id || firstRecord.id;

            if (recordId) {
              toast.info('Redirecionando para seu registro...');
              navigate(`/user/database/${selectedConnection.id}/edit/${recordId}`);
            }
          } else {
            // Se não houver registro, talvez redirecionar para criar um novo?
            // Por enquanto, vamos mostrar a lista vazia com um aviso
            toast.info('Nenhum registro encontrado. Crie um novo registro.');
          }
        } catch (error) {
          console.error('Erro ao buscar registro para redirecionamento:', error);
        } finally {
          setLoadingRecords(false);
        }
      }
    };

    handleSingleRecordRedirect();
  }, [selectedConnection, user, navigate]);

  const loadTableData = async () => {
    if (!selectedConnection?.id || !user?.token) return;

    setLoadingRecords(true);
    try {
      const data = await databaseConnectionsService.getUserTableData(user.token, selectedConnection.id);
      setRecords(data);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados da tabela');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Filtrar e ordenar registros
  const getFilteredAndSortedRecords = () => {
    let filtered = records;

    // Aplicar busca
    if (searchTerm) {
      filtered = filtered.filter(record => {
        if (filterField === 'all') {
          return visibleFields.some(field => {
            const value = record[field.columnName];
            return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
          });
        } else {
          const value = record[filterField];
          return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        }
      });
    }

    // Aplicar ordenação
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];

        if (aValue === bValue) return 0;

        const comparison = aValue > bValue ? 1 : -1;
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  };

  const filteredRecords = getFilteredAndSortedRecords();

  // Calcular paginação
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  // Reset para primeira página quando filtrar ou trocar conexão
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterField, sortField, selectedConnection]);

  const handleEditRecord = (record: any) => {
    if (!selectedConnection?.id) {
      toast.error('Conexão não selecionada');
      return;
    }

    const recordId = record.Id || record.id;
    if (!recordId) {
      toast.error('ID do registro não encontrado');
      return;
    }

    navigate(`/user/database/${selectedConnection.id}/edit/${recordId}`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterField('all');
    setSortField('');
  };

  const handleAddRecord = () => {
    if (!selectedConnection?.id) {
      toast.error('Conexão não selecionada');
      return;
    }
    navigate(`/user/database/${selectedConnection.id}/add`);
  };

  // Verificar se uma visualização está disponível
  const isViewAvailable = (view: ViewType): boolean => {
    if (view === 'table') return true; // Table sempre disponível

    const viewConfig = selectedConnection?.viewConfiguration || selectedConnection?.view_configuration;
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

  const handleViewChange = (view: string) => {
    const newView = view as ViewType;
    setSelectedView(newView);

    // Salvar preferência
    if (selectedConnection?.id) {
      saveViewPreference(selectedConnection.id, newView);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando suas conexões...</span>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Meu Banco de Dados</h1>
          <p className="text-muted-foreground">
            Gerencie seus dados personalizados
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma conexão disponível</h3>
              <p className="text-muted-foreground mb-4">
                O administrador ainda não atribuiu nenhuma conexão de banco de dados para sua conta.
              </p>
              <Button variant="outline" onClick={loadUserConnections}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Verificar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const viewConfig = selectedConnection?.viewConfiguration || selectedConnection?.view_configuration;
  const calendarAvailable = isViewAvailable('calendar');
  const kanbanAvailable = isViewAvailable('kanban');

  return (
    <FeatureGate
      feature="nocodb_integration"
      title="Integração NocoDB"
      description="A integração com banco de dados NocoDB não está disponível no seu plano atual. Faça upgrade para desbloquear."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meu Banco de Dados</h1>
            <p className="text-muted-foreground">
              {selectedConnection ? selectedConnection.name : 'Gerencie seus dados personalizados'}
            </p>
          </div>

        {/* View Mode Toggle - Only show in table view */}
        {selectedView === 'table' && (
          <div className="flex items-center space-x-2 border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {selectedConnection && (
        <Tabs value={selectedView} onValueChange={handleViewChange}>
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Tabela</span>
              <span className="sm:hidden">Tab</span>
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

          {/* Table View */}
          <TabsContent value="table" className="space-y-6 mt-6">
            {/* Filters Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="md:col-span-2 relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar nos seus registros..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Filter Field */}
                  <Select value={filterField} onValueChange={setFilterField}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrar por campo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os campos</SelectItem>
                      {visibleFields.map((field) => (
                        <SelectItem key={field.columnName} value={field.columnName}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Sort */}
                  <div className="flex space-x-2">
                    <Select value={sortField || 'none'} onValueChange={(value) => setSortField(value === 'none' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem ordenação</SelectItem>
                        {visibleFields.map((field) => (
                          <SelectItem key={field.columnName} value={field.columnName}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {sortField && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Active Filters */}
                {(searchTerm || filterField !== 'all' || sortField) && (
                  <div className="flex items-center space-x-2 mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">Filtros ativos:</span>
                    {searchTerm && (
                      <Badge variant="secondary">
                        Busca: {searchTerm}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setSearchTerm('')} />
                      </Badge>
                    )}
                    {filterField !== 'all' && (
                      <Badge variant="secondary">
                        Campo: {visibleFields.find(f => f.columnName === filterField)?.label}
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setFilterField('all')} />
                      </Badge>
                    )}
                    {sortField && (
                      <Badge variant="secondary">
                        Ordem: {visibleFields.find(f => f.columnName === sortField)?.label} ({sortOrder === 'asc' ? 'A-Z' : 'Z-A'})
                        <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => setSortField('')} />
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Limpar tudo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Records Display */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{selectedConnection.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {filteredRecords.length} de {records.length} registros
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleAddRecord}
                      disabled={loadingRecords}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                    <Button variant="outline" size="sm" onClick={loadTableData} disabled={loadingRecords}>
                      {loadingRecords ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {loadingRecords ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Carregando dados...</span>
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {searchTerm ? 'Nenhum registro encontrado para sua busca.' : 'Nenhum registro encontrado.'}
                    </p>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* Grid View */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginatedRecords.map((record) => {
                      // Filtrar campos para exibir no card
                      // Prioridade: campos com showInCard: true
                      let cardFields = visibleFields.filter(f => f.showInCard);

                      // Fallback: se nenhum campo tem showInCard: true, usar primeiros campos visíveis (exceto técnicos)
                      if (cardFields.length === 0) {
                        const technicalFields = ['id', 'Id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order'];
                        cardFields = visibleFields.filter(f => !technicalFields.includes(f.columnName));
                      }

                      const fieldsToShow = cardFields.slice(0, 4);
                      const totalCardFields = cardFields.length;

                      return (
                        <Card key={record.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                          <CardContent className="pt-6">
                            <div className="space-y-3">
                              {fieldsToShow.map((field) => {
                                const Icon = getFieldIcon(field.columnName);
                                return (
                                  <div key={field.columnName} className="flex items-start space-x-3">
                                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs text-muted-foreground">{field.label}</div>
                                      <div className="text-sm font-medium truncate" title={record[field.columnName]}>
                                        {record[field.columnName] || '-'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {totalCardFields > 4 && (
                                <div className="text-xs text-muted-foreground pt-2 border-t">
                                  +{totalCardFields - 4} campos adicionais
                                </div>
                              )}

                              <Button
                                className="w-full mt-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                size="sm"
                                onClick={() => handleEditRecord(record)}
                              >
                                <Edit className="h-3 w-3 mr-2" />
                                Editar Registro
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  /* List View */
                  <div className="space-y-2">
                    {paginatedRecords.map((record) => {
                      // Filtrar campos para exibir no card
                      // Prioridade: campos com showInCard: true
                      let cardFields = visibleFields.filter(f => f.showInCard);

                      // Fallback: se nenhum campo tem showInCard: true, usar primeiros campos visíveis (exceto técnicos)
                      if (cardFields.length === 0) {
                        const technicalFields = ['id', 'Id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order'];
                        cardFields = visibleFields.filter(f => !technicalFields.includes(f.columnName));
                      }

                      const fieldsToShow = cardFields.slice(0, 4);

                      return (
                        <Card key={record.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                {fieldsToShow.map((field) => {
                                  const Icon = getFieldIcon(field.columnName);
                                  return (
                                    <div key={field.columnName} className="flex items-center space-x-2">
                                      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      <div className="min-w-0">
                                        <div className="text-xs text-muted-foreground">{field.label}</div>
                                        <div className="text-sm font-medium truncate" title={record[field.columnName]}>
                                          {record[field.columnName] || '-'}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRecord(record)}
                                className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* Pagination Controls */}
                {filteredRecords.length > 0 && (
                  <div className="space-y-4 mt-6 pt-6 border-t">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Items per page selector */}
                      <div className="flex items-center gap-2">
                        <Label htmlFor="items-per-page" className="text-sm text-muted-foreground whitespace-nowrap">
                          Itens por página:
                        </Label>
                        <select
                          id="items-per-page"
                          value={itemsPerPage}
                          onChange={(e) => {
                            setItemsPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      {/* Page info */}
                      <div className="text-sm text-muted-foreground">
                        Mostrando {startIndex + 1} a {Math.min(endIndex, filteredRecords.length)} de {filteredRecords.length} registros
                        {searchTerm && ` (filtrados de ${records.length} total)`}
                      </div>

                      {/* Pagination buttons */}
                      {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0"
                            title="Primeira página"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0"
                            title="Página anterior"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>

                          <div className="flex items-center gap-1 px-2">
                            <span className="text-sm font-medium">{currentPage}</span>
                            <span className="text-sm text-muted-foreground">de</span>
                            <span className="text-sm font-medium">{totalPages}</span>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 p-0"
                            title="Próxima página"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 p-0"
                            title="Última página"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar View */}
          {calendarAvailable && (
            <TabsContent value="calendar" className="mt-6">
              <CalendarView
                connection={selectedConnection}
                records={records}
                dateField={viewConfig?.calendar?.dateField || ''}
                onRecordClick={(clickedRecord) => {
                  if (selectedConnection?.id) {
                    const recordId = clickedRecord.Id || clickedRecord.id;
                    if (recordId) {
                      navigate(`/user/database/${selectedConnection.id}/edit/${recordId}`);
                    }
                  }
                }}
                onRefresh={loadTableData}
              />
            </TabsContent>
          )}

          {/* Kanban View */}
          {kanbanAvailable && (
            <TabsContent value="kanban" className="mt-6">
              <KanbanView
                connection={selectedConnection}
                records={records}
                statusField={viewConfig?.kanban?.statusField || ''}
                onRecordUpdate={async (recordId, updates) => {
                  if (!user?.token || !selectedConnection.id) return;

                  await databaseConnectionsService.updateUserTableRecord(
                    user.token,
                    selectedConnection.id,
                    recordId,
                    updates
                  );

                  // Recarregar dados
                  await loadTableData();
                }}
                onRecordClick={(clickedRecord) => {
                  if (selectedConnection?.id) {
                    const recordId = clickedRecord.Id || clickedRecord.id;
                    if (recordId) {
                      navigate(`/user/database/${selectedConnection.id}/edit/${recordId}`);
                    }
                  }
                }}
                onRefresh={loadTableData}
              />
            </TabsContent>
          )}
        </Tabs>
      )}
      </div>
    </FeatureGate>
  );
};

export default UserDatabaseModern;
