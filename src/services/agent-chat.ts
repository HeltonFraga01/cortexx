/**
 * Agent Chat Service
 * 
 * API client for agent chat endpoints - uses Bearer token authentication
 * instead of session cookies.
 */

import { getAgentToken } from './agent-auth'
import type {
  Conversation,
  ConversationsResponse,
  ChatMessage,
  MessagesResponse,
  Label,
  CannedResponse,
  ConversationFilters,
  ContactAttribute,
  ContactNote,
  ConversationInfo,
  PrivateNote,
  GroupParticipant,
  SendLocationMessageData
} from '@/types/chat'

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

// Helper to get request options with agent token
function getRequestOptions(): RequestInit {
  const token = getAgentToken()
  return {
    headers: token ? { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    }
  }
}

// Helper to get request options with agent token AND CSRF token for POST/PATCH/DELETE
async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const authToken = getAgentToken()
  const csrf = await getCsrfToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  if (csrf) headers['CSRF-Token'] = csrf
  
  return {
    credentials: 'include' as RequestCredentials,
    headers
  }
}

// Helper to convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// Helper to transform object keys from snake_case to camelCase
function transformKeys<T>(obj: any): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item)) as T
  }
  if (typeof obj === 'object') {
    const transformed: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = snakeToCamel(key)
        transformed[camelKey] = transformKeys(obj[key])
      }
    }
    return transformed as T
  }
  return obj
}

// Helper to extract data from API response
function extractData<T>(response: { success: boolean; data?: any; error?: string }): T {
  if (!response.success) {
    throw new Error(response.error || 'API request failed')
  }
  return response.data
}

// ==================== Conversations ====================

export async function getAgentConversations(
  filters: ConversationFilters = {},
  pagination: { limit?: number; offset?: number } = {}
): Promise<ConversationsResponse> {
  const params = new URLSearchParams()
  
  if (filters.status) params.append('status', filters.status)
  if (filters.hasUnread) params.append('hasUnread', 'true')
  if (filters.assignedBotId) params.append('assignedBotId', String(filters.assignedBotId))
  if (filters.labelId) params.append('labelId', String(filters.labelId))
  if (filters.search) params.append('search', filters.search)
  if (filters.inboxId) params.append('inboxId', String(filters.inboxId))
  if (pagination.limit) params.append('limit', String(pagination.limit))
  if (pagination.offset) params.append('offset', String(pagination.offset))
  
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations?${params}`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar conversas')
  }
  
  const conversations = transformKeys<Conversation[]>(result.data || [])
  return {
    conversations,
    pagination: result.pagination
  }
}

export async function getAgentConversation(conversationId: number): Promise<Conversation> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar conversa')
  }
  
  return transformKeys<Conversation>(result.data)
}

export async function updateAgentConversation(
  conversationId: number,
  data: { status?: string; assignedBotId?: number | null; isMuted?: boolean }
): Promise<Conversation> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}`, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data)
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atualizar conversa')
  }
  
  return transformKeys<Conversation>(result.data)
}

export async function markAgentConversationAsRead(conversationId: number): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}/read`, {
    ...options,
    method: 'POST'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao marcar como lida')
  }
}

export async function searchAgentConversations(query: string, limit = 20): Promise<Conversation[]> {
  const options = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    options
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar conversas')
  }
  
  return transformKeys<Conversation[]>(result.data || [])
}

/**
 * Start or get existing conversation with a phone number
 * Used to initiate chat from contacts page
 */
export async function startAgentConversation(
  phone: string,
  contactInfo?: { name?: string; avatarUrl?: string }
): Promise<Conversation> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/start`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({
      phone,
      name: contactInfo?.name,
      avatarUrl: contactInfo?.avatarUrl
    })
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao iniciar conversa')
  }
  
  return transformKeys<Conversation>(result.data)
}

// ==================== Messages ====================

