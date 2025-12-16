/**
 * AgentDatabasePage
 * 
 * Page for agents to view and manage database records they have access to.
 * Respects access levels: 'view' = read-only, 'full' = read/write
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Database,
  Edit,
  Eye,
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
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  getAgentDatabaseConnection,
  getAgentDatabaseData,
  type AgentDatabaseConnectionDetails
} from '@/services/agent-auth';

// Field icon mapping
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

const AgentDatabasePage = () => {
  const navigate = useNavigate();
  const { connectionId } = useParams<{ connectionId: string }>();

  // Data states
  const [connection, setConnection] = useState<AgentDatabaseConnectionDetails | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<AgentDatabaseConnectionDetails['fieldMappings']>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterField, setFilterField] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (connectionId) {
      loadConnection();
    }
  }, [connectionId]);

  const loadConnection = async () => {
    if (!connectionId) return;
    
    setLoading(true);
    try {
      const conn = await getAgentDatabaseConnection(connectionId);
      setConnection(conn);
      
      const fieldMappings = conn.fieldMappings || [];
      const visible = fieldMappings.filter(f => f.visible);
      setVisibleFields(visible);
      
      // Load data
      await loadTableData(connectionId);
    } catch (error: any) {
      console.error('Error loading connection:', error);
      toast.error(error.message || 'Erro ao carregar conexão');
      navigate('/agent');
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (connId?: string) => {
    const id = connId || connectionId;
    if (!id) return;

    setLoadingRecords(true);
    try {
      const data = await getAgentDatabaseData(id);
      setRecords(data);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error(error.message || 'Erro ao carregar dados');
    } finally {
      setLoadingRecords(false);
    }
  };

  // Filter and sort records
  const getFilteredAndSortedRecords = () => {
    let filtered = records;

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

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterField, sortField]);

  const handleViewRecord = (record: any) => {
    if (!connectionId) return;
    const recordId = record.Id || record.id;
    if (!recordId) {
      toast.error('ID do registro não encontrado');
      return;
    }
    navigate(`/agent/database/${connectionId}/edit/${recordId}`);
  };

  const handleAddRecord = () => {
    if (!connectionId) return;
    if (connection?.accessLevel !== 'full') {
      toast.error('Você não tem permissão para criar registros');
      return;
    }
    navigate(`/agent/database/${connectionId}/add`);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterField('all');
    setSortField('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Conexão não encontrada</h3>
              <Button variant="outline" onClick={() => navigate('/agent')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReadOnly = connection.accessLevel === 'view';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agent')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{connection.name}</h1>
              <Badge variant={isReadOnly ? 'secondary' : 'default'}>
                {isReadOnly ? (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Somente Leitura
                  </>
                ) : (
                  <>
                    <Edit className="h-3 w-3 mr-1" />
                    Acesso Total
                  </>
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {isReadOnly ? 'Você pode visualizar os registros' : 'Você pode visualizar e editar os registros'}
            </p>
          </div>
        </div>

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
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nos registros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

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
                  Ordem: {visibleFields.find(f => f.columnName === sortField)?.label}
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

      {/* Records */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">{connection.name}</CardTitle>
                <CardDescription className="text-sm">
                  {filteredRecords.length} de {records.length} registros
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <Button variant="default" size="sm" onClick={handleAddRecord}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => loadTableData()} disabled={loadingRecords}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedRecords.map((record) => {
                let cardFields = visibleFields.filter(f => f.showInCard);
                if (cardFields.length === 0) {
                  const technicalFields = ['id', 'Id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order'];
                  cardFields = visibleFields.filter(f => !technicalFields.includes(f.columnName));
                }
                const fieldsToShow = cardFields.slice(0, 4);
                const totalCardFields = cardFields.length;

                return (
                  <Card key={record.id || record.Id} className="hover:shadow-lg transition-shadow cursor-pointer group">
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
                          variant={isReadOnly ? 'outline' : 'default'}
                          onClick={() => handleViewRecord(record)}
                        >
                          {isReadOnly ? (
                            <>
                              <Eye className="h-3 w-3 mr-2" />
                              Visualizar
                            </>
                          ) : (
                            <>
                              <Edit className="h-3 w-3 mr-2" />
                              Editar
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedRecords.map((record) => {
                let cardFields = visibleFields.filter(f => f.showInCard);
                if (cardFields.length === 0) {
                  const technicalFields = ['id', 'Id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'nc_order'];
                  cardFields = visibleFields.filter(f => !technicalFields.includes(f.columnName));
                }
                const fieldsToShow = cardFields.slice(0, 4);

                return (
                  <Card key={record.id || record.Id} className="hover:shadow-md transition-shadow cursor-pointer group">
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
                          variant={isReadOnly ? 'outline' : 'ghost'}
                          size="sm"
                          onClick={() => handleViewRecord(record)}
                          className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {isReadOnly ? (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </>
                          ) : (
                            <>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {filteredRecords.length > 0 && (
            <div className="space-y-4 mt-6 pt-6 border-t">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
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

                <div className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, filteredRecords.length)} de {filteredRecords.length}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm">
                    {currentPage} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="h-8 w-8"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentDatabasePage;
