/**
 * Account Audit Service
 * 
 * Handles audit log querying.
 */

import type { AuditLog, AuditLogFilters, AuditLogResponse } from '@/types/multi-user'

const API_BASE = ''

function getRequestOptions(): RequestInit {
  return { credentials: 'include' as RequestCredentials }
}

/**
 * List audit logs with filters
 */
export async function listAuditLogs(filters?: AuditLogFilters): Promise<AuditLogResponse> {
  const params = new URLSearchParams()
  if (filters?.agentId) params.set('agentId', filters.agentId)
  if (filters?.action) params.set('action', filters.action)
  if (filters?.resourceType) params.set('resourceType', filters.resourceType)
  if (filters?.resourceId) params.set('resourceId', filters.resourceId)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))

  const url = `${API_BASE}/api/session/audit${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url, getRequestOptions())

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to list audit logs')

  return {
    logs: result.data?.logs || [],
    pagination: result.data?.pagination || { total: 0, limit: 50, offset: 0, hasMore: false }
  }
}

/**
 * Get audit log entry by ID
 */
export async function getAuditLog(id: string): Promise<AuditLog> {
  const response = await fetch(`${API_BASE}/api/session/audit/${id}`, getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get audit log')
  return result.data
}

/**
 * Export audit logs as CSV
 */
export async function exportAuditLogs(filters?: { startDate?: string; endDate?: string }): Promise<Blob> {
  const params = new URLSearchParams()
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)

  const url = `${API_BASE}/api/session/audit/export${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url, getRequestOptions())

  if (!response.ok) {
    const result = await response.json()
    throw new Error(result.error || 'Failed to export audit logs')
  }

  return response.blob()
}
