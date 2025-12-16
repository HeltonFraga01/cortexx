/**
 * Conversation Cache Utilities
 * 
 * Helper functions for updating conversation state in TanStack Query cache
 * Used for optimistic updates to provide immediate UI feedback
 * 
 * Requirements: 5.1, 5.5
 */

import type { Conversation, ConversationStatus, Label } from '@/types/chat'

interface ConversationsResponse {
  conversations: Conversation[]
  pagination?: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * Updates a single conversation in the cache with partial updates
 * @param data - Current cache data
 * @param conversationId - ID of conversation to update
 * @param updates - Partial conversation updates to apply
 * @returns Updated cache data
 */
export function updateConversationInCache(
  data: ConversationsResponse | undefined,
  conversationId: number,
  updates: Partial<Conversation>
): ConversationsResponse | undefined {
  if (!data) return data

  return {
    ...data,
    conversations: data.conversations.map(conv =>
      conv.id === conversationId ? { ...conv, ...updates } : conv
    )
  }
}

/**
 * Adds a label to a conversation in the cache
 * @param data - Current cache data
 * @param conversationId - ID of conversation to update
 * @param label - Label to add
 * @returns Updated cache data
 */
export function addLabelToConversationInCache(
  data: ConversationsResponse | undefined,
  conversationId: number,
  label: Label
): ConversationsResponse | undefined {
  if (!data) return data

  return {
    ...data,
    conversations: data.conversations.map(conv => {
      if (conv.id !== conversationId) return conv
      
      // Check if label already exists
      const existingLabels = conv.labels || []
      if (existingLabels.some(l => l.id === label.id)) {
        return conv
      }
      
      return {
        ...conv,
        labels: [...existingLabels, label]
      }
    })
  }
}

/**
 * Removes a label from a conversation in the cache
 * @param data - Current cache data
 * @param conversationId - ID of conversation to update
 * @param labelId - ID of label to remove
 * @returns Updated cache data
 */
export function removeLabelFromConversationInCache(
  data: ConversationsResponse | undefined,
  conversationId: number,
  labelId: number
): ConversationsResponse | undefined {
  if (!data) return data

  return {
    ...data,
    conversations: data.conversations.map(conv => {
      if (conv.id !== conversationId) return conv
      
      return {
        ...conv,
        labels: (conv.labels || []).filter(l => l.id !== labelId)
      }
    })
  }
}

/**
 * Updates conversation muted state in cache
 * @param data - Current cache data
 * @param conversationId - ID of conversation to update
 * @param isMuted - New muted state
 * @returns Updated cache data
 */
export function updateConversationMutedInCache(
  data: ConversationsResponse | undefined,
  conversationId: number,
  isMuted: boolean
): ConversationsResponse | undefined {
  return updateConversationInCache(data, conversationId, { isMuted })
}

/**
 * Updates conversation status in cache
 * @param data - Current cache data
 * @param conversationId - ID of conversation to update
 * @param status - New status
 * @returns Updated cache data
 */
export function updateConversationStatusInCache(
  data: ConversationsResponse | undefined,
  conversationId: number,
  status: ConversationStatus
): ConversationsResponse | undefined {
  return updateConversationInCache(data, conversationId, { status })
}

/**
 * Updates conversation bot assignment in cache
 * @param data - Current cache data
 * @param conversationId - ID of conversation to update
 * @param assignedBotId - New bot ID (null to remove)
 * @param assignedBot - Bot object (null if removing)
 * @returns Updated cache data
 */
export function updateConversationBotInCache(
  data: ConversationsResponse | undefined,
  conversationId: number,
  assignedBotId: number | null,
  assignedBot: { id: number; name: string; avatarUrl: string | null } | null = null
): ConversationsResponse | undefined {
  return updateConversationInCache(data, conversationId, { 
    assignedBotId, 
    assignedBot 
  })
}

/**
 * Gets a single conversation from cache by ID
 * @param data - Current cache data
 * @param conversationId - ID of conversation to find
 * @returns Conversation or undefined
 */
export function getConversationFromCache(
  data: ConversationsResponse | undefined,
  conversationId: number
): Conversation | undefined {
  if (!data) return undefined
  return data.conversations.find(conv => conv.id === conversationId)
}
