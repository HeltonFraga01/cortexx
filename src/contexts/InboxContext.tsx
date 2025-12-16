/**
 * InboxContext - Context for managing inbox state
 * 
 * Provides inbox list for current agent and current inbox selection.
 * 
 * Requirements: 4.4
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Inbox } from '@/types/multi-user'
import * as inboxService from '@/services/account-inboxes'
import { useAgent } from './AgentContext'

interface InboxContextValue {
  // State
  inboxes: Inbox[]
  currentInbox: Inbox | null
  isLoading: boolean
  
  // Actions
  setCurrentInbox: (inbox: Inbox | null) => void
  refreshInboxes: () => Promise<void>
}

const InboxContext = createContext<InboxContextValue | null>(null)

interface InboxProviderProps {
  children: ReactNode
}

export function InboxProvider({ children }: InboxProviderProps) {
  // Try to use AgentContext, but don't fail if not available
  let isAuthenticated = false
  let agent = null
  try {
    const agentContext = useAgent()
    isAuthenticated = agentContext.isAuthenticated
    agent = agentContext.agent
  } catch {
    // AgentContext not available, use defaults
    isAuthenticated = true // Assume authenticated if no AgentContext
  }
  
  const [inboxes, setInboxes] = useState<Inbox[]>([])
  const [currentInbox, setCurrentInbox] = useState<Inbox | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load inboxes when authenticated
  useEffect(() => {
    if (!isAuthenticated || !agent) {
      setInboxes([])
      setCurrentInbox(null)
      return
    }

    const loadInboxes = async () => {
      setIsLoading(true)
      try {
        const data = await inboxService.listMyInboxes()
        setInboxes(data)
        
        // Auto-select first inbox if none selected
        if (data.length > 0 && !currentInbox) {
          setCurrentInbox(data[0])
        }
      } catch (error) {
        console.error('Failed to load inboxes:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInboxes()
  }, [isAuthenticated, agent])

  // Refresh inboxes
  const refreshInboxes = useCallback(async () => {
    if (!isAuthenticated) return

    setIsLoading(true)
    try {
      const data = await inboxService.listMyInboxes()
      setInboxes(data)
      
      // Update current inbox if it still exists
      if (currentInbox) {
        const updated = data.find(i => i.id === currentInbox.id)
        if (updated) {
          setCurrentInbox(updated)
        } else if (data.length > 0) {
          setCurrentInbox(data[0])
        } else {
          setCurrentInbox(null)
        }
      }
    } catch (error) {
      console.error('Failed to refresh inboxes:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, currentInbox])

  const value: InboxContextValue = {
    inboxes,
    currentInbox,
    isLoading,
    setCurrentInbox,
    refreshInboxes
  }

  return (
    <InboxContext.Provider value={value}>
      {children}
    </InboxContext.Provider>
  )
}

/**
 * Hook to use inbox context
 */
export function useInbox(): InboxContextValue {
  const context = useContext(InboxContext)
  if (!context) {
    throw new Error('useInbox must be used within an InboxProvider')
  }
  return context
}

export default InboxContext
