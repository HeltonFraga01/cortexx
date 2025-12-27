/**
 * Contact CRM Service
 * 
 * Handles CRM-specific operations for contacts including lead scoring,
 * timeline, and communication preferences.
 * 
 * Requirements: 8.2 (Contact CRM Evolution)
 */

import { supabase } from '@/lib/supabase'

// Types
export interface ContactCRM {
  id: string
  phone: string
  name: string | null
  avatarUrl: string | null
  leadScore: number
  leadTier: 'cold' | 'warm' | 'hot' | 'vip'
  lifetimeValueCents: number
  purchaseCount: number
  creditBalance: number
  lastInteractionAt: string | null
  lastPurchaseAt: string | null
  isActive: boolean
  bulkMessagingOptIn: boolean
  optOutAt: string | null
  optOutMethod: string | null
  customFields: Record<string, unknown>
  interactionStats: {
    total: number
    byType: Record<string, number>
    incoming: number
    outgoing: number
  }
  createdAt: string
  updatedAt: string
}

export interface TimelineEvent {
  id: string
  type: 'message' | 'call' | 'email' | 'note' | 'status_change' | 'purchase' | 'credit'
  timestamp: string
  direction?: 'incoming' | 'outgoing'
  content: string
  fullContent?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  createdByType?: string
}

export interface LeadScoreConfig {
  messageReceived: number
  messageSent: number
  purchaseMade: number
  purchaseValueMultiplier: number
  inactivityDecayPerDay: number
  maxScore: number
  tiers: {
    cold: { min: number; max: number }
    warm: { min: number; max: number }
    hot: { min: number; max: number }
    vip: { min: number; max: number }
  }
}

export interface LeadScoreDistribution {
  cold: number
  warm: number
  hot: number
  vip: number
}

export interface OptInStats {
  totalContacts: number
  optedIn: number
  optedOut: number
  optInRate: number
  optOutByMethod: Record<string, number>
}

// Helper to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`
  }
}

// API base URL
const API_BASE = '/api/user/crm'

/**
 * Get full CRM data for a contact
 */
export async function getContactCRM(contactId: string): Promise<ContactCRM> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch contact CRM data')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Update lead score manually
 */
export async function updateLeadScore(contactId: string, score: number): Promise<{ score: number; tier: string }> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/lead-score`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ score })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update lead score')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Get activity timeline for a contact
 */
export async function getTimeline(
  contactId: string,
  options: {
    page?: number
    pageSize?: number
    types?: string[]
    startDate?: string
    endDate?: string
    includeRelated?: boolean
  } = {}
): Promise<{ data: TimelineEvent[]; total: number; page: number; pageSize: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.types?.length) params.set('types', options.types.join(','))
  if (options.startDate) params.set('startDate', options.startDate)
  if (options.endDate) params.set('endDate', options.endDate)
  if (options.includeRelated) params.set('includeRelated', 'true')
  
  const response = await fetch(`${API_BASE}/contacts/${contactId}/timeline?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch timeline')
  }
  
  return response.json()
}

/**
 * Add a note to contact timeline
 */
export async function addNote(contactId: string, note: string): Promise<TimelineEvent> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ note })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add note')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Update communication preferences
 */
export async function updatePreferences(
  contactId: string,
  preferences: { bulkMessagingOptIn: boolean }
): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/preferences`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(preferences)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update preferences')
  }
}

/**
 * Get lead scoring configuration
 */
export async function getLeadScoringConfig(): Promise<LeadScoreConfig> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/lead-scoring/config`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch lead scoring config')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Update lead scoring configuration
 */
export async function updateLeadScoringConfig(config: Partial<LeadScoreConfig>): Promise<LeadScoreConfig> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/lead-scoring/config`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(config)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update lead scoring config')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Get lead score distribution
 */
export async function getLeadScoreDistribution(): Promise<LeadScoreDistribution> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/lead-scoring/distribution`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch score distribution')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Get contacts by lead tier
 */
export async function getContactsByTier(
  tier: 'cold' | 'warm' | 'hot' | 'vip',
  options: { page?: number; pageSize?: number } = {}
): Promise<{ data: ContactCRM[]; total: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  
  const response = await fetch(`${API_BASE}/contacts/by-tier/${tier}?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch contacts by tier')
  }
  
  return response.json()
}

/**
 * Get opt-in/opt-out statistics
 */
export async function getOptInStats(): Promise<OptInStats> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/preferences/stats`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch opt-in stats')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Get opted-out contacts
 */
export async function getOptedOutContacts(
  options: { page?: number; pageSize?: number } = {}
): Promise<{ data: ContactCRM[]; total: number; page: number; pageSize: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  
  const response = await fetch(`${API_BASE}/preferences/opted-out?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch opted-out contacts')
  }
  
  return response.json()
}

/**
 * Get recent interactions across all contacts
 */
export async function getRecentInteractions(limit = 20): Promise<TimelineEvent[]> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/interactions/recent?limit=${limit}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch recent interactions')
  }
  
  const data = await response.json()
  return data.data
}

/**
 * Get inactive contacts
 */
export async function getInactiveContacts(
  options: { page?: number; pageSize?: number } = {}
): Promise<{ data: ContactCRM[]; total: number; page: number; pageSize: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  
  const response = await fetch(`${API_BASE}/contacts/inactive?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch inactive contacts')
  }
  
  return response.json()
}
