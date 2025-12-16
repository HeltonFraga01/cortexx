/**
 * AgentMessagingPage
 * Main page for agent message sending with SendFlow
 * Replicates user messaging functionality for agent context
 * 
 * Requirements: 1.1, 1.2, 2.1-2.5, 3.1-3.5, 4.1-4.4, 5.1-5.4, 6.1-6.5, 9.1-9.5, 12.1-12.4
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText, Inbox, BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { AgentSendFlow, type AgentSendFlowData } from './AgentSendFlow'
import { AgentInboxProvider } from '@/contexts/AgentInboxContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  getAgentQuota,
  createAgentCampaign,
  saveAgentDraft,
  loadAgentDraft,
  clearAgentDraft,
  type QuotaInfo,
} from '@/services/agent-messaging'
import { toast } from 'sonner'

function AgentMessagingContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [draftData, setDraftData] = useState<any>(null)

  // Fetch quota info
  const { data: quota, isLoading: isLoadingQuota } = useQuery({
    queryKey: ['agent-messaging-quota'],
    queryFn: getAgentQuota,
    staleTime: 30000
  })

  // Check for existing draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      try {
        const draft = await loadAgentDraft()
        if (draft && draft.data) {
          setDraftData(draft.data)
          setShowDraftPrompt(true)
        }
      } catch (error) {
        // No draft found, ignore
      }
    }
    checkDraft()
  }, [])

  const handleSend = async (data: AgentSendFlowData) => {
    try {
      // Get the first selected inbox
      const selectedInbox = data.selectedInboxes.find(i => i.connected)
      if (!selectedInbox) {
        throw new Error('Nenhuma caixa de entrada conectada selecionada')
      }

      // Create campaign via agent API
      const result = await createAgentCampaign({
        name: data.campaignName,
        inboxId: selectedInbox.id,
        contacts: data.recipients.map(r => ({
          phone: r.phone,
          name: r.name,
          variables: r.variables,
        })),
        messages: data.messages.map(m => ({
          type: 'text' as const,
          content: m.content,
        })),
        humanization: {
          delayMin: data.humanization.delayMin,
          delayMax: data.humanization.delayMax,
          randomizeOrder: data.humanization.randomizeOrder,
        },
        schedule: data.schedule ? {
          scheduledAt: data.schedule.scheduledAt,
          sendingWindow: data.schedule.sendingWindow,
        } : undefined,
      })

      // Clear draft after successful send
      await clearAgentDraft()

      // Refresh quota
      queryClient.invalidateQueries({ queryKey: ['agent-messaging-quota'] })

      // Navigate to outbox
      navigate('/agent/messaging/outbox', {
        state: { highlightedCampaignId: result.campaignId },
      })
    } catch (error: any) {
      throw error
    }
  }

  const handleSaveDraft = async (data: AgentSendFlowData) => {
    try {
      await saveAgentDraft({
        recipients: data.recipients,
        campaignName: data.campaignName,
        messages: data.messages,
        selectedInboxes: data.selectedInboxes,
        humanization: data.humanization,
        schedule: data.schedule,
      })
      toast.success('Rascunho salvo')
    } catch (error: any) {
      toast.error('Erro ao salvar rascunho', { description: error.message })
    }
  }

  const handleRestoreDraft = () => {
    setShowDraftPrompt(false)
    // Draft data is already loaded
  }

  const handleDiscardDraft = async () => {
    await clearAgentDraft()
    setDraftData(null)
    setShowDraftPrompt(false)
  }

  const dailyPercentage = quota ? (quota.daily.used / quota.daily.limit) * 100 : 0
  const monthlyPercentage = quota ? (quota.monthly.used / quota.monthly.limit) * 100 : 0

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 md:px-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Envio de Mensagens"
        subtitle="Crie e envie campanhas de mensagens"
        actions={[
          {
            label: 'Templates',
            onClick: () => navigate('/agent/messaging/templates'),
            variant: 'outline',
            icon: <FileText className="h-4 w-4" />,
          },
          {
            label: 'Caixa de Saída',
            onClick: () => navigate('/agent/messaging/outbox'),
            variant: 'outline',
            icon: <Inbox className="h-4 w-4" />,
          },
          {
            label: 'Relatórios',
            onClick: () => navigate('/agent/messaging/reports'),
            variant: 'outline',
            icon: <BarChart3 className="h-4 w-4" />,
          },
        ]}
      />

      {/* Quota Display */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Saldo de Mensagens</CardTitle>
          <CardDescription>Consumo da conta do proprietário</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingQuota ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : quota ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Diário</span>
                  <span>{quota.daily.used} / {quota.daily.limit}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${dailyPercentage >= 90 ? 'bg-destructive' : dailyPercentage >= 70 ? 'bg-yellow-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(dailyPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {quota.daily.remaining} restantes hoje
                </p>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Mensal</span>
                  <span>{quota.monthly.used} / {quota.monthly.limit}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${monthlyPercentage >= 90 ? 'bg-destructive' : monthlyPercentage >= 70 ? 'bg-yellow-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(monthlyPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {quota.monthly.remaining} restantes este mês
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Não foi possível carregar</p>
          )}
        </CardContent>
      </Card>

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

      {/* Send Flow */}
      <AgentSendFlow
        onSend={handleSend}
        onSaveDraft={handleSaveDraft}
        preSelectedContacts={draftData?.recipients}
      />
    </div>
  )
}

// Wrap with ErrorBoundary and AgentInboxProvider
export default function AgentMessagingPage() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('AgentMessagingPage Error:', { error, errorInfo })
        toast.error('Erro ao carregar página de mensagens', {
          description: 'Tente recarregar a página',
        })
      }}
    >
      <AgentInboxProvider>
        <AgentMessagingContent />
      </AgentInboxProvider>
    </ErrorBoundary>
  )
}
