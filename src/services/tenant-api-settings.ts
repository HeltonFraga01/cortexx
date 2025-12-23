/**
 * Tenant API Settings Service
 * Frontend service for managing tenant-specific WUZAPI configuration
 * 
 * Requirements: 11.2 (Tenant Webhook Configuration)
 */

import { backendApi } from './api-client'

export interface TenantApiSettings {
  baseUrl: string
  hasAdminToken: boolean
  timeout: number
  webhookBaseUrl: string
  isConfigured: boolean
  source: 'database' | 'environment'
  updatedAt?: string
}

export interface TenantApiSettingsUpdate {
  baseUrl?: string
  adminToken?: string
  timeout?: number
  webhookBaseUrl?: string
}

export interface ConnectionTestResult {
  success: boolean
  responseTime?: number
  version?: string
  usersCount?: number
  error?: string
}

const API_BASE = '/admin/tenant/api-settings'

/**
 * Get current tenant API settings
 */
export async function getTenantApiSettings(): Promise<TenantApiSettings> {
  const response = await backendApi.get<{ success: boolean; data: TenantApiSettings }>(API_BASE)
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao carregar configurações')
  }

  return response.data?.data!
}

/**
 * Update tenant API settings
 */
export async function updateTenantApiSettings(settings: TenantApiSettingsUpdate): Promise<TenantApiSettings> {
  const response = await backendApi.put<{ success: boolean; data: TenantApiSettings }>(API_BASE, settings)
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao salvar configurações')
  }

  return response.data?.data!
}

/**
 * Test API connection with provided or saved credentials
 */
export async function testTenantApiConnection(credentials?: { baseUrl: string; adminToken: string }): Promise<ConnectionTestResult> {
  const response = await backendApi.post<{ success: boolean; data: ConnectionTestResult }>(
    `${API_BASE}/test`,
    credentials || {}
  )
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao testar conexão')
  }

  return response.data?.data!
}

/**
 * Clear tenant API settings (revert to env fallback)
 */
export async function clearTenantApiSettings(): Promise<TenantApiSettings> {
  const response = await backendApi.delete<{ success: boolean; data: TenantApiSettings }>(API_BASE)
  
  if (!response.success) {
    throw new Error(response.error || 'Falha ao remover configurações')
  }

  return response.data?.data!
}
