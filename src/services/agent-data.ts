/**
 * Agent Data Service
 * 
 * Fetches data scoped to the authenticated agent (inboxes, conversations, contacts).
 */

import { getAgentToken } from './agent-auth'

const API_BASE = ''

// CSRF token cache
let csrfToken: string | null = null

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include'
    })
    const data = await response.json()
    csrfToken = data.csrfToken
    return csrfToken
  } catch (error) {
    console.error('Failed to get CSRF token:', error)
    return null
  }
}

function getRequestOptions(): RequestInit {
  const token = getAgentToken()
  return {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  }
}

async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const authToken = getAgentToken()
  const csrf = await getCsrfToken()
  
  const headers: Record<string, string> = {}
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  if (csrf) headers['CSRF-Token'] = csrf
  
  return {
    credentials: 'include' as RequestCredentials,
    headers
  }
}

// Types
export interface AgentInbox {
  id: string
  name: string
  description?: string
  channelType: string
  enableAutoAssignment: boolean
  conversationCount?: number
  unreadCount?: number
}

export interface AgentConversation {
  id: string
  contactName: string
  contactPhone: string
  lastMessage?: string
  lastMessageAt?: string
  status: 'open' | 'pending' | 'resolved' | 'snoozed'
  unreadCount: number
  inboxId: string
  inboxName?: string
  assignedAt?: string
}

export interface AgentContact {
  id: string
  name: string
  phone: string
  email?: string
  avatarUrl?: string
  lastContactAt?: string
  conversationCount?: number
}

// Inbox Status Types
export type InboxConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'not_configured' | 'not_applicable' | 'unknown'

export interface InboxStatus {
  inboxId: string
  inboxName: string
  channelType: string
  status: InboxConnectionStatus
  connected: boolean
  loggedIn: boolean
  details?: Record<string, unknown>
}

export interface InboxStatusSummary {
  total: number
  online: number
  offline: number
  connecting: number
}

/**
 * Get inboxes assigned to the current agent
 */
export async function getMyInboxes(): Promise<AgentInbox[]> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/my/inboxes`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar caixas de entrada')
  }

  return result.data || []
}

/**
 * Get conversations assigned to the current agent
 */
export async function getMyConversations(filters?: {
  status?: string
  inboxId?: string
  limit?: number
  offset?: number
}): Promise<{ conversations: AgentConversation[], total: number }> {
  const options = getRequestOptions()
  
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.inboxId) params.set('inboxId', filters.inboxId)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))

  const url = `${API_BASE}/api/agent/my/conversations${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar conversas')
  }

  return {
    conversations: result.data || [],
    total: result.total || 0
  }
}

/**
 * Get contacts accessible to the current agent
 */
export async function getMyContacts(filters?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<{ contacts: AgentContact[], total: number }> {
  const options = getRequestOptions()
  
  const params = new URLSearchParams()
  if (filters?.search) params.set('search', filters.search)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))

  const url = `${API_BASE}/api/agent/my/contacts${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar contatos')
  }

  return {
    contacts: result.data || [],
    total: result.total || 0
  }
}

/**
 * Get dashboard stats for the current agent
 */
export async function getMyStats(): Promise<{
  totalInboxes: number
  totalConversations: number
  openConversations: number
  pendingConversations: number
  totalContacts: number
}> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/my/stats`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar estatísticas')
  }

  return result.data || {
    totalInboxes: 0,
    totalConversations: 0,
    openConversations: 0,
    pendingConversations: 0,
    totalContacts: 0
  }
}

/**
 * Import contacts from WUZAPI for a specific inbox
 */
export async function importContactsFromInbox(inboxId: string): Promise<{
  contacts: AgentContact[]
  total: number
  imported: number
}> {
  const options = await getRequestOptionsWithCsrf()
  
  const response = await fetch(`${API_BASE}/api/agent/my/inboxes/${inboxId}/import-contacts`, {
    ...options,
    method: 'POST'
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao importar contatos')
  }

  return {
    contacts: result.data?.contacts || [],
    total: result.data?.total || 0,
    imported: result.data?.imported || 0
  }
}

/**
 * Get connection status for all inboxes assigned to the current agent
 * Returns status for each WhatsApp inbox and a summary
 */
export async function getMyInboxesStatus(): Promise<{
  statuses: InboxStatus[]
  summary: InboxStatusSummary
}> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/my/inboxes/status`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar status das caixas de entrada')
  }

  return {
    statuses: result.data || [],
    summary: result.summary || { total: 0, online: 0, offline: 0, connecting: 0 }
  }
}

/**
 * Get connection status for a specific inbox assigned to the current agent
 */
export async function getAgentInboxStatus(inboxId: string): Promise<InboxStatus> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/my/inboxes/${inboxId}/status`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar status da caixa de entrada')
  }

  return result.data
}
