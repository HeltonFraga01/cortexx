/**
 * Inbox Context Service
 * 
 * Serviço para gerenciar o contexto de inbox do usuário autenticado via Supabase Auth.
 * 
 * Requirements: 2.2, 6.4, 7.4, 10.3, 12.2
 */

import { supabase } from '@/lib/supabase'

/**
 * Resumo de uma inbox disponível
 */
export interface InboxSummary {
  id: string
  name: string
  phoneNumber?: string
  isConnected: boolean
  isPrimary: boolean
  unreadCount?: number
  channelType?: string
}

/**
 * Contexto completo da sessão do usuário
 */
export interface SessionContext {
  // Identificação do usuário
  userId: string
  userType: 'owner' | 'agent'
  email: string
  
  // Info do agente (se aplicável)
  agentId?: string
  agentRole?: string
  
  // Info da account
  accountId: string
  accountName: string
  tenantId: string
  
  // Info da inbox ativa
  inboxId: string
  inboxName: string
  wuzapiToken: string
  instance: string
  phoneNumber?: string
  isConnected: boolean
  
  // Permissões
  permissions: string[]
  
  // Inboxes disponíveis
  availableInboxes: InboxSummary[]
}

/**
 * Status da inbox
 */
export interface InboxStatus {
  inboxId: string
  inboxName: string
  phoneNumber?: string
  isConnected: boolean
  instance: string
  lastChecked: string
}

/**
 * Resposta de erro da API
 */
interface ApiError {
  code: string
  message: string
  details?: unknown
}

/**
 * Resposta padrão da API
 */
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  message?: string
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
async function authenticatedFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAccessToken()
  
  if (!token) {
    return {
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Usuário não autenticado'
      }
    }
  }

  try {
    const response = await fetch(`/api/user${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      credentials: 'include'
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || {
          code: 'REQUEST_FAILED',
          message: data.message || 'Erro na requisição'
        }
      }
    }

    return {
      success: true,
      data: data.data,
      message: data.message
    }
  } catch (error) {
    console.error('Inbox context API error:', error)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Erro de conexão'
      }
    }
  }
}

/**
 * Obtém o contexto atual do usuário (inbox ativa, account, permissões)
 */
export async function getInboxContext(): Promise<ApiResponse<SessionContext>> {
  return authenticatedFetch<SessionContext>('/inbox-context')
}

/**
 * Troca a inbox ativa do usuário
 */
export async function switchInbox(inboxId: string): Promise<ApiResponse<SessionContext>> {
  return authenticatedFetch<SessionContext>('/inbox-context/switch', {
    method: 'POST',
    body: JSON.stringify({ inboxId })
  })
}

/**
 * Lista todas as inboxes disponíveis para o usuário
 */
export async function getAvailableInboxes(): Promise<ApiResponse<{
  inboxes: InboxSummary[]
  activeInboxId: string
  userType: 'owner' | 'agent'
  accountId: string
}>> {
  return authenticatedFetch('/inboxes/available')
}

/**
 * Obtém o status de conexão da inbox ativa
 */
export async function getInboxStatus(): Promise<ApiResponse<InboxStatus>> {
  return authenticatedFetch<InboxStatus>('/inbox-status')
}

/**
 * Força atualização do contexto (invalida cache)
 */
export async function refreshInboxContext(): Promise<ApiResponse<SessionContext>> {
  return authenticatedFetch<SessionContext>('/inbox-context/refresh', {
    method: 'POST'
  })
}

/**
 * Verifica se o usuário tem uma permissão específica
 */
export function hasPermission(context: SessionContext | null, permission: string): boolean {
  if (!context) return false
  
  const permissions = context.permissions || []
  
  // Owner tem todas as permissões
  if (permissions.includes('*')) return true
  
  return permissions.includes(permission)
}

/**
 * Verifica se o usuário pode enviar mensagens
 */
export function canSendMessages(context: SessionContext | null): boolean {
  if (!context) return false
  if (!context.isConnected) return false
  
  return hasPermission(context, 'messages:send')
}

/**
 * Verifica se o usuário pode gerenciar contatos
 */
export function canManageContacts(context: SessionContext | null): boolean {
  if (!context) return false
  
  return hasPermission(context, 'contacts:write')
}

/**
 * Verifica se o usuário pode criar campanhas
 */
export function canCreateCampaigns(context: SessionContext | null): boolean {
  if (!context) return false
  
  return hasPermission(context, 'campaigns:write')
}

/**
 * Tipo de seleção de inbox
 */
export type InboxSelection = 'all' | string[]

/**
 * Obtém a seleção de inboxes salva do usuário
 */
export async function getInboxSelection(): Promise<ApiResponse<{ selection: InboxSelection }>> {
  return authenticatedFetch<{ selection: InboxSelection }>('/inbox-selection')
}

/**
 * Salva a seleção de inboxes do usuário
 */
export async function saveInboxSelection(selection: InboxSelection): Promise<ApiResponse<{ selection: InboxSelection }>> {
  return authenticatedFetch<{ selection: InboxSelection }>('/inbox-selection', {
    method: 'POST',
    body: JSON.stringify({ selection })
  })
}