export async function getAgentMessages(
  conversationId: number,
  options: { limit?: number; before?: string; after?: string } = {}
): Promise<MessagesResponse> {
  const params = new URLSearchParams()
  if (options.limit) params.append('limit', String(options.limit))
  if (options.before) params.append('before', options.before)
  if (options.after) params.append('after', options.after)
  
  const reqOptions = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/messages?${params}`,
    reqOptions
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar mensagens')
  }
  
  const messages = transformKeys<ChatMessage[]>(result.data || [])
  return {
    messages,
    pagination: result.pagination
  }
}

export async function sendAgentTextMessage(
  conversationId: number,
  data: { content: string; replyToMessageId?: string }
): Promise<ChatMessage> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}/messages`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({
      content: data.content,
      messageType: 'text',
      replyToMessageId: data.replyToMessageId
    })
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao enviar mensagem')
  }
  
  return transformKeys<ChatMessage>(result.data)
}

export async function sendAgentImageMessage(
  conversationId: number,
  data: { image: string; caption?: string; mimeType?: string }
): Promise<ChatMessage> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}/messages`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({
      content: data.caption,
      messageType: 'image',
      mediaUrl: data.image,
      mediaMimeType: data.mimeType || 'image/jpeg'
    })
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao enviar imagem')
  }
  
  return transformKeys<ChatMessage>(result.data)
}

export async function sendAgentDocumentMessage(
  conversationId: number,
  data: { document: string; filename?: string; caption?: string; mimeType?: string }
): Promise<ChatMessage> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}/messages`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({
      content: data.caption,
      messageType: 'document',
      mediaUrl: data.document,
      mediaFilename: data.filename,
      mediaMimeType: data.mimeType || 'application/octet-stream'
    })
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao enviar documento')
  }
  
  return transformKeys<ChatMessage>(result.data)
}

export async function sendAgentAudioMessage(
  conversationId: number,
  data: { audio: string; mimeType?: string }
): Promise<ChatMessage> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}/messages`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({
      messageType: 'audio',
      mediaUrl: data.audio,
      mediaMimeType: data.mimeType || 'audio/ogg; codecs=opus'
    })
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao enviar áudio')
  }
  
  return transformKeys<ChatMessage>(result.data)
}

// ==================== Labels ====================

export async function getAgentLabels(): Promise<Label[]> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/chat/labels`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar etiquetas')
  }
  
  return result.data || []
}

export async function assignAgentLabelToConversation(
  conversationId: number,
  labelId: number
): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}/labels`, {
    ...options,
    method: 'POST',
    body: JSON.stringify({ labelId })
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atribuir etiqueta')
  }
}

export async function removeAgentLabelFromConversation(
  conversationId: number,
  labelId: number
): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/agent/chat/conversations/${conversationId}/labels/${labelId}`, {
    ...options,
    method: 'DELETE'
  })
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao remover etiqueta')
  }
}

// ==================== Canned Responses ====================

export async function getAgentCannedResponses(search?: string): Promise<CannedResponse[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : ''
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/chat/canned-responses${params}`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar respostas rápidas')
  }
  
  return result.data || []
}

// ==================== Media ====================

export interface MediaDownloadResponse {
  url?: string
  base64?: string
  thumbnail?: string
  mimeType?: string
  filename?: string
  isThumbnail?: boolean
  error?: string
}

export async function downloadAgentMedia(messageId: number): Promise<MediaDownloadResponse> {
  try {
    const options = getRequestOptions()
    const response = await fetch(`${API_BASE}/api/agent/chat/messages/${messageId}/media`, options)
    const result = await response.json()
    
    if (!response.ok) {
      return { error: result.error || 'Falha ao baixar mídia' }
    }
    
    return result.data || {}
  } catch {
    return { error: 'Falha ao baixar mídia' }
  }
}

// ==================== Contact Info ====================

export async function getAgentContactAttributes(contactJid: string): Promise<ContactAttribute[]> {
  const options = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/attributes`,
    options
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar atributos')
  }
  
  return transformKeys<ContactAttribute[]>(result.data || [])
}

