/**
 * useInboxConnectionData Hook
 * 
 * Hook para gerenciar o carregamento de dados de conexão por inbox.
 * Carrega dados de conexão, status da sessão e webhook quando o inboxId muda.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 4.4 (inbox-connection-sync spec)
 * Enhanced for: connection-status-sync spec (1.1, 2.1, 2.2)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useSupabaseInboxOptional } from '@/contexts/SupabaseInboxContext'
import type { SessionStatus, WebhookConfig } from '@/services/wuzapi'

/**
 * Dados de conexão da inbox
 */
export interface InboxConnectionData {
  inboxId: string
  inboxName: string
  phoneNumber: string | null
  wuzapiToken: string
  wuzapiUserId: string | null
  jid: string | null
  profilePicture: string | null
  isConnected: boolean
  isLoggedIn: boolean
}

/**
 * Perfil do usuário WhatsApp
 */
export interface UserProfile {
  jid?: string
  name?: string
  profilePicture?: string
  phone?: string
}

/**
 * Opções do hook
 */
export interface UseInboxConnectionDataOptions {
  inboxId: string | null
  enabled?: boolean
}

/**
 * Retorno do hook
 */
export interface UseInboxConnectionDataReturn {
  // Dados de conexão
  connectionData: InboxConnectionData | null
  sessionStatus: SessionStatus | null
  userProfile: UserProfile
  webhookConfig: WebhookConfig
  qrCode: string
  
  // Estados
  isLoading: boolean
  error: string | null
  
  // Ações
  refetch: () => Promise<void>
  refetchStatus: () => Promise<void>
  refetchWebhook: () => Promise<void>
}

/**
 * Helper para obter o token de acesso atual
 */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Helper para fazer requisições autenticadas
 */
