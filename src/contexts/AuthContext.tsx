import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { authService, getUserRole, getRedirectPath, requiresPasswordChange, type UserRole } from '@/services/auth-service';
import { queryClient } from '@/lib/queryClient';
import { getAccountSummary } from '@/services/user-subscription';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

/**
 * AuthContext - Unified Authentication Context using Supabase Auth
 * Requirements: 7.1, 7.2, 7.3, 7.5
 * 
 * This context provides:
 * - Session management via Supabase Auth
 * - Role-based access control
 * - Tenant isolation
 * - Automatic session refresh
 * - Backward compatibility with legacy token-based code
 */

interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  tenantId?: string;
  avatarUrl?: string;
  requiresPasswordChange?: boolean;
  // Legacy compatibility - token is the Supabase access token
  token: string;
  // Legacy compatibility - jid for WhatsApp
  jid?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresPasswordChange?: boolean }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  // Helper to get current access token
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Map Supabase user to internal User format
 * Maintains backward compatibility with legacy code that uses user.token
 */
function mapSupabaseUser(supabaseUser: SupabaseUser | null, accessToken = ''): User | null {
  if (!supabaseUser) return null;
  
  const metadata = supabaseUser.user_metadata || {};
  
  return {
    id: supabaseUser.id,
    role: getUserRole(supabaseUser),
    name: metadata.name || metadata.full_name || supabaseUser.email?.split('@')[0] || 'Usuário',
    email: supabaseUser.email || '',
    tenantId: metadata.tenant_id,
    avatarUrl: metadata.avatar_url,
    requiresPasswordChange: metadata.requires_password_change === true,
    // Legacy compatibility
    token: accessToken,
    jid: metadata.jid || metadata.whatsapp_jid,
  };
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Prefetch critical data after successful authentication
   * This improves LCP by having data ready when dashboard loads
   */
  const prefetchCriticalData = useCallback(() => {
    // Prefetch account summary - used by multiple dashboard components
    queryClient.prefetchQuery({
      queryKey: ['user', 'account-summary'],
      queryFn: getAccountSummary,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }).catch(() => {
      // Silently ignore prefetch errors - data will be fetched on demand
    });
  }, []);

  /**
   * Get current access token
   * Useful for API calls that need the token
   */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    return currentSession?.access_token || null;
  }, []);

  /**
   * Check authentication status with Supabase
   * Requirement: 7.2
   */
    const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(mapSupabaseUser(currentSession.user, currentSession.access_token));
      } else {
        // Fallback: Check backend session (cookie-based)
        try {
           const response = await fetch('/api/auth/status?t=' + Date.now(), {
             credentials: 'include'
           });
           const data = await response.json();
           
           if (data?.authenticated && data.user) {
             // Construct meaningful user object from backend data
             const backendUser: User = {
                id: data.user.id,
                role: data.user.role,
                name: data.user.name || 'Admin',
                email: data.user.email || '',
                token: data.user.token,
                jid: data.user.jid
             };
             setUser(backendUser);
             // Create a fake session object to satisfy type requirements (optional if we relax check)
             setSession({
                access_token: data.user.token,
                expires_in: 3600,
                refresh_token: '',
                token_type: 'bearer',
                user: { id: data.user.id } as any
             });
           } else {
             setUser(null);
             setSession(null);
           }
        } catch (backendErr) {
           console.warn('Backend auth check failed', backendErr);
           setUser(null);
           setSession(null);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login with email and password using Supabase Auth
   * Requirements: 2.1, 3.1, 4.1
   */
  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string; requiresPasswordChange?: boolean }> => {
    try {
      const { user: authUser, session: authSession, error } = await authService.signIn(email, password);

      if (error) {
        // Map Supabase errors to user-friendly messages
        let errorMessage = 'Email ou senha incorretos';
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Por favor, confirme seu email antes de fazer login';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Conta temporariamente bloqueada. Tente novamente mais tarde.';
        }
        
        return { success: false, error: errorMessage };
      }

      if (!authUser || !authSession) {
        return { success: false, error: 'Falha na autenticação' };
      }

      // Check if password change is required - Requirement 9.5
      const needsPasswordChange = requiresPasswordChange(authUser);
      
      setSession(authSession);
      setUser(mapSupabaseUser(authUser, authSession.access_token));

      // Prefetch critical data after successful login for better LCP
      // This runs in the background and doesn't block the login flow
      prefetchCriticalData();

      return { 
        success: true, 
        requiresPasswordChange: needsPasswordChange 
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Falha na autenticação. Tente novamente.' };
    }
  }, []);

  /**
   * Logout and destroy session
   * Requirement: 7.3
   */
  const logout = useCallback(async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state
      setUser(null);
      setSession(null);
      
      // Clear any cached data
      localStorage.removeItem('supabase.auth.token');
    }
  }, []);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for auth state changes - Requirement 7.5
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && currentSession?.user) {
          setSession(currentSession);
          setUser(mapSupabaseUser(currentSession.user, currentSession.access_token));
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
        } else if (event === 'TOKEN_REFRESHED' && currentSession?.user) {
          setSession(currentSession);
          setUser(mapSupabaseUser(currentSession.user, currentSession.access_token));
        } else if (event === 'USER_UPDATED' && currentSession?.user) {
          setSession(currentSession);
          setUser(mapSupabaseUser(currentSession.user, currentSession.access_token));
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Listen for session expired events
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('Session expired event received, clearing user state');
      setUser(null);
      setSession(null);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated: !!user && !!session,
      isLoading,
      login,
      logout,
      checkAuth,
      getAccessToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Re-export utility functions for convenience
export { getUserRole, getRedirectPath };
