/**
 * Credit Service
 * 
 * Handles contact credit balance management including viewing balance,
 * adding credits, consuming credits, and transaction history.
 * 
 * Requirements: 4.1, 4.2, 4.3 (Contact CRM Evolution)
 */

import { supabase } from '@/lib/supabase'

// Types
export interface CreditBalance {
  balance: number
  lastTransaction: CreditTransaction | null
}

export interface CreditTransaction {
  id: string
  contactId: string
  type: 'credit' | 'debit' | 'adjustment' | 'expiration'
  amount: number
  balanceAfter: number
  source: string
  description: string | null
  metadata: Record<string, unknown>
  createdAt: string
  createdBy: string | null
  createdByType: 'account' | 'agent' | 'system' | null
}

export interface AddCreditsData {
  amount: number
  source: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface ConsumeCreditsData {
  amount: number
  reason: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface AdjustCreditsData {
  amount: number
  reason: string
  metadata?: Record<string, unknown>
}

export interface CreditSummary {
  totalBalance: number
  contactsWithCredits: number
  monthlyCreditsAdded: number
  monthlyCreditsConsumed: number
}

export interface BalanceCheck {
  sufficient: boolean
  balance: number
  shortfall: number
}

export interface BulkAddResult {
  success: number
  failed: number
  results: Array<{
    contactId: string
    success: boolean
    balance?: number
    error?: string
  }>
  invalidContactIds: string[]
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
const API_BASE = '/api/user/credits'

/**
 * Get credit balance for a contact
 */
export async function getBalance(contactId: string): Promise<CreditBalance> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch credit balance')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get credit transaction history for a contact
 */
export async function getTransactionHistory(
  contactId: string,
  options: {
    page?: number
    pageSize?: number
    type?: 'credit' | 'debit' | 'adjustment' | 'expiration'
    startDate?: string
    endDate?: string
  } = {}
): Promise<{ data: CreditTransaction[]; total: number; page: number; pageSize: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.type) params.set('type', options.type)
  if (options.startDate) params.set('startDate', options.startDate)
  if (options.endDate) params.set('endDate', options.endDate)
  
  const response = await fetch(`${API_BASE}/contacts/${contactId}/history?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch transaction history')
  }
  
  return response.json()
}

/**
 * Add credits to a contact
 */
export async function addCredits(
  contactId: string,
  data: AddCreditsData
): Promise<{ balance: number; transaction: CreditTransaction }> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/add`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to add credits')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Consume credits from a contact
 */
export async function consumeCredits(
  contactId: string,
  data: ConsumeCreditsData
): Promise<{ balance: number; transaction: CreditTransaction }> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/consume`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    if (error.error === 'Insufficient credits') {
      throw new Error(`Saldo insuficiente. Saldo atual: ${error.currentBalance}, Solicitado: ${error.requested}`)
    }
    throw new Error(error.error || 'Failed to consume credits')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Adjust credit balance (positive or negative)
 */
export async function adjustCredits(
  contactId: string,
  data: AdjustCreditsData
): Promise<{ balance: number; transaction: CreditTransaction }> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/adjust`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to adjust credits')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Check if contact has sufficient balance
 */
export async function checkBalance(contactId: string, amount: number): Promise<BalanceCheck> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}/check?amount=${amount}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to check balance')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Add credits to multiple contacts
 */
export async function bulkAddCredits(
  contactIds: string[],
  amount: number,
  source: string
): Promise<BulkAddResult> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/bulk/add`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contactIds, amount, source })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to bulk add credits')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get credit summary for account
 */
export async function getCreditSummary(): Promise<CreditSummary> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/summary`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch credit summary')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get contacts with low or zero balance
 */
export async function getLowBalanceContacts(threshold = 0): Promise<Array<{
  id: string
  name: string | null
  phone: string
  creditBalance: number
}>> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/low-balance?threshold=${threshold}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch low balance contacts')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Format credit amount for display
 */
export function formatCredits(amount: number): string {
  return new Intl.NumberFormat('pt-BR').format(amount)
}

/**
 * Get transaction type label
 */
export function getTransactionTypeLabel(type: CreditTransaction['type']): string {
  const labels: Record<CreditTransaction['type'], string> = {
    credit: 'Crédito',
    debit: 'Débito',
    adjustment: 'Ajuste',
    expiration: 'Expiração'
  }
  return labels[type] || type
}

/**
 * Get transaction type color
 */
export function getTransactionTypeColor(type: CreditTransaction['type']): string {
  const colors: Record<CreditTransaction['type'], string> = {
    credit: 'text-green-600',
    debit: 'text-red-600',
    adjustment: 'text-yellow-600',
    expiration: 'text-gray-600'
  }
  return colors[type] || 'text-gray-600'
}
