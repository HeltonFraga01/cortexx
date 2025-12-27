/**
 * Purchase Service
 * 
 * Handles contact purchase management including history, manual entry,
 * webhook processing, and CSV import.
 * 
 * Requirements: 3.1, 3.6 (Contact CRM Evolution)
 */

import { supabase } from '@/lib/supabase'

// Types
export interface Purchase {
  id: string
  contactId: string
  externalId: string | null
  amountCents: number
  currency: string
  description: string | null
  productName: string | null
  status: 'pending' | 'completed' | 'refunded' | 'cancelled'
  source: 'manual' | 'stripe' | 'webhook' | 'import'
  metadata: Record<string, unknown>
  purchasedAt: string
  createdAt: string
}

export interface CreatePurchaseData {
  amountCents: number
  currency?: string
  productName?: string
  description?: string
  externalId?: string
  status?: 'pending' | 'completed' | 'refunded' | 'cancelled'
  purchasedAt?: string
  metadata?: Record<string, unknown>
}

export interface WebhookPurchaseData {
  phone?: string
  email?: string
  customerName?: string
  externalId?: string
  amountCents: number
  currency?: string
  productName?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface PurchaseStats {
  totalPurchases: number
  completedPurchases: number
  totalRevenueCents: number
  averageOrderValueCents: number
  refundedCount: number
  pendingCount: number
}

export interface TopCustomer {
  id: string
  name: string | null
  phone: string
  lifetimeValueCents: number
  purchaseCount: number
}

export interface ImportResult {
  imported: number
  failed: number
  errors: string[]
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
const API_BASE = '/api/user/purchases'

/**
 * Get purchase history for a contact
 */
export async function getPurchases(
  contactId: string,
  options: {
    page?: number
    pageSize?: number
    status?: 'pending' | 'completed' | 'refunded' | 'cancelled'
    startDate?: string
    endDate?: string
  } = {}
): Promise<{ data: Purchase[]; total: number; page: number; pageSize: number }> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.status) params.set('status', options.status)
  if (options.startDate) params.set('startDate', options.startDate)
  if (options.endDate) params.set('endDate', options.endDate)
  
  const response = await fetch(`${API_BASE}/contacts/${contactId}?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch purchases')
  }
  
  return response.json()
}

/**
 * Create a manual purchase for a contact
 */
export async function createPurchase(contactId: string, data: CreatePurchaseData): Promise<Purchase> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/contacts/${contactId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create purchase')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Update purchase status
 */
export async function updatePurchaseStatus(
  purchaseId: string,
  status: 'pending' | 'completed' | 'refunded' | 'cancelled'
): Promise<Purchase> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/${purchaseId}/status`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update purchase status')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Process purchase from webhook
 */
export async function processWebhookPurchase(data: WebhookPurchaseData): Promise<{
  duplicate: boolean
  purchase?: Purchase
  contact?: { id: string; name: string | null; phone: string }
  contactCreated?: boolean
}> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to process webhook purchase')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Import purchases from CSV data
 */
export async function importPurchases(purchases: WebhookPurchaseData[]): Promise<ImportResult> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ purchases })
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to import purchases')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get purchase statistics for account
 */
export async function getPurchaseStats(options: {
  startDate?: string
  endDate?: string
} = {}): Promise<PurchaseStats> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  
  if (options.startDate) params.set('startDate', options.startDate)
  if (options.endDate) params.set('endDate', options.endDate)
  
  const response = await fetch(`${API_BASE}/stats?${params}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch purchase stats')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Get top customers by LTV
 */
export async function getTopCustomers(limit = 10): Promise<TopCustomer[]> {
  const headers = await getAuthHeaders()
  const response = await fetch(`${API_BASE}/top-customers?limit=${limit}`, { headers })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch top customers')
  }
  
  const result = await response.json()
  return result.data
}

/**
 * Format currency value from cents
 */
export function formatCurrency(cents: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency
  }).format(cents / 100)
}

/**
 * Calculate average order value
 */
export function calculateAOV(totalRevenueCents: number, purchaseCount: number): number {
  if (purchaseCount === 0) return 0
  return Math.round(totalRevenueCents / purchaseCount)
}
