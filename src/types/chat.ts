/**
 * Chat Types
 * 
 * TypeScript interfaces for the chat interface
 */

// ==================== Message Types ====================

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'document' 
  | 'location' 
  | 'contact'
  | 'sticker'
  | 'reaction'
  | 'poll'
  | 'poll_vote'
  | 'view_once'
  | 'interactive'
  | 'template'
  | 'channel_comment'
  | 'deleted'
  | 'unknown'
  | 'system'

export type MessageStatus = 
  | 'sending'  // Task 7.1: Optimistic update status
  | 'pending' 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'failed'

export type MessageDirection = 'incoming' | 'outgoing'

export type SenderType = 'user' | 'contact' | 'bot' | 'system'

export interface MessageReaction {
  id: number
  emoji: string
  reactorJid: string
  createdAt: string
}

export interface ReplyToMessage {
  id: number
  messageId: string
  direction: MessageDirection
  messageType: MessageType
  content: string | null
  timestamp: string
  // Group message participant fields for quoted messages
  participantJid?: string | null
  participantName?: string | null
}

export interface PollData {
  question: string
  options: string[]
  selectableCount?: number
}

export interface InteractiveData {
  type: 'buttons' | 'list' | 'buttons_response' | 'list_response'
  text?: string
  buttonText?: string
  buttons?: { id: string; text: string }[]
  sections?: { 
    title: string
    rows: { id: string; title: string; description?: string }[] 
  }[]
  selectedId?: string
  selectedTitle?: string
}

export interface ChatMessage {
  id: number
  conversationId: number
  messageId: string
  direction: MessageDirection
  messageType: MessageType
  content: string | null
  mediaUrl: string | null
  mediaMimeType: string | null
  mediaFilename: string | null
  replyToMessageId: string | null
  replyToMessage: ReplyToMessage | null
  status: MessageStatus
  isPrivateNote: boolean
  senderType: SenderType
  senderBotId: number | null
  timestamp: string
  createdAt: string
  reactions: MessageReaction[]
  // Group message participant fields
  participantJid?: string | null
  participantName?: string | null
  isGroupMessage?: boolean
  // Special message type fields (unsupported-message-types)
  isEdited?: boolean
  isDeleted?: boolean
  pollData?: PollData | null
  interactiveData?: InteractiveData | null
}

// ==================== Conversation Types ====================

export type ConversationStatus = 'open' | 'resolved' | 'pending' | 'snoozed'

export type PresenceState = 'composing' | 'paused' | 'recording' | 'available' | 'unavailable'

export interface Label {
  id: number
  name: string
  color: string
  createdAt?: string
  usageCount?: number
}

export interface AssignedBot {
  id: number
  name: string
  avatarUrl: string | null
}

export interface AssignedAgent {
  id: string
  name: string | null
  avatarUrl: string | null
}

export interface Conversation {
  id: number
  userId: number
  contactJid: string
  contactName: string | null
  contactAvatarUrl: string | null
  lastMessageAt: string | null
  lastMessagePreview: string | null
  unreadCount: number
  assignedBotId: number | null
  assignedBot: AssignedBot | null
  assignedAgentId: string | null
  assignedAgent: AssignedAgent | null
  inboxId: string | null
  status: ConversationStatus
  isMuted: boolean
  createdAt: string
  updatedAt: string
  labels: Label[]
}

// ==================== Bot Types ====================

export type BotStatus = 'active' | 'paused'

export interface AgentBot {
  id: number
  userId: number
  name: string
  description: string | null
  avatarUrl: string | null
  outgoingUrl: string
  accessToken: string
  status: BotStatus
  priority: number
  isDefault: boolean
  includeHistory: boolean
  createdAt: string
  updatedAt: string
  assignedConversations?: number
}

export interface CreateBotData {
  name: string
  description?: string
  avatarUrl?: string
  outgoingUrl: string
  includeHistory?: boolean
}

export interface UpdateBotData {
  name?: string
  description?: string
  avatarUrl?: string
  outgoingUrl?: string
  includeHistory?: boolean
}

// ==================== Canned Response Types ====================

