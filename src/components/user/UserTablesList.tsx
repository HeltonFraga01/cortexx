import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Eye, Edit, Trash2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { genericTableService } from '@/services/generic-table';
import { tablePermissionsService, TableInfo } from '@/services/table-permissions';

/**
 * Component that displays a list of tables the user has access to
 * Shows permissions for each table and allows navigation to table view
 */
export function UserTablesList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const userToken = localStorage.getItem('userToken');
      if (!userToken) {
        navigate('/login');
        return;
      }

      // Set user token for generic table service
      genericTableService.setUserToken(userToken);

      // Get available tables (this will be filtered by backend based on permissions)
      const response = await tablePermissionsService.getAvailableTables();
      
      if (response.success && response.data) {
        setTables(response.data);
      } else {
        throw new Error(response.error || 'Erro ao carregar tabelas');
      }
    } catch (error: any) {
      console.error('Error loading tables:', error);
      setError(error.message || 'Erro ao carregar tabelas disponíveis');
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar tabelas disponíveis',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (tableName: string) => {
    navigate(`/user/tables/${tableName}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando tabelas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Erro ao Carregar Tabelas</h3>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTables}
                className="mt-4"
              >
                Tentar Novamente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Database className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Nenhuma Tabela Disponível</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Você não tem acesso a nenhuma tabela no momento.
                Entre em contato com o administrador para solicitar permissões.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minhas Tabelas</h1>
        <p className="text-muted-foreground">
          Tabelas que você tem permissão para acessar
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <Card
            key={table.table_name}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleTableClick(table.table_name)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <Database className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="mt-4">{table.table_name}</CardTitle>
              <CardDescription>
                {table.row_count} {table.row_count === 1 ? 'registro' : 'registros'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Colunas:</span>
                  <Badge variant="secondary">{table.column_count}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Índices:</span>
                  <Badge variant="secondary">{table.index_count}</Badge>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Permissões:</p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Eye className="h-3 w-3 mr-1" />
                      Ler
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Edit className="h-3 w-3 mr-1" />
                      Editar
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Trash2 className="h-3 w-3 mr-1" />
                      Excluir
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
