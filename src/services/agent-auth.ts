/**
 * Agent Authentication Service
 * 
 * Handles agent login, logout, and session management.
 */

const API_BASE = ''

// CSRF token cache
let csrfToken: string | null = null

/**
 * Get CSRF token for protected requests
 */
async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include'
    })
    const data = await response.json()
    csrfToken = data.csrfToken || null
    return csrfToken
  } catch {
    return null
  }
}

export interface AgentLoginResponse {
  token: string
  expiresAt: string
  agent: {
    id: string
    email: string
    name: string
    avatarUrl?: string
    role: string
    availability: string
  }
  account: {
    id: string
    name: string
  }
  permissions: string[]
}

export interface AgentInfo {
  id: string
  email: string
  name: string
  avatarUrl?: string
  role: string
  availability: string
  status: string
  lastActivityAt?: string
}

export interface AgentSession {
  agent: AgentInfo
  account: {
    id: string
    name: string
    timezone?: string
    locale?: string
  }
  permissions: string[]
  session: {
    id: string
    expiresAt: string
  }
}

// Store agent token in memory (will be lost on page refresh)
let agentToken: string | null = null

/**
 * Set the agent token for API calls
 */
export function setAgentToken(token: string | null) {
  agentToken = token
  if (token) {
    localStorage.setItem('agentToken', token)
  } else {
    localStorage.removeItem('agentToken')
  }
}

/**
 * Get the current agent token
 */
export function getAgentToken(): string | null {
  if (!agentToken) {
    agentToken = localStorage.getItem('agentToken')
  }
  return agentToken
}

/**
 * Get request options with agent token
 */
function getRequestOptions(): RequestInit {
  const token = getAgentToken()
  return {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  }
}

/**
 * Login as agent
 */
export async function loginAgent(email: string, password: string): Promise<AgentLoginResponse> {
  const response = await fetch(`${API_BASE}/api/agent/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })

  const result = await response.json()
  
  if (!response.ok) {
    throw new Error(result.error || 'Falha no login')
  }

  // Store the token
  setAgentToken(result.data.token)

  return result.data
}

/**
 * Logout agent
 */
export async function logoutAgent(): Promise<void> {
  const options = getRequestOptions()
  
  try {
    await fetch(`${API_BASE}/api/agent/logout`, {
      method: 'POST',
      ...options
    })
  } finally {
    // Always clear the token
    setAgentToken(null)
  }
}

/**
 * Get current agent info
 */
export async function getCurrentAgent(): Promise<AgentSession> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/me`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao obter informações do agente')
  }

  return result.data
}

/**
 * Update agent availability
 */
export async function updateAvailability(availability: 'online' | 'busy' | 'offline'): Promise<void> {
  const options = getRequestOptions()
  const csrf = await getCsrfToken()
  
  const response = await fetch(`${API_BASE}/api/agent/availability`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrf && { 'CSRF-Token': csrf }),
      ...options.headers as Record<string, string>
    },
    body: JSON.stringify({ availability })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atualizar disponibilidade')
  }
}

/**
 * Change agent password
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const options = getRequestOptions()
  const csrf = await getCsrfToken()
  
  const response = await fetch(`${API_BASE}/api/agent/password`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrf && { 'CSRF-Token': csrf }),
      ...options.headers as Record<string, string>
    },
    body: JSON.stringify({ currentPassword, newPassword })
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao alterar senha')
  }
}

/**
 * Update agent profile (name and avatar)
 */
export async function updateAgentProfile(data: { name?: string; avatarUrl?: string }): Promise<AgentInfo> {
  const options = getRequestOptions()
  const csrf = await getCsrfToken()
  
  const response = await fetch(`${API_BASE}/api/agent/profile`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      ...(csrf && { 'CSRF-Token': csrf }),
      ...options.headers as Record<string, string>
    },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atualizar perfil')
  }

  // Invalidate CSRF token to get a fresh one on next request
  csrfToken = null

  return result.data
}

/**
 * Validate invitation token
 */
export async function validateInvitation(token: string): Promise<{
  valid: boolean
  invitation?: {
    role: string
    email?: string
    expiresAt: string
  }
  account?: {
    id: string
    name: string
  }
}> {
  const response = await fetch(`${API_BASE}/api/agent/invitation/${token}`)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Convite inválido')
  }

  return result.data
}

/**
 * Complete registration via invitation
 */
