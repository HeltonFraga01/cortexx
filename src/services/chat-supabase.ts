/**
 * Chat Service (Supabase)
 * Task 16.3: Update frontend services to use Supabase client
 * 
 * Direct Supabase client for chat-related operations.
 * Uses RLS for data isolation and realtime for live updates.
 * 
 * Requirements: 4.1, 4.2, 6.1, 6.2, 7.1, 7.2, 8.2
 */

import { supabase, db } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

// Type aliases for convenience
type Conversation = Database['public']['Tables']['conversations']['Row']
type ConversationInsert = Database['public']['Tables']['conversations']['Insert']
type ConversationUpdate = Database['public']['Tables']['conversations']['Update']
type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert']
type Label = Database['public']['Tables']['labels']['Row']

// Response types
export interface ConversationsResponse {
  conversations: ConversationWithRelations[]
  pagination: {
    limit: number
    cursor: string | null
    hasMore: boolean
  }
}

export interface MessagesResponse {
  messages: MessageWithRelations[]
  pagination: {
    limit: number
    cursor: string | null
    hasMore: boolean
  }
}

export interface ConversationWithRelations extends Conversation {
  labels?: Label[]
  assignedAgent?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
  assignedBot?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
}

export interface MessageWithRelations extends ChatMessage {
  reactions?: {
    id: string
    emoji: string
    reactor_jid: string
    created_at: string
  }[]
  senderAgent?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
  senderBot?: {
    id: string
    name: string
    avatar_url: string | null
  } | null
}

export interface ConversationFilters {
  status?: string
  hasUnread?: boolean
  search?: string
  inboxId?: string
  assignedAgentId?: string | null
  labelId?: string
}

// ==================== Conversations ====================

/**
 * Get conversations with cursor-based pagination
 * Implements Property 15: Pagination Consistency (Requirement 8.2)
 */
