/**
 * Account Subscription Service
 * 
 * Handles subscription and quota information for the current user.
 */

export interface Quotas {
  maxInboxes: number
  maxAgents: number
  maxTeams: number
  maxConnections: number
  maxMessagesPerDay?: number
  maxMessagesPerMonth?: number
  maxWebhooks?: number
  maxCampaigns?: number
  maxStorageMb?: number
}

export interface Usage {
  inboxes: number
  agents: number
  teams: number
}

export interface Plan {
  id: string
  name: string
  priceCents: number
  billingCycle: string
  quotas: Quotas
  features: Record<string, boolean>
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended'
  startedAt: string
  trialEndsAt?: string
  currentPeriodStart: string
  currentPeriodEnd: string
  canceledAt?: string
  plan?: Plan
}

export interface SubscriptionData {
  subscription: Subscription | null
  usage: Usage
  quotas: Quotas
}

const API_BASE = ''

// CSRF token cache
let csrfToken: string | null = null

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include'
    })
    const data = await response.json()
    csrfToken = data.csrfToken
    return csrfToken
  } catch (error) {
    console.error('Failed to get CSRF token:', error)
    return null
  }
}

function getRequestOptions(): RequestInit {
  return { credentials: 'include' as RequestCredentials }
}

/**
 * Get current user subscription and quotas
 */
export async function getSubscription(): Promise<SubscriptionData> {
  const response = await fetch(`${API_BASE}/api/session/subscription`, getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get subscription')
  return result.data
}

/**
 * Check if user can create more inboxes
 */
export async function canCreateInbox(): Promise<{ allowed: boolean; current: number; max: number }> {
  const data = await getSubscription()
  const current = data.usage.inboxes
  const max = data.quotas.maxInboxes
  return {
    allowed: current < max,
    current,
    max
  }
}

/**
 * Check if user can create more agents
 */
export async function canCreateAgent(): Promise<{ allowed: boolean; current: number; max: number }> {
  const data = await getSubscription()
  const current = data.usage.agents
  const max = data.quotas.maxAgents
  return {
    allowed: current < max,
    current,
    max
  }
}

/**
 * Check if user can create more teams
 */
export async function canCreateTeam(): Promise<{ allowed: boolean; current: number; max: number }> {
  const data = await getSubscription()
  const current = data.usage.teams
  const max = data.quotas.maxTeams
  return {
    allowed: current < max,
    current,
    max
  }
}