export async function getAgentContactNotes(contactJid: string): Promise<ContactNote[]> {
  const options = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/notes`,
    options
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar notas')
  }
  
  return transformKeys<ContactNote[]>(result.data || [])
}

export async function createAgentContactNote(
  contactJid: string,
  content: string
): Promise<ContactNote> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/notes`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify({ content })
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao criar nota')
  }
  
  return transformKeys<ContactNote>(result.data)
}

export async function getAgentConversationInfo(conversationId: number): Promise<ConversationInfo> {
  const options = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/info`,
    options
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar informações')
  }
  
  return transformKeys<ConversationInfo>(result.data)
}

// ==================== Avatar ====================

export interface FetchAvatarResponse {
  avatarUrl?: string
  conversationId?: number
}

export async function fetchAgentConversationAvatar(
  conversationId: number
): Promise<FetchAvatarResponse | null> {
  try {
    const options = await getRequestOptionsWithCsrf()
    const response = await fetch(
      `${API_BASE}/api/agent/chat/conversations/${conversationId}/fetch-avatar`,
      {
        ...options,
        method: 'POST'
      }
    )
    const result = await response.json()
    
    if (!response.ok) {
      return null
    }
    
    return result.data || null
  } catch {
    return null
  }
}

// ==================== Assignment ====================

export interface TransferableAgent {
  id: string
  name: string
  avatarUrl?: string
  availability: 'online' | 'busy' | 'offline'
  conversationCount: number
}

export interface PickupResponse {
  conversationId: number
  agentId: string
}

export interface TransferResponse {
  conversationId: number
  targetAgentId: string
  warning?: string
}

export interface ReleaseResponse {
  conversationId: number
}

/**
 * Pickup an unassigned conversation
 * Requirements: 2.3
 */
export async function pickupAgentConversation(conversationId: number): Promise<PickupResponse> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/pickup`,
    {
      ...options,
      method: 'POST'
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Conversa já foi atribuída a outro agente')
    }
    throw new Error(result.error || 'Falha ao pegar conversa')
  }
  
  return result.data
}

/**
 * Transfer conversation to another agent
 * Requirements: 5.1
 */
export async function transferAgentConversation(
  conversationId: number,
  targetAgentId: string
): Promise<TransferResponse> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/transfer`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify({ targetAgentId })
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao transferir conversa')
  }
  
  return result.data
}

/**
 * Release conversation back to pool
 * Requirements: 6.1
 */
export async function releaseAgentConversation(conversationId: number): Promise<ReleaseResponse> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/release`,
    {
      ...options,
      method: 'POST'
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao liberar conversa')
  }
  
  return result.data
}

/**
 * Get agents available for transfer
 */
export async function getTransferableAgents(conversationId: number): Promise<TransferableAgent[]> {
  const options = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/transferable-agents`,
    options
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar agentes')
  }
  
  return transformKeys<TransferableAgent[]>(result.data || [])
}

// ==================== Bots ====================

export interface AgentBotInfo {
  id: number
  name: string
  description?: string
  avatarUrl?: string
  status: string
}

/**
 * Get available bots from the account owner
 * Agents can see bots to assign/remove from conversations
 */
export async function getAgentBots(): Promise<AgentBotInfo[]> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/chat/bots`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar bots')
  }
  
  return transformKeys<AgentBotInfo[]>(result.data || [])
}

/**
 * Assign or remove a bot from a conversation
 * @param conversationId - Conversation ID
 * @param botId - Bot ID to assign, or null to remove
 */