export interface CannedResponse {
  id: number
  shortcut: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreateCannedResponseData {
  shortcut: string
  content: string
}

export interface UpdateCannedResponseData {
  shortcut?: string
  content?: string
}

// ==================== Webhook Types ====================

export type WebhookEventType = 
  | 'message.received'
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'message.failed'
  | 'conversation.created'
  | 'conversation.updated'
  | 'reaction.added'
  | 'reaction.removed'
  | 'presence.updated'
  | 'test'
  | '*'

export interface OutgoingWebhook {
  id: number
  userId: number
  inboxId: string | null  // null for legacy global webhooks
  url: string
  events: WebhookEventType[]
  secret: string
  isActive: boolean
  successCount: number
  failureCount: number
  lastDeliveryAt: string | null
  createdAt: string
}

export interface WebhookDelivery {
  id: string
  eventType: string
  success: boolean
  attempts: number
  responseStatus: number | null
  error: string | null
  durationMs: number
  createdAt: string
}

export interface WebhookStats {
  webhook: {
    id: number
    url: string
    events: WebhookEventType[]
    isActive: boolean
    createdAt: string
    lastDeliveryAt: string | null
  }
  stats: {
    totalSuccess: number
    totalFailure: number
    recentDeliveries: number
    recentSuccess: number
    recentFailure: number
    avgDurationMs: number
  }
  recentDeliveries: WebhookDelivery[]
}

export interface CreateWebhookData {
  url: string
  events: WebhookEventType[]
  secret?: string
  inboxId?: string  // Associate webhook with specific inbox
  isActive?: boolean
}

export interface UpdateWebhookData {
  url?: string
  events?: WebhookEventType[]
  isActive?: boolean
}

// ==================== API Response Types ====================

export interface PaginationInfo {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface ConversationsResponse {
  conversations: Conversation[]
  pagination: PaginationInfo
}

export interface MessagesResponse {
  messages: ChatMessage[]
  pagination: {
    hasMore: boolean
    oldestTimestamp?: string
    newestTimestamp?: string
  }
}

export interface SearchResult {
  id: number
  conversationId: number
  messageId: string
  content: string
  timestamp: string
  contactName: string | null
  contactJid: string
}

// ==================== Send Message Types ====================

export interface SendTextMessageData {
  content: string
  replyToMessageId?: string
}

export interface SendImageMessageData {
  image: string // base64
  caption?: string
  mimeType?: string
}

export interface SendVideoMessageData {
  video: string // base64
  caption?: string
  mimeType?: string
}

export interface SendAudioMessageData {
  audio: string // base64 Opus format
  mimeType?: string
}

export interface SendDocumentMessageData {
  document: string // base64
  filename: string
  caption?: string
  mimeType?: string
}

export interface SendLocationMessageData {
  latitude: number
  longitude: number
  name?: string
}

export interface SendContactMessageData {
  vcard: string
  displayName: string
}

// ==================== WebSocket Event Types ====================

export interface TypingIndicator {
  conversationId: number
  userId: number
  isTyping: boolean
}

export interface PresenceUpdate {
  conversationId: number
  contactJid: string
  state: PresenceState
}

export interface MessageStatusUpdate {
  messageId: string
  conversationId: number
  status: MessageStatus
}

// ==================== Filter Types ====================

export type AssignmentFilter = 'all' | 'mine' | 'unassigned'

export interface ConversationFilters {
  status?: ConversationStatus
  hasUnread?: boolean
  assignedBotId?: number
  labelId?: number
  search?: string
  inboxId?: number
  inboxIds?: string[]
  assignmentFilter?: AssignmentFilter
}

// ==================== Contact Panel Types ====================

export interface ContactAttribute {
  id: number
  name: string
  value: string
  createdAt: string
  updatedAt: string
}

export interface ContactNote {
  id: number
  content: string
  createdAt: string
}

export interface ConversationInfo {
  createdAt: string
  lastActivityAt: string
  messageCount: number
  durationMinutes: number
  botAssignedAt: string | null
  labelAssignments: LabelAssignment[]
}

export interface LabelAssignment {
  labelId: number
  labelName: string
  assignedAt: string
}

export interface PreviousConversation {
  id: number
  status: ConversationStatus
  messageCount: number
  lastMessagePreview: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface GroupParticipant {
  jid: string
  name: string
  isAdmin: boolean
  isSuperAdmin: boolean
  avatarUrl: string | null
}

export type MacroActionType = 'change_status' | 'assign_bot' | 'add_label' | 'send_message'

export interface MacroAction {
  id: number
  type: MacroActionType
  params: Record<string, unknown>
  order: number
}

export interface Macro {
  id: number
  name: string
  description: string | null
  actions: MacroAction[]
  createdAt: string
  updatedAt: string
}

export interface MacroExecutionResult {
  macro: string
  results: {
    action: string
    success: boolean
    error?: string
  }[]
}

// ==================== Bot Test Chat Types ====================

/**
 * Bot test session data
 * Returned when starting a test chat session
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
 * Represents a message in the test chat
 */
export interface BotTestMessage {
  id: string
  text: string
  timestamp: number
  fromMe: boolean
}

/**
 * Bot test quota usage
 * Tracks quota consumption during testing
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
 * Returned after sending a test message
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
 * Bot test webhook payload
 * Structure sent to the bot webhook
 */
export interface BotTestPayload {
  jid: string
  message: {
    id: string
    text: string
    timestamp: number
    fromMe: boolean
  }
  conversationId: number
  userId: string | number
  history?: BotTestMessage[]
  isTest: boolean
}
