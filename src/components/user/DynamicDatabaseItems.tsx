import { useEffect, useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { databaseConnectionsService, DatabaseConnection, DatabaseNavigationException } from '@/services/database-connections';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DynamicDatabaseItemsProps {
  userToken: string;
  onNavigate?: (connectionId: number) => void;
}

export const DynamicDatabaseItems = ({ userToken, onNavigate }: DynamicDatabaseItemsProps) => {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (userToken) {
      fetchConnections();
    }
  }, [userToken]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const data = await databaseConnectionsService.getUserConnections(userToken);
      
      // Sort alphabetically by name
      const sortedConnections = data.sort((a, b) => 
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      );
      
      setConnections(sortedConnections);
    } catch (error) {
      console.error('Failed to fetch user connections:', error);
      
      if (error instanceof DatabaseNavigationException) {
        if (error.code === 'UNAUTHORIZED') {
          toast.error('Sessão expirada', {
            description: 'Por favor, faça login novamente',
            duration: 5000
          });
        } else {
          toast.error('Erro ao carregar conexões', {
            description: error.message,
            duration: 5000
          });
        }
      } else {
        toast.error('Erro ao carregar conexões de banco de dados', {
          description: 'Tente novamente mais tarde',
          duration: 5000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionClick = async (connection: DatabaseConnection) => {
    if (!connection.id) return;
    
    setActiveId(connection.id);
    
    try {
      // Fetch all user's records for this connection
      const records = await databaseConnectionsService.getUserTableData(
        userToken,
        connection.id
      );
      
      if (!records || records.length === 0) {
        toast.error('Nenhum registro encontrado', {
          description: 'Entre em contato com o administrador para criar um registro para sua conta'
        });
        return;
      }
      
      // Call optional callback
      if (onNavigate) {
        onNavigate(connection.id);
      }
      
      // If only one record, navigate directly to edit page
      if (records.length === 1) {
        navigate(`/user/database/${connection.id}/edit/${records[0].id}`);
      } else {
        // If multiple records, navigate to the list/selection page
        navigate(`/user/database?connection=${connection.id}`);
      }
      
    } catch (error) {
      console.error('Failed to fetch user records:', error);
      
      if (error instanceof DatabaseNavigationException) {
        if (error.code === 'RECORD_NOT_FOUND') {
          toast.error('Registro não encontrado', {
            description: error.suggestion || 'Entre em contato com o administrador',
            duration: 6000
          });
        } else if (error.code === 'CONNECTION_NOT_FOUND') {
          toast.error('Conexão não encontrada', {
            description: 'Esta conexão pode ter sido removida',
            duration: 5000
          });
        } else if (error.code === 'UNAUTHORIZED') {
          toast.error('Acesso negado', {
            description: 'Você não tem permissão para acessar esta conexão',
            duration: 5000
          });
        } else {
          toast.error('Erro ao carregar dados', {
            description: error.message,
            duration: 5000
          });
        }
      } else {
        toast.error('Erro ao carregar seus dados', {
          description: 'Tente novamente mais tarde',
          duration: 5000
        });
      }
    } finally {
      setActiveId(null);
    }
  };

  /**
   * Handle keyboard navigation for connection items
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, connection: DatabaseConnection) => {
    // Enter or Space to activate
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleConnectionClick(connection);
    }
  };

  // Show loading skeleton with multiple items
  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Carregando conexões de banco de dados" aria-live="polite">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-10 bg-muted rounded-md"></div>
          </div>
        ))}
        <span className="sr-only">Carregando conexões...</span>
      </div>
    );
  }

  // Don't show anything if no connections
  if (connections.length === 0) {
    return null;
  }

  return (
    <nav 
      className="space-y-2" 
      role="navigation" 
      aria-label="Conexões de banco de dados"
    >
      {connections.map((connection, index) => (
        <button
          key={connection.id}
          onClick={() => handleConnectionClick(connection)}
          onKeyDown={(e) => handleKeyDown(e, connection)}
          disabled={activeId === connection.id}
          className={cn(
            "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full min-w-0",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
            activeId === connection.id
              ? "bg-muted text-muted-foreground cursor-wait"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          aria-label={`Acessar banco de dados ${connection.name}`}
          aria-describedby={`connection-desc-${connection.id}`}
          aria-disabled={activeId === connection.id}
          aria-busy={activeId === connection.id}
          tabIndex={0}
          type="button"
        >
          <Database 
            className="h-4 w-4 flex-shrink-0" 
            aria-hidden="true"
          />
          <span 
            className="truncate flex-1 text-left min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
            title={connection.name}
          >
            {connection.name}
          </span>
          <span id={`connection-desc-${connection.id}`} className="sr-only">
            Conexão de banco de dados {connection.type}. 
            {index + 1} de {connections.length}.
          </span>
          {activeId === connection.id && (
            <>
              <Loader2 
                className="h-4 w-4 animate-spin flex-shrink-0" 
                aria-hidden="true"
              />
              <span className="sr-only">Carregando dados da conexão {connection.name}</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
};
