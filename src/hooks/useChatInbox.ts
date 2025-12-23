/**
 * useChatInbox - Unified hook for inbox context in chat
 * 
 * Works with both SupabaseInboxContext (user) and AgentInboxContext (agent)
 * Automatically detects which context is available
 * 
 * Updated for unified-inbox-selector spec - now uses multi-select from context
 */

import { useContext, useMemo } from 'react'
import { useSupabaseInboxOptional } from '@/contexts/SupabaseInboxContext'
import AgentInboxContext from '@/contexts/AgentInboxContext'
import type { Inbox } from '@/types/multi-user'

interface ChatInboxValue {
  // Lista de inboxes disponíveis
  inboxes: Inbox[]
  
  // Seleção múltipla (novo)
  selectedInboxIds: string[]
  isAllSelected: boolean
  
  // Estado
  isLoading: boolean
  
  // Ações de seleção múltipla
  selectAll: () => void
  selectSingle: (inboxId: string) => void
  toggleInbox: (inboxId: string) => void
  isInboxSelected: (inboxId: string) => boolean
  getSelectedCount: () => number
  
  // Estatísticas agregadas
  totalUnreadCount: number
  hasDisconnectedInbox: boolean
  
  // Refresh
  refreshInboxes: () => Promise<void>
}

/**
 * Hook that works with both user and agent inbox contexts
 * Tries SupabaseInboxContext first, then falls back to AgentInboxContext
 */
export function useChatInbox(): ChatInboxValue {
  const supabaseContext = useSupabaseInboxOptional()
  const agentContext = useContext(AgentInboxContext)
  
  // Prefer Supabase context if available (user context)
  if (supabaseContext && supabaseContext.context) {
    return {
      inboxes: supabaseContext.availableInboxes.map(inbox => ({
        id: inbox.id,
        name: inbox.name,
        phoneNumber: inbox.phoneNumber || '',
        isConnected: inbox.isConnected,
        isPrimary: inbox.isPrimary || false,
        unreadCount: inbox.unreadCount || 0
      })),
      selectedInboxIds: supabaseContext.selectedInboxIds,
      isAllSelected: supabaseContext.isAllSelected,
      isLoading: supabaseContext.isLoading,
      selectAll: supabaseContext.selectAll,
      selectSingle: supabaseContext.selectSingle,
      toggleInbox: supabaseContext.toggleInbox,
      isInboxSelected: supabaseContext.isInboxSelected,
      getSelectedCount: supabaseContext.getSelectedCount,
      totalUnreadCount: supabaseContext.totalUnreadCount,
      hasDisconnectedInbox: supabaseContext.hasDisconnectedInbox,
      refreshInboxes: supabaseContext.refreshContext
    }
  }
  
  // Fall back to agent context
  if (agentContext) {
    // Agent context uses single selection, adapt to multi-select interface
    const currentInboxId = agentContext.currentInbox?.id || null
    const selectedIds = currentInboxId ? [currentInboxId] : []
    
    return {
      inboxes: agentContext.inboxes.map(inbox => ({
        id: inbox.id,
        name: inbox.name,
        phoneNumber: inbox.phoneNumber || '',
        isConnected: inbox.isConnected || false,
        isPrimary: inbox.isPrimary || false,
        unreadCount: inbox.unreadCount || 0
      })),
      selectedInboxIds: selectedIds,
      isAllSelected: selectedIds.length === agentContext.inboxes.length,
      isLoading: agentContext.isLoading,
      selectAll: () => {
        // Agent context doesn't support multi-select, select first inbox
        if (agentContext.inboxes.length > 0) {
          agentContext.setCurrentInbox(agentContext.inboxes[0])
        }
      },
      selectSingle: (inboxId: string) => {
        const inbox = agentContext.inboxes.find(i => i.id === inboxId)
        if (inbox) {
          agentContext.setCurrentInbox(inbox)
        }
      },
      toggleInbox: (inboxId: string) => {
        // Agent context doesn't support multi-select, just select the inbox
        const inbox = agentContext.inboxes.find(i => i.id === inboxId)
        if (inbox) {
          agentContext.setCurrentInbox(inbox)
        }
      },
      isInboxSelected: (inboxId: string) => currentInboxId === inboxId,
      getSelectedCount: () => currentInboxId ? 1 : 0,
      totalUnreadCount: agentContext.inboxes.reduce((sum, i) => sum + (i.unreadCount || 0), 0),
      hasDisconnectedInbox: agentContext.inboxes.some(i => !i.isConnected),
      refreshInboxes: agentContext.refreshInboxes
    }
  }
  
  // Return empty state if no context available
  return {
    inboxes: [],
    selectedInboxIds: [],
    isAllSelected: true,
    isLoading: false,
    selectAll: () => {},
    selectSingle: () => {},
    toggleInbox: () => {},
    isInboxSelected: () => false,
    getSelectedCount: () => 0,
    totalUnreadCount: 0,
    hasDisconnectedInbox: false,
    refreshInboxes: async () => {}
  }
}

export default useChatInbox
