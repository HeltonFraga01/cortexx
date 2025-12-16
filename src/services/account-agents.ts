/**
 * Account Agents Service
 * 
 * Handles agent CRUD operations and invitation management.
 */

import type {
  Agent,
  AgentFilters,
  CreateAgentDTO,
  UpdateAgentDTO,
  CreateInvitationDTO,
  Invitation,
  InvitationFilters,
  AgentRole
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

// Use session-based auth (cookies) instead of agent token headers
function getRequestOptions(): RequestInit {
  return {
    credentials: 'include' as RequestCredentials
  }
}

async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const token = await getCsrfToken()
  return {
    credentials: 'include' as RequestCredentials,
    headers: token ? { 'CSRF-Token': token } : {}
  }
}

/**
 * List agents
 */
export async function listAgents(filters?: AgentFilters): Promise<Agent[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.role) params.set('role', filters.role)
  if (filters?.availability) params.set('availability', filters.availability)
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (filters?.offset) params.set('offset', String(filters.offset))

  const url = `${API_BASE}/api/session/agents${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url, getRequestOptions())

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to list agents')

  return result.data
}

/**
 * Get agent by ID
 */
export async function getAgent(id: string): Promise<Agent> {
  const response = await fetch(`${API_BASE}/api/session/agents/${id}`, getRequestOptions())

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get agent')

  return result.data
}

/**
 * Create agent directly
 */
export async function createAgent(data: CreateAgentDTO): Promise<Agent> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to create agent')

  return result.data
}

/**
 * Create invitation
 */
export async function createInvitation(data: CreateInvitationDTO): Promise<{
  id: string
  token: string
  role: AgentRole
  email?: string
  expiresAt: string
  invitationUrl: string
}> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/invite`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to create invitation')

  return result.data
}

/**
 * List invitations
 */
export async function listInvitations(filters?: InvitationFilters): Promise<Invitation[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)

  const url = `${API_BASE}/api/session/agents/invitations/list${params.toString() ? `?${params}` : ''}`
  const response = await fetch(url, getRequestOptions())

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to list invitations')

  return result.data
}

/**
 * Delete invitation
 */
export async function deleteInvitation(id: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/invitations/${id}`, {
    method: 'DELETE',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to delete invitation')
}

/**
 * Update agent
 */
export async function updateAgent(id: string, data: UpdateAgentDTO): Promise<Agent> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update agent')

  return result.data
}

/**
 * Update agent role
 */
export async function updateAgentRole(id: string, role: AgentRole, customRoleId?: string): Promise<Agent> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${id}/role`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify({ role, customRoleId }),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update agent role')

  return result.data
}

/**
 * Deactivate agent
 */
export async function deactivateAgent(id: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${id}`, {
    method: 'DELETE',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to deactivate agent')
}

/**
 * Activate agent
 */
export async function activateAgent(id: string): Promise<void> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${id}/activate`, {
    method: 'POST',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to activate agent')
}


// ==================== AGENT DETAILS & ASSIGNMENTS ====================

import type {
  AgentDetailsResponse,
  Team,
  Inbox,
  DatabaseAccessConfig,
  Permission,
  UpdateAgentTeamsDTO,
  UpdateAgentInboxesDTO,
  UpdateAgentDatabaseAccessDTO,
  UpdateAgentPermissionsDTO,
  BulkActionRequest,
  BulkActionResult
} from '@/types/multi-user'

/**
 * Get agent details including teams, inboxes, database access, and permissions
 */
export async function getAgentDetails(agentId: string): Promise<AgentDetailsResponse> {
  const response = await fetch(`${API_BASE}/api/session/agents/${agentId}/details`, getRequestOptions())

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get agent details')

  return result.data
}

/**
 * Update agent team memberships
 */
export async function updateAgentTeams(agentId: string, teamIds: string[]): Promise<Team[]> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${agentId}/teams`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify({ teamIds } as UpdateAgentTeamsDTO),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update agent teams')

  return result.data
}

/**
 * Update agent inbox assignments
 */
export async function updateAgentInboxes(agentId: string, inboxIds: string[]): Promise<Inbox[]> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${agentId}/inboxes`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify({ inboxIds } as UpdateAgentInboxesDTO),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update agent inboxes')

  return result.data
}

/**
 * Update agent database access configurations
 */
export async function updateAgentDatabaseAccess(
  agentId: string, 
  access: DatabaseAccessConfig[]
): Promise<DatabaseAccessConfig[]> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${agentId}/database-access`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify({ access } as UpdateAgentDatabaseAccessDTO),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update agent database access')

  return result.data
}

/**
 * Update agent permissions (role and custom permissions)
 */
export async function updateAgentPermissions(
  agentId: string,
  role?: AgentRole,
  permissions?: Permission[],
  customRoleId?: string | null
): Promise<{ agent: Agent; permissions: Permission[] }> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/${agentId}/permissions`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify({ role, permissions, customRoleId } as UpdateAgentPermissionsDTO),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to update agent permissions')

  return result.data
}

/**
 * Bulk update multiple agents
 */
export async function bulkUpdateAgents(request: BulkActionRequest): Promise<BulkActionResult> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/agents/bulk`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrfOptions.headers as Record<string, string>)
    },
    body: JSON.stringify(request),
    credentials: 'include'
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to bulk update agents')

  return result.data
}
