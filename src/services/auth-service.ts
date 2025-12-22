/**
 * Unified Authentication Service
 * Requirements: 2.1, 3.1, 4.1, 7.1, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 * 
 * Provides centralized authentication operations using Supabase Auth
 */

import { supabase } from '@/lib/supabase';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

// Types
export type UserRole = 'agent' | 'user' | 'admin' | 'superadmin';

export interface UserMetadata {
  role: UserRole;
  tenant_id: string;
  name: string;
  avatar_url?: string;
  legacy_table?: 'agents' | 'users' | 'superadmins';
  legacy_id?: string;
  requires_password_change?: boolean;
}

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  tenantId?: string;
}

export interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

// Role to redirect path mapping - Requirements: 8.2, 8.3, 8.4, 8.5
const ROLE_REDIRECTS: Record<UserRole, string> = {
  agent: '/agent/dashboard',
  user: '/user/dashboard',
  admin: '/admin',
  superadmin: '/superadmin/dashboard',
};

/**
 * Get redirect path based on user role
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
 */
export function getRedirectPath(role: UserRole | string | undefined): string {
  if (!role) return ROLE_REDIRECTS.user; // Default to user - Requirement 8.6
  return ROLE_REDIRECTS[role as UserRole] || ROLE_REDIRECTS.user;
}

/**
 * Extract user role from Supabase user metadata
 * Requirements: 8.1, 8.6
 */
export function getUserRole(user: User | null): UserRole {
  if (!user) return 'user';
  const role = user.user_metadata?.role;
  if (role && ['agent', 'user', 'admin', 'superadmin'].includes(role)) {
    return role as UserRole;
  }
  return 'user'; // Default - Requirement 8.6
}

/**
 * Get user metadata from Supabase user
 */
export function getUserMetadata(user: User | null): Partial<UserMetadata> | null {
  if (!user) return null;
  return user.user_metadata as Partial<UserMetadata>;
}

/**
 * Check if user requires password change (for migrated users)
 * Requirement: 9.5
 */
export function requiresPasswordChange(user: User | null): boolean {
  if (!user) return false;
  return user.user_metadata?.requires_password_change === true;
}

/**
 * Sign in with email and password
 * Requirements: 2.1, 3.1, 4.1
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      return { user: null, session: null, error };
    }

    return { user: data.user, session: data.session, error: null };
  } catch (err) {
    return { 
      user: null, 
      session: null, 
      error: err instanceof Error ? err : new Error('Authentication failed') 
    };
  }
}

/**
 * Sign out current user
 * Requirement: 7.3
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Sign up new user with metadata
 * Requirements: 5.1, 10.1, 10.5
 */
export async function signUp(data: SignUpData): Promise<AuthResponse> {
  try {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          name: data.name,
          role: data.role || 'user',
          tenant_id: data.tenantId,
        },
      },
    });

    if (error) {
      return { user: null, session: null, error };
    }

    return { user: authData.user, session: authData.session, error: null };
  } catch (err) {
    return { 
      user: null, 
      session: null, 
      error: err instanceof Error ? err : new Error('Registration failed') 
    };
  }

}

/**
 * Login as admin via backend API
 */
export async function loginAdmin(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Falha no login administrativo');
    }

    // Adapt response to AuthResponse format
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        user_metadata: {
          role: data.user.role,
          name: data.user.name,
          account_id: data.user.accountId
        },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString()
       } as unknown as User,
      session: {
        access_token: data.user.token,
        refresh_token: '',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
           id: data.user.id,
           email: data.user.email
        } as unknown as User
      } as Session,
      error: null
    };
  } catch (err) {
    return {
      user: null,
      session: null,
      error: err instanceof Error ? err : new Error('Admin login failed')
    };
  }
}

/**
 * Request password reset email
 * Requirements: 6.1, 6.5
 */
export async function resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  
  // Don't throw error to prevent email enumeration - Requirement 6.5
  if (error) {
    console.error('Password reset error:', error.message);
  }
}

/**
 * Update user password
 * Requirement: 6.3
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  if (error) throw error;
}

/**
 * Update user metadata (e.g., remove requires_password_change flag)
 */
export async function updateUserMetadata(metadata: Partial<UserMetadata>): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: metadata,
  });
  
  if (error) throw error;
}

/**
 * Get current session
 * Requirement: 7.2
 */
export async function getSession(): Promise<Session | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

/**
 * Get current user
 */
export async function getUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Listen for auth state changes
 * Requirement: 7.5
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

/**
 * Verify email confirmation status
 * Requirement: 5.4
 */
export function isEmailConfirmed(user: User | null): boolean {
  if (!user) return false;
  return !!user.email_confirmed_at;
}

/**
 * Resend confirmation email
 */
export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
  });
  
  if (error) throw error;
}

// Export auth service object for convenience
export const authService = {
  signIn,
  signOut,
  signUp,
  resetPassword,
  updatePassword,
  updateUserMetadata,
  getSession,
  getUser,
  onAuthStateChange,
  getUserRole,
  getUserMetadata,
  getRedirectPath,
  requiresPasswordChange,
  isEmailConfirmed,
  resendConfirmationEmail,
  loginAdmin,
};

export default authService;
