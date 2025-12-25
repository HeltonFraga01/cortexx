/**
 * UserInboxEditPage Component
 * 
 * User-facing inbox edit page with modern UX.
 * Organized in tabs: Visão Geral, Webhooks, Automação.
 * 
 * Requirements: Replicate admin inbox edit functionality for user tenant
 * UX Pattern: Inline forms with Cards (no modals for forms)
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  QrCode,
  Bot,
  Webhook,
  Settings,
  ArrowLeft
} from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useInboxConnectionData } from '@/hooks/useInboxConnectionData'
import { useTabNavigation } from '@/hooks/useTabNavigation'
import { 
  ConnectionControlCard, 
  WebhookConfigCard,
  ModernInboxHeader,
  ModernConnectionCard,
  BotGrid,
  WebhookToggle,
  DEFAULT_AVAILABLE_EVENTS
} from '@/components/shared/inbox'
import type { WebhookConfigData, BotInfo } from '@/components/shared/inbox'
import { 
  adaptWebhookResponseToConfig,
  adaptWebhookConfigToWuzapi
} from '@/lib/adapters/inbox-adapters'
import { WuzAPIService } from '@/services/wuzapi'
import { supabase } from '@/lib/supabase'
import { ChatIntegrationSection } from '@/components/features/chat/settings/ChatIntegrationSection'

const wuzapi = new WuzAPIService()

// Tab configuration
const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: Settings },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'automation', label: 'Automação', icon: Bot }
] as const

type TabId = typeof TABS[number]['id']

const UserInboxEditPage = () => {
  const { inboxId } = useParams<{ inboxId: string }>()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  // Tab navigation with URL persistence
  const { activeTab, setActiveTab } = useTabNavigation({
    defaultTab: 'overview',
    validTabs: TABS.map(t => t.id)
  })

  // States
  const [connecting, setConnecting] = useState(false)
  const [loadingAction, setLoadingAction] = useState<'connect' | 'disconnect' | 'logout' | 'qr' | null>(null)
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [localWebhookConfig, setLocalWebhookConfig] = useState<WebhookConfigData>({
    webhookUrl: '',
    events: []
  })
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [showQrDialog, setShowQrDialog] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loadingAvatar, setLoadingAvatar] = useState(false)
  
  // Bot assignment states
  const [availableBots, setAvailableBots] = useState<BotInfo[]>([])
  const [currentBotAssignment, setCurrentBotAssignment] = useState<{
    id: string
    botId: string
    bot: { id: string; name: string; botType: string | null } | null
  } | null>(null)
  const [loadingBots, setLoadingBots] = useState(false)
  const [savingBotAssignment, setSavingBotAssignment] = useState(false)

  // Hook para carregar dados de conexão
  const {
    connectionData,
    sessionStatus,
    webhookConfig,
    qrCode,
    isLoading,
    error,
    refetch,
    refetchStatus,
    refetchWebhook
  } = useInboxConnectionData({
    inboxId: inboxId || null,
    enabled: !!inboxId
  })

  // Sincronizar webhook config local com dados do servidor
  useEffect(() => {
    const serverConfig = adaptWebhookResponseToConfig(
      webhookConfig?.webhook || '', 
      webhookConfig?.subscribe || []
    )
    setLocalWebhookConfig(serverConfig)
  }, [webhookConfig])

  // Buscar avatar quando logado
  const fetchAvatar = useCallback(async () => {
    if (!connectionData?.wuzapiToken || !connectionData?.jid) return
    
    setLoadingAvatar(true)
    try {
      const phone = connectionData.jid.split('@')[0].split(':')[0]
      if (phone) {
        const avatarData = await wuzapi.getAvatar(connectionData.wuzapiToken, phone, false)
        if (avatarData?.URL) {
          setAvatarUrl(avatarData.URL)
        }
      }
    } catch (error) {
      console.error('Error fetching avatar:', error)
    } finally {
      setLoadingAvatar(false)
    }
  }, [connectionData?.wuzapiToken, connectionData?.jid])

  // Auto-load avatar quando logado
  useEffect(() => {
    const isLoggedIn = sessionStatus?.loggedIn ?? connectionData?.isLoggedIn
    if (isLoggedIn && connectionData?.jid && !avatarUrl) {
      fetchAvatar()
    }
  }, [sessionStatus?.loggedIn, connectionData?.isLoggedIn, connectionData?.jid, avatarUrl, fetchAvatar])

  // Carregar bots disponíveis e assignment atual
  const fetchBotData = useCallback(async () => {
    if (!inboxId) return
    
    setLoadingBots(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) return

      const [botsRes, assignmentRes] = await Promise.all([
        fetch('/api/user/bots/available', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/user/inbox/${inboxId}/bot-assignment`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (botsRes.ok) {
        const botsData = await botsRes.json()
        if (botsData.success) {
          setAvailableBots(botsData.data.bots || [])
        }
      }

      if (assignmentRes.ok) {
        const assignmentData = await assignmentRes.json()
        if (assignmentData.success) {
          setCurrentBotAssignment(assignmentData.data.assignment)
        }
      }
    } catch (error) {
      console.error('Error fetching bot data:', error)
    } finally {
      setLoadingBots(false)
    }
  }, [inboxId])

  useEffect(() => {
    fetchBotData()
  }, [fetchBotData])

  // Salvar bot assignment
  const handleSaveBotAssignment = async (botId: string | null) => {
    if (!inboxId) return
    
    setSavingBotAssignment(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        toast.error('Sessão expirada')
        return
      }

      const response = await fetch(`/api/user/inbox/${inboxId}/bot-assignment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ botId })
      })

      const data = await response.json()
      
      if (data.success) {
        setCurrentBotAssignment(data.data.assignment)
        toast.success(botId ? 'Bot atribuído com sucesso!' : 'Bot removido da caixa de entrada')
      } else {
        toast.error(data.error?.message || 'Erro ao salvar')
      }
    } catch (error) {
      console.error('Error saving bot assignment:', error)
      toast.error('Erro ao salvar atribuição de bot')
    } finally {
      setSavingBotAssignment(false)
    }
  }

  // Handlers
  const handleBackToList = useCallback(() => {
    navigate('/user/inboxes')
  }, [navigate])

  const handleConnect = async () => {
    if (!connectionData?.wuzapiToken) {
      toast.error('Token não disponível')
      return
    }
    
    const currentStatus = sessionStatus || connectionData
    if (currentStatus?.connected && currentStatus?.loggedIn) {
      toast.info('Já conectado', {
        description: 'A sessão WhatsApp já está conectada'
      })
      return
    }
    
    setConnecting(true)
    setLoadingAction('connect')
    try {
      await wuzapi.connectSession(connectionData.wuzapiToken, {
        Subscribe: ['Message', 'ReadReceipt'],
        Immediate: false
      })
      toast.success('Conectando ao WhatsApp...')
      setTimeout(refetchStatus, 2000)
    } catch (error) {
      console.error('Error connecting:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      if (errorMessage.toLowerCase().includes('already connected')) {
        toast.info('Já conectado', {
          description: 'A sessão WhatsApp já está conectada'
        })
        refetchStatus()
        return
      }
      
      if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
        toast.error('Token WUZAPI inválido', {
          description: 'O token desta caixa de entrada não é válido no WUZAPI.'
        })
      } else {
        toast.error('Erro ao conectar', { description: errorMessage })
      }
    } finally {
      setConnecting(false)
      setLoadingAction(null)
    }
  }

  const handleDisconnect = async () => {
    if (!connectionData?.wuzapiToken) {
      toast.error('Token não disponível')
      return
    }
    
    setLoadingAction('disconnect')
    try {
      await wuzapi.disconnectSession(connectionData.wuzapiToken)
      toast.success('Desconectado com sucesso')
      setTimeout(refetchStatus, 2000)
    } catch (error) {
      console.error('Error disconnecting:', error)
      toast.error('Erro ao desconectar')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleLogout = async () => {
    if (!connectionData?.wuzapiToken) {
      toast.error('Token não disponível')
      return
    }
    
    setLoadingAction('logout')
    try {
      await wuzapi.logoutSession(connectionData.wuzapiToken)
      toast.success('Logout realizado com sucesso')
      setAvatarUrl(null)
      setTimeout(refetchStatus, 2000)
    } catch (error) {
      console.error('Error logging out:', error)
      toast.error('Erro ao fazer logout')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleGenerateQR = async () => {
    if (!connectionData?.wuzapiToken) {
      toast.error('Token não disponível')
      return
    }
    
    setLoadingAction('qr')
    const loadingToast = toast.loading('Gerando QR Code...')
    try {
      try {
        await wuzapi.connectSession(connectionData.wuzapiToken)
      } catch (e) {
        console.log('Sessão existente ou erro:', e)
      }
      
      await new Promise(r => setTimeout(r, 1000))
      
      const qr = await wuzapi.getQRCode(connectionData.wuzapiToken)
      if (qr.QRCode) {
        setQrCodeData(qr.QRCode)
        setShowQrDialog(true)
        toast.success('QR Code gerado!', { id: loadingToast })
      } else {
        toast.error('QR Code não disponível', { id: loadingToast })
      }
    } catch (error) {
      console.error('Error generating QR:', error)
      toast.error('Erro ao gerar QR Code', { id: loadingToast })
    } finally {
      setLoadingAction(null)
    }
  }

  const handleWebhookConfigChange = (config: WebhookConfigData) => {
    setLocalWebhookConfig(config)
  }

  const hasWebhookChanges = (): boolean => {
    if (!webhookConfig) return localWebhookConfig.webhookUrl !== '' || localWebhookConfig.events.length > 0
    const serverConfig = adaptWebhookResponseToConfig(webhookConfig.webhook || '', webhookConfig.subscribe || [])
    return (
      localWebhookConfig.webhookUrl !== serverConfig.webhookUrl ||
      JSON.stringify(localWebhookConfig.events.sort()) !== JSON.stringify(serverConfig.events.sort())
    )
  }

  const handleSaveWebhook = async () => {
    if (!connectionData?.wuzapiToken) {
      toast.error('Token não disponível')
      return
    }
    
    setSavingWebhook(true)
    try {
      const { webhook, events } = adaptWebhookConfigToWuzapi(localWebhookConfig)
      await wuzapi.setWebhook(connectionData.wuzapiToken, webhook, events)
      toast.success('Webhook configurado com sucesso!')
      await refetchWebhook()
    } catch (error) {
      console.error('Error saving webhook:', error)
      toast.error('Erro ao configurar webhook')
    } finally {
      setSavingWebhook(false)
    }
  }

  // Derived state
  const isConnected = sessionStatus?.connected ?? connectionData?.isConnected ?? false
  const isLoggedIn = sessionStatus?.loggedIn ?? connectionData?.isLoggedIn ?? false
  
  // Connection status for header
  const connectionStatus: 'logged_in' | 'connected' | 'offline' = 
    isLoggedIn ? 'logged_in' : isConnected ? 'connected' : 'offline'

  // Phone number display
  const phoneNumber = connectionData?.jid 
    ? connectionData.jid.split('@')[0].split(':')[0]
    : connectionData?.phoneNumber

  // Webhook enabled state (has URL configured)
  const webhookEnabled = !!localWebhookConfig.webhookUrl

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados da caixa de entrada...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !connectionData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Erro ao Carregar</CardTitle>
            <CardDescription>
              {error || 'Caixa de entrada não encontrada'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Button onClick={() => refetch()} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
              <Button onClick={handleBackToList} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar à Lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Modern Header */}
      <ModernInboxHeader
        inboxName={connectionData.inboxName}
        phoneNumber={phoneNumber}
        avatarUrl={avatarUrl || undefined}
        connectionStatus={connectionStatus}
        onBack={handleBackToList}
        onRefresh={refetchStatus}
        onGenerateQR={handleGenerateQR}
        isRefreshing={false}
        isGeneratingQR={loadingAction === 'qr'}
      />

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)}>
        <TabsList className="grid w-full grid-cols-3">
          {TABS.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab: Visão Geral */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Modern Connection Card */}
          <ModernConnectionCard
            connection={{
              id: connectionData.inboxId,
              name: connectionData.inboxName,
              phoneNumber: connectionData.phoneNumber,
              jid: connectionData.jid,
              token: connectionData.wuzapiToken,
              isConnected,
              isLoggedIn
            }}
          />

          {/* Connection Control Card */}
          <ConnectionControlCard
            connectionStatus={{ isConnected, isLoggedIn }}
            isLoading={connecting}
            loadingAction={loadingAction}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onLogout={handleLogout}
            onGenerateQR={handleGenerateQR}
          />

          {/* QR Code inline display */}
          {qrCode && !isLoggedIn && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  QR Code para Login
                </CardTitle>
                <CardDescription>
                  Escaneie este QR Code com seu WhatsApp para fazer login
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <img 
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Webhooks */}
        <TabsContent value="webhooks" className="space-y-6 mt-6">
          {/* Webhook Toggle */}
          <WebhookToggle
            enabled={webhookEnabled}
            onChange={(enabled) => {
              if (!enabled) {
                setLocalWebhookConfig({ webhookUrl: '', events: [] })
              }
            }}
            eventCount={localWebhookConfig.events.length}
            totalEvents={DEFAULT_AVAILABLE_EVENTS.length}
          />

          {/* Webhook Configuration */}
          <WebhookConfigCard
            config={localWebhookConfig}
            availableEvents={DEFAULT_AVAILABLE_EVENTS}
            onChange={handleWebhookConfigChange}
            onSave={handleSaveWebhook}
            isLoading={savingWebhook}
            readOnly={false}
            hasChanges={hasWebhookChanges()}
          />
        </TabsContent>

        {/* Tab: Automação */}
        <TabsContent value="automation" className="space-y-6 mt-6">
          {/* Bot Assignment with BotGrid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Atribuição de Bot
              </CardTitle>
              <CardDescription>
                Selecione um bot para processar automaticamente as mensagens recebidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BotGrid
                bots={availableBots.map(bot => ({
                  id: bot.id,
                  name: bot.name,
                  description: bot.description || undefined,
                  botType: bot.botType || undefined,
                  status: (bot.status as 'active' | 'paused') || undefined,
                  avatarUrl: bot.avatarUrl || undefined
                }))}
                selectedBotId={currentBotAssignment?.botId || null}
                onSelectBot={handleSaveBotAssignment}
                isLoading={loadingBots}
                isSaving={savingBotAssignment}
              />
            </CardContent>
          </Card>

          {/* Chat Integration Section */}
          {inboxId && (
            <ChatIntegrationSection inboxId={inboxId} />
          )}
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog (for generated QR) */}
      {qrCodeData && (
        <Dialog 
          open={showQrDialog} 
          onOpenChange={(open) => {
            if (!open) {
              setShowQrDialog(false)
              setQrCodeData(null)
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code - {connectionData.inboxName}</DialogTitle>
              <DialogDescription>
                Escaneie este QR Code com o WhatsApp para conectar a instância
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <img 
                  src={qrCodeData.startsWith('data:') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                  alt="QR Code"
                  className="max-w-full h-auto"
                />
              </div>
            </div>
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowQrDialog(false)
                  refetchStatus()
                }}
              >
                Fechar e Verificar Status
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog />
    </div>
  )
}

export default UserInboxEditPage