export async function registerViaInvitation(
  invitationToken: string,
  data: { email: string; password: string; name: string; avatarUrl?: string }
): Promise<AgentLoginResponse> {
  const response = await fetch(`${API_BASE}/api/agent/register/${invitationToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha no registro')
  }

  // Store the token
  setAgentToken(result.data.token)

  return result.data
}

/**
 * Check if agent is authenticated
 */
export function isAgentAuthenticated(): boolean {
  return !!getAgentToken()
}


/**
 * Database connection info for agent
 */
export interface AgentDatabaseConnection {
  id: string
  name: string
  type?: string
  status?: string
  accessLevel: 'view' | 'full'
}

/**
 * Get database connections accessible to the agent
 */
export async function getAgentDatabaseConnections(): Promise<AgentDatabaseConnection[]> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/my-database-connections`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao obter conexões de banco de dados')
  }

  return result.data || []
}

/**
 * Database connection with full details for agent
 */
export interface AgentDatabaseConnectionDetails {
  id: number
  name: string
  type: string
  status: string
  baseUrl?: string
  tableId?: string
  fieldMappings: Array<{
    columnName: string
    label: string
    visible: boolean
    editable: boolean
    showInCard?: boolean
  }>
  viewConfiguration?: {
    calendar?: { enabled: boolean; dateField?: string }
    kanban?: { enabled: boolean; statusField?: string }
  }
  default_view_mode?: string
  accessLevel: 'view' | 'full'
}

/**
 * Get database connection details for agent
 */
export async function getAgentDatabaseConnection(connectionId: string | number): Promise<AgentDatabaseConnectionDetails> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/database/${connectionId}`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao obter conexão de banco de dados')
  }

  return result.data
}

/**
 * Get table data for agent
 */
export async function getAgentDatabaseData(connectionId: string | number): Promise<any[]> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/database/${connectionId}/data`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao obter dados do banco de dados')
  }

  return result.data || []
}

/**
 * Get a specific record for agent
 */
export async function getAgentDatabaseRecord(connectionId: string | number, recordId: string | number): Promise<{ record: any; accessLevel: 'view' | 'full' }> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/database/${connectionId}/record/${recordId}`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao obter registro')
  }

  return { record: result.data, accessLevel: result.accessLevel }
}

/**
 * Update a record (requires 'full' access)
 */
export async function updateAgentDatabaseRecord(connectionId: string | number, recordId: string | number, data: Record<string, any>): Promise<any> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/database/${connectionId}/record/${recordId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    },
    body: JSON.stringify(data)
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao atualizar registro')
  }

  return result.data
}

/**
 * Create a new record (requires 'full' access)
 */
export async function createAgentDatabaseRecord(connectionId: string | number, data: Record<string, any>): Promise<any> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/database/${connectionId}/record`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    },
    body: JSON.stringify(data)
  })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao criar registro')
  }

  return result.data
}

/**
 * Get NocoDB columns for a connection
 */
export async function getAgentDatabaseColumns(connectionId: string | number): Promise<any[]> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/database/${connectionId}/columns`, options)
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Falha ao obter colunas')
  }

  return result.data || []
}

/**
 * Get a custom theme by ID (for agents)
 */
export async function getAgentCustomTheme(themeId: number): Promise<{ success: boolean; data?: any; error?: string }> {
  const options = getRequestOptions()
  
  const response = await fetch(`${API_BASE}/api/agent/custom-themes/${themeId}`, options)
  const result = await response.json()

  if (!response.ok) {
    return { success: false, error: result.error || 'Falha ao carregar tema' }
  }

  return { success: true, data: result.data }
}

/**
 * List custom themes (for agents)
 */
export async function listAgentCustomThemes(options?: { connectionId?: number; limit?: number; offset?: number }): Promise<{ success: boolean; data?: any; error?: string }> {
  const requestOptions = getRequestOptions()
  
  const params = new URLSearchParams()
  if (options?.connectionId) params.append('connection_id', options.connectionId.toString())
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())
  
  const queryString = params.toString()
  const url = queryString ? `${API_BASE}/api/agent/custom-themes?${queryString}` : `${API_BASE}/api/agent/custom-themes`
  
  const response = await fetch(url, requestOptions)
  const result = await response.json()

  if (!response.ok) {
    return { success: false, error: result.error || 'Falha ao listar temas' }
  }

  return { success: true, data: result.data }
}
