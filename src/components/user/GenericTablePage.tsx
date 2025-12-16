import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { GenericTableView } from './GenericTableView';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Wrapper page component for GenericTableView
 * Handles routing parameters and user token retrieval
 */
export function GenericTablePage() {
  const { tableName } = useParams<{ tableName: string }>();
  const navigate = useNavigate();
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    // Get user token from localStorage
    const token = localStorage.getItem('userToken');
    if (!token) {
      navigate('/login');
      return;
    }
    setUserToken(token);
  }, [navigate]);

  if (!tableName) {
    return (
      <div className="p-6">
        <p className="text-destructive">Nome da tabela não especificado</p>
      </div>
    );
  }

  if (!userToken) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>
      <GenericTableView tableName={tableName} userToken={userToken} />
    </div>
  );
}
