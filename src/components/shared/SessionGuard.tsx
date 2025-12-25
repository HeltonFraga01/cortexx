/**
 * SessionGuard Component
 * 
 * Ensures session is ready before rendering children.
 * Prevents race conditions where API calls are made before authentication is complete.
 * 
 * @module src/components/shared/SessionGuard
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { RouteLoadingSkeleton } from './RouteLoadingSkeleton'

interface SessionGuardProps {
  children: React.ReactNode
  /** Required role for access (optional) */
  requiredRole?: 'admin' | 'user' | 'superadmin' | 'tenant_admin'
  /** Timeout in milliseconds before redirecting to login (default: 5000) */
  timeoutMs?: number
  /** Custom redirect path on timeout (default: /login) */
  redirectPath?: string
  /** Callback when session is ready */
  onSessionReady?: () => void
}

/**
 * SessionGuard ensures authentication is complete before rendering children.
 * 
 * Features:
 * - Waits for session to be ready before rendering
 * - Shows loading skeleton while waiting
 * - Redirects to login after timeout
 * - Supports role-based access control
 * - Logs warnings for debugging
 * 
 * @example
 * ```tsx
 * <SessionGuard requiredRole="admin">
 *   <AdminDashboard />
 * </SessionGuard>
 * ```
 */
export function SessionGuard({
  children,
  requiredRole,
  timeoutMs = 5000,
  redirectPath = '/login',
  onSessionReady,
}: SessionGuardProps) {
  const { session, isLoading, role } = useAuth()
  const navigate = useNavigate()
  const [timedOut, setTimedOut] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Handle timeout
  useEffect(() => {
    if (!isLoading && session) {
      // Session is ready
      setSessionReady(true)
      onSessionReady?.()
      return
    }

    if (!isLoading && !session) {
      // Not loading but no session - redirect immediately
      if (import.meta.env.DEV) {
        console.debug('[SessionGuard] No session, redirecting to login')
      }
      navigate(redirectPath, { replace: true })
      return
    }

    // Set timeout for session loading
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('[SessionGuard] Session loading timeout, redirecting to login')
        setTimedOut(true)
      }
    }, timeoutMs)

    return () => clearTimeout(timer)
  }, [isLoading, session, timeoutMs, navigate, redirectPath, onSessionReady])

  // Handle timeout redirect
  useEffect(() => {
    if (timedOut) {
      navigate(redirectPath, { replace: true })
    }
  }, [timedOut, navigate, redirectPath])

  // Check role when session is ready
  useEffect(() => {
    if (!sessionReady || !requiredRole) return

    const validRoles: Record<string, string[]> = {
      admin: ['admin', 'tenant_admin', 'owner', 'administrator', 'superadmin'],
      user: ['user'],
      superadmin: ['superadmin'],
      tenant_admin: ['tenant_admin', 'admin', 'owner', 'administrator'],
    }

    const allowedRoles = validRoles[requiredRole] || [requiredRole]

    if (!allowedRoles.includes(role || '')) {
      console.warn('[SessionGuard] Insufficient permissions', {
        required: requiredRole,
        actual: role,
        allowedRoles,
      })
      navigate('/unauthorized', { replace: true })
    }
  }, [sessionReady, requiredRole, role, navigate])

  // Still loading
  if (isLoading && !timedOut) {
    return <RouteLoadingSkeleton />
  }

  // Timed out or no session
  if (timedOut || !session) {
    return null
  }

  // Session ready, render children
  return <>{children}</>
}

/**
 * Hook version of SessionGuard for more flexible usage
 * 
 * @returns Object with session state and guard utilities
 */
export function useSessionGuard(options: {
  requiredRole?: 'admin' | 'user' | 'superadmin' | 'tenant_admin'
  timeoutMs?: number
} = {}) {
  const { session, isLoading, role } = useAuth()
  const navigate = useNavigate()
  const [timedOut, setTimedOut] = useState(false)
  const { requiredRole, timeoutMs = 5000 } = options

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        console.warn('[useSessionGuard] Session loading timeout')
        setTimedOut(true)
      }, timeoutMs)
      return () => clearTimeout(timer)
    }
  }, [isLoading, timeoutMs])

  const isReady = !isLoading && !!session && !timedOut

  const hasRequiredRole = useCallback(() => {
    if (!requiredRole) return true
    
    const validRoles: Record<string, string[]> = {
      admin: ['admin', 'tenant_admin', 'owner', 'administrator', 'superadmin'],
      user: ['user'],
      superadmin: ['superadmin'],
      tenant_admin: ['tenant_admin', 'admin', 'owner', 'administrator'],
    }

    const allowedRoles = validRoles[requiredRole] || [requiredRole]
    return allowedRoles.includes(role || '')
  }, [requiredRole, role])

  const redirectToLogin = useCallback(() => {
    navigate('/login', { replace: true })
  }, [navigate])

  const redirectToUnauthorized = useCallback(() => {
    navigate('/unauthorized', { replace: true })
  }, [navigate])

  return {
    isReady,
    isLoading,
    timedOut,
    session,
    role,
    hasRequiredRole,
    redirectToLogin,
    redirectToUnauthorized,
  }
}

export default SessionGuard
