/**
 * Account Teams Service
 * 
 * Handles team CRUD operations and member management.
 */

import type {
  Team,
  TeamWithStats,
  TeamWithMembers,
  CreateTeamDTO,
  UpdateTeamDTO
} from '@/types/multi-user'

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

async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const token = await getCsrfToken()
  return {
    credentials: 'include' as RequestCredentials,
    headers: token ? { 'CSRF-Token': token } : {}
  }
}

/**
 * List teams with stats
 */
export async function listTeams(): Promise<TeamWithStats[]> {
  const response = await fetch(`${API_BASE}/api/session/teams`, getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to list teams')
  return result.data
}

/**
 * Get team by ID with members
 */
export async function getTeam(id: string): Promise<TeamWithMembers> {
  const response = await fetch(`${API_BASE}/api/session/teams/${id}`, getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get team')
  return result.data
}

/**
 * Create team
 */
export async function createTeam(data: CreateTeamDTO): Promise<Team> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/teams`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to create team')
  return result.data
}


/**
 * Update team
 */
export async function updateTeam(id: string, data: UpdateTeamDTO): Promise<Team> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/teams/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update team')
  return result.data
}

/**
 * Delete team
 */
export async function deleteTeam(id: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/teams/${id}`, {
    method: 'DELETE',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to delete team')
}

/**
 * Get team members
 */
export async function getTeamMembers(teamId: string): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/session/teams/${teamId}/members`, getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get team members')
  return result.data
}

/**
 * Add member to team
 */
export async function addTeamMember(teamId: string, agentId: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/teams/${teamId}/members`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify({ agentId }),
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to add team member')
}

/**
 * Remove member from team
 */
export async function removeTeamMember(teamId: string, agentId: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/teams/${teamId}/members/${agentId}`, {
    method: 'DELETE',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to remove team member')
}
