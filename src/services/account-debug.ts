/**
 * Account Debug Service
 * 
 * Debug utilities for account and inbox troubleshooting.
 */

const API_BASE = ''

function getRequestOptions(): RequestInit {
  return { credentials: 'include' as RequestCredentials }
}

async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include'
    })
    const data = await response.json()
    return {
      credentials: 'include' as RequestCredentials,
      headers: data.csrfToken ? { 'CSRF-Token': data.csrfToken } : {}
    }
  } catch {
    return { credentials: 'include' as RequestCredentials }
  }
}

export interface DebugInfo {
  sessionUserId: string | null
  sessionUserToken: string | null
  sessionRole: string | null
  existingTables: string[]
  account: Record<string, unknown> | null
  accountByToken: Record<string, unknown> | null
  accountInboxes: Record<string, unknown>[]
  allAccounts: Record<string, unknown>[]
  allInboxes: Record<string, unknown>[]
  orphanInboxes: Record<string, unknown>[]
  recentMigrations: string[]
}

/**
 * Get debug information about account and inboxes
 */
export async function getDebugInfo(): Promise<DebugInfo> {
  const response = await fetch(`${API_BASE}/api/session/account-debug`, getRequestOptions())
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to get debug info')
  return result.debug
}

/**
 * Migrate orphan inboxes to current user's account
 */
export async function migrateOrphanInboxes(): Promise<{ migrated: number; migratedIds: string[] }> {
  const csrfOptions = await getRequestOptionsWithCsrf()
  const response = await fetch(`${API_BASE}/api/session/account-debug/migrate-inboxes`, {
    method: 'POST',
    headers: csrfOptions.headers as Record<string, string>,
    credentials: 'include'
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to migrate inboxes')
  return result
}
