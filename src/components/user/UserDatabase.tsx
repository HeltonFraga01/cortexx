import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom';
import { Database, Edit, Search, Loader2, RefreshCw, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { databaseConnectionsService, DatabaseConnection, FieldMapping } from '@/services/database-connections';

const UserDatabase = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados para dados
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<DatabaseConnection | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [visibleFields, setVisibleFields] = useState<FieldMapping[]>([]);
  
  // Estados para UI
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const loadUserConnections = async () => {
    if (!user?.token) return;
    
    setLoading(true);
    try {
      const userConnections = await databaseConnectionsService.getUserConnections(user.token);
      setConnections(userConnections);
      
      // Selecionar a primeira conexão automaticamente
      if (userConnections.length > 0) {
        setSelectedConnection(userConnections[0]);
        
        // Configurar campos visíveis
        const fieldMappings = userConnections[0].fieldMappings || userConnections[0].field_mappings || [];
        const visible = fieldMappings.filter(f => f.visible);
        setVisibleFields(visible);
      }
    } catch (error: any) {
      console.error('Erro ao carregar conexões:', error);
      toast.error('Erro ao carregar suas conexões de banco de dados');
    } finally {
      setLoading(false);
    }
  };

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

  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    
    return visibleFields.some(field => {
      const value = record[field.columnName];
      return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
    });
  });

  // Calcular paginação
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  // Reset para primeira página quando filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedConnection]);

  const handleEditRecord = (record: any) => {
    if (!selectedConnection?.id) {
      toast.error('Conexão não selecionada');
      return;
    }
    
    navigate(`/user/database/edit/${selectedConnection.id}/${record.id}`);
  };

  const handleAddRecord = () => {
    if (!selectedConnection?.id) {
      toast.error('Conexão não selecionada');
      return;
    }
    navigate(`/user/database/${selectedConnection.id}/add`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Meu Banco de Dados</h1>
          <p className="text-muted-foreground">Carregando suas conexões...</p>
        </div>
        <LoadingSkeleton variant="card" count={2} />
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
            <EmptyState
              icon={Database}
              title="Nenhuma conexão disponível"
              description="O administrador ainda não atribuiu nenhuma conexão de banco de dados para sua conta."
              action={{
                label: "Verificar Novamente",
                onClick: loadUserConnections
              }}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meu Banco de Dados</h1>
        <p className="text-muted-foreground">
          Gerencie seus dados personalizados
        </p>
      </div>

      {/* Connection Selector - Minimalista */}
      {connections.length > 1 && (
        <div className="flex items-center space-x-3 overflow-x-auto pb-2">
          {connections.map((connection) => (
            <button
              key={connection.id}
              onClick={() => {
                setSelectedConnection(connection);
                const fieldMappings = connection.fieldMappings || connection.field_mappings || [];
                const visible = fieldMappings.filter(f => f.visible);
                setVisibleFields(visible);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${
                selectedConnection?.id === connection.id 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <Database className="h-4 w-4" />
              <div className="text-left">
                <div className="text-sm font-medium">{connection.name}</div>
                <div className="text-xs text-muted-foreground">{connection.type} • {connection.table_name}</div>
              </div>
              {selectedConnection?.id === connection.id && (
                <div className="h-2 w-2 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      {selectedConnection && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{selectedConnection.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {selectedConnection.type} • {records.length} registros • {selectedConnection.user_link_field}
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
          
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nos seus registros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Records Table */}
            {loadingRecords ? (
              <LoadingSkeleton variant="list" count={5} />
            ) : filteredRecords.length === 0 ? (
              <EmptyState
                icon={Database}
                title={searchTerm ? 'Nenhum registro encontrado para sua busca' : 'Nenhum registro encontrado'}
                description="Apenas registros vinculados ao seu token são exibidos"
              />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {visibleFields.map((field) => (
                        <TableHead key={field.columnName} className="font-medium">
                          {field.label}
                        </TableHead>
                      ))}
                      <TableHead className="text-right w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((record, index) => (
                      <TableRow key={record.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        {visibleFields.map((field) => (
                          <TableCell key={field.columnName} className={field.columnName === 'id' ? 'font-medium' : ''}>
                            <div className="max-w-[200px] truncate" title={record[field.columnName]}>
                              {record[field.columnName] || '-'}
                            </div>
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRecord(record)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredRecords.length > 0 && (
              <div className="space-y-4">
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
      )}

      {/* No Connection Selected */}
      {connections.length > 1 && !selectedConnection && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Database}
              title="Selecione uma Conexão"
              description="Escolha uma das conexões acima para visualizar seus registros"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserDatabase;