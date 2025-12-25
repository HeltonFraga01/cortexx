/**
 * Chat Service
 * 
 * API client for chat-related endpoints
 */

import { backendApi } from '@/services/api-client'
import type {
  Conversation,
  ConversationsResponse,
  ChatMessage,
  MessagesResponse,
  Label,
  CannedResponse,
  AgentBot,
  OutgoingWebhook,
  WebhookStats,
  SearchResult,
  ConversationFilters,
  CreateBotData,
  UpdateBotData,
  CreateCannedResponseData,
  UpdateCannedResponseData,
  CreateWebhookData,
  UpdateWebhookData,
  SendTextMessageData,
  SendImageMessageData,
  SendVideoMessageData,
  SendAudioMessageData,
  SendDocumentMessageData,
  SendLocationMessageData,
  SendContactMessageData,
  MessageReaction
} from '@/types/chat'

const BASE_URL = '/chat/inbox'
const BOTS_URL = '/user/bots'
const WEBHOOKS_URL = '/user/outgoing-webhooks'

// Helper to convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

// Helper to transform object keys from snake_case to camelCase
// Exported for use in WebSocket handlers
export function transformKeys<T>(obj: any): T {
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
  return response.data?.data ?? response.data
}

// Helper to extract and transform data from API response
function extractAndTransform<T>(response: { success: boolean; data?: any; error?: string }): T {
  const data = extractData<any>(response)
  return transformKeys<T>(data)
}

// ==================== Conversations ====================

export async function getConversations(
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
  if (filters.inboxIds && filters.inboxIds.length > 0) {
    params.append('inboxIds', JSON.stringify(filters.inboxIds))
  }
  if (pagination.limit) params.append('limit', String(pagination.limit))
  if (pagination.offset) params.append('offset', String(pagination.offset))
  
  const response = await backendApi.get(`${BASE_URL}/conversations?${params}`)
  const data = extractData<any>(response)
  const conversations = transformKeys<Conversation[]>(data.conversations || data || [])
  return {
    conversations,
    pagination: data.pagination
  }
}

export async function getConversation(conversationId: string | number): Promise<Conversation> {
  const response = await backendApi.get(`${BASE_URL}/conversations/${conversationId}`)
  return extractAndTransform<Conversation>(response)
}

export async function updateConversation(
  conversationId: number,
  data: { status?: string; assignedBotId?: number | null; isMuted?: boolean; unreadCount?: number }
): Promise<Conversation> {
  const response = await backendApi.patch(`${BASE_URL}/conversations/${conversationId}`, data)
  return extractAndTransform<Conversation>(response)
}

export async function muteConversation(
  conversationId: number,
  muted: boolean
): Promise<Conversation> {
  return updateConversation(conversationId, { isMuted: muted })
}

export async function markConversationAsUnread(conversationId: number): Promise<Conversation> {
  return updateConversation(conversationId, { unreadCount: 1 })
}

export async function markConversationAsRead(conversationId: number): Promise<void> {
  const response = await backendApi.post(`${BASE_URL}/conversations/${conversationId}/read`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to mark conversation as read')
  }
}

export async function deleteConversation(conversationId: number): Promise<void> {
  const response = await backendApi.delete(`${BASE_URL}/conversations/${conversationId}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete conversation')
  }
}

// ==================== Inbox Transfer ====================

export interface TransferResult {
  conversation: Conversation
  transfer: {
    id: string
    fromInboxId: string
    toInboxId: string
    transferredAt: string
    reason?: string
  }
}

export interface TransferHistoryItem {
  id: string
  fromInbox: { id: string; name: string } | null
  toInbox: { id: string; name: string } | null
  transferredBy: { id: string; name: string } | null
  transferredAt: string
  reason?: string
}

/**
 * Transfer a conversation to another inbox
 * @param conversationId - Conversation ID to transfer
 * @param targetInboxId - Target inbox ID
 * @param reason - Optional reason for transfer
 * @returns Transfer result with updated conversation
 * 
 * Requirements: REQ-1.1, REQ-1.2, REQ-1.4
 */
export async function transferConversation(
  conversationId: number,
  targetInboxId: string,
  reason?: string
): Promise<TransferResult> {
  const response = await backendApi.patch(
    `${BASE_URL}/conversations/${conversationId}/transfer`,
    { targetInboxId, reason }
  )
  return extractAndTransform<TransferResult>(response)
}

/**
 * Get transfer history for a conversation
 * @param conversationId - Conversation ID
 * @returns List of transfers
 * 
 * Requirements: REQ-4.1, REQ-4.2
 */
export async function getTransferHistory(
  conversationId: number
): Promise<TransferHistoryItem[]> {
  const response = await backendApi.get(
    `${BASE_URL}/conversations/${conversationId}/transfers`
  )
  const data = extractData<{ transfers: TransferHistoryItem[] }>(response)
  return data.transfers || []
}

export async function searchConversations(query: string, limit = 20): Promise<Conversation[]> {
  const response = await backendApi.get(
    `${BASE_URL}/conversations/search?q=${encodeURIComponent(query)}&limit=${limit}`
  )
  return extractAndTransform<Conversation[]>(response)
}

/**
 * Start or get existing conversation with a phone number
 * Used to initiate chat from contacts page
 */
export async function startConversation(
  phone: string,
  contactInfo?: { name?: string; avatarUrl?: string }
): Promise<Conversation> {
  const response = await backendApi.post(`${BASE_URL}/conversations/start`, {
    phone,
    name: contactInfo?.name,
    avatarUrl: contactInfo?.avatarUrl
  })
  return extractAndTransform<Conversation>(response)
}

// ==================== Avatar ====================

export interface AvatarResponse {
  url: string | null
  id?: string
  type?: 'preview' | 'full'
  directPath?: string
}

/**
 * Get contact avatar/profile picture from WUZAPI
 * @param phone - Phone number (with or without country code)
 * @param preview - Whether to get preview (smaller) or full image
 */
export async function getContactAvatar(
  phone: string,
  preview = true
): Promise<AvatarResponse | null> {
  try {
    const response = await backendApi.get(
      `${BASE_URL}/avatar/${phone}?preview=${preview}`
    )
    const data = extractData<AvatarResponse | null>(response)
    return data
  } catch {
    return null
  }
}

/**
 * Fetch and update avatar for a conversation's contact
 * @param conversationId - Conversation ID
 */
export async function fetchConversationAvatar(
  conversationId: number
): Promise<{ avatarUrl: string | null; conversationId: number } | null> {
  try {
    const response = await backendApi.post(
      `${BASE_URL}/conversations/${conversationId}/fetch-avatar`
    )
    return extractData<{ avatarUrl: string | null; conversationId: number } | null>(response)
  } catch {
    return null
  }
}


// ==================== Messages ====================

export async function getMessages(
  conversationId: number,
  options: { limit?: number; before?: string; after?: string } = {}
): Promise<MessagesResponse> {
  const params = new URLSearchParams()
  if (options.limit) params.append('limit', String(options.limit))
  if (options.before) params.append('before', options.before)
  if (options.after) params.append('after', options.after)
  
  const response = await backendApi.get(
    `${BASE_URL}/conversations/${conversationId}/messages?${params}`
  )
  const data = extractData<any>(response)
  // Transform snake_case to camelCase for message fields (is_edited -> isEdited, etc.)
  const messages = transformKeys<ChatMessage[]>(data.messages || data || [])
  return {
    messages,
    pagination: data.pagination
  }
}

export async function sendTextMessage(
  conversationId: number,
  data: SendTextMessageData
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    {
      content: data.content,
      messageType: 'text',
      replyToMessageId: data.replyToMessageId
    }
  )
  return extractData<ChatMessage>(response)
}

export async function sendImageMessage(
  conversationId: number,
  data: SendImageMessageData
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    {
      content: data.caption,
      messageType: 'image',
      mediaUrl: data.image,
      mediaMimeType: data.mimeType || 'image/jpeg'
    }
  )
  return extractData<ChatMessage>(response)
}

export async function sendVideoMessage(
  conversationId: number,
  data: SendVideoMessageData
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    {
      content: data.caption,
      messageType: 'video',
      mediaUrl: data.video,
      mediaMimeType: data.mimeType || 'video/mp4'
    }
  )
  return extractData<ChatMessage>(response)
}

export async function sendAudioMessage(
  conversationId: number,
  data: SendAudioMessageData
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    {
      messageType: 'audio',
      mediaUrl: data.audio,
      mediaMimeType: data.mimeType || 'audio/ogg; codecs=opus'
    }
  )
  return extractData<ChatMessage>(response)
}

export async function sendDocumentMessage(
  conversationId: number,
  data: SendDocumentMessageData
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    {
      content: data.caption,
      messageType: 'document',
      mediaUrl: data.document,
      mediaFilename: data.filename,
      mediaMimeType: data.mimeType || 'application/octet-stream'
    }
  )
  return extractData<ChatMessage>(response)
}

export async function sendLocationMessage(
  conversationId: number,
  data: SendLocationMessageData
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    {
      content: JSON.stringify(data),
      messageType: 'location'
    }
  )
  return extractData<ChatMessage>(response)
}

export async function sendContactMessage(
  conversationId: number,
  data: SendContactMessageData
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/messages`,
    {
      content: data.vcard,
      messageType: 'contact'
    }
  )
  return extractData<ChatMessage>(response)
}

export async function searchMessagesInConversation(
  conversationId: number,
  query: string,
  limit = 50
): Promise<SearchResult[]> {
  const response = await backendApi.get(
    `${BASE_URL}/conversations/${conversationId}/messages/search?q=${encodeURIComponent(query)}&limit=${limit}`
  )
  return extractData<SearchResult[]>(response)
}

/**
 * Delete a message from a conversation
 * @param messageId - Message ID to delete
 */
export async function deleteMessage(messageId: string | number): Promise<void> {
  const response = await backendApi.delete(`${BASE_URL}/messages/${messageId}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete message')
  }
}

export async function searchMessagesGlobal(query: string, limit = 20): Promise<SearchResult[]> {
  const response = await backendApi.get(
    `${BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  )
  return extractData<SearchResult[]>(response)
}

// ==================== Private Notes ====================

export async function addPrivateNote(
  conversationId: number,
  content: string
): Promise<ChatMessage> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/notes`,
    { content }
  )
  return extractData<ChatMessage>(response)
}

export async function getPrivateNotes(conversationId: number): Promise<ChatMessage[]> {
  const response = await backendApi.get(`${BASE_URL}/conversations/${conversationId}/notes`)
  return extractData<ChatMessage[]>(response)
}

// ==================== Reactions ====================

export async function addReaction(
  messageId: number,
  emoji: string
): Promise<MessageReaction & { removed?: boolean }> {
  const response = await backendApi.post(`${BASE_URL}/messages/${messageId}/react`, { emoji })
  return extractData<MessageReaction & { removed?: boolean }>(response)
}

// ==================== Bot Assignment ====================

export async function assignBotToConversation(
  conversationId: number,
  botId: number | null
): Promise<Conversation> {
  const response = await backendApi.post(
    `${BASE_URL}/conversations/${conversationId}/assign-bot`,
    { botId }
  )
  return extractAndTransform<Conversation>(response)
}


// ==================== Labels ====================

export async function getLabels(): Promise<Label[]> {
  const response = await backendApi.get(`${BASE_URL}/labels`)
  return extractData<Label[]>(response)
}

export async function createLabel(data: { name: string; color?: string }): Promise<Label> {
  const response = await backendApi.post(`${BASE_URL}/labels`, data)
  return extractData<Label>(response)
}

export async function updateLabel(
  labelId: number,
  data: { name?: string; color?: string }
): Promise<Label> {
  const response = await backendApi.put(`${BASE_URL}/labels/${labelId}`, data)
  return extractData<Label>(response)
}

export async function deleteLabel(labelId: number): Promise<void> {
  const response = await backendApi.delete(`${BASE_URL}/labels/${labelId}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete label')
  }
}

