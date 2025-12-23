/**
 * Account Inboxes Service
 * 
 * Handles inbox CRUD operations and agent assignment.
 */

import type {
  Inbox,
  InboxWithStats,
  InboxWithMembers,
  CreateInboxDTO,
  UpdateInboxDTO
} from '@/types/multi-user'
import { supabase } from '@/lib/supabase'

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

/**
 * Helper para obter o token de acesso Supabase
 */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

async function getRequestOptions(): Promise<RequestInit> {
  const token = await getAccessToken()
  return { 
    credentials: 'include' as RequestCredentials,
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  }
}

async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const [csrf, token] = await Promise.all([getCsrfToken(), getAccessToken()])
  const headers: Record<string, string> = {}
  if (csrf) headers['CSRF-Token'] = csrf
  if (token) headers['Authorization'] = `Bearer ${token}`
  return {
    credentials: 'include' as RequestCredentials,
    headers
  }
}

/**
 * List inboxes with stats
 */
export async function listInboxes(): Promise<InboxWithStats[]> {
  const options = await getRequestOptions()
  const response = await fetch(`${API_BASE}/api/session/inboxes`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to list inboxes')
  return result.data
}

/**
 * List inboxes for current agent (same as listInboxes for session-based auth)
 */
export async function listMyInboxes(): Promise<Inbox[]> {
  const options = await getRequestOptions()
  const response = await fetch(`${API_BASE}/api/session/inboxes`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to list my inboxes')
  return result.data
}

/**
 * Get inbox by ID with members
 */
export async function getInbox(id: string): Promise<InboxWithMembers> {
  const options = await getRequestOptions()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${id}`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get inbox')
  return result.data
}

/**
 * Create inbox
 */
export async function createInbox(data: CreateInboxDTO): Promise<Inbox> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to create inbox')
  return result.data
}


/**
 * Update inbox
 */
export async function updateInbox(id: string, data: UpdateInboxDTO): Promise<Inbox> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update inbox')
  return result.data
}

/**
 * Delete inbox
 */
export async function deleteInbox(id: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${id}`, {
    method: 'DELETE',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to delete inbox')
}

/**
 * Get inbox members
 */
export async function getInboxMembers(inboxId: string): Promise<any[]> {
  const options = await getRequestOptions()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/members`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get inbox members')
  return result.data
}

/**
 * Assign agent to inbox
 */
export async function assignAgentToInbox(inboxId: string, agentId: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/members`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify({ agentId }),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to assign agent')
}

/**
 * Assign agents to inbox (multiple)
 */
export async function assignAgentsToInbox(inboxId: string, agentIds: string[]): Promise<void> {
  for (const agentId of agentIds) {
    await assignAgentToInbox(inboxId, agentId)
  }
}

/**
 * Remove agent from inbox
 */
export async function removeAgentFromInbox(inboxId: string, agentId: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/members/${agentId}`, {
    method: 'DELETE',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to remove agent from inbox')
}

/**
 * Get QR code for WhatsApp inbox
 */
export async function getInboxQRCode(inboxId: string): Promise<{ qrCode: string | null; connected: boolean }> {
  const options = await getRequestOptions()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/qrcode`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get QR code')
  return result.data
}

/**
 * Get WhatsApp connection status for inbox
 */
export async function getInboxStatus(inboxId: string): Promise<{
  connected: boolean
  loggedIn: boolean
  status: 'connected' | 'connecting' | 'disconnected' | 'not_configured'
  details?: Record<string, unknown>
}> {
  const options = await getRequestOptions()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/status`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get inbox status')
  return result.data
}

/**
 * Create or get default inbox (user's main WhatsApp connection)
 */
export async function createDefaultInbox(): Promise<{ inbox: Inbox; isNew: boolean }> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/default`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to create default inbox')
  return { inbox: result.data, isNew: result.isNew }
}

/**
 * Connect WhatsApp session for inbox
 */
export async function connectInbox(inboxId: string, options?: { Subscribe?: string[]; Immediate?: boolean }): Promise<unknown> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/connect`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(options || {}),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to connect inbox')
  return result.data
}

/**
 * Disconnect WhatsApp session for inbox
 */
export async function disconnectInbox(inboxId: string): Promise<unknown> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/disconnect`, {
    method: 'POST',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to disconnect inbox')
  return result.data
}

/**
 * Logout WhatsApp session for inbox (removes device pairing)
 */
export async function logoutInbox(inboxId: string): Promise<unknown> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/inboxes/${inboxId}/logout`, {
    method: 'POST',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to logout inbox')
  return result.data
}
