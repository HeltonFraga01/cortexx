/**
 * InboxListUser Component
 * 
 * Displays list of inboxes with member count for user dashboard.
 * Includes Dashboard-like management features: QR code, connect, disconnect, logout.
 * 
 * Requirements: 4.1
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CardHeaderWithIcon, LoadingSkeleton, EmptyState } from '@/components/ui-custom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  Edit,
  Inbox,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Settings,
  MessageSquare,
  AlertTriangle,
  Wifi,
  WifiOff,
  QrCode,
  Power,
  PowerOff,
  LogOut,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import type { InboxWithStats } from '@/types/multi-user'
import { 
  listInboxes, 
  deleteInbox, 
  createDefaultInbox,
  getInboxQRCode,
  connectInbox,
  disconnectInbox,
  logoutInbox
} from '@/services/account-inboxes'
import { 
  getInboxStatus as getProviderInboxStatus,
  getStatusMessage,
  hasStatusError,
  type InboxStatusResult
} from '@/services/inbox-status'
import { useInboxQuota } from '@/hooks/useInboxQuota'

interface InboxListUserProps {
  onCreateInbox?: () => void
  onEditInbox?: (inbox: InboxWithStats) => void
  onManageAgents?: (inbox: InboxWithStats) => void
}

interface InboxStatus {
  connected: boolean
  loggedIn: boolean
  status: 'connected' | 'connecting' | 'disconnected' | 'not_configured' | 'unknown'
  hasError?: boolean
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  web: 'Web Chat',
  api: 'API',
}

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '📱',
  email: '📧',
  web: '💬',
  api: '🔌',
}

export function InboxListUser({ 
  onCreateInbox, 
  onEditInbox, 
  onManageAgents
}: InboxListUserProps) {
  const [inboxes, setInboxes] = useState<InboxWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [selectedInbox, setSelectedInbox] = useState<InboxWithStats | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [expandedInbox, setExpandedInbox] = useState<string | null>(null)
  const [inboxStatuses, setInboxStatuses] = useState<Record<string, InboxStatus>>({})
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const [connectingInbox, setConnectingInbox] = useState<string | null>(null)
  const itemsPerPage = 10

  // Quota management
  const { quota, refresh: refreshQuota, canCreate } = useInboxQuota()
  const maxInboxesReached = !canCreate

  const fetchInboxStatus = useCallback(async (inboxId: string) => {
    try {
      // Usar o novo serviço de status baseado no Provider (fonte única de verdade)
      const result: InboxStatusResult = await getProviderInboxStatus(inboxId)
      
      // Mapear resultado para o formato esperado pelo componente
      let statusValue: InboxStatus['status'] = 'disconnected'
      
      if (hasStatusError(result)) {
        statusValue = 'unknown'
      } else if (result.status.loggedIn) {
        statusValue = 'connected'
      } else if (result.status.connected) {
        statusValue = 'connecting'
      } else {
        statusValue = 'disconnected'
      }
      
      const status: InboxStatus = {
        connected: result.status.connected,
        loggedIn: result.status.loggedIn,
        status: statusValue,
        hasError: hasStatusError(result)
      }
      
      setInboxStatuses(prev => ({ ...prev, [inboxId]: status }))
      
      // If status includes QR code, use it directly
      if (result.status.qrCode) {
        setQrCodes(prev => ({ ...prev, [inboxId]: result.status.qrCode! }))
      }
      // If connected but not logged in and no QR code in status, fetch QR code separately
      else if (status.connected && !status.loggedIn) {
        fetchQRCode(inboxId)
      }
    } catch (error) {
      console.error('Error fetching inbox status:', error)
      // Em caso de erro, marcar como desconhecido
      setInboxStatuses(prev => ({ 
        ...prev, 
        [inboxId]: {
          connected: false,
          loggedIn: false,
          status: 'unknown',
          hasError: true
        }
      }))
    }
  }, [])

  const fetchQRCode = async (inboxId: string) => {
    try {
      const result = await getInboxQRCode(inboxId)
      if (result.qrCode) {
        setQrCodes(prev => ({ ...prev, [inboxId]: result.qrCode! }))
      } else if (result.connected && !result.loggedIn) {
        // QR code not ready yet, will be fetched on next status poll
        console.log('QR code not ready yet for inbox:', inboxId)
      }
    } catch (error) {
      console.error('Error fetching QR code:', error)
      // Don't show error toast - QR code fetch is best-effort
    }
  }

  const fetchInboxes = useCallback(async () => {
    try {
      setLoading(true)
      
      // First, ensure default inbox exists
      try {
        await createDefaultInbox()
      } catch (defaultError) {
        console.log('Default inbox check:', defaultError)
      }
      
      const data = await listInboxes()
      setInboxes(data)
      
      // Fetch status for WhatsApp inboxes
      for (const inbox of data) {
        if (inbox.channelType === 'whatsapp') {
          fetchInboxStatus(inbox.id)
        }
      }
    } catch (error) {
      console.error('Error fetching inboxes:', error)
      toast.error('Erro ao carregar caixas de entrada')
    } finally {
      setLoading(false)
    }
  }, [fetchInboxStatus])

  useEffect(() => {
    fetchInboxes()
  }, [fetchInboxes])

  // Poll status for expanded inbox
  useEffect(() => {
    if (!expandedInbox) return
    
    const interval = setInterval(() => {
      fetchInboxStatus(expandedInbox)
    }, 5000)
    
    return () => clearInterval(interval)
  }, [expandedInbox, fetchInboxStatus])

  const handleConnect = async (inbox: InboxWithStats) => {
    // Verificar status atual antes de tentar conectar (Property 7: Pre-Action Status Check)
    const currentStatus = inboxStatuses[inbox.id]
    if (currentStatus?.connected && currentStatus?.loggedIn) {
      toast.info('Já conectado', {
        description: 'A sessão WhatsApp já está conectada'
      })
      return
    }
    
    try {
      setConnectingInbox(inbox.id)
      await connectInbox(inbox.id, { Subscribe: ['Message', 'ReadReceipt'], Immediate: false })
      toast.success('Conectando ao WhatsApp...')
      
      // Update status to show connecting state immediately
      setInboxStatuses(prev => ({ 
        ...prev, 
        [inbox.id]: {
          connected: true,
          loggedIn: false,
          status: 'connecting',
          hasError: false
        }
      }))
      
      // Wait a bit then fetch status and QR code with retries
      const fetchWithRetry = async () => {
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          await fetchInboxStatus(inbox.id)
          await fetchQRCode(inbox.id)
        }
      }
      
      fetchWithRetry()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao conectar'
      
      // Tratar "already connected" como sucesso (Property 6: Already Connected Handling)
      if (errorMessage.toLowerCase().includes('already connected')) {
        toast.info('Já conectado', {
          description: 'A sessão WhatsApp já está conectada'
        })
        fetchInboxStatus(inbox.id)
        return
      }
      
      toast.error(errorMessage)
    } finally {
      setConnectingInbox(null)
    }
  }

  const handleDisconnect = async (inbox: InboxWithStats) => {
    try {
      setActionLoading(true)
      await disconnectInbox(inbox.id)
      toast.success('Desconectado com sucesso')
      setQrCodes(prev => {
        const newCodes = { ...prev }
        delete newCodes[inbox.id]
        return newCodes
      })
      setTimeout(() => fetchInboxStatus(inbox.id), 1000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desconectar')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!selectedInbox) return
    
    try {
      setActionLoading(true)
      await logoutInbox(selectedInbox.id)
      toast.success('Logout realizado com sucesso')
      setLogoutDialogOpen(false)
      setQrCodes(prev => {
        const newCodes = { ...prev }
        delete newCodes[selectedInbox.id]
        return newCodes
      })
      setTimeout(() => fetchInboxStatus(selectedInbox.id), 1000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao fazer logout')
    } finally {
      setActionLoading(false)
      setSelectedInbox(null)
    }
  }

  const handleDelete = async () => {
    if (!selectedInbox) return

    try {
      setActionLoading(true)
      await deleteInbox(selectedInbox.id)
      toast.success('Caixa de entrada excluída com sucesso')
      setDeleteDialogOpen(false)
      setSelectedInbox(null)
      fetchInboxes()
      refreshQuota() // Refresh quota after deletion
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir caixa de entrada')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateInbox = () => {
    if (maxInboxesReached) {
      toast.error('Limite de caixas de entrada atingido. Faça upgrade do seu plano.')
      return
    }
    onCreateInbox?.()
  }

  const toggleExpand = (inboxId: string) => {
    if (expandedInbox === inboxId) {
      setExpandedInbox(null)
    } else {
      setExpandedInbox(inboxId)
      fetchInboxStatus(inboxId)
    }
  }

  const getStatusBadge = (inbox: InboxWithStats) => {
    const status = inboxStatuses[inbox.id]
    
    if (!status || status.status === 'not_configured') {
      return <Badge variant="outline"><WifiOff className="h-3 w-3 mr-1" />Não configurado</Badge>
    }
    
    if (status.status === 'unknown' || status.hasError) {
      return <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800"><AlertTriangle className="h-3 w-3 mr-1" />Status desconhecido</Badge>
    }
    
    if (status.loggedIn) {
      return <Badge className="bg-green-500 hover:bg-green-600"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>
    }
    
    if (status.connected) {
      return <Badge variant="secondary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Aguardando QR</Badge>
    }
    
    return <Badge variant="outline"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>
  }

  const filteredInboxes = inboxes.filter((inbox) =>
    inbox.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inbox.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.ceil(filteredInboxes.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInboxes = filteredInboxes.slice(startIndex, endIndex)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  return (
    <div className="space-y-6 w-full max-w-none mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Caixas de Entrada</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Configure canais de comunicação e gerencie conexões WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quota Display */}
          {quota && (
            <Badge variant={maxInboxesReached ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
              {quota.current}/{quota.limit} caixas
            </Badge>
          )}
          <Button onClick={fetchInboxes} variant="outline" size="icon" className="flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {onCreateInbox && (
            <Button onClick={handleCreateInbox} disabled={maxInboxesReached}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Caixa
            </Button>
          )}
        </div>
      </div>

      {maxInboxesReached && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você atingiu o limite de {quota?.limit} caixa{quota?.limit !== 1 ? 's' : ''} de entrada do seu plano. 
            Faça upgrade para criar mais caixas.
          </AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar caixas de entrada..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inboxes List */}
      <Card className="w-full">
        <CardHeaderWithIcon
          icon={Inbox}
          iconColor="text-purple-500"
          title={`Caixas de Entrada (${filteredInboxes.length})`}
        >
          <p className="text-sm text-muted-foreground">Gerencie suas conexões WhatsApp</p>
        </CardHeaderWithIcon>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <LoadingSkeleton variant="list" count={3} />
            </div>
          ) : filteredInboxes.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Inbox}
                title="Nenhuma caixa de entrada encontrada"
                description={searchTerm ? 'Tente uma busca diferente' : 'Sua caixa de entrada padrão será criada automaticamente'}
              />
            </div>
          ) : (
            <div className="divide-y">
              {paginatedInboxes.map((inbox) => {
                const status = inboxStatuses[inbox.id]
                const isExpanded = expandedInbox === inbox.id
                const qrCode = qrCodes[inbox.id]
                
                return (
                  <div key={inbox.id}>
                    {/* Inbox Row */}
                    <div className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-2xl">{CHANNEL_ICONS[inbox.channelType] || '📥'}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{inbox.name}</span>
                              {inbox.channelType === 'whatsapp' && getStatusBadge(inbox)}
                            </div>
                            {inbox.description && (
                              <p className="text-sm text-muted-foreground truncate">{inbox.description}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="hidden sm:flex">
                            {CHANNEL_LABELS[inbox.channelType] || inbox.channelType}
                          </Badge>
                          <Badge variant="secondary" className="hidden sm:flex">
                            <UserPlus className="h-3 w-3 mr-1" />
                            {inbox.memberCount}
                          </Badge>
                          
                          {inbox.channelType === 'whatsapp' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpand(inbox.id)}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => onEditInbox?.(inbox)}>
                                <Settings className="h-4 w-4 mr-2" />
                                Configurações
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onManageAgents?.(inbox)}>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Gerenciar Agentes
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Ver Conversas
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedInbox(inbox)
                                  setDeleteDialogOpen(true)
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Caixa
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                    
                    {/* Expanded Connection Panel */}
                    {isExpanded && inbox.channelType === 'whatsapp' && (
                      <div className="px-4 pb-4 bg-muted/30 border-t">
                        <div className="pt-4 space-y-4">
                          {/* Connection Controls */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Button 
                              onClick={() => fetchInboxStatus(inbox.id)} 
                              variant="outline" 
                              size="sm"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Atualizar Status
                            </Button>
                            
                            {!status?.connected ? (
                              <Button 
                                onClick={() => handleConnect(inbox)} 
                                disabled={connectingInbox === inbox.id}
                                className="bg-green-600 hover:bg-green-700"
                                size="sm"
                              >
                                {connectingInbox === inbox.id ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Power className="h-4 w-4 mr-2" />
                                )}
                                Conectar
                              </Button>
                            ) : (
                              <>
                                <Button 
                                  onClick={() => handleDisconnect(inbox)} 
                                  variant="outline"
                                  size="sm"
                                  disabled={actionLoading}
                                >
                                  <PowerOff className="h-4 w-4 mr-2" />
                                  Desconectar
                                </Button>
                                {status.loggedIn && (
                                  <Button 
                                    onClick={() => {
                                      setSelectedInbox(inbox)
                                      setLogoutDialogOpen(true)
                                    }}
                                    variant="destructive"
                                    size="sm"
                                  >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Logout WhatsApp
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                          
                          {/* Status Message */}
                          {status?.loggedIn && (
                            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                              <p className="text-sm text-green-700 dark:text-green-300">
                                <strong>✅ Conectado!</strong> Esta caixa de entrada está ativa e pronta para receber mensagens.
                              </p>
                            </div>
                          )}
                          
                          {/* QR Code */}
                          {qrCode && status?.connected && !status?.loggedIn && (
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                  <QrCode className="h-5 w-5" />
                                  QR Code para Login
                                </CardTitle>
                                <CardDescription>
                                  Escaneie este QR Code com seu WhatsApp para conectar
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="flex justify-center">
                                <div className="bg-white p-4 rounded-lg">
                                  <img 
                                    src={qrCode} 
                                    alt="QR Code WhatsApp" 
                                    className="w-48 h-48"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          
                          {/* Waiting for QR Code */}
                          {status?.connected && !status?.loggedIn && !qrCode && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                              <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Aguardando QR Code...
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {!loading && filteredInboxes.length > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredInboxes.length)} de {filteredInboxes.length} caixas
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Anterior</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNum}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="hidden sm:inline">Próxima</span>
                <ChevronRight className="h-4 w-4 sm:ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Caixa de Entrada</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a caixa de entrada <strong>{selectedInbox?.name}</strong>? Esta ação não pode ser
              desfeita e todas as conversas associadas serão arquivadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout do WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja fazer logout do WhatsApp na caixa <strong>{selectedInbox?.name}</strong>? 
              Isso irá desconectar o dispositivo e você precisará escanear o QR Code novamente para reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Desconectando...' : 'Fazer Logout'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default InboxListUser
