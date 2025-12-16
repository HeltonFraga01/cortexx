/**
 * AgentInboxContext - Context for managing inbox state for agents
 * 
 * Provides inbox list for current agent and current inbox selection.
 * Uses agent authentication instead of session authentication.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Inbox } from '@/types/multi-user'
import { useAgentAuth } from './AgentAuthContext'
import { getMyInboxes } from '@/services/agent-data'

interface AgentInboxContextValue {
  // State
  inboxes: Inbox[]
  currentInbox: Inbox | null
  isLoading: boolean
  
  // Actions
  setCurrentInbox: (inbox: Inbox | null) => void
  refreshInboxes: () => Promise<void>
}

const AgentInboxContext = createContext<AgentInboxContextValue | null>(null)

interface AgentInboxProviderProps {
  children: ReactNode
}

export function AgentInboxProvider({ children }: AgentInboxProviderProps) {
  const { agent, isLoading: isAuthLoading } = useAgentAuth()
  
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [currentInbox, setCurrentInbox] = useState<Inbox | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load inboxes when authenticated
  useEffect(() => {
    if (isAuthLoading || !agent) {
      return
    }

    const loadInboxes = async () => {
      setIsLoading(true)
      try {
        const data = await getMyInboxes()
        // Convert AgentInbox to Inbox format
        const formattedInboxes: Inbox[] = data.map(inbox => ({
          id: inbox.id,
          accountId: '', // Not needed for display
          name: inbox.name,
          description: inbox.description,
          channelType: inbox.channelType,
          enableAutoAssignment: inbox.enableAutoAssignment,
          autoAssignmentConfig: {},
          greetingEnabled: false,
          greetingMessage: undefined,
          createdAt: '',
          updatedAt: ''
        }))
        setInboxes(formattedInboxes)
        
        // Auto-select first inbox if none selected
        if (formattedInboxes.length > 0 && !currentInbox) {
          setCurrentInbox(formattedInboxes[0])
        }
      } catch (error) {
        console.error('Failed to load agent inboxes:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInboxes()
  }, [isAuthLoading, agent])

  // Refresh inboxes
  const refreshInboxes = useCallback(async () => {
    if (!agent) return

    setIsLoading(true)
    try {
      const data = await getMyInboxes()
      const formattedInboxes: Inbox[] = data.map(inbox => ({
        id: inbox.id,
        accountId: '',
        name: inbox.name,
        description: inbox.description,
        channelType: inbox.channelType,
        enableAutoAssignment: inbox.enableAutoAssignment,
        autoAssignmentConfig: {},
        greetingEnabled: false,
        greetingMessage: undefined,
        createdAt: '',
        updatedAt: ''
      }))
      setInboxes(formattedInboxes)
      
      // Update current inbox if it still exists
      if (currentInbox) {
        const updated = formattedInboxes.find(i => i.id === currentInbox.id)
        if (updated) {
          setCurrentInbox(updated)
        } else if (formattedInboxes.length > 0) {
          setCurrentInbox(formattedInboxes[0])
        } else {
          setCurrentInbox(null)
        }
      }
    } catch (error) {
      console.error('Failed to refresh agent inboxes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [agent, currentInbox])

  const value: AgentInboxContextValue = {
    inboxes,
    currentInbox,
    isLoading,
    setCurrentInbox,
    refreshInboxes
  }

  return (
    <AgentInboxContext.Provider value={value}>
      {children}
    </AgentInboxContext.Provider>
  )
}

/**
 * Hook to use agent inbox context
 */
export function useAgentInbox(): AgentInboxContextValue {
  const context = useContext(AgentInboxContext)
  if (!context) {
    throw new Error('useAgentInbox must be used within an AgentInboxProvider')
  }
  return context
}

export default AgentInboxContext