export async function assignAgentBotToConversation(
  conversationId: number,
  botId: number | null
): Promise<Conversation> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/assign-bot`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify({ botId })
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atribuir bot')
  }
  
  return transformKeys<Conversation>(result.data)
}

// ==================== Macros ====================

export interface AgentMacro {
  id: number
  name: string
  description?: string
  actions: Array<{
    id: number
    actionType: string
    params: Record<string, unknown>
    actionOrder: number
  }>
}

export interface MacroExecutionResult {
  macro: string
  results: Array<{
    action: string
    success: boolean
    error?: string
  }>
}

/**
 * Get all macros from the account owner
 */
export async function getAgentMacros(): Promise<AgentMacro[]> {
  const options = getRequestOptions()
  const response = await fetch(`${API_BASE}/api/agent/chat/macros`, options)
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar macros')
  }
  
  return transformKeys<AgentMacro[]>(result.data || [])
}

/**
 * Execute a macro on a conversation
 */
export async function executeAgentMacro(
  macroId: number,
  conversationId: number
): Promise<MacroExecutionResult> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/macros/${macroId}/execute`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify({ conversationId })
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao executar macro')
  }
  
  return result.data
}

// ==================== Previous Conversations ====================

export interface PreviousConversation {
  id: number
  status: string
  createdAt: string
  lastMessageAt: string
  lastMessagePreview?: string
  messageCount: number
}

/**
 * Get previous conversations with a contact
 */
export async function getAgentPreviousConversations(
  contactJid: string,
  excludeId?: number
): Promise<PreviousConversation[]> {
  const params = excludeId ? `?excludeId=${excludeId}` : ''
  const options = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/conversations${params}`,
    options
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao carregar conversas anteriores')
  }
  
  return transformKeys<PreviousConversation[]>(result.data || [])
}

// ==================== Contact Attributes CRUD ====================

/**
 * Create a contact attribute
 */
export async function createAgentContactAttribute(
  contactJid: string,
  data: { name: string; value: string }
): Promise<ContactAttribute> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/attributes`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao criar atributo')
  }
  
  return transformKeys<ContactAttribute>(result.data)
}

/**
 * Update a contact attribute
 */
export async function updateAgentContactAttribute(
  contactJid: string,
  attributeId: number,
  value: string
): Promise<ContactAttribute> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/attributes/${attributeId}`,
    {
      ...options,
      method: 'PUT',
      body: JSON.stringify({ value })
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atualizar atributo')
  }
  
  return transformKeys<ContactAttribute>(result.data)
}

/**
 * Delete a contact attribute
 */
export async function deleteAgentContactAttribute(
  contactJid: string,
  attributeId: number
): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/attributes/${attributeId}`,
    {
      ...options,
      method: 'DELETE'
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao excluir atributo')
  }
}

/**
 * Delete a contact note
 */
export async function deleteAgentContactNote(
  contactJid: string,
  noteId: number
): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/contacts/${encodeURIComponent(contactJid)}/notes/${noteId}`,
    {
      ...options,
      method: 'DELETE'
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao excluir nota')
  }
}

// ==================== Additional Conversation Operations ====================

/**
 * Mute/unmute a conversation
 */
export async function muteAgentConversation(
  conversationId: number,
  muted: boolean
): Promise<Conversation> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/mute`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify({ muted })
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao alterar silenciamento')
  }
  return result.data
}

/**
 * Delete a conversation
 */
export async function deleteAgentConversation(conversationId: number): Promise<void> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}`,
    {
      ...options,
      method: 'DELETE'
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao excluir conversa')
  }
}

// ==================== Private Notes ====================

/**
 * Add a private note to a conversation
 */
export async function addAgentPrivateNote(
  conversationId: number,
  content: string
): Promise<PrivateNote> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/notes`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify({ content })
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao adicionar nota privada')
  }
  return result.data
}

// ==================== Group Participants ====================

/**
 * Get group participants
 */
export async function getAgentGroupParticipants(conversationId: number): Promise<GroupParticipant[]> {
  const options = getRequestOptions()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/participants`,
    options
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao buscar participantes')
  }
  return result.data || []
}

// ==================== Location Messages ====================

/**
 * Send a location message
 */
export async function sendAgentLocationMessage(
  conversationId: number,
  data: SendLocationMessageData
): Promise<ChatMessage> {
  const options = await getRequestOptionsWithCsrf()
  const response = await fetch(
    `${API_BASE}/api/agent/chat/conversations/${conversationId}/messages/location`,
    {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }
  )
  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha ao enviar localização')
  }
  return result.data
}
