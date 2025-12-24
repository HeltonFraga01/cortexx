/**
 * UserInboxEditPage Component
 * 
 * User-facing inbox edit page that replicates admin functionality.
 * Allows users to manage their own inboxes: view status, generate QR code,
 * configure webhooks, and manage connection.
 * 
 * Requirements: Replicate admin inbox edit functionality for user tenant
 * UX Pattern: Inline forms with Cards (no modals for forms)
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  ArrowLeft, 
  Inbox, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Wifi,
  WifiOff,
  QrCode,
  Phone,
  Hash,
  Copy,
  Check,
  User,
  ImageIcon,
  Key,
  Bot,
  MessageSquare
} from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useInboxConnectionData } from '@/hooks/useInboxConnectionData'
import { 
  InboxInfoCard, 
  ConnectionControlCard, 
  WebhookConfigCard,
  DEFAULT_AVAILABLE_EVENTS
} from '@/components/shared/inbox'
import type { WebhookConfigData } from '@/components/shared/inbox'
import { 
  adaptWebhookResponseToConfig,
  adaptWebhookConfigToWuzapi
} from '@/lib/adapters/inbox-adapters'
import { WuzAPIService } from '@/services/wuzapi'
import { supabase } from '@/lib/supabase'

const wuzapi = new WuzAPIService()

const UserInboxEditPage = () => {
  const { inboxId } = useParams<{ inboxId: string }>()
  const navigate = useNavigate()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  // States
  const [connecting, setConnecting] = useState(false)
  const [loadingAction, setLoadingAction] = useState<'connect' | 'disconnect' | 'logout' | 'qr' | null>(null)
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [localWebhookConfig, setLocalWebhookConfig] = useState<WebhookConfigData | null>(null)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [showQrDialog, setShowQrDialog] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loadingAvatar, setLoadingAvatar] = useState(false)
  
  // Bot assignment states
  const [availableBots, setAvailableBots] = useState<Array<{
    id: string
    name: string
    description: string | null
    botType: string | null
    status: string | null
    avatarUrl: string | null
  }>>([])
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
    if (webhookConfig) {
      const serverConfig = adaptWebhookResponseToConfig(webhookConfig.webhook || '', webhookConfig.subscribe)
      setLocalWebhookConfig(serverConfig)
    }
  }, [webhookConfig])

  // Buscar avatar quando logado - usar connectionData.isLoggedIn (já vem do WUZAPI)
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

  // Auto-load avatar quando logado (priorizar sessionStatus.loggedIn do WUZAPI)
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

      // Buscar bots disponíveis e assignment em paralelo
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

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(`${field} copiado!`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      toast.error('Erro ao copiar')
    }
  }

  const handleConnect = async () => {
    if (!connectionData?.wuzapiToken) {
      toast.error('Token não disponível')
      return
    }
    
    // Verificar status atual antes de tentar conectar (Property 7: Pre-Action Status Check)
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
      
      // Tratar "already connected" como sucesso (Property 6: Already Connected Handling)
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
      // Primeiro conectar a sessão
      try {
        await wuzapi.connectSession(connectionData.wuzapiToken)
      } catch (e) {
        console.log('Sessão existente ou erro:', e)
      }
      
      await new Promise(r => setTimeout(r, 1000))
      
      // Buscar QR Code
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
    if (!localWebhookConfig || !webhookConfig) return false
    const serverConfig = adaptWebhookResponseToConfig(webhookConfig.webhook || '', webhookConfig.subscribe)
    return (
      localWebhookConfig.webhookUrl !== serverConfig.webhookUrl ||
      JSON.stringify(localWebhookConfig.events.sort()) !== JSON.stringify(serverConfig.events.sort())
    )
  }

  const handleSaveWebhook = async () => {
    if (!connectionData?.wuzapiToken || !localWebhookConfig) {
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

  const isConnected = sessionStatus?.connected ?? connectionData.isConnected ?? false
  const isLoggedIn = sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={handleBackToList}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6" />
            {connectionData.inboxName}
          </h1>
          <p className="text-muted-foreground">Gerenciar configurações da caixa de entrada</p>
        </div>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <User className="h-5 w-5 mr-2 text-primary" />
            Informações da Conexão
          </CardTitle>
          <CardDescription>
            Dados da conexão WhatsApp e status atual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header com Avatar, Info Principal e Ações */}
          <div className="flex flex-col lg:flex-row gap-6 p-4 bg-muted/30 rounded-lg border">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                {avatarUrl ? (
                  <AvatarImage 
                    src={avatarUrl} 
                    alt={connectionData.inboxName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className={`text-2xl ${isLoggedIn ? 'bg-green-100 text-green-700' : 'bg-muted'}`}>
                  {loadingAvatar ? (
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <User className="h-8 w-8" />
                  )}
                </AvatarFallback>
              </Avatar>
              {isLoggedIn && !avatarUrl && !loadingAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={fetchAvatar}
                  className="text-xs"
                >
                  <ImageIcon className="h-3 w-3 mr-1" />
                  Carregar foto
                </Button>
              )}
            </div>

            {/* Info Principal */}
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-semibold">{connectionData.inboxName}</h3>
                {isLoggedIn ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    <Wifi className="h-3 w-3 mr-1" />
                    Logado
                  </Badge>
                ) : isConnected ? (
                  <Badge variant="secondary">
                    <Wifi className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <WifiOff className="h-3 w-3 mr-1" />
                    Offline
                  </Badge>
                )}
              </div>
              
              {/* ID da Inbox */}
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">ID:</span>
                <code className="bg-muted px-2 py-1 rounded font-mono text-xs truncate max-w-[180px]">
                  {connectionData.inboxId}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(connectionData.inboxId, 'ID')}
                >
                  {copiedField === 'ID' ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {/* Telefone */}
              {connectionData.phoneNumber && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{connectionData.phoneNumber}</span>
                </div>
              )}

              {/* JID */}
              {connectionData.jid && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{connectionData.jid.split('@')[0]}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopy(connectionData.jid || '', 'JID')}
                  >
                    {copiedField === 'JID' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}

              {/* Token WUZAPI */}
              {connectionData.wuzapiToken && (
                <div className="flex items-center gap-2 text-sm">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Token:</span>
                  <code className="bg-muted px-2 py-1 rounded font-mono text-xs truncate max-w-[180px]">
                    {connectionData.wuzapiToken}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopy(connectionData.wuzapiToken, 'Token')}
                  >
                    {copiedField === 'Token' ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {isLoggedIn 
                  ? 'Conectado e autenticado no WhatsApp. Pronto para enviar/receber mensagens.'
                  : isConnected 
                  ? 'Conectado mas não autenticado. É necessário escanear o QR Code.'
                  : 'Não conectado ao WhatsApp. Gere um novo QR Code para conectar.'
                }
              </p>
            </div>

            {/* Ações Rápidas */}
            <div className="flex flex-col gap-2 lg:border-l lg:pl-6 lg:ml-auto">
              <span className="text-xs font-medium text-muted-foreground mb-1">Ações Rápidas</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateQR}
                disabled={loadingAction === 'qr'}
                className="justify-start text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                {loadingAction === 'qr' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Gerar QR Code
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
                className="justify-start"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar Status
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connection Control Card */}
      <ConnectionControlCard
        connectionStatus={{
          isConnected,
          isLoggedIn
        }}
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

      {/* Webhook Configuration */}
      {localWebhookConfig && (
        <WebhookConfigCard
          config={localWebhookConfig}
          availableEvents={DEFAULT_AVAILABLE_EVENTS}
          onChange={handleWebhookConfigChange}
          onSave={handleSaveWebhook}
          isLoading={savingWebhook}
          readOnly={false}
          hasChanges={hasWebhookChanges()}
        />
      )}

      {/* Chat Integration - Bot Assignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <Bot className="h-5 w-5 mr-2 text-primary" />
            Integração com Chat
          </CardTitle>
          <CardDescription>
            Configure um bot para processar automaticamente as mensagens recebidas nesta caixa de entrada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBots ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Carregando bots...</span>
            </div>
          ) : availableBots.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum bot disponível</p>
              <p className="text-xs mt-1">Crie um bot na seção de Automações para usar aqui</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bot Atribuído</label>
                <Select
                  value={currentBotAssignment?.botId || 'none'}
                  onValueChange={(value) => handleSaveBotAssignment(value === 'none' ? null : value)}
                  disabled={savingBotAssignment}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um bot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Nenhum bot (desativado)</span>
                    </SelectItem>
                    {availableBots.map((bot) => (
                      <SelectItem key={bot.id} value={bot.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <span>{bot.name}</span>
                          {bot.status === 'paused' && (
                            <Badge variant="secondary" className="text-xs">Pausado</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {savingBotAssignment && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Salvando...
                  </div>
                )}
              </div>

              {currentBotAssignment?.bot && (
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{currentBotAssignment.bot.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tipo: {currentBotAssignment.bot.botType || 'webhook'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mensagens recebidas serão encaminhadas automaticamente para este bot
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!currentBotAssignment && (
                <p className="text-xs text-muted-foreground">
                  Sem bot atribuído, as mensagens não serão processadas automaticamente.
                  Você ainda pode visualizá-las no chat.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
