/**
 * useChatInbox - Unified hook for inbox context in chat
 * 
 * Works with both InboxContext (user) and AgentInboxContext (agent)
 * Automatically detects which context is available
 */

import { useContext } from 'react'
import InboxContext from '@/contexts/InboxContext'
import AgentInboxContext from '@/contexts/AgentInboxContext'
import type { Inbox } from '@/types/multi-user'

interface ChatInboxValue {
  inboxes: Inbox[]
  currentInbox: Inbox | null
  isLoading: boolean
  setCurrentInbox: (inbox: Inbox | null) => void
  refreshInboxes: () => Promise<void>
}

/**
 * Hook that works with both user and agent inbox contexts
 * Tries AgentInboxContext first, then falls back to InboxContext
 */
export function useChatInbox(): ChatInboxValue {
  const agentContext = useContext(AgentInboxContext)
  const userContext = useContext(InboxContext)
  
  // Prefer agent context if available
  if (agentContext) {
    return agentContext
  }
  
  // Fall back to user context
  if (userContext) {
    return userContext
  }
  
  // Return empty state if no context available
  return {
    inboxes: [],
    currentInbox: null,
    isLoading: false,
    setCurrentInbox: () => {},
    refreshInboxes: async () => {}
  }
}

export default useChatInbox
