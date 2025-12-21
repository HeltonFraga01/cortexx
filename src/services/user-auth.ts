/**
 * User Authentication Service
 * 
 * Handles authentication for independent users (email/password).
 * Requirements: 2.1
 */

import { api } from '@/lib/api'

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  status: string
  permissions: string[]
  lastLoginAt?: string
  createdAt?: string
}

export interface UserInbox {
  id: string
  inboxId: string
  isPrimary: boolean
  createdAt: string
}

export interface LoginResponse {
  token: string
  expiresAt: string
  user: User
  inboxes: UserInbox[]
  role: 'user'
}

export interface UserMeResponse {
  user: User
  inboxes: UserInbox[]
  primaryInbox: UserInbox | null
  session: {
    id: string
    expiresAt: string
  }
  role: 'user'
}

const TOKEN_KEY = 'user_session_token'

/**
 * Login with email and password
 */
export async function login(email: string, password: string, tenantId?: string): Promise<LoginResponse> {
  const response = await api.post<{ success: boolean; data: LoginResponse }>('/api/auth/user-login', {
    email,
    password,
    tenantId
  })
  
  if (!response.data.success) {
    throw new Error('Login failed')
  }
  
  // Store token
  localStorage.setItem(TOKEN_KEY, response.data.data.token)
  
  return response.data.data
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  try {
    const token = getToken()
    if (token) {
      await api.post('/api/auth/user-logout', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
    }
  } finally {
    // Always clear local storage
    localStorage.removeItem(TOKEN_KEY)
  }
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<UserMeResponse | null> {
  const token = getToken()
  if (!token) {
    return null
  }
  
  try {
    const response = await api.get<{ success: boolean; data: UserMeResponse }>('/api/auth/user/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.data.success) {
      return null
    }
    
    return response.data.data
  } catch {
    // Token invalid or expired
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
}

/**
 * Change user password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }
  
  const response = await api.put<{ success: boolean; message: string }>('/api/auth/user/password', {
    currentPassword,
    newPassword
  }, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  if (!response.data.success) {
    throw new Error('Failed to change password')
  }
}

/**
 * Get stored token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken()
}

/**
 * Set auth header for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  if (!token) {
    return {}
  }
  return {
    'Authorization': `Bearer ${token}`
  }
}

export const userAuthService = {
  login,
  logout,
  getCurrentUser,
  changePassword,
  getToken,
  isAuthenticated,
  getAuthHeaders
}

export default userAuthService
