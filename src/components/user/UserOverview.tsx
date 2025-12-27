/**
 * UserOverview Component
 * Main user dashboard page with tabs for Dashboard and Connection
 * Requirements: 7.1, 7.5, 9.1, 9.2, 9.3, 9.4
 * Enhanced for: inbox-connection-sync spec (1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 4.1, 4.2, 4.3, 4.4)
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useSupabaseInboxOptional } from '@/contexts/SupabaseInboxContext'
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton'
import { QuotaSummaryCard } from '@/components/user/QuotaUsageCard'
import { CreditBalance } from '@/components/user/billing/CreditBalance'
import { CreditPurchase } from '@/components/user/billing/CreditPurchase'
import { UserDashboardModern } from '@/components/user/UserDashboardModern'
import {
  UserInfoCardModern,
  ConnectionControlCardModern,
  WebhookConfigCardModern
} from '@/components/user/dashboard'
import { 
  ConnectionControlCard, 
  WebhookConfigCard,
  DEFAULT_AVAILABLE_EVENTS
} from '@/components/shared/inbox'
import { 
  adaptWebhookResponseToConfig,
  adaptWebhookConfigToWuzapi
} from '@/lib/adapters/inbox-adapters'
import { useInboxConnectionData } from '@/hooks/useInboxConnectionData'
import type { WebhookConfigData } from '@/components/shared/inbox'

import { WuzAPIService } from '@/services/wuzapi'
import { useAccountSummary } from '@/hooks/useAccountSummary'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  QrCode, 
  MessageSquare, 
  Settings,
  Database,
  LayoutDashboard,
  Wrench,
  Users,
  UsersRound,
  Inbox,
  FileText,
  Shield,
  AlertCircle,
  User,
  Hash,
  Phone,
  Key,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader2,
  ImageIcon
} from 'lucide-react'
import { toast } from 'sonner'

interface DashboardStats {
  messagesCount: number
  connectionsCount: number
}

const UserOverview = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [connecting, setConnecting] = useState(false)
  const [stats, setStats] = useState<DashboardStats>({
    messagesCount: 0,
    connectionsCount: 0
  })
  const [loadingAvatar, setLoadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const avatarFetchAttemptedRef = useRef<string | null>(null)
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [localWebhookConfig, setLocalWebhookConfig] = useState<WebhookConfigData | null>(null)
  const [showCreditPurchase, setShowCreditPurchase] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  // Novos estados para ações rápidas e cópia
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<'qr' | 'refresh' | null>(null)
  
  const { user } = useAuth()
  const inboxContext = useSupabaseInboxOptional()
  const navigate = useNavigate()
  
  // Use centralized hook for account summary (request deduplication)
  const { data: accountSummary } = useAccountSummary()
  const quotas = accountSummary?.quotas ?? []
  const hasManagementPermission = accountSummary?.features.some(
    f => f.featureName === 'agent_management' && f.enabled
  ) || accountSummary?.subscription?.planName !== 'free'

  // Obter inbox selecionada do contexto para exibir dados de conexão
  // Prioridade: seleção única > primeira da seleção múltipla > activeInbox
  const getSelectedInboxForConnection = (): { id: string | null; token: string | null } => {
    if (!inboxContext) return { id: null, token: null }
    
    const { selection, availableInboxes, selectedInboxIds, activeInbox, wuzapiToken } = inboxContext
    
    // Se há inboxes selecionadas, usar a primeira
    if (selectedInboxIds.length > 0) {
      const firstSelectedId = selectedInboxIds[0]
      const selectedInbox = availableInboxes.find(inbox => inbox.id === firstSelectedId)
      if (selectedInbox) {
        // Se a inbox selecionada é a mesma que a activeInbox, usar o token do contexto
        const token = activeInbox?.id === firstSelectedId ? wuzapiToken : null
        return { id: selectedInbox.id, token }
      }
    }
    
    // Fallback para activeInbox (inbox ativa do backend)
    return { 
      id: inboxContext.activeInbox?.id || null, 
      token: inboxContext.wuzapiToken || null 
    }
  }

  const selectedInbox = getSelectedInboxForConnection()
  const activeInboxId = selectedInbox.id
  const activeInboxToken = selectedInbox.token

  // Hook para carregar dados de conexão da inbox selecionada
  const {
    connectionData,
    sessionStatus,
    userProfile,
    webhookConfig,
    qrCode,
    isLoading: isLoadingConnection,
    error: connectionError,
    refetch: refetchConnection,
    refetchStatus,
    refetchWebhook
  } = useInboxConnectionData({
    inboxId: activeInboxId,
    enabled: !!activeInboxId
  })

  const wuzapi = new WuzAPIService()

  // Buscar avatar usando o token da inbox selecionada
  const fetchUserAvatar = useCallback(async (jid: string, token: string) => {
    if (!token || !jid) return
    
    // Evitar buscar avatar múltiplas vezes para o mesmo JID
    if (avatarFetchAttemptedRef.current === jid) return
    avatarFetchAttemptedRef.current = jid
    
    setLoadingAvatar(true)
    
    try {
      const phone = jid.split('@')[0].split(':')[0]
      
      if (phone) {
        const avatarData = await wuzapi.getAvatar(token, phone, false)
        if (avatarData?.URL) {
          // Atualizar estado local diretamente (igual à página de edição)
          setAvatarUrl(avatarData.URL)
        }
      }
    } catch (error) {
      console.error('Error fetching user avatar:', error)
    } finally {
      setLoadingAvatar(false)
    }
  }, [])

  // Salvar webhook usando o token da inbox selecionada
  const handleSaveWebhook = async () => {
    const token = connectionData?.wuzapiToken || activeInboxToken
    if (!token || !localWebhookConfig) {
      toast.error('Token não disponível')
      return
    }
    
    setSavingWebhook(true)
    try {
      const { webhook, events } = adaptWebhookConfigToWuzapi(localWebhookConfig)
      await wuzapi.setWebhook(token, webhook, events)
      toast.success('Webhook configurado com sucesso!')
      await refetchWebhook()
    } catch (error) {
      console.error('Error saving webhook:', error)
      toast.error('Erro ao configurar webhook')
    } finally {
      setSavingWebhook(false)
    }
  }

  // Handler para mudanças no webhook config
  const handleWebhookConfigChange = (config: WebhookConfigData) => {
    setLocalWebhookConfig(config)
  }

  // Verificar se há mudanças no webhook
  const hasWebhookChanges = (): boolean => {
    if (!localWebhookConfig || !webhookConfig) return false
    const serverConfig = adaptWebhookResponseToConfig(webhookConfig.webhook || '', webhookConfig.subscribe)
    return (
      localWebhookConfig.webhookUrl !== serverConfig.webhookUrl ||
      JSON.stringify(localWebhookConfig.events.sort()) !== JSON.stringify(serverConfig.events.sort())
    )
  }

  const fetchDashboardStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }
      
      const response = await fetch('/api/user/dashboard-stats', {
        method: 'GET',
        headers,
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.data) {
          setStats({
            messagesCount: data.data.messagesCount || 0,
            connectionsCount: data.data.connectionsCount || 0
          })
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    }
  }

  // Handlers de conexão usando o token da inbox selecionada
  const handleConnect = async () => {
    const token = connectionData?.wuzapiToken || activeInboxToken
    if (!token) {
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
    try {
      await wuzapi.connectSession(token, {
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
      
      // Check for 401/unauthorized errors - indicates invalid WUZAPI token
      if (errorMessage.includes('401') || 
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('não autorizado') ||
          errorMessage.toLowerCase().includes('token wuzapi inválido') ||
          errorMessage.toLowerCase().includes('sessão expirada')) {
        toast.error('Token WUZAPI inválido', {
          description: 'O token desta caixa de entrada não é válido no WUZAPI. Reconfigure a caixa de entrada ou entre em contato com o suporte.'
        })
      } else {
        toast.error('Erro ao conectar', {
          description: errorMessage
        })
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    const token = connectionData?.wuzapiToken || activeInboxToken
    if (!token) {
      toast.error('Token não disponível')
      return
    }
    
    try {
      await wuzapi.disconnectSession(token)
      toast.success('Desconectado com sucesso')
      setTimeout(() => {
        refetchStatus()
        fetchDashboardStats()
      }, 2000)
    } catch (error) {
      console.error('Error disconnecting:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      // Check for 401/unauthorized errors - indicates invalid WUZAPI token
      if (errorMessage.includes('401') || 
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('não autorizado') ||
          errorMessage.toLowerCase().includes('token wuzapi inválido') ||
          errorMessage.toLowerCase().includes('sessão expirada')) {
        toast.error('Token WUZAPI inválido', {
          description: 'O token desta caixa de entrada não é válido no WUZAPI.'
        })
      } else {
        toast.error('Erro ao desconectar', {
          description: errorMessage
        })
      }
    }
  }

  const handleLogout = async () => {
    const token = connectionData?.wuzapiToken || activeInboxToken
    if (!token) {
      toast.error('Token não disponível')
      return
    }
    
    try {
      await wuzapi.logoutSession(token)
      toast.success('Logout realizado com sucesso')
      setTimeout(() => {
        refetchStatus()
        fetchDashboardStats()
      }, 2000)
    } catch (error) {
      console.error('Error logging out:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      // Check for 401/unauthorized errors - indicates invalid WUZAPI token
      if (errorMessage.includes('401') || 
          errorMessage.toLowerCase().includes('unauthorized') ||
          errorMessage.toLowerCase().includes('não autorizado') ||
          errorMessage.toLowerCase().includes('token wuzapi inválido') ||
          errorMessage.toLowerCase().includes('sessão expirada')) {
        toast.error('Token WUZAPI inválido', {
          description: 'O token desta caixa de entrada não é válido no WUZAPI.'
        })
      } else {
        toast.error('Erro ao fazer logout', {
          description: errorMessage
        })
      }
    }
  }

  const handleRefreshStatus = async () => {
    await refetchStatus()
  }

  // Handler para copiar texto para clipboard
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

  // Handler para gerar QR Code (ação rápida)
  const handleGenerateQRQuick = async () => {
    const token = connectionData?.wuzapiToken || activeInboxToken
    if (!token) {
      toast.error('Token não disponível')
      return
    }
    
    setLoadingAction('qr')
    const loadingToast = toast.loading('Gerando QR Code...')
    try {
      // Primeiro conectar a sessão
      try {
        await wuzapi.connectSession(token)
      } catch (e) {
        console.log('Sessão existente ou erro:', e)
      }
      
      await new Promise(r => setTimeout(r, 1000))
      
      // Buscar QR Code via refetch
      await refetchStatus()
      toast.success('QR Code gerado!', { id: loadingToast })
    } catch (error) {
      console.error('Error generating QR:', error)
      toast.error('Erro ao gerar QR Code', { id: loadingToast })
    } finally {
      setLoadingAction(null)
    }
  }

  // Handler para atualizar status (ação rápida)
  const handleRefreshStatusQuick = async () => {
    setLoadingAction('refresh')
    try {
      await refetchStatus()
      toast.success('Status atualizado!')
    } catch (error) {
      console.error('Error refreshing status:', error)
      toast.error('Erro ao atualizar status')
    } finally {
      setLoadingAction(null)
    }
  }

  // Efeito para carregar dados iniciais
  useEffect(() => {
    fetchDashboardStats()
    setInitialLoading(false)
  }, [])

  // Efeito para polling de status
  useEffect(() => {
    if (!activeInboxId) return
    
    const interval = setInterval(refetchStatus, 10000)
    return () => clearInterval(interval)
  }, [activeInboxId, refetchStatus])

  // Efeito para buscar avatar quando logado (igual à página de edição)
  useEffect(() => {
    const isLoggedIn = sessionStatus?.loggedIn ?? connectionData?.isLoggedIn
    if (isLoggedIn && connectionData?.jid && connectionData?.wuzapiToken && !avatarUrl) {
      // Reset ref quando inbox muda
      if (avatarFetchAttemptedRef.current !== connectionData.jid) {
        avatarFetchAttemptedRef.current = null
        fetchUserAvatar(connectionData.jid, connectionData.wuzapiToken)
      }
    }
  }, [sessionStatus?.loggedIn, connectionData?.isLoggedIn, connectionData?.jid, connectionData?.wuzapiToken, avatarUrl, fetchUserAvatar])

  // Efeito para resetar avatar quando inbox muda
  useEffect(() => {
    setAvatarUrl(null)
    avatarFetchAttemptedRef.current = null
  }, [activeInboxId])

  // Efeito para sincronizar webhook config local com dados do servidor
  useEffect(() => {
    if (webhookConfig) {
      const serverConfig = adaptWebhookResponseToConfig(webhookConfig.webhook || '', webhookConfig.subscribe)
      setLocalWebhookConfig(serverConfig)
    }
  }, [webhookConfig])

  // Debug effect para rastrear mudanças no sessionStatus
  useEffect(() => {
    console.log('[UserOverview] sessionStatus changed:', {
      sessionStatus,
      connectionDataIsConnected: connectionData?.isConnected,
      computedIsConnected: sessionStatus?.connected ?? connectionData?.isConnected ?? false,
      computedIsLoggedIn: sessionStatus?.loggedIn ?? false
    })
  }, [sessionStatus, connectionData?.isConnected])

  // Loading inicial
  if (initialLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
        <LoadingSkeleton variant="stats" count={3} />
        <div className="grid gap-6 lg:grid-cols-2">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="connection" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Conexão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <UserDashboardModern 
            onSwitchToConnection={(inboxId) => {
              // Trocar para a inbox selecionada via contexto
              if (inboxContext?.selectSingle) {
                inboxContext.selectSingle(inboxId)
              }
              setActiveTab('connection')
            }}
          />
        </TabsContent>

        <TabsContent value="connection" className="mt-6 space-y-6">
          {/* Loading state */}
          {isLoadingConnection && (
            <div className="grid gap-6 lg:grid-cols-2">
              <LoadingSkeleton variant="card" />
              <LoadingSkeleton variant="card" />
            </div>
          )}

          {/* Error state */}
          {connectionError && !isLoadingConnection && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Erro ao carregar dados</p>
                    <p className="text-sm text-muted-foreground">{connectionError}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="ml-auto"
                    onClick={() => refetchConnection()}
                  >
                    Tentar novamente
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No inbox selected */}
          {!activeInboxId && !isLoadingConnection && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Selecione uma caixa de entrada para ver os dados de conexão</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main content - only show when we have data */}
          {connectionData && !isLoadingConnection && (
            <>
              {/* Card de Informações da Conexão - Layout completo igual à página de edição */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <User className="h-5 w-5 mr-2 text-primary" />
                    Informações da Inbox
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
                        {(avatarUrl || connectionData.profilePicture) ? (
                          <AvatarImage 
                            src={avatarUrl || connectionData.profilePicture || ''} 
                            alt={connectionData.inboxName}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className={`text-2xl ${(sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false) ? 'bg-green-100 text-green-700' : 'bg-muted'}`}>
                          {loadingAvatar ? (
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                          ) : (
                            <User className="h-8 w-8" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {(sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false) && !avatarUrl && !connectionData.profilePicture && !loadingAvatar && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (connectionData.jid && connectionData.wuzapiToken) {
                              avatarFetchAttemptedRef.current = null
                              fetchUserAvatar(connectionData.jid, connectionData.wuzapiToken)
                            }
                          }}
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
                        {(sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false) ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <Wifi className="h-3 w-3 mr-1" />
                            Logado
                          </Badge>
                        ) : (sessionStatus?.connected ?? connectionData.isConnected ?? false) ? (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
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
                      
                      {/* Telefone */}
                      {connectionData.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{connectionData.phoneNumber}</span>
                        </div>
                      )}
                      
                      {/* ID da Inbox */}
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">ID da Inbox</span>
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

                      {/* JID */}
                      {connectionData.jid && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">JID WhatsApp</span>
                          <code className="bg-muted px-2 py-1 rounded font-mono text-xs truncate max-w-[180px]">
                            {connectionData.jid.split('@')[0]}
                          </code>
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
                          <span className="text-xs text-muted-foreground">Token de Acesso</span>
                          <code className="bg-muted px-2 py-1 rounded font-mono text-xs truncate max-w-[180px]">
                            {connectionData.wuzapiToken.substring(0, 15)}...
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
                        {(sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false)
                          ? 'Conectado e autenticado no WhatsApp. Pronto para enviar/receber mensagens.'
                          : (sessionStatus?.connected ?? connectionData.isConnected ?? false)
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
                        onClick={handleGenerateQRQuick}
                        disabled={loadingAction === 'qr'}
                        className="justify-start text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
                      >
                        {loadingAction === 'qr' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <QrCode className="h-4 w-4 mr-2" />
                        )}
                        Escanear QR Code
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshStatusQuick}
                        disabled={loadingAction === 'refresh'}
                        className="justify-start"
                      >
                        {loadingAction === 'refresh' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Atualizar Status
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/user/inboxes/edit/${connectionData.inboxId}`)}
                        className="justify-start"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configurações
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Connection Control Card - usando componente compartilhado */}
              <ConnectionControlCard
                connectionStatus={{
                  isConnected: sessionStatus?.connected ?? connectionData.isConnected ?? false,
                  isLoggedIn: sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false
                }}
                isLoading={connecting}
                loadingAction={connecting ? 'connect' : null}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onLogout={handleLogout}
                onGenerateQR={handleConnect}
              />

              {/* QR Code */}
              {qrCode && (
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
                        src={qrCode} 
                        alt="QR Code WhatsApp" 
                        className="w-64 h-64"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Secondary Grid */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Webhook Configuration - usando componente compartilhado */}
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

                {/* Credit Balance */}
                <CreditBalance onPurchase={() => setShowCreditPurchase(true)} />
              </div>
            </>
          )}

          {/* Credit Purchase Dialog */}
          <CreditPurchase 
            open={showCreditPurchase} 
            onOpenChange={setShowCreditPurchase}
          />

          {/* Quota Summary and Quick Actions Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Quota Summary Card */}
            {quotas.length > 0 && (
              <QuotaSummaryCard quotas={quotas} />
            )}

            {/* Management Quick Actions */}
            {hasManagementPermission && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Gestão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 grid-cols-2">
                    <Button 
                      variant="outline" 
                      className="h-12 flex-col w-full text-xs hover:bg-primary/5"
                      onClick={() => navigate('/user/agents')}
                    >
                      <Users className="h-4 w-4 mb-1" />
                      Agentes
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-12 flex-col w-full text-xs hover:bg-primary/5"
                      onClick={() => navigate('/user/teams')}
                    >
                      <UsersRound className="h-4 w-4 mb-1" />
                      Equipes
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-12 flex-col w-full text-xs hover:bg-primary/5"
                      onClick={() => navigate('/user/inboxes')}
                    >
                      <Inbox className="h-4 w-4 mb-1" />
                      Caixas
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-12 flex-col w-full text-xs hover:bg-primary/5"
                      onClick={() => navigate('/user/audit')}
                    >
                      <FileText className="h-4 w-4 mb-1" />
                      Auditoria
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Navigation Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Acesso Rápido</CardTitle>
              <CardDescription>
                Navegue para outras seções da aplicação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                <Button 
                  variant="outline" 
                  className="h-16 flex-col w-full hover:bg-primary/5"
                  onClick={() => navigate('/user/messages')}
                >
                  <MessageSquare className="h-5 w-5 mb-1" />
                  <span className="text-sm">Histórico de Mensagens</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-16 flex-col w-full hover:bg-primary/5"
                  onClick={() => navigate('/user/database')}
                >
                  <Database className="h-5 w-5 mb-1" />
                  <span className="text-sm">Meu Banco de Dados</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-16 flex-col w-full sm:col-span-2 md:col-span-1 hover:bg-primary/5"
                  onClick={() => navigate('/user/settings')}
                >
                  <Settings className="h-5 w-5 mb-1" />
                  <span className="text-sm">Configurações Completas</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default UserOverview
