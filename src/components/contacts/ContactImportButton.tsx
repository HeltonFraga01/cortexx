/**
 * ContactImportButton Component
 * 
 * Botão para importar contatos da agenda WUZAPI.
 * Exibe estado de carregamento, progresso e notificações de sucesso/erro.
 * Implementa retry automático com backoff exponencial.
 */

import { useState } from 'react';
import { Users, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { contactImportService } from '@/services/contactImportService';

interface ContactImportButtonProps {
  instance: string;
  userToken: string;
  onImportComplete?: (contacts: any[], total: number) => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  maxRetries?: number;
}

/**
 * Mapeia códigos de erro HTTP para mensagens amigáveis
 */
function getErrorMessage(error: any): string {
  // Verificar se é erro de rede
  if (!error.response && error.message) {
    if (error.message.includes('Network Error') || error.message.includes('ECONNREFUSED')) {
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
    if (error.message.includes('timeout')) {
      return 'Tempo limite excedido. O servidor demorou muito para responder.';
    }
  }

  // Verificar código de status HTTP
  const status = error.response?.status;
  
  switch (status) {
    case 401:
      return 'Token inválido ou expirado. Verifique suas credenciais.';
    case 404:
      return 'Instância não encontrada ou desconectada.';
    case 408:
      return 'Tempo limite excedido. Tente novamente.';
    case 500:
      return 'Erro interno do servidor. Tente novamente mais tarde.';
    case 503:
      return 'Serviço temporariamente indisponível. Tente novamente.';
    default:
      // Usar mensagem do erro se disponível
      return error.response?.data?.message || error.message || 'Erro desconhecido ao importar contatos';
  }
}

export function ContactImportButton({
  instance,
  userToken,
  onImportComplete,
  disabled = false,
  variant = 'default',
  size = 'default',
  className,
  maxRetries = 3,
}: ContactImportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  /**
   * Calcula delay com backoff exponencial
   * Tentativa 1: 2s, Tentativa 2: 4s, Tentativa 3: 8s
   */
  const getRetryDelay = (attempt: number): number => {
    return Math.min(2000 * Math.pow(2, attempt), 10000); // Max 10s
  };

  const handleImport = async (isRetry: boolean = false) => {
    // Validações de pré-requisitos
    if (!instance) {
      toast.error('Instância não selecionada', {
        description: 'Selecione uma instância antes de importar contatos'
      });
      return;
    }

    if (!userToken) {
      toast.error('Token não disponível', {
        description: 'Token de autenticação não encontrado'
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('📥 Iniciando importação', {
        instance,
        tokenPrefix: userToken.substring(0, 8) + '...',
        isRetry,
        retryCount
      });

      // Chamar serviço de importação
      const result = await contactImportService.importFromWuzapi(instance, userToken);

      console.log('✅ Importação bem-sucedida', {
        total: result.total,
        hasWarning: !!result.warning,
        lidCount: result.lidCount
      });

      // Resetar contador de retry em caso de sucesso
      setRetryCount(0);

      // Exibir mensagem de sucesso
      if (result.warning) {
        toast.success(`${result.total} contatos importados`, {
          description: result.warning
        });
      } else {
        toast.success(`${result.total} contatos importados com sucesso`);
      }

      // Callback para atualizar estado no componente pai
      if (onImportComplete) {
        onImportComplete(result.contacts, result.total);
      }
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      
      // Log detalhado do erro
      console.error('❌ Erro na importação de contatos:', {
        error: err,
        instance,
        retryCount,
        isRetry,
        message: errorMessage,
        status: err.response?.status,
        stack: err.stack,
      });

      // Verificar se deve tentar novamente automaticamente
      const canRetry = retryCount < maxRetries;
      const shouldAutoRetry = canRetry && !isRetry && isRetryableError(err);
      
      if (shouldAutoRetry) {
        const nextRetry = retryCount + 1;
        const delay = getRetryDelay(retryCount);
        
        console.log(`🔄 Tentando novamente (${nextRetry}/${maxRetries}) em ${delay}ms`);
        
        toast.warning('Erro ao importar contatos', {
          description: `${errorMessage}. Tentando novamente em ${delay / 1000}s... (${nextRetry}/${maxRetries})`
        });
        
        // Incrementar contador e tentar novamente após delay
        setRetryCount(nextRetry);
        setTimeout(() => handleImport(true), delay);
      } else {
        // Erro final ou não retryable
        toast.error('Erro ao importar contatos', {
          description: errorMessage,
          action: canRetry ? {
            label: 'Tentar Novamente',
            onClick: () => handleRetry(),
          } : undefined,
        });
      }
    } finally {
      // Só desabilitar loading se não for fazer retry automático
      if (retryCount >= maxRetries || !isRetry) {
        setLoading(false);
      }
    }
  };

  /**
   * Verifica se o erro é retryable (temporário)
   */
  const isRetryableError = (error: any): boolean => {
    const status = error.response?.status;
    
    // Erros temporários que vale a pena tentar novamente
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    
    // Erros de rede também são retryable
    const isNetworkError = !error.response && (
      error.message?.includes('Network Error') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('timeout')
    );
    
    return retryableStatuses.includes(status) || isNetworkError;
  };

  const handleRetry = () => {
    console.log('🔄 Retry manual iniciado');
    setRetryCount(0);
    setError(null);
    handleImport(false);
  };

  return (
    <Button 
      onClick={() => handleImport(false)} 
      disabled={disabled || loading || !instance || !userToken}
      variant={variant}
      size={size}
      className={`transition-all duration-200 hover:scale-105 ${className || ''}`}
      aria-label={loading ? 'Importando contatos' : 'Importar contatos da agenda WUZAPI'}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          <span>Importando...</span>
          {retryCount > 0 && <span className="ml-1">({retryCount}/{maxRetries})</span>}
        </>
      ) : (
        <>
          <Users className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>Importar da Agenda</span>
        </>
      )}
    </Button>
  );
}