async function authenticatedFetch<T>(endpoint: string): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = await getAccessToken()
  
  if (!token) {
    return { success: false, error: 'Usuário não autenticado' }
  }

  try {
    const response = await fetch(`/api/user${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Erro na requisição' }
    }

    return { success: true, data: data.data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro de conexão' }
  }
}

/**
 * Hook para carregar dados de conexão de uma inbox específica
 */
export function useInboxConnectionData({
  inboxId,
  enabled = true
}: UseInboxConnectionDataOptions): UseInboxConnectionDataReturn {
  // Obter contexto para sincronização de status (connection-status-sync spec)
  const inboxContext = useSupabaseInboxOptional()
  
  // Ref para o contexto para evitar re-renders
  const inboxContextRef = useRef(inboxContext)
  inboxContextRef.current = inboxContext
  
  // Estados
  const [connectionData, setConnectionData] = useState<InboxConnectionData | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile>({})
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({ webhook: '', subscribe: [] })
  const [qrCode, setQrCode] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Ref para evitar race conditions
  const currentInboxIdRef = useRef<string | null>(null)

  /**
   * Busca dados de conexão da inbox
   */
  const fetchConnectionData = useCallback(async (id: string) => {
    const result = await authenticatedFetch<InboxConnectionData>(`/inbox/${id}/connection`)
    
    if (result.success && result.data) {
      // Verificar se ainda é a inbox atual
      if (currentInboxIdRef.current === id) {
        setConnectionData(result.data)
        setUserProfile({
          jid: result.data.jid || undefined,
          profilePicture: result.data.profilePicture || undefined,
          phone: result.data.phoneNumber
        })
      }
      return result.data
    } else {
      throw new Error(result.error || 'Erro ao buscar dados de conexão')
    }
  }, [])

  /**
   * Busca status da sessão WhatsApp
   * Enhanced for: connection-status-sync spec (1.1, 2.1, 2.2)
   */
  const fetchStatus = useCallback(async (id: string) => {
    console.log('[useInboxConnectionData] fetchStatus called for inbox:', id)
    const result = await authenticatedFetch<{ connected: boolean; loggedIn: boolean; qrCode: string | null }>(`/inbox/${id}/status`)
    
    console.log('[useInboxConnectionData] fetchStatus result:', {
      success: result.success,
      data: result.data,
      error: result.error,
      currentInboxId: currentInboxIdRef.current
    })
    
    if (result.success && result.data) {
      // Verificar se ainda é a inbox atual
      if (currentInboxIdRef.current === id) {
        const status: SessionStatus = {
          connected: result.data.connected,
          loggedIn: result.data.loggedIn
        }
        console.log('[useInboxConnectionData] Setting sessionStatus:', status)
        setSessionStatus(status)
        setQrCode(result.data.qrCode || '')
        
        // Sincronizar com contexto global usando ref (connection-status-sync spec: 1.1, 2.1, 2.2)
        const ctx = inboxContextRef.current
        if (ctx?.updateInboxStatus) {
          console.log('[useInboxConnectionData] Updating context status for inbox:', id)
          ctx.updateInboxStatus(id, {
            isConnected: result.data.connected,
            isLoggedIn: result.data.loggedIn
          })
        }
      } else {
        console.log('[useInboxConnectionData] Skipping update - inbox changed')
      }
      return result.data
    } else {
      console.error('[useInboxConnectionData] fetchStatus failed:', result.error)
      throw new Error(result.error || 'Erro ao buscar status')
    }
  }, []) // Sem dependências - usa refs

  /**
   * Busca configuração de webhook
   */
  const fetchWebhook = useCallback(async (id: string) => {
    const result = await authenticatedFetch<WebhookConfig>(`/inbox/${id}/webhook`)
    
    if (result.success && result.data) {
      // Verificar se ainda é a inbox atual
      if (currentInboxIdRef.current === id) {
        setWebhookConfig(result.data)
      }
      return result.data
    } else {
      throw new Error(result.error || 'Erro ao buscar webhook')
    }
  }, [])

  /**
   * Carrega todos os dados da inbox
   */
  const loadAllData = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    currentInboxIdRef.current = id

    console.log('[useInboxConnectionData] loadAllData called for inbox:', id)

    // Carregar dados em paralelo, mas tratar erros individualmente
    const results = await Promise.allSettled([
      fetchConnectionData(id),
      fetchStatus(id),
      fetchWebhook(id)
    ])

    // Verificar se ainda é a inbox atual
    if (currentInboxIdRef.current !== id) {
      console.log('[useInboxConnectionData] loadAllData - inbox changed, skipping state update')
      return
    }

    // Verificar se houve erros críticos (connectionData é obrigatório)
    const [connectionResult, statusResult, webhookResult] = results
    
    if (connectionResult.status === 'rejected') {
      console.error('[useInboxConnectionData] fetchConnectionData failed:', connectionResult.reason)
      setError(connectionResult.reason?.message || 'Erro ao carregar dados de conexão')
    }
    
    if (statusResult.status === 'rejected') {
      console.warn('[useInboxConnectionData] fetchStatus failed:', statusResult.reason)
      // Não setar erro global, apenas logar - status pode falhar sem impedir o resto
    }
    
    if (webhookResult.status === 'rejected') {
      console.warn('[useInboxConnectionData] fetchWebhook failed:', webhookResult.reason)
      // Não setar erro global, apenas logar
    }

    setIsLoading(false)
  }, [fetchConnectionData, fetchStatus, fetchWebhook])

  /**
   * Refetch de todos os dados
   */
  const refetch = useCallback(async () => {
    if (inboxId && enabled) {
      await loadAllData(inboxId)
    }
  }, [inboxId, enabled, loadAllData])

  /**
   * Refetch apenas do status
   */
  const refetchStatus = useCallback(async () => {
    if (inboxId && enabled) {
      try {
        await fetchStatus(inboxId)
      } catch (err) {
        console.error('Error refetching status:', err)
      }
    }
  }, [inboxId, enabled, fetchStatus])

  /**
   * Refetch apenas do webhook
   */
  const refetchWebhook = useCallback(async () => {
    if (inboxId && enabled) {
      try {
        await fetchWebhook(inboxId)
      } catch (err) {
        console.error('Error refetching webhook:', err)
      }
    }
  }, [inboxId, enabled, fetchWebhook])

  // Efeito para carregar dados quando inboxId muda
  useEffect(() => {
    if (!enabled) {
      return
    }

    if (inboxId) {
      loadAllData(inboxId)
    } else {
      // Limpar dados quando não há inbox selecionada
      currentInboxIdRef.current = null
      setConnectionData(null)
      setSessionStatus(null)
      setUserProfile({})
      setWebhookConfig({ webhook: '', subscribe: [] })
      setQrCode('')
      setError(null)
      setIsLoading(false)
    }
  }, [inboxId, enabled, loadAllData])

  return {
    connectionData,
    sessionStatus,
    userProfile,
    webhookConfig,
    qrCode,
    isLoading,
    error,
    refetch,
    refetchStatus,
    refetchWebhook
  }
}

export default useInboxConnectionData
