/**
 * MessagingPage
 * Main page for message sending with SendFlow
 * 
 * Requirements: 4.1, 4.8, 5.1, 7.1, 7.2, 7.3, 8.1-8.10, 9.1-9.5
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui-custom';
import { PageHeader } from '@/components/ui/page-header';
import {
  Send,
  FileText,
  Inbox,
  BarChart3,
} from 'lucide-react';
import { SendFlow, SendFlowData } from '@/components/features/messaging/SendFlow';
import { useDraft } from '@/contexts/DraftContext';
import { useAuth } from '@/contexts/AuthContext';
import { bulkCampaignService } from '@/services/bulkCampaignService';
import { Contact } from '@/services/draftService';
import { CampaignTemplate } from '@/services/templateService';
import { FeatureGate } from '@/components/user/FeatureGate';

export function MessagingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { draft, saveDraft, clearDraft, hasUnsavedChanges } = useDraft();
  const { user } = useAuth();

  // Use user token directly
  const activeToken = user?.token || '';
  
  // Pre-selected data from navigation state
  const [preSelectedContacts, setPreSelectedContacts] = useState<Contact[]>([]);
  const [preSelectedTemplate, setPreSelectedTemplate] = useState<CampaignTemplate | undefined>();
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  useEffect(() => {
    // Check for pre-selected data from navigation
    const state = location.state as {
      contacts?: Contact[];
      template?: CampaignTemplate;
    } | null;

    if (state?.contacts) {
      setPreSelectedContacts(state.contacts);
    }
    if (state?.template) {
      setPreSelectedTemplate(state.template);
    }

    // Check for existing draft
    if (draft?.sendFlow && !state?.contacts && !state?.template) {
      setShowDraftPrompt(true);
    }
  }, [location.state, draft]);

  const handleSend = async (data: SendFlowData) => {
    try {
      // Use selected inboxes or fallback to user token
      const selectedInboxTokens = data.selectedInboxes
        .filter(inbox => inbox.connected && inbox.wuzapiToken)
        .map(inbox => inbox.wuzapiToken!);
      
      // Convert SendFlowData to campaign config (matching CampaignBuilder format)
      const config = {
        name: data.campaignName || `Campanha ${new Date().toLocaleDateString('pt-BR')}`,
        instance: selectedInboxTokens[0] || activeToken, // Primary inbox token
        inboxes: data.selectedInboxes.map(inbox => ({
          id: inbox.id,
          name: inbox.name,
          token: inbox.wuzapiToken,
          phoneNumber: inbox.phoneNumber,
        })),
        messageType: 'text' as const,
        messageContent: data.messages[0]?.content || '',
        // Messages must be array of objects with id, type, content
        messages: data.messages.map(m => ({
          id: m.id,
          type: 'text' as const,
          content: m.content,
        })),
        delayMin: data.humanization.delayMin,
        delayMax: data.humanization.delayMax,
        randomizeOrder: data.humanization.randomizeOrder,
        isScheduled: !!data.schedule,
        scheduledAt: data.schedule?.scheduledAt,
        sendingWindow: data.schedule?.sendingWindow,
        contacts: data.recipients.map((r) => ({
          phone: r.phone,
          name: r.name,
          variables: r.variables,
        })),
      };

      const result = await bulkCampaignService.createCampaign(config);
      
      // Clear draft after successful send
      await clearDraft();
      
      // Navigate to outbox with the new campaign highlighted
      navigate('/user/mensagens/caixa', {
        state: { highlightedCampaignId: result.campaignId },
      });
    } catch (error: any) {
      throw error;
    }
  };

  const handleSaveDraft = async (data: SendFlowData) => {
    await saveDraft({
      sendType: data.sendType,
      recipients: data.recipients,
      campaignName: data.campaignName,
      messages: data.messages,
      template: data.template,
      selectedInboxes: data.selectedInboxes,
      humanization: data.humanization,
      schedule: data.schedule,
    });
  };

  const handleRestoreDraft = () => {
    setShowDraftPrompt(false);
    // Draft is already loaded in context
  };

  const handleDiscardDraft = async () => {
    await clearDraft();
    setShowDraftPrompt(false);
  };

  // Check if we have a valid token
  if (!activeToken) {
    return (
      <div className="space-y-6">
        <Card className="p-8">
          <EmptyState
            icon={Send}
            title="Token não encontrado"
            description="Faça login para usar o sistema de mensagens"
          />
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate
      feature="bulk_campaigns"
      title="Campanhas em Massa"
      description="O envio de campanhas em massa não está disponível no seu plano atual. Faça upgrade para desbloquear."
    >
      <div className="w-full max-w-full overflow-x-hidden px-4 md:px-6 space-y-6">
        {/* Header */}
        <PageHeader
          title="Envio de Mensagens"
          subtitle="Crie e envie campanhas de mensagens"
          actions={[
            {
              label: 'Templates',
              onClick: () => navigate('/user/mensagens/templates'),
              variant: 'outline',
              icon: <FileText className="h-4 w-4" />,
            },
            {
              label: 'Caixa de Saída',
              onClick: () => navigate('/user/mensagens/caixa'),
              variant: 'outline',
              icon: <Inbox className="h-4 w-4" />,
            },
            {
              label: 'Relatórios',
              onClick: () => navigate('/user/mensagens/relatorios'),
              variant: 'outline',
              icon: <BarChart3 className="h-4 w-4" />,
            },
          ]}
        />

        {/* Draft Prompt */}
        {showDraftPrompt && (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Rascunho encontrado</h3>
                  <p className="text-sm text-muted-foreground">
                    Você tem um envio não finalizado. Deseja continuar?
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleDiscardDraft}>
                    Descartar
                  </Button>
                  <Button onClick={handleRestoreDraft}>
                    Continuar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <Badge variant="outline" className="text-yellow-600">
            Alterações não salvas
          </Badge>
        )}

        {/* Send Flow */}
        <SendFlow
          instance={activeToken}
          userToken={user?.token || activeToken}
          preSelectedContacts={preSelectedContacts}
          preSelectedTemplate={preSelectedTemplate}
          onSend={handleSend}
          onSaveDraft={handleSaveDraft}
        />
      </div>
    </FeatureGate>
  );
}

export default MessagingPage;
