import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { 
  getCurrentAgent, 
  logoutAgent, 
  getAgentToken, 
  setAgentToken,
  type AgentSession 
} from '@/services/agent-auth'

interface AgentAuthContextType {
  agent: AgentSession['agent'] | null
  account: AgentSession['account'] | null
  permissions: string[]
  isAuthenticated: boolean
  isLoading: boolean
  checkAuth: () => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
}

const AgentAuthContext = createContext<AgentAuthContextType | undefined>(undefined)

export const useAgentAuth = () => {
  const context = useContext(AgentAuthContext)
  if (!context) {
    throw new Error('useAgentAuth must be used within an AgentAuthProvider')
  }
  return context
}

interface AgentAuthProviderProps {
  children: React.ReactNode
}

export const AgentAuthProvider: React.FC<AgentAuthProviderProps> = ({ children }) => {
  const [agent, setAgent] = useState<AgentSession['agent'] | null>(null)
  const [account, setAccount] = useState<AgentSession['account'] | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    const token = getAgentToken()
    
    if (!token) {
      setAgent(null)
      setAccount(null)
      setPermissions([])
      setIsLoading(false)
      return
    }

    try {
      const session = await getCurrentAgent()
      setAgent(session.agent)
      setAccount(session.account)
      setPermissions(session.permissions)
    } catch (error) {
      console.error('Agent auth check failed:', error)
      // Token is invalid, clear it
      setAgentToken(null)
      setAgent(null)
      setAccount(null)
      setPermissions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutAgent()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setAgent(null)
      setAccount(null)
      setPermissions([])
    }
  }, [])

  const hasPermission = useCallback((permission: string): boolean => {
    // Owner has all permissions
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }, [permissions])

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <AgentAuthContext.Provider
      value={{
        agent,
        account,
        permissions,
        isAuthenticated: !!agent,
        isLoading,
        checkAuth,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AgentAuthContext.Provider>
  )
}