export async function getConversations(
  accountId: string,
  filters: ConversationFilters = {},
  pagination: { limit?: number; cursor?: string | null } = {}
): Promise<ConversationsResponse> {
  const { limit = 20, cursor = null } = pagination
  const { status, hasUnread, search, inboxId, assignedAgentId, labelId } = filters

  let query = supabase
    .from('conversations')
    .select(`
      *,
      agents!conversations_assigned_agent_id_fkey(id, name, avatar_url),
      agent_bots!conversations_assigned_bot_id_fkey(id, name, avatar_url)
    `)
    .eq('account_id', accountId)
    .or('is_test.is.null,is_test.eq.false')

  if (status) {
    query = query.eq('status', status)
  }

  if (hasUnread) {
    query = query.gt('unread_count', 0)
  }

  if (search) {
    query = query.or(`contact_name.ilike.%${search}%,contact_jid.ilike.%${search}%`)
  }

  if (inboxId) {
    query = query.eq('inbox_id', inboxId)
  }

  if (assignedAgentId !== undefined) {
    if (assignedAgentId === null) {
      query = query.is('assigned_agent_id', null)
    } else {
      query = query.eq('assigned_agent_id', assignedAgentId)
    }
  }

  // Cursor-based pagination
  if (cursor) {
    query = query.lt('last_message_at', cursor)
  }

  query = query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(limit + 1)

  const { data, error } = await query

  if (error) throw error

  // Check if there are more results
  const hasMore = data && data.length > limit
  const results = hasMore ? data.slice(0, limit) : (data || [])

  // Get next cursor
  const nextCursor = hasMore && results.length > 0
    ? results[results.length - 1].last_message_at
    : null

  // Get labels for each conversation if labelId filter is set
  let conversationsWithLabels = results as ConversationWithRelations[]
  
  if (labelId) {
    // Filter by label
    const { data: labeledConvs } = await supabase
      .from('conversation_labels')
      .select('conversation_id')
      .eq('label_id', labelId)

    const labeledIds = new Set(labeledConvs?.map(l => l.conversation_id) || [])
    conversationsWithLabels = conversationsWithLabels.filter(c => labeledIds.has(c.id))
  }

  // Fetch labels for each conversation
  const conversationIds = conversationsWithLabels.map(c => c.id)
  if (conversationIds.length > 0) {
    const { data: labelsData } = await supabase
      .from('conversation_labels')
      .select(`
        conversation_id,
        labels(id, title, color)
      `)
      .in('conversation_id', conversationIds)

    const labelsByConversation = new Map<string, Label[]>()
    labelsData?.forEach(item => {
      const convId = item.conversation_id
      if (!labelsByConversation.has(convId)) {
        labelsByConversation.set(convId, [])
      }
      if (item.labels) {
        labelsByConversation.get(convId)!.push(item.labels as unknown as Label)
      }
    })

    conversationsWithLabels = conversationsWithLabels.map(conv => ({
      ...conv,
      labels: labelsByConversation.get(conv.id) || [],
      assignedAgent: conv.agents as ConversationWithRelations['assignedAgent'],
      assignedBot: conv.agent_bots as ConversationWithRelations['assignedBot']
    }))
  }

  return {
    conversations: conversationsWithLabels,
    pagination: {
      limit,
      cursor: nextCursor,
      hasMore
    }
  }
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(conversationId: string): Promise<ConversationWithRelations | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      agents!conversations_assigned_agent_id_fkey(id, name, avatar_url),
      agent_bots!conversations_assigned_bot_id_fkey(id, name, avatar_url)
    `)
    .eq('id', conversationId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  // Get labels
  const { data: labelsData } = await supabase
    .from('conversation_labels')
    .select('labels(id, title, color)')
    .eq('conversation_id', conversationId)

  return {
    ...data,
    labels: labelsData?.map(l => l.labels as unknown as Label).filter(Boolean) || [],
    assignedAgent: data.agents as ConversationWithRelations['assignedAgent'],
    assignedBot: data.agent_bots as ConversationWithRelations['assignedBot']
  }
}

/**
 * Get or create conversation by contact JID
 */
export async function getOrCreateConversation(
  accountId: string,
  contactJid: string,
  contactInfo?: { name?: string; avatarUrl?: string }
): Promise<ConversationWithRelations> {
  // Try to find existing
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_jid', contactJid)
    .single()

  if (existing) {
    return existing as ConversationWithRelations
  }

  // Create new
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      account_id: accountId,
      contact_jid: contactJid,
      contact_name: contactInfo?.name || contactJid.split('@')[0],
      contact_avatar_url: contactInfo?.avatarUrl || null,
      status: 'open',
      unread_count: 0
    })
    .select()
    .single()

  if (error) throw error

  return created as ConversationWithRelations
}

/**
 * Update conversation
 */
export async function updateConversation(
  conversationId: string,
  updates: ConversationUpdate
): Promise<ConversationWithRelations> {
  const { data, error } = await supabase
    .from('conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .select()
    .single()

  if (error) throw error

  return data as ConversationWithRelations
}

/**
 * Mark conversation as read
 */
export async function markConversationAsRead(conversationId: string): Promise<void> {
  // Update messages
  await supabase
    .from('chat_messages')
    .update({ status: 'read' })
    .eq('conversation_id', conversationId)
    .eq('direction', 'incoming')
    .neq('status', 'read')

  // Reset unread count
  await supabase
    .from('conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
}

/**
 * Search conversations
 */
export async function searchConversations(
  accountId: string,
  query: string,
  limit = 20
): Promise<ConversationWithRelations[]> {
  if (!query.trim()) return []

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .or(`contact_name.ilike.%${query}%,contact_jid.ilike.%${query}%`)
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data || []) as ConversationWithRelations[]
}

// ==================== Messages ====================

/**
 * Get messages with cursor-based pagination
 * Implements Property 15: Pagination Consistency (Requirement 8.2)
 */
export async function getMessages(
  conversationId: string,
  pagination: { limit?: number; cursor?: string | null } = {}
): Promise<MessagesResponse> {
  const { limit = 50, cursor = null } = pagination

  let query = supabase
    .from('chat_messages')
    .select(`
      *,
      agents!chat_messages_sender_agent_id_fkey(id, name, avatar_url),
      agent_bots!chat_messages_sender_bot_id_fkey(id, name, avatar_url)
    `)
    .eq('conversation_id', conversationId)

  // Cursor-based pagination
  if (cursor) {
    query = query.lt('timestamp', cursor)
  }

  query = query
    .order('timestamp', { ascending: false })
    .limit(limit + 1)

  const { data, error } = await query

  if (error) throw error

  // Check if there are more results
  const hasMore = data && data.length > limit
  const results = hasMore ? data.slice(0, limit) : (data || [])

  // Get next cursor
  const nextCursor = hasMore && results.length > 0
    ? results[results.length - 1].timestamp
    : null

  // Get reactions for messages
  const messageIds = results.map(m => m.id)
  const reactionsMap = new Map<string, MessageWithRelations['reactions']>()

  if (messageIds.length > 0) {
    const { data: reactions } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messageIds)

    reactions?.forEach(r => {
      if (!reactionsMap.has(r.message_id)) {
        reactionsMap.set(r.message_id, [])
      }
      reactionsMap.get(r.message_id)!.push(r)
    })
  }

  const messagesWithRelations: MessageWithRelations[] = results.map(msg => ({
    ...msg,
    reactions: reactionsMap.get(msg.id) || [],
    senderAgent: msg.agents as MessageWithRelations['senderAgent'],
    senderBot: msg.agent_bots as MessageWithRelations['senderBot']
  }))

  return {
    messages: messagesWithRelations.reverse(), // Return in chronological order
    pagination: {
      limit,
      cursor: nextCursor,
      hasMore
    }
  }
}

/**
 * Create a new message
 */
export async function createMessage(
  message: ChatMessageInsert
): Promise<MessageWithRelations> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert(message)
    .select()
    .single()

  if (error) throw error

  return data as MessageWithRelations
}

/**
 * Update message status
 */
export async function updateMessageStatus(
  messageId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('chat_messages')
    .update({ status })
    .eq('id', messageId)

  if (error) throw error
}

/**
 * Search messages in a conversation
 */
export async function searchMessages(
  conversationId: string,
  query: string,
  limit = 50
): Promise<ChatMessage[]> {
  if (!query.trim()) return []

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .ilike('content', `%${query}%`)
    .eq('is_private_note', false)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) throw error

  return data || []
}

// ==================== Labels ====================

/**
 * Get all labels for an account
 */
export async function getLabels(accountId: string): Promise<Label[]> {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .eq('account_id', accountId)
    .order('title')

  if (error) throw error

  return data || []
}

/**
 * Assign label to conversation
 */
export async function assignLabel(
  conversationId: string,
  labelId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_labels')
    .insert({ conversation_id: conversationId, label_id: labelId })

  if (error && error.code !== '23505') { // Ignore duplicate key
    throw error
  }
}

/**
 * Remove label from conversation
 */
export async function removeLabel(
  conversationId: string,
  labelId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_labels')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('label_id', labelId)

  if (error) throw error
}

// ==================== Reactions ====================

/**
 * Add or toggle reaction on a message
 */
export async function toggleReaction(
  messageId: string,
  emoji: string,
  reactorJid: string
): Promise<{ added: boolean }> {
  // Check if reaction exists
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('emoji', emoji)
    .eq('reactor_jid', reactorJid)
    .single()

  if (existing) {
    // Remove reaction
    await supabase
      .from('message_reactions')
      .delete()
      .eq('id', existing.id)
    return { added: false }
  } else {
    // Add reaction
    await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, emoji, reactor_jid: reactorJid })
    return { added: true }
  }
}

// ==================== Private Notes ====================

/**
 * Add private note to conversation
 */
export async function addPrivateNote(
  conversationId: string,
  content: string,
  senderAgentId?: string
): Promise<MessageWithRelations> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      message_id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      direction: 'outgoing',
      message_type: 'text',
      content,
      is_private_note: true,
      sender_type: 'user',
      sender_agent_id: senderAgentId,
      status: 'sent',
      timestamp: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error

  return data as MessageWithRelations
}

/**
 * Get private notes for a conversation
 */
export async function getPrivateNotes(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('is_private_note', true)
    .order('timestamp', { ascending: false })

  if (error) throw error

  return data || []
}

// ==================== Canned Responses ====================

/**
 * Get canned responses for an account
 */
export async function getCannedResponses(
  accountId: string,
  search?: string
): Promise<Database['public']['Tables']['canned_responses']['Row'][]> {
  let query = supabase
    .from('canned_responses')
    .select('*')
    .eq('account_id', accountId)

  if (search) {
    query = query.or(`short_code.ilike.%${search}%,content.ilike.%${search}%`)
  }

  query = query.order('short_code')

  const { data, error } = await query

  if (error) throw error

  return data || []
}

// ==================== Export all functions ====================

export const chatSupabase = {
  // Conversations
  getConversations,
  getConversation,
  getOrCreateConversation,
  updateConversation,
  markConversationAsRead,
  searchConversations,
  
  // Messages
  getMessages,
  createMessage,
  updateMessageStatus,
  searchMessages,
  
  // Labels
  getLabels,
  assignLabel,
  removeLabel,
  
  // Reactions
  toggleReaction,
  
  // Private Notes
  addPrivateNote,
  getPrivateNotes,
  
  // Canned Responses
  getCannedResponses
}

export default chatSupabase
