/**
 * SupabaseInboxContext - Context for Supabase Auth user inbox binding
 * 
 * Gerencia o contexto de inbox para usuários autenticados via Supabase Auth.
 * Carrega automaticamente os dados da inbox associada (token WUZAPI, instância, etc.)
 * e os disponibiliza em todo o sistema.
 * 
 * Suporta seleção múltipla de inboxes e opção "Todas as Caixas".
 * 
 * Requirements: 2.1, 2.2, 2.4, 6.4, 7.4, 8.4, 11.6
 * Enhanced for: unified-inbox-selector spec
 */

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useRef,
  useMemo,
  type ReactNode 
} from 'react'
import { useAuth } from './AuthContext'
import { toast } from 'sonner'
import {
  getInboxContext,
  switchInbox as switchInboxApi,
  getInboxStatus,
  refreshInboxContext,
  hasPermission as checkPermission,
  canSendMessages as checkCanSendMessages,
  getInboxSelection,
  saveInboxSelection,
  type SessionContext,
  type InboxSummary
} from '@/services/inbox-context'

/**
 * Tipo de seleção: 'all' para todas as caixas ou array de IDs específicos
 */
export type InboxSelection = 'all' | string[]

/**
 * Valor do contexto exposto pelo provider
 */
interface SupabaseInboxContextValue {
  // Estado atual
  context: SessionContext | null
  isLoading: boolean
  error: string | null
  
  // Ações de seleção única (legado)
  switchInbox: (inboxId: string) => Promise<boolean>
  refreshContext: () => Promise<void>
  
  // Ações de seleção múltipla (novo)
  selection: InboxSelection
  selectedInboxIds: string[]
  isAllSelected: boolean
  selectAll: () => void
  selectSingle: (inboxId: string) => void
  toggleInbox: (inboxId: string) => void
  isInboxSelected: (inboxId: string) => boolean
  getSelectedCount: () => number
  
  // Estatísticas agregadas
  totalUnreadCount: number
  hasDisconnectedInbox: boolean
  
  // Helpers
  hasPermission: (permission: string) => boolean
  canSendMessages: () => boolean
  
  // Dados derivados
  activeInbox: InboxSummary | null
  availableInboxes: InboxSummary[]
  isConnected: boolean
  wuzapiToken: string | null
  instance: string | null
  accountId: string | null
  userType: 'owner' | 'agent' | null
}

const SupabaseInboxContext = createContext<SupabaseInboxContextValue | null>(null)

interface SupabaseInboxProviderProps {
  children: ReactNode
  /** Intervalo de polling para status em ms (default: 30000) */
  statusPollingInterval?: number
  /** Habilitar polling de status (default: true) */
  enableStatusPolling?: boolean
}

