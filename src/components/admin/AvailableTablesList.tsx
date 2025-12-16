import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Database, Eye, Shield, Columns, Hash, FileText, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { tablePermissionsService, TableInfo, TableSchema } from '@/services/table-permissions';

export default function AvailableTablesList() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableSchemas, setTableSchemas] = useState<Record<string, TableSchema>>({});
  const [loadingSchemas, setLoadingSchemas] = useState<Record<string, boolean>>({});

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await tablePermissionsService.getAvailableTables();
      
      if (response.success && response.data) {
        setTables(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar tabelas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleToggleSchema = async (tableName: string) => {
    // Se já está expandido, colapsar
    if (expandedTable === tableName) {
      setExpandedTable(null);
      return;
    }

    // Expandir e carregar schema se ainda não foi carregado
    setExpandedTable(tableName);
    
    if (!tableSchemas[tableName]) {
      try {
        setLoadingSchemas(prev => ({ ...prev, [tableName]: true }));
        
        const response = await tablePermissionsService.getTableSchema(tableName);
        
        if (response.success && response.data) {
          setTableSchemas(prev => ({ ...prev, [tableName]: response.data! }));
        } else {
          toast.error('Erro ao carregar schema da tabela');
          setExpandedTable(null);
        }
      } catch (error) {
        console.error('Erro ao buscar schema:', error);
        toast.error('Erro ao buscar schema da tabela');
        setExpandedTable(null);
      } finally {
        setLoadingSchemas(prev => ({ ...prev, [tableName]: false }));
      }
    }
  };

  const getTypeColor = (type: string): string => {
    const upperType = type.toUpperCase();
    if (upperType.includes('INT')) return 'bg-blue-100 text-blue-800';
    if (upperType.includes('TEXT') || upperType.includes('VARCHAR')) return 'bg-green-100 text-green-800';
    if (upperType.includes('REAL') || upperType.includes('FLOAT')) return 'bg-purple-100 text-purple-800';
    if (upperType.includes('DATE') || upperType.includes('TIME')) return 'bg-orange-100 text-orange-800';
    if (upperType.includes('BOOL')) return 'bg-pink-100 text-pink-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Tabelas Disponíveis
              </CardTitle>
              <CardDescription>
                Visualize todas as tabelas do banco de dados e seus schemas
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin/table-permissions')} 
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para Permissões
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando tabelas...
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma tabela encontrada
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome da Tabela</TableHead>
                    <TableHead className="text-center">Registros</TableHead>
                    <TableHead className="text-center">Colunas</TableHead>
                    <TableHead className="text-center">Índices</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => {
                    const isExpanded = expandedTable === table.table_name;
                    const schema = tableSchemas[table.table_name];
                    const isLoading = loadingSchemas[table.table_name];

                    return (
                      <>
                        <TableRow key={table.table_name}>
                          <TableCell className="font-medium font-mono">
                            {table.table_name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="gap-1">
                              <Hash className="h-3 w-3" />
                              {table.row_count.toLocaleString()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="gap-1">
                              <Columns className="h-3 w-3" />
                              {table.column_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="gap-1">
                              <FileText className="h-3 w-3" />
                              {table.index_count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleSchema(table.table_name)}
                              className="gap-2"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  Ocultar Schema
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4" />
                                  Ver Schema
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>

                        {/* Schema Inline Expandido */}
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/50 p-0">
                              <div className="p-6 space-y-4">
                                {isLoading ? (
                                  <div className="text-center py-8 text-muted-foreground">
                                    Carregando schema...
                                  </div>
                                ) : schema ? (
                                  <>
                                    {/* Informações gerais */}
                                    <div className="flex gap-4 p-4 bg-background rounded-lg border">
                                      <div className="flex items-center gap-2">
                                        <Columns className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                          <strong>{schema.columns.length}</strong> colunas
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">
                                          <strong>
                                            {schema.columns.filter(c => c.primary_key).length}
                                          </strong>{' '}
                                          chave(s) primária(s)
                                        </span>
                                      </div>
                                    </div>

                                    {/* Tabela de colunas */}
                                    <div className="rounded-md border bg-background">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead className="text-center">Obrigatório</TableHead>
                                            <TableHead className="text-center">Chave Primária</TableHead>
                                            <TableHead>Valor Padrão</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {schema.columns.map((column) => (
                                            <TableRow key={column.name}>
                                              <TableCell className="font-medium font-mono">
                                                {column.name}
                                              </TableCell>
                                              <TableCell>
                                                <Badge className={getTypeColor(column.type)}>
                                                  {column.type}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {column.not_null ? (
                                                  <Badge variant="destructive" className="text-xs">
                                                    Sim
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="secondary" className="text-xs">
                                                    Não
                                                  </Badge>
                                                )}
                                              </TableCell>
                                              <TableCell className="text-center">
                                                {column.primary_key ? (
                                                  <Badge variant="default" className="text-xs">
                                                    Sim
                                                  </Badge>
                                                ) : (
                                                  <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                              </TableCell>
                                              <TableCell className="font-mono text-xs">
                                                {column.default_value || (
                                                  <span className="text-muted-foreground">-</span>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>

                                    {/* Dica */}
                                    <div className="text-xs text-muted-foreground p-3 bg-background rounded-lg border">
                                      <strong>Dica:</strong> Use estas informações para configurar permissões
                                      adequadas para cada usuário. Considere quais colunas contêm dados sensíveis.
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">
                                    Erro ao carregar schema
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Estatísticas */}
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div>Total: {tables.length} tabela(s)</div>
            <div>
              {tables.reduce((sum, t) => sum + t.row_count, 0).toLocaleString()} registros no total
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
