/**
 * Account Roles Service
 * 
 * Handles role CRUD operations and permission management.
 */

import type {
  CustomRole,
  CustomRoleWithUsage,
  RolesResponse,
  CreateCustomRoleDTO,
  UpdateCustomRoleDTO
} from '@/types/multi-user'
import { supabase } from '@/lib/supabase'

const API_BASE = ''

/**
 * Get JWT token from Supabase session for API authentication
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

async function getCsrfToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include'
    })
    const data = await response.json()
    return data.csrfToken || null
  } catch (error) {
    console.error('Failed to get CSRF token:', error)
    return null
  }
}

async function getRequestOptions(): Promise<RequestInit> {
  const token = await getAuthToken()
  return { 
    credentials: 'include' as RequestCredentials,
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  }
}

async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const [authToken, csrfToken] = await Promise.all([getAuthToken(), getCsrfToken()])
  const headers: Record<string, string> = {}
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  if (csrfToken) headers['CSRF-Token'] = csrfToken
  return {
    credentials: 'include' as RequestCredentials,
    headers
  }
}

/**
 * List all roles (default + custom)
 */
export async function listRoles(): Promise<RolesResponse> {
  const response = await fetch(`${API_BASE}/api/session/roles`, await getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to list roles')
  return result.data
}

/**
 * Get custom role by ID
 */
export async function getCustomRole(id: string): Promise<CustomRoleWithUsage> {
  const response = await fetch(`${API_BASE}/api/session/roles/${id}`, await getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get role')
  return result.data
}

/**
 * Create custom role
 */
export async function createCustomRole(data: CreateCustomRoleDTO): Promise<CustomRole> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/roles`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to create role')
  return result.data
}


/**
 * Update custom role
 */
export async function updateCustomRole(id: string, data: UpdateCustomRoleDTO): Promise<CustomRole> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/roles/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update role')
  return result.data
}

/**
 * Delete custom role
 */
export async function deleteCustomRole(id: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/roles/${id}`, {
    method: 'DELETE',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to delete role')
}
