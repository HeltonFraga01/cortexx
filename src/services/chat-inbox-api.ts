/**
 * Chat Inbox API Service
 * 
 * API client for inbox-specific chat operations
 * 
 * Requirements: REQ-1.1, REQ-1.2, REQ-4.1
 */

import { transferConversation, getTransferHistory } from '@/services/chat'
import type { TransferResult, TransferHistoryItem } from '@/services/chat'

export const chatInboxApi = {
  /**
   * Transfer a conversation to another inbox
   * @param conversationId - Conversation ID to transfer
   * @param targetInboxId - Target inbox ID
   * @param reason - Optional reason for transfer
   * @returns Transfer result with updated conversation
   */
  async transferConversation(
    conversationId: number,
    targetInboxId: string,
    reason?: string
  ): Promise<TransferResult> {
    return transferConversation(conversationId, targetInboxId, reason)
  },

  /**
   * Get transfer history for a conversation
   * @param conversationId - Conversation ID
   * @returns List of transfers
   */
  async getTransferHistory(conversationId: number): Promise<TransferHistoryItem[]> {
    return getTransferHistory(conversationId)
  }
}

export default chatInboxApi