export function SupabaseInboxProvider({ 
  children,
  statusPollingInterval = 30000,
  enableStatusPolling = true
}: SupabaseInboxProviderProps) {
  const { isAuthenticated, session } = useAuth()
  
  const [context, setContext] = useState<SessionContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Estado de seleção múltipla
  const [selection, setSelection] = useState<InboxSelection>('all')
  
  // Ref para controlar polling
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const previousConnectedRef = useRef<boolean | null>(null)

  /**
   * Carrega o contexto inicial
   */
  const loadContext = useCallback(async () => {
    if (!isAuthenticated || !session) {
      setContext(null)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await getInboxContext()

      if (response.success && response.data) {
        setContext(response.data)
        previousConnectedRef.current = response.data.isConnected
        
        // Carregar seleção salva
        try {
          const selectionResponse = await getInboxSelection()
          if (selectionResponse.success && selectionResponse.data) {
            const savedSelection = selectionResponse.data.selection
            // Validar que os IDs salvos ainda existem
            if (savedSelection !== 'all') {
              const validIds = savedSelection.filter(id => 
                response.data!.availableInboxes.some(inbox => inbox.id === id)
              )
              setSelection(validIds.length > 0 ? validIds : 'all')
            } else {
              setSelection('all')
            }
          }
        } catch {
          // Se falhar ao carregar seleção, usar 'all' como padrão
          setSelection('all')
        }
      } else {
        const errorCode = response.error?.code
        
        // Erros esperados não são críticos
        if (errorCode === 'NO_ACCOUNT' || errorCode === 'NO_INBOX') {
          setContext(null)
          setError(response.error?.message || 'Contexto não disponível')
        } else {
          setError(response.error?.message || 'Erro ao carregar contexto')
        }
      }
    } catch (err) {
      console.error('Failed to load inbox context:', err)
      setError('Erro ao carregar contexto')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, session])

  /**
   * Troca a inbox ativa
   */
  const switchInbox = useCallback(async (inboxId: string): Promise<boolean> => {
    if (!isAuthenticated) {
      toast.error('Usuário não autenticado')
      return false
    }

    setIsLoading(true)

    try {
      const response = await switchInboxApi(inboxId)

      if (response.success && response.data) {
        setContext(response.data)
        previousConnectedRef.current = response.data.isConnected
        toast.success(response.message || 'Caixa de entrada alterada')
        return true
      } else {
        toast.error(response.error?.message || 'Erro ao trocar caixa de entrada')
        return false
      }
    } catch (err) {
      console.error('Failed to switch inbox:', err)
      toast.error('Erro ao trocar caixa de entrada')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated])

  /**
   * Força atualização do contexto
   */
  const refreshContext = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await refreshInboxContext()

      if (response.success && response.data) {
        setContext(response.data)
        previousConnectedRef.current = response.data.isConnected
      }
    } catch (err) {
      console.error('Failed to refresh context:', err)
    }
  }, [isAuthenticated])

  /**
   * Verifica status de conexão periodicamente
   */
  const checkStatus = useCallback(async () => {
    if (!context?.inboxId) return

    try {
      const response = await getInboxStatus()

      if (response.success && response.data) {
        const newConnected = response.data.isConnected
        const wasConnected = previousConnectedRef.current

        // Notificar mudança de status
        if (wasConnected !== null && wasConnected !== newConnected) {
          if (newConnected) {
            toast.success('WhatsApp conectado')
          } else {
            toast.warning('WhatsApp desconectado')
          }
        }

        previousConnectedRef.current = newConnected

        // Atualizar contexto com novo status
        setContext(prev => prev ? {
          ...prev,
          isConnected: newConnected
        } : null)
      }
    } catch (err) {
      console.error('Failed to check inbox status:', err)
    }
  }, [context?.inboxId])

  // Carregar contexto quando autenticado
  useEffect(() => {
    loadContext()
  }, [loadContext])

  // Configurar polling de status
  useEffect(() => {
    if (!enableStatusPolling || !context?.inboxId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    pollingRef.current = setInterval(checkStatus, statusPollingInterval)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [enableStatusPolling, context?.inboxId, statusPollingInterval, checkStatus])

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Helpers
  const hasPermission = useCallback((permission: string): boolean => {
    return checkPermission(context, permission)
  }, [context])

  const canSendMessages = useCallback((): boolean => {
    return checkCanSendMessages(context)
  }, [context])

  // === Funções de seleção múltipla ===
  
  /**
   * IDs das inboxes selecionadas (resolvidos)
   */
  const selectedInboxIds = useMemo((): string[] => {
    const inboxes = context?.availableInboxes || []
    if (selection === 'all') {
      return inboxes.map(inbox => inbox.id)
    }
    return selection
  }, [selection, context?.availableInboxes])

  /**
   * Verifica se "Todas as Caixas" está selecionado
   */
  const isAllSelected = selection === 'all'

  /**
   * Seleciona todas as caixas
   */
  const selectAll = useCallback(() => {
    setSelection('all')
    saveInboxSelection('all').catch(console.error)
  }, [])

  /**
   * Seleciona apenas uma inbox específica
   */
  const selectSingle = useCallback((inboxId: string) => {
    setSelection([inboxId])
    saveInboxSelection([inboxId]).catch(console.error)
  }, [])

  /**
   * Alterna seleção de uma inbox (adiciona/remove)
   */
  const toggleInbox = useCallback((inboxId: string) => {
    setSelection(prev => {
      const inboxes = context?.availableInboxes || []
      let newSelection: InboxSelection
      
      if (prev === 'all') {
        // Se estava em "all", seleciona todas exceto a clicada
        const allIds = inboxes.map(i => i.id)
        const filtered = allIds.filter(id => id !== inboxId)
        // Garantir pelo menos uma selecionada
        newSelection = filtered.length > 0 ? filtered : [inboxId]
      } else {
        const isSelected = prev.includes(inboxId)
        if (isSelected) {
          // Remover, mas garantir pelo menos uma
          const filtered = prev.filter(id => id !== inboxId)
          newSelection = filtered.length > 0 ? filtered : prev
        } else {
          // Adicionar
          newSelection = [...prev, inboxId]
        }
        
        // Se todas estão selecionadas, mudar para 'all'
        if (newSelection.length === inboxes.length) {
          newSelection = 'all'
        }
      }
      
      saveInboxSelection(newSelection).catch(console.error)
      return newSelection
    })
  }, [context?.availableInboxes])

  /**
   * Verifica se uma inbox específica está selecionada
   */
  const isInboxSelected = useCallback((inboxId: string): boolean => {
    if (selection === 'all') return true
    return selection.includes(inboxId)
  }, [selection])

  /**
   * Retorna o número de inboxes selecionadas
   */
  const getSelectedCount = useCallback((): number => {
    if (selection === 'all') {
      return context?.availableInboxes?.length || 0
    }
    return selection.length
  }, [selection, context?.availableInboxes])

  // === Estatísticas agregadas ===
  
  /**
   * Total de mensagens não lidas em todas as inboxes selecionadas
   */
  const totalUnreadCount = useMemo((): number => {
    const inboxes = context?.availableInboxes || []
    const selectedIds = selection === 'all' 
      ? inboxes.map(i => i.id) 
      : selection
    
    return inboxes
      .filter(inbox => selectedIds.includes(inbox.id))
      .reduce((sum, inbox) => sum + (inbox.unreadCount || 0), 0)
  }, [context?.availableInboxes, selection])

  /**
   * Verifica se alguma inbox selecionada está desconectada
   */
  const hasDisconnectedInbox = useMemo((): boolean => {
    const inboxes = context?.availableInboxes || []
    const selectedIds = selection === 'all' 
      ? inboxes.map(i => i.id) 
      : selection
    
    return inboxes
      .filter(inbox => selectedIds.includes(inbox.id))
      .some(inbox => !inbox.isConnected)
  }, [context?.availableInboxes, selection])

  // Dados derivados
  const activeInbox: InboxSummary | null = context ? {
    id: context.inboxId,
    name: context.inboxName,
    phoneNumber: context.phoneNumber,
    isConnected: context.isConnected,
    isPrimary: true
  } : null

  const value: SupabaseInboxContextValue = {
    context,
    isLoading,
    error,
    switchInbox,
    refreshContext,
    // Seleção múltipla
    selection,
    selectedInboxIds,
    isAllSelected,
    selectAll,
    selectSingle,
    toggleInbox,
    isInboxSelected,
    getSelectedCount,
    // Estatísticas
    totalUnreadCount,
    hasDisconnectedInbox,
    // Helpers
    hasPermission,
    canSendMessages,
    // Dados derivados
    activeInbox,
    availableInboxes: context?.availableInboxes || [],
    isConnected: context?.isConnected || false,
    wuzapiToken: context?.wuzapiToken || null,
    instance: context?.instance || null,
    accountId: context?.accountId || null,
    userType: context?.userType || null
  }

  return (
    <SupabaseInboxContext.Provider value={value}>
      {children}
    </SupabaseInboxContext.Provider>
  )
}

/**
 * Hook para usar o contexto de inbox do Supabase Auth
 */
export function useSupabaseInbox(): SupabaseInboxContextValue {
  const context = useContext(SupabaseInboxContext)
  
  if (!context) {
    throw new Error('useSupabaseInbox must be used within a SupabaseInboxProvider')
  }
  
  return context
}

/**
 * Hook opcional que não lança erro se usado fora do provider
 */
export function useSupabaseInboxOptional(): SupabaseInboxContextValue | null {
  return useContext(SupabaseInboxContext)
}

export default SupabaseInboxContext
