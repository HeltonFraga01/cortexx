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
  refreshInboxContext,
  hasPermission as checkPermission,
  canSendMessages as checkCanSendMessages,
  getInboxSelection,
  saveInboxSelection,
  type SessionContext,
  type InboxSummary
} from '@/services/inbox-context'
import { 
  getInboxStatus as getProviderInboxStatus,
  getAllInboxesStatus,
  type InboxStatusResult
} from '@/services/inbox-status'

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
  
  // Sincronização de status (connection-status-sync spec)
  updateInboxStatus: (inboxId: string, status: { isConnected: boolean; isLoggedIn: boolean }) => void
  // Refresh imediato de status (wuzapi-status-source-of-truth spec)
  refreshInboxStatus: (inboxId: string) => Promise<InboxStatusResult | null>
  
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
  const isPageVisibleRef = useRef<boolean>(true)
  const inFlightRequestRef = useRef<boolean>(false)

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
        // Carregar seleção salva primeiro para determinar qual inbox será exibida
        let finalSelection: InboxSelection = 'all'
        try {
          const selectionResponse = await getInboxSelection()
          if (selectionResponse.success && selectionResponse.data) {
            const savedSelection = selectionResponse.data.selection
            // Validar que os IDs salvos ainda existem
            if (savedSelection !== 'all') {
              const validIds = savedSelection.filter(id => 
                response.data!.availableInboxes.some(inbox => inbox.id === id)
              )
              finalSelection = validIds.length > 0 ? validIds : 'all'
            } else {
              finalSelection = 'all'
            }
          }
        } catch {
          // Se falhar ao carregar seleção, usar 'all' como padrão
          finalSelection = 'all'
        }
        
        // Determinar qual inbox será exibida na UI
        let displayedInboxId: string
        if (finalSelection === 'all') {
          // Quando "all", a primeira inbox em availableInboxes é exibida
          displayedInboxId = response.data.availableInboxes[0]?.id || response.data.inboxId
        } else {
          // Quando há seleção específica, a primeira selecionada é exibida
          displayedInboxId = finalSelection[0]
        }
        
        // Obter o status da inbox que será exibida
        const displayedInbox = response.data.availableInboxes.find(inbox => inbox.id === displayedInboxId)
        const displayedIsConnected = displayedInbox?.isConnected ?? response.data.isConnected
        
        console.log('[SupabaseInboxContext] loadContext - setting isConnected:', {
          backendActiveInboxId: response.data.inboxId,
          backendIsConnected: response.data.isConnected,
          displayedInboxId,
          displayedIsConnected,
          finalSelection
        })
        
        // Setar contexto com isConnected da inbox que será exibida
        setContext({
          ...response.data,
          isConnected: displayedIsConnected
        })
        previousConnectedRef.current = displayedIsConnected
        setSelection(finalSelection)
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
   * Verifica status de conexão de TODAS as inboxes periodicamente
   * Usa a nova API de status que consulta o Provider (WUZAPI) como fonte única de verdade
   * Requirements: 3.1, 7.1, 7.2, 7.3 (wuzapi-status-source-of-truth spec)
   */
  const checkStatus = useCallback(async () => {
    // Evitar requisições duplicadas (deduplication)
    if (inFlightRequestRef.current) {
      console.log('[SupabaseInboxContext] checkStatus - skipping, request in flight')
      return
    }

    // Não fazer polling se a página não está visível
    if (!isPageVisibleRef.current) {
      console.log('[SupabaseInboxContext] checkStatus - skipping, page not visible')
      return
    }

    // Usar setContext com callback para acessar o estado atual sem dependência
    setContext(currentContext => {
      if (!currentContext?.availableInboxes?.length) return currentContext

      // Marcar requisição em andamento
      inFlightRequestRef.current = true

      // Executar a busca de status de forma assíncrona
      const fetchStatuses = async () => {
        try {
          // Buscar status de TODAS as inboxes via Provider API (fonte única de verdade)
          const result = await getAllInboxesStatus()

          // Atualizar contexto com novos status
          setContext(prev => {
            if (!prev) return null

            const updatedInboxes = prev.availableInboxes.map(inbox => {
              const statusResult = result.statuses.find(s => s.inboxId === inbox.id)
              if (statusResult?.success) {
                const newConnected = statusResult.status.loggedIn
                
                // Notificar mudança de status apenas para inbox ativa
                if (inbox.id === prev.inboxId) {
                  const wasConnected = previousConnectedRef.current
                  if (wasConnected !== null && wasConnected !== newConnected) {
                    if (newConnected) {
                      toast.success('WhatsApp conectado')
                    } else {
                      toast.warning('WhatsApp desconectado')
                    }
                  }
                  previousConnectedRef.current = newConnected
                }
                
                return { 
                  ...inbox, 
                  isConnected: newConnected,
                  isLoggedIn: statusResult.status.loggedIn
                }
              }
              return inbox
            })

            // Atualizar isConnected do contexto se for a inbox ativa
            const activeInboxStatus = result.statuses.find(s => s.inboxId === prev.inboxId)
            const newIsConnected = activeInboxStatus?.success 
              ? activeInboxStatus.status.loggedIn 
              : prev.isConnected

            return {
              ...prev,
              isConnected: newIsConnected,
              availableInboxes: updatedInboxes
            }
          })
        } catch (err) {
          console.error('Failed to check inbox statuses:', err)
        } finally {
          inFlightRequestRef.current = false
        }
      }

      // Executar de forma assíncrona sem bloquear
      fetchStatuses()
      
      // Retornar o contexto atual sem modificação (a atualização será feita pelo fetchStatuses)
      return currentContext
    })
  }, [])

  // Carregar contexto quando autenticado
  useEffect(() => {
    loadContext()
  }, [loadContext])

  // Configurar polling de status para TODAS as inboxes
  useEffect(() => {
    if (!enableStatusPolling || !context?.availableInboxes?.length) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    // Fazer check inicial
    checkStatus()

    pollingRef.current = setInterval(checkStatus, statusPollingInterval)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [enableStatusPolling, context?.availableInboxes?.length, statusPollingInterval, checkStatus])

  // Page Visibility API - pausar polling quando página não está visível
  // Requirements: 7.3, 7.4 (wuzapi-status-source-of-truth spec)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      isPageVisibleRef.current = isVisible
      
      console.log('[SupabaseInboxContext] Page visibility changed:', { isVisible })
      
      // Quando a página volta a ficar visível, fazer refresh imediato
      if (isVisible && enableStatusPolling && context?.availableInboxes?.length) {
        checkStatus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enableStatusPolling, context?.availableInboxes?.length, checkStatus])

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
   * Atualiza context.isConnected para refletir a primeira inbox (que será exibida)
   */
  const selectAll = useCallback(() => {
    setSelection('all')
    saveInboxSelection('all').catch(console.error)
    
    // Quando seleciona "all", usar o status da primeira inbox (que será exibida)
    setContext(prev => {
      if (!prev) return null
      const firstInbox = prev.availableInboxes[0]
      if (firstInbox) {
        console.log('[SupabaseInboxContext] selectAll - updating isConnected:', {
          firstInboxId: firstInbox.id,
          newIsConnected: firstInbox.isConnected
        })
        return {
          ...prev,
          isConnected: firstInbox.isConnected
        }
      }
      return prev
    })
  }, [])

  /**
   * Seleciona apenas uma inbox específica
   * Também atualiza context.isConnected para refletir o status da inbox selecionada
   */
  const selectSingle = useCallback((inboxId: string) => {
    setSelection([inboxId])
    saveInboxSelection([inboxId]).catch(console.error)
    
    // Atualizar context.isConnected para refletir a inbox selecionada
    setContext(prev => {
      if (!prev) return null
      const selectedInbox = prev.availableInboxes.find(inbox => inbox.id === inboxId)
      if (selectedInbox) {
        console.log('[SupabaseInboxContext] selectSingle - updating isConnected:', {
          inboxId,
          newIsConnected: selectedInbox.isConnected
        })
        return {
          ...prev,
          isConnected: selectedInbox.isConnected
        }
      }
      return prev
    })
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

  // === Sincronização de Status (connection-status-sync spec) ===
  
  /**
   * Atualiza o status de conexão de uma inbox específica
   * Chamado pelo hook useInboxConnectionData quando recebe status do WUZAPI
   * Requirements: 1.1, 2.1, 2.2 (connection-status-sync spec)
   * 
   * IMPORTANTE: Atualiza context.isConnected se:
   * 1. É a inbox ativa do backend (prev.inboxId === inboxId), OU
   * 2. É a primeira inbox selecionada na UI:
   *    - Se selection é array: selection[0] === inboxId
   *    - Se selection é 'all': primeira inbox em availableInboxes === inboxId
   * 
   * Isso garante que o header ConnectionStatus mostre o status correto
   * mesmo quando o usuário seleciona uma inbox diferente da ativa do backend.
   */
  const updateInboxStatus = useCallback((inboxId: string, status: { isConnected: boolean; isLoggedIn: boolean }) => {
    console.log('[SupabaseInboxContext] updateInboxStatus CALLED:', {
      inboxId,
      statusReceived: status,
      currentSelection: selection
    })
    
    setContext(prev => {
      if (!prev) {
        console.log('[SupabaseInboxContext] updateInboxStatus - prev is null, skipping')
        return null
      }
      
      console.log('[SupabaseInboxContext] updateInboxStatus - availableInboxes BEFORE:', 
        prev.availableInboxes.map(i => ({ id: i.id, name: i.name, isConnected: i.isConnected }))
      )
      
      // Atualizar a inbox específica em availableInboxes
      const updatedInboxes = prev.availableInboxes.map(inbox => 
        inbox.id === inboxId 
          ? { ...inbox, isConnected: status.isLoggedIn, isLoggedIn: status.isLoggedIn }
          : inbox
      )
      
      // Verificar se é a inbox ativa do backend (a que o usuário está visualizando/editando)
      const isBackendActiveInbox = prev.inboxId === inboxId
      
      // Verificar se é a inbox que está sendo exibida na UI
      // Quando selection é 'all':
      //   - No Dashboard: a primeira inbox da lista é exibida
      //   - Na página de edição: a inbox ativa do backend é exibida
      // Quando selection é array: a primeira selecionada é exibida
      let isUISelectedInbox = false
      if (selection === 'all') {
        // Quando "Todas as Caixas" está selecionado, verificar AMBOS:
        // 1. Se é a primeira inbox (exibida no dashboard)
        // 2. Se é a inbox ativa do backend (exibida na página de edição)
        const firstInbox = prev.availableInboxes[0]
        isUISelectedInbox = firstInbox?.id === inboxId || isBackendActiveInbox
      } else {
        // Quando há seleção específica, usar a primeira selecionada
        isUISelectedInbox = selection[0] === inboxId
      }
      
      // Atualizar isConnected se é a inbox relevante para exibição
      const shouldUpdateContextStatus = isBackendActiveInbox || isUISelectedInbox
      
      console.log('[SupabaseInboxContext] updateInboxStatus - decision:', {
        inboxId,
        status,
        backendActiveInboxId: prev.inboxId,
        isBackendActiveInbox,
        isUISelectedInbox,
        shouldUpdateContextStatus,
        previousContextIsConnected: prev.isConnected,
        newContextIsConnected: shouldUpdateContextStatus ? status.isLoggedIn : prev.isConnected,
        selection,
        firstAvailableInboxId: prev.availableInboxes[0]?.id
      })
      
      console.log('[SupabaseInboxContext] updateInboxStatus - availableInboxes AFTER:', 
        updatedInboxes.map(i => ({ id: i.id, name: i.name, isConnected: i.isConnected }))
      )
      
      return {
        ...prev,
        isConnected: shouldUpdateContextStatus ? status.isLoggedIn : prev.isConnected,
        availableInboxes: updatedInboxes
      }
    })
  }, [selection])

  /**
   * Força refresh imediato do status de uma inbox específica
   * Chamado após ações de conexão (connect, disconnect, logout)
   * Requirements: 7.4 (wuzapi-status-source-of-truth spec)
   */
  const refreshInboxStatus = useCallback(async (inboxId: string) => {
    try {
      const result = await getProviderInboxStatus(inboxId)
      
      if (result.success) {
        updateInboxStatus(inboxId, {
          isConnected: result.status.loggedIn,
          isLoggedIn: result.status.loggedIn
        })
      }
      
      return result
    } catch (error) {
      console.error('Failed to refresh inbox status:', error)
      return null
    }
  }, [updateInboxStatus])

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
    isLoggedIn: context.isConnected, // Usar isConnected como proxy para isLoggedIn
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
    // Sincronização de status
    updateInboxStatus,
    refreshInboxStatus,
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
