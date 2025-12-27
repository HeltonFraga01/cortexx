/**
 * AgentContext - Context for managing current agent state
 * 
 * Provides agent authentication state, permissions checking, availability management,
 * and subscription/quota/feature information.
 * 
 * IMPORTANT: This context loads features/quotas for BOTH:
 * - Agent authentication (via agent token)
 * - User authentication (via user token from AuthContext)
 * 
 * Requirements: 8.1, 8.2, 8.3, 1.1, 1.3, 1.5, 7.3
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Agent, Permission, AvailabilityStatus } from '@/types/multi-user'
import type { UserSubscription, UserFeature } from '@/types/admin-management'
import * as agentAuth from '@/services/agent-auth'
import { useAccountSummary } from '@/hooks/useAccountSummary'
import type { QuotaStatus } from '@/services/user-subscription'
import { useAuth } from '@/contexts/AuthContext'

interface AgentContextValue {
  // State
  agent: Agent | null
  account: { id: string; name: string; timezone: string; locale: string } | null
  permissions: Permission[]
  isLoading: boolean
  isAuthenticated: boolean
  
  // Subscription, Quotas, Features
  subscription: UserSubscription | null
  quotas: QuotaStatus[]
  features: UserFeature[]
  
  // Actions
  login: (accountId: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAgent: () => Promise<void>
  refreshAccountData: () => Promise<void>
  setAvailability: (status: AvailabilityStatus) => Promise<void>
  
  // Permission helpers
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  isOwner: () => boolean
  isAdmin: () => boolean
  
  // Feature and Quota helpers
  isFeatureEnabled: (featureName: string) => boolean
  checkQuota: (quotaType: string) => QuotaStatus | null
  isQuotaExceeded: (quotaType: string) => boolean
}

const AgentContext = createContext<AgentContextValue | null>(null)

interface AgentProviderProps {
  children: ReactNode
}

export function AgentProvider({ children }: AgentProviderProps) {
  // Get user authentication state from AuthContext
  const { user: authUser, isAuthenticated: isUserAuthenticated } = useAuth()
  
  // Use centralized hook for account summary (request deduplication)
  const { data: accountSummary, refetch: refetchAccountSummary } = useAccountSummary()
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [account, setAccount] = useState<{ id: string; name: string; timezone: string; locale: string } | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Derive subscription, quotas, features from hook data
  const subscription = accountSummary?.subscription ?? null
  const quotas = accountSummary?.quotas ?? []
  const features = accountSummary?.features ?? []

  // Check if user is authenticated (either as agent or as user)
  const isAuthenticated = !!agent || isUserAuthenticated

  // Load account data (subscription, quotas, features) - now just refetches the hook
  const loadAccountData = useCallback(async () => {
    try {
      await refetchAccountSummary()
    } catch (error) {
      console.error('Failed to load account data:', error)
    }
  }, [refetchAccountSummary])

  // Load current agent on mount (for agent authentication)
  useEffect(() => {
    const loadAgent = async () => {
      if (!agentAuth.isAgentAuthenticated()) {
        setIsLoading(false)
        return
      }

      try {
        const data = await agentAuth.getCurrentAgent()
        setAgent(data.agent)
        setAccount(data.account)
        setPermissions(data.permissions)
        
        // Load account data after agent is loaded
        await loadAccountData()
      } catch (error) {
        console.error('Failed to load agent:', error)
        agentAuth.setAgentToken(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadAgent()
  }, [loadAccountData])

  // Load account data when user is authenticated via AuthContext (user token)
  // This ensures features/quotas are loaded even without agent authentication
  useEffect(() => {
    if (isUserAuthenticated && !agentAuth.isAgentAuthenticated()) {
      loadAccountData()
    }
  }, [isUserAuthenticated, loadAccountData])

  // Login
  const login = useCallback(async (accountId: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await agentAuth.loginAgent(email, password)
      setAgent(data.agent)
      setAccount(data.account)
      setPermissions(data.permissions)
      
      // Load account data after login
      await loadAccountData()
    } finally {
      setIsLoading(false)
    }
  }, [loadAccountData])

  // Logout
  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      await agentAuth.logoutAgent()
    } finally {
      setAgent(null)
      setAccount(null)
      setPermissions([])
      setSubscription(null)
      setQuotas([])
      setFeatures([])
      setIsLoading(false)
    }
  }, [])

  // Refresh agent data
  const refreshAgent = useCallback(async () => {
    if (!agentAuth.isAgentAuthenticated()) return

    try {
      const data = await agentAuth.getCurrentAgent()
      setAgent(data.agent)
      setAccount(data.account)
      setPermissions(data.permissions)
    } catch (error) {
      console.error('Failed to refresh agent:', error)
    }
  }, [])

  // Refresh account data (subscription, quotas, features)
  const refreshAccountData = useCallback(async () => {
    await loadAccountData()
  }, [loadAccountData])

  // Update availability
  const setAvailability = useCallback(async (status: AvailabilityStatus) => {
    await agentAuth.updateAvailability(status)
    setAgent(prev => prev ? { ...prev, availability: status } : null)
  }, [])

  // Permission helpers
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (permissions.includes('*' as Permission)) return true
    return permissions.includes(permission)
  }, [permissions])

  const hasAnyPermission = useCallback((perms: Permission[]): boolean => {
    if (permissions.includes('*' as Permission)) return true
    return perms.some(p => permissions.includes(p))
  }, [permissions])

  const hasAllPermissions = useCallback((perms: Permission[]): boolean => {
    if (permissions.includes('*' as Permission)) return true
    return perms.every(p => permissions.includes(p))
  }, [permissions])

  const isOwner = useCallback((): boolean => {
    return agent?.role === 'owner'
  }, [agent])

  const isAdmin = useCallback((): boolean => {
    return agent?.role === 'owner' || agent?.role === 'administrator'
  }, [agent])

  // Feature helper
  const isFeatureEnabled = useCallback((featureName: string): boolean => {
    const feature = features.find(f => f.featureName === featureName)
    return feature?.enabled ?? false
  }, [features])

  // Quota helpers
  const checkQuota = useCallback((quotaType: string): QuotaStatus | null => {
    return quotas.find(q => q.quotaType === quotaType) || null
  }, [quotas])

  const isQuotaExceeded = useCallback((quotaType: string): boolean => {
    const quota = quotas.find(q => q.quotaType === quotaType)
    return quota?.exceeded ?? false
  }, [quotas])

  const value: AgentContextValue = {
    agent,
    account,
    permissions,
    isLoading,
    isAuthenticated,
    subscription,
    quotas,
    features,
    login,
    logout,
    refreshAgent,
    refreshAccountData,
    setAvailability,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwner,
    isAdmin,
    isFeatureEnabled,
    checkQuota,
    isQuotaExceeded
  }

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  )
}

/**
 * Hook to use agent context
 */
export function useAgent(): AgentContextValue {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgent must be used within an AgentProvider')
  }
  return context
}

/**
 * Alias for useAgent - for backward compatibility
 */
export const useAgentContext = useAgent

/**
 * Hook to check if agent has a specific permission
 */
export function usePermission(permission: Permission): boolean {
  const { hasPermission } = useAgent()
  return hasPermission(permission)
}

/**
 * Hook to check if agent has any of the specified permissions
 */
export function useAnyPermission(permissions: Permission[]): boolean {
  const { hasAnyPermission } = useAgent()
  return hasAnyPermission(permissions)
}

export default AgentContext
