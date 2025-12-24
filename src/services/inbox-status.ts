/**
 * Inbox Status Service
 * 
 * Serviço para consultar status de conexão de inboxes.
 * O status SEMPRE vem da API do Provider (WUZAPI, Evolution, etc.) como fonte única de verdade.
 * 
 * Requirements: 3.1, 3.2, 3.3, 5.2 (wuzapi-status-source-of-truth spec)
 */

import { supabase } from '@/lib/supabase'
import type {
  InboxStatusResult,
  MultipleInboxStatusResult,
  InboxStatusApiResponse,
  MultipleInboxStatusApiResponse,
  InboxStatusErrorCode
} from '@/types/inbox-status'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Helper para obter o token de acesso atual
 */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Resposta padrão para erros
 */
function errorResponse(
  inboxId: string,
  code: InboxStatusErrorCode,
  message: string
): InboxStatusResult {
  return {
    success: false,
    inboxId,
    status: { connected: false, loggedIn: false },
    source: 'error',
    error: message,
    code
  }
}

/**
 * Consulta o status de conexão de uma inbox específica
 * SEMPRE consulta o Provider API - nunca retorna dados cacheados como autoritativos
 * 
 * @param inboxId - ID da inbox
 * @returns Status de conexão da inbox
 */
export async function getInboxStatus(inboxId: string): Promise<InboxStatusResult> {
  const token = await getAccessToken()
  
  if (!token) {
    return errorResponse(inboxId, 'ACCESS_DENIED', 'Usuário não autenticado')
  }

  try {
    const response = await fetch(`${API_BASE}/api/user/inbox/${inboxId}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    })

    const data: InboxStatusApiResponse = await response.json()

    if (!response.ok || !data.success) {
      return {
        success: false,
        inboxId,
        status: { connected: false, loggedIn: false },
        source: 'error',
        error: data.error?.message || 'Erro ao consultar status',
        code: data.error?.code || 'STATUS_ERROR'
      }
    }

    return data.data || errorResponse(inboxId, 'STATUS_ERROR', 'Resposta inválida')
  } catch (error) {
    console.error('Inbox status fetch error:', error)
    return errorResponse(
      inboxId,
      'PROVIDER_UNAVAILABLE',
      error instanceof Error ? error.message : 'Erro de conexão'
    )
  }
}

/**
 * Consulta o status de conexão de todas as inboxes do usuário
 * SEMPRE consulta o Provider API para cada inbox
 * 
 * @returns Status de conexão de todas as inboxes
 */
export async function getAllInboxesStatus(): Promise<MultipleInboxStatusResult> {
  const token = await getAccessToken()
  
  if (!token) {
    return {
      statuses: [],
      totalInboxes: 0,
      connectedCount: 0,
      errorCount: 0
    }
  }

  try {
    const response = await fetch(`${API_BASE}/api/user/inboxes/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include'
    })

    const data: MultipleInboxStatusApiResponse = await response.json()

    if (!response.ok || !data.success) {
      console.error('Failed to get inboxes status:', data.error)
      return {
        statuses: [],
        totalInboxes: 0,
        connectedCount: 0,
        errorCount: 1
      }
    }

    return data.data || {
      statuses: [],
      totalInboxes: 0,
      connectedCount: 0,
      errorCount: 0
    }
  } catch (error) {
    console.error('Inboxes status fetch error:', error)
    return {
      statuses: [],
      totalInboxes: 0,
      connectedCount: 0,
      errorCount: 1
    }
  }
}

/**
 * Consulta o status de múltiplas inboxes específicas em paralelo
 * 
 * @param inboxIds - Array de IDs de inboxes
 * @returns Map de status por inbox ID
 */
export async function getMultipleInboxStatus(
  inboxIds: string[]
): Promise<Map<string, InboxStatusResult>> {
  const results = await Promise.all(
    inboxIds.map(id => getInboxStatus(id))
  )

  return new Map(results.map((result, index) => [inboxIds[index], result]))
}

/**
 * Verifica se uma inbox está conectada e pode enviar mensagens
 * 
 * @param status - Resultado do status da inbox
 * @returns true se a inbox está logada e pode enviar mensagens
 */
export function isInboxReady(status: InboxStatusResult | null): boolean {
  if (!status) return false
  return status.success && status.status.loggedIn
}

/**
 * Verifica se uma inbox precisa de autenticação (QR Code)
 * 
 * @param status - Resultado do status da inbox
 * @returns true se a inbox precisa escanear QR Code
 */
export function needsQrCode(status: InboxStatusResult | null): boolean {
  if (!status) return false
  return status.success && status.status.connected && !status.status.loggedIn
}

/**
 * Verifica se houve erro na consulta de status
 * 
 * @param status - Resultado do status da inbox
 * @returns true se houve erro
 */
export function hasStatusError(status: InboxStatusResult | null): boolean {
  if (!status) return true
  return !status.success || status.source === 'error'
}

/**
 * Obtém mensagem de status amigável para exibição
 * 
 * @param status - Resultado do status da inbox
 * @returns Mensagem de status em português
 */
export function getStatusMessage(status: InboxStatusResult | null): string {
  if (!status) return 'Status desconhecido'
  
  if (!status.success || status.source === 'error') {
    return status.error || 'Erro ao consultar status'
  }

  if (status.status.loggedIn) {
    return 'Conectado'
  }

  if (status.status.connected) {
    return 'Aguardando autenticação'
  }

  return 'Desconectado'
}

/**
 * Obtém a cor do badge de status
 * 
 * @param status - Resultado do status da inbox
 * @returns Classe CSS para a cor do badge
 */
export function getStatusColor(status: InboxStatusResult | null): string {
  if (!status || !status.success || status.source === 'error') {
    return 'bg-gray-500' // Desconhecido/Erro
  }

  if (status.status.loggedIn) {
    return 'bg-green-500' // Conectado
  }

  if (status.status.connected) {
    return 'bg-yellow-500' // Aguardando QR
  }

  return 'bg-red-500' // Desconectado
}

/**
 * Obtém o ícone de status
 * 
 * @param status - Resultado do status da inbox
 * @returns Nome do ícone Lucide
 */
export function getStatusIcon(status: InboxStatusResult | null): 'check-circle' | 'alert-circle' | 'x-circle' | 'help-circle' {
  if (!status || !status.success || status.source === 'error') {
    return 'help-circle' // Desconhecido/Erro
  }

  if (status.status.loggedIn) {
    return 'check-circle' // Conectado
  }

  if (status.status.connected) {
    return 'alert-circle' // Aguardando QR
  }

  return 'x-circle' // Desconectado
}
