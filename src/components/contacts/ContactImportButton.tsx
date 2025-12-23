/**
 * ContactImportButton Component
 * 
 * Botão para importar contatos com seleção de inbox.
 * Exibe estado de carregamento, progresso e notificações de sucesso/erro.
 * Requirements: 1.2, 1.3
 */

import { useState, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { InboxSelector } from './InboxSelector';
import { getInboxes, importFromInbox, InboxOption } from '@/services/contactsApiService';

interface ContactImportButtonProps {
  onImportComplete?: (result: { added: number; updated: number; unchanged: number }) => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ContactImportButton({
  onImportComplete,
  disabled = false,
  variant = 'default',
  size = 'default',
  className,
}: ContactImportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showInboxSelector, setShowInboxSelector] = useState(false);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);

  const handleImportClick = async () => {
    try {
      setLoadingInboxes(true);
      
      // Fetch available inboxes
      const availableInboxes = await getInboxes();
      setInboxes(availableInboxes);

      // Check inbox count and auto-select if only one
      const connectedInboxes = availableInboxes.filter(inbox => inbox.isConnected);
      
      if (connectedInboxes.length === 0) {
        toast.error('Nenhuma caixa de entrada conectada', {
          description: 'Conecte uma caixa de entrada ao WhatsApp primeiro'
        });
        return;
      }

      if (connectedInboxes.length === 1) {
        // Auto-select single inbox (Requirement 1.2)
        await handleInboxImport(connectedInboxes[0]);
      } else {
        // Show selector for multiple inboxes (Requirement 1.3)
        setShowInboxSelector(true);
      }
    } catch (error: any) {
      console.error('Failed to fetch inboxes:', error);
      toast.error('Erro ao carregar caixas de entrada', {
        description: error.message || 'Tente novamente'
      });
    } finally {
      setLoadingInboxes(false);
    }
  };

  const handleInboxImport = async (inbox: InboxOption) => {
    try {
      setLoading(true);
      setShowInboxSelector(false);

      console.log('📥 Iniciando importação da inbox', {
        inboxId: inbox.id,
        inboxName: inbox.name,
        phoneNumber: inbox.phoneNumber
      });

      const result = await importFromInbox(inbox.id);

      console.log('✅ Importação bem-sucedida', result);

      // Show success message
      const message = `Importação concluída: ${result.added} novos, ${result.updated} atualizados, ${result.unchanged} inalterados`;
      toast.success('Contatos importados com sucesso', {
        description: message
      });

      // Callback for parent component
      if (onImportComplete) {
        onImportComplete(result);
      }
    } catch (error: any) {
      console.error('❌ Erro na importação:', error);
      
      let errorMessage = 'Erro desconhecido';
      if (error.message.includes('não encontrada')) {
        errorMessage = 'Caixa de entrada não encontrada';
      } else if (error.message.includes('não conectada')) {
        errorMessage = 'Caixa de entrada não conectada ao WhatsApp';
      } else if (error.message.includes('acesso negado')) {
        errorMessage = 'Acesso negado à caixa de entrada';
      } else {
        errorMessage = error.message || 'Erro ao importar contatos';
      }

      toast.error('Erro ao importar contatos', {
        description: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowInboxSelector(false);
  };

  return (
    <>
      <Button 
        onClick={handleImportClick} 
        disabled={disabled || loading || loadingInboxes}
        variant={variant}
        size={size}
        className={`transition-all duration-200 hover:scale-105 ${className || ''}`}
        aria-label={loading ? 'Importando contatos' : 'Importar contatos da agenda WUZAPI'}
      >
        {(loading || loadingInboxes) ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            <span>{loadingInboxes ? 'Carregando...' : 'Importando...'}</span>
          </>
        ) : (
          <>
            <Users className="h-4 w-4 mr-2" aria-hidden="true" />
            <span>Importar da Agenda</span>
          </>
        )}
      </Button>

      <InboxSelector
        inboxes={inboxes}
        isOpen={showInboxSelector}
        onSelect={handleInboxImport}
        onCancel={handleCancel}
        isLoading={loading}
      />
    </>
  );
}