export async function assignLabelToConversation(
  conversationId: number,
  labelId: number
): Promise<void> {
  const response = await backendApi.post(`${BASE_URL}/conversations/${conversationId}/labels`, { labelId })
  if (!response.success) {
    throw new Error(response.error || 'Failed to assign label')
  }
}

export async function removeLabelFromConversation(
  conversationId: number,
  labelId: number
): Promise<void> {
  const response = await backendApi.delete(`${BASE_URL}/conversations/${conversationId}/labels/${labelId}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to remove label')
  }
}

// ==================== Canned Responses ====================

export async function getCannedResponses(search?: string): Promise<CannedResponse[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : ''
  const response = await backendApi.get(`${BASE_URL}/canned-responses${params}`)
  return extractData<CannedResponse[]>(response)
}

export async function createCannedResponse(
  data: CreateCannedResponseData
): Promise<CannedResponse> {
  const response = await backendApi.post(`${BASE_URL}/canned-responses`, data)
  return extractData<CannedResponse>(response)
}

export async function updateCannedResponse(
  responseId: number,
  data: UpdateCannedResponseData
): Promise<CannedResponse> {
  const response = await backendApi.put(`${BASE_URL}/canned-responses/${responseId}`, data)
  return extractData<CannedResponse>(response)
}

export async function deleteCannedResponse(responseId: number): Promise<void> {
  const response = await backendApi.delete(`${BASE_URL}/canned-responses/${responseId}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete canned response')
  }
}

// ==================== Bots ====================

export async function getBots(): Promise<AgentBot[]> {
  const response = await backendApi.get(BOTS_URL)
  return extractData<AgentBot[]>(response)
}

export async function getBot(botId: number): Promise<AgentBot> {
  const response = await backendApi.get(`${BOTS_URL}/${botId}`)
  return extractData<AgentBot>(response)
}

export async function createBot(data: CreateBotData): Promise<AgentBot> {
  const response = await backendApi.post(BOTS_URL, data)
  return extractData<AgentBot>(response)
}

export async function updateBot(botId: number, data: UpdateBotData): Promise<AgentBot> {
  const response = await backendApi.put(`${BOTS_URL}/${botId}`, data)
  return extractData<AgentBot>(response)
}

export async function deleteBot(botId: number): Promise<void> {
  const response = await backendApi.delete(`${BOTS_URL}/${botId}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete bot')
  }
}

export async function pauseBot(botId: number): Promise<AgentBot> {
  const response = await backendApi.post(`${BOTS_URL}/${botId}/pause`)
  return extractData<AgentBot>(response)
}

export async function resumeBot(botId: number): Promise<AgentBot> {
  const response = await backendApi.post(`${BOTS_URL}/${botId}/resume`)
  return extractData<AgentBot>(response)
}

export async function regenerateBotToken(botId: number): Promise<AgentBot> {
  const response = await backendApi.post(`${BOTS_URL}/${botId}/regenerate-token`)
  return extractData<AgentBot>(response)
}

export async function setDefaultBot(botId: number): Promise<AgentBot> {
  const response = await backendApi.post(`${BOTS_URL}/${botId}/set-default`)
  return extractData<AgentBot>(response)
}

export async function updateBotPriorities(priorities: { id: number; priority: number }[]): Promise<AgentBot[]> {
  const response = await backendApi.put(`${BOTS_URL}/priorities`, { priorities })
  return extractData<AgentBot[]>(response)
}

// ==================== Admin-Assigned Bots ====================

export interface QuotaMetric {
  daily: number
  monthly: number
  dailyLimit: number
  monthlyLimit: number
}

export interface BotQuotaUsage {
  calls: QuotaMetric
  messages: QuotaMetric
  tokens: QuotaMetric
  dailyResetAt: string
  monthlyResetAt: string
}

export interface AssignedBot {
  id: number
  name: string
  description: string | null
  outgoingUrl: string
  includeHistory: boolean
  isDefault: boolean
  inboxAssignments: {
    inboxId: number
    inboxName: string
  }[]
  quotaUsage: BotQuotaUsage
}

/**
 * Get admin-assigned bots for current user with quota usage
 * Returns bot templates assigned to user's inboxes
 * 
 * Requirements: 9.1, 9.2, 9.3
 */
export async function getAssignedBots(): Promise<AssignedBot[]> {
  const response = await backendApi.get(`${BOTS_URL}/assigned`)
  return extractData<AssignedBot[]>(response)
}

// ==================== Outgoing Webhooks ====================

/**
 * Get outgoing webhooks, optionally filtered by inbox
 * @param inboxId - Filter by specific inbox (optional)
 * @param legacy - If true, return only legacy webhooks (inbox_id IS NULL)
 * @returns List of webhooks
 * 
 * Requirements: 4.1, 5.1
 */
export async function getOutgoingWebhooks(inboxId?: string, legacy?: boolean): Promise<OutgoingWebhook[]> {
  const params = new URLSearchParams()
  if (inboxId) params.append('inboxId', inboxId)
  if (legacy) params.append('legacy', 'true')
  
  const queryString = params.toString()
  const url = queryString ? `${WEBHOOKS_URL}?${queryString}` : WEBHOOKS_URL
  
  const response = await backendApi.get(url)
  return extractData<OutgoingWebhook[]>(response)
}

export async function getOutgoingWebhook(webhookId: number): Promise<OutgoingWebhook> {
  const response = await backendApi.get(`${WEBHOOKS_URL}/${webhookId}`)
  return extractData<OutgoingWebhook>(response)
}

/**
 * Create a new outgoing webhook
 * @param data - Webhook configuration including optional inboxId
 * @returns Created webhook
 * 
 * Requirements: 4.2, 5.1
 */
export async function createOutgoingWebhook(data: CreateWebhookData): Promise<OutgoingWebhook> {
  const response = await backendApi.post(WEBHOOKS_URL, data)
  return extractData<OutgoingWebhook>(response)
}

export async function updateOutgoingWebhook(
  webhookId: number,
  data: UpdateWebhookData
): Promise<OutgoingWebhook> {
  const response = await backendApi.put(`${WEBHOOKS_URL}/${webhookId}`, data)
  return extractData<OutgoingWebhook>(response)
}

export async function deleteOutgoingWebhook(webhookId: number): Promise<void> {
  const response = await backendApi.delete(`${WEBHOOKS_URL}/${webhookId}`)
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete webhook')
  }
}

export async function getWebhookStats(webhookId: number): Promise<WebhookStats> {
  const response = await backendApi.get(`${WEBHOOKS_URL}/${webhookId}/stats`)
  return extractData<WebhookStats>(response)
}

export async function testWebhook(webhookId: number): Promise<{ success: boolean; error?: string }> {
  const response = await backendApi.post(`${WEBHOOKS_URL}/${webhookId}/test`)
  return extractData<{ success: boolean; error?: string }>(response)
}

// ==================== Webhook Configuration ====================

export interface WebhookStatus {
  webhook: string
  events: string[]
  subscribe: string[]
  isConfigured: boolean
}

/**
 * Get current webhook configuration status
 */
export async function getWebhookStatus(): Promise<WebhookStatus> {
  const response = await backendApi.get(`${BASE_URL}/webhook/status`)
  return extractData<WebhookStatus>(response)
}

/**
 * Configure webhook to receive messages for chat inbox
 * @param webhookUrl - Optional custom webhook URL (uses server default if not provided)
 */
export async function configureWebhook(webhookUrl?: string): Promise<{ webhookUrl: string; message: string }> {
  const response = await backendApi.post(`${BASE_URL}/webhook/configure`, { webhookUrl })
  return extractData<{ webhookUrl: string; message: string }>(response)
}

// ==================== Media Download ====================

export interface MediaDownloadResponse {
  url?: string
  base64?: string
  thumbnail?: string
  mimeType?: string
  filename?: string
  isThumbnail?: boolean
  error?: string
}

/**
 * Download media for a message
 * @param messageId - Internal message ID
 * @returns Media data (URL, base64, or thumbnail)
 */
export async function downloadMedia(messageId: number): Promise<MediaDownloadResponse> {
  try {
    const response = await backendApi.get(`${BASE_URL}/messages/${messageId}/media`)
    return extractData<MediaDownloadResponse>(response)
  } catch (error) {
    // Return error response instead of throwing
    // This allows the frontend to handle gracefully
    return {
      error: error instanceof Error ? error.message : 'Failed to download media'
    }
  }
}

// ==================== Contact Attributes ====================

import type {
  ContactAttribute,
  ContactNote,
  ConversationInfo,
  PreviousConversation,
  GroupParticipant,
  Macro,
  MacroExecutionResult
} from '@/types/chat'

/**
 * Get all attributes for a contact
 */
export async function getContactAttributes(contactJid: string): Promise<ContactAttribute[]> {
  const response = await backendApi.get(`${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/attributes`)
  return extractAndTransform<ContactAttribute[]>(response)
}

/**
 * Create a new attribute for a contact
 */
export async function createContactAttribute(
  contactJid: string,
  data: { name: string; value: string }
): Promise<ContactAttribute> {
  const response = await backendApi.post(
    `${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/attributes`,
    data
  )
  return extractAndTransform<ContactAttribute>(response)
}

/**
 * Update an attribute value
 */
export async function updateContactAttribute(
  contactJid: string,
  attributeId: number,
  value: string
): Promise<ContactAttribute> {
  const response = await backendApi.put(
    `${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/attributes/${attributeId}`,
    { value }
  )
  return extractAndTransform<ContactAttribute>(response)
}

/**
 * Delete an attribute
 */
export async function deleteContactAttribute(
  contactJid: string,
  attributeId: number
): Promise<void> {
  const response = await backendApi.delete(
    `${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/attributes/${attributeId}`
  )
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete attribute')
  }
}

// ==================== Contact Notes ====================

/**
 * Get all notes for a contact
 */
export async function getContactNotes(contactJid: string): Promise<ContactNote[]> {
  const response = await backendApi.get(`${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/notes`)
  return extractAndTransform<ContactNote[]>(response)
}

/**
 * Create a new note for a contact
 */
export async function createContactNote(
  contactJid: string,
  content: string
): Promise<ContactNote> {
  const response = await backendApi.post(
    `${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/notes`,
    { content }
  )
  return extractAndTransform<ContactNote>(response)
}

/**
 * Delete a note
 */
export async function deleteContactNote(
  contactJid: string,
  noteId: number
): Promise<void> {
  const response = await backendApi.delete(
    `${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/notes/${noteId}`
  )
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete note')
  }
}

// ==================== Conversation Info ====================

/**
 * Get conversation metadata and statistics
 */
export async function getConversationInfo(conversationId: number): Promise<ConversationInfo> {
  const response = await backendApi.get(`${BASE_URL}/conversations/${conversationId}/info`)
  return extractAndTransform<ConversationInfo>(response)
}

/**
 * Get previous conversations with a contact
 */
export async function getPreviousConversations(
  contactJid: string,
  excludeId?: number
): Promise<PreviousConversation[]> {
  const params = excludeId ? `?excludeId=${excludeId}` : ''
  const response = await backendApi.get(
    `${BASE_URL}/contacts/${encodeURIComponent(contactJid)}/conversations${params}`
  )
  return extractAndTransform<PreviousConversation[]>(response)
}

// ==================== Group Participants ====================

/**
 * Get group participants
 */
export async function getGroupParticipants(conversationId: number): Promise<GroupParticipant[]> {
  const response = await backendApi.get(`${BASE_URL}/conversations/${conversationId}/participants`)
  return extractAndTransform<GroupParticipant[]>(response)
}

// ==================== Macros ====================

/**
 * Get all macros for the user
 */
export async function getMacros(): Promise<Macro[]> {
  const response = await backendApi.get(`${BASE_URL}/macros`)
  return extractAndTransform<Macro[]>(response)
}

/**
 * Execute a macro on a conversation
 */
export async function executeMacro(
  macroId: number,
  conversationId: number
): Promise<MacroExecutionResult> {
  const response = await backendApi.post(`${BASE_URL}/macros/${macroId}/execute`, { conversationId })
  return extractData<MacroExecutionResult>(response)
}

// ==================== Bot Test Chat ====================

/**
 * Bot test session response
 */
export interface BotTestSession {
  conversationId: number
  botId: number
  botName: string
  simulatedJid: string
  includeHistory: boolean
  quotaUsage: BotTestQuotaUsage
}

/**
 * Bot test message
 */
export interface BotTestMessage {
  id: string
  text: string
  timestamp: number
  fromMe: boolean
}

/**
 * Bot test quota usage
 */
export interface BotTestQuotaUsage {
  calls: {
    daily: number
    dailyLimit: number
  }
  messages: {
    daily: number
    dailyLimit: number
  }
  tokens: {
    daily: number
    dailyLimit: number
  }
}

/**
 * Bot test message response
 */
export interface BotTestMessageResponse {
  userMessage: BotTestMessage
  botReply: BotTestMessage | null
  webhookError?: string
  quotaExceeded?: string
  error?: string
  quotaUsage: BotTestQuotaUsage
}

/**
 * Start a bot test session
 * Creates a test conversation for testing bot webhook
 * 
 * @param botId - Bot ID to test
 * @returns Test session data
 * 
 * Requirements: 1.2, 1.3, 3.1
 */
export async function startBotTest(botId: number): Promise<BotTestSession> {
  const response = await backendApi.post(`${BOTS_URL}/${botId}/test/start`)
  return extractData<BotTestSession>(response)
}

/**
 * Send a test message to the bot
 * Forwards message to bot webhook and returns response
 * 
 * @param botId - Bot ID
 * @param conversationId - Test conversation ID
 * @param message - Message text to send
 * @returns Message response with bot reply
 * 
 * Requirements: 2.1, 2.2, 3.1, 6.1
 */
export async function sendBotTestMessage(
  botId: number,
  conversationId: number,
  message: string
): Promise<BotTestMessageResponse> {
  const response = await backendApi.post(`${BOTS_URL}/${botId}/test/message`, {
    conversationId,
    message
  })
  return extractData<BotTestMessageResponse>(response)
}

/**
 * End a bot test session
 * Archives the test conversation
 * 
 * @param botId - Bot ID
 * @param conversationId - Test conversation ID
 * 
 * Requirements: 1.5
 */
export async function endBotTest(botId: number, conversationId: number): Promise<void> {
  const response = await backendApi.post(`${BOTS_URL}/${botId}/test/end`, {
    conversationId
  })
  if (!response.success) {
    throw new Error(response.error || 'Failed to end test session')
  }
}

/**
 * Clear bot test conversation history
 * 
 * @param botId - Bot ID
 * @param conversationId - Test conversation ID
 * 
 * Requirements: 6.4
 */
export async function clearBotTestHistory(botId: number, conversationId: number): Promise<void> {
  const response = await backendApi.delete(`${BOTS_URL}/${botId}/test/history`, {
    data: { conversationId }
  })
  if (!response.success) {
    throw new Error(response.error || 'Failed to clear test history')
  }
}

/**
 * Get messages from a bot test conversation
 * 
 * @param botId - Bot ID
 * @param conversationId - Test conversation ID
 * @returns Array of test messages
 */
export async function getBotTestMessages(
  botId: number,
  conversationId: number
): Promise<BotTestMessage[]> {
  const response = await backendApi.get(
    `${BOTS_URL}/${botId}/test/messages?conversationId=${conversationId}`
  )
  return extractData<BotTestMessage[]>(response)
}
