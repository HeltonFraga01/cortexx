import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { backendApi } from '@/services/api-client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * ImpersonationContext - Manages superadmin tenant impersonation state
 * Requirements: Task 7.3 - Fix Impersonation Route Access
 * 
 * This context provides:
 * - Impersonation state tracking
 * - Start/end impersonation functions
 * - Automatic status check on app load for superadmins
 * - localStorage persistence for cross-subdomain support
 */

const IMPERSONATION_STORAGE_KEY = 'wuzapi_impersonation';

interface ImpersonationState {
  isImpersonating: boolean;
  tenantId: string | null;
  tenantName: string | null;
  tenantSubdomain: string | null;
  sessionId: string | null;
  startedAt: string | null;
  durationMinutes: number;
  reason: string | null;
}

interface ImpersonationContextType {
  impersonation: ImpersonationState;
  isLoading: boolean;
  startImpersonation: (tenantId: string, reason?: string) => Promise<boolean>;
  endImpersonation: () => Promise<boolean>;
  checkImpersonationStatus: () => Promise<void>;
}

const defaultState: ImpersonationState = {
  isImpersonating: false,
  tenantId: null,
  tenantName: null,
  tenantSubdomain: null,
  sessionId: null,
  startedAt: null,
  durationMinutes: 0,
  reason: null,
};

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

/**
 * Get impersonation state from localStorage
 */
const getStoredImpersonation = (): ImpersonationState => {
  try {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Calculate duration if impersonating
      if (parsed.isImpersonating && parsed.startedAt) {
        const startedAt = new Date(parsed.startedAt);
        const now = new Date();
        parsed.durationMinutes = Math.round((now.getTime() - startedAt.getTime()) / 60000);
      }
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to parse stored impersonation state:', error);
  }
  return defaultState;
};

/**
 * Save impersonation state to localStorage
 */
const saveImpersonation = (state: ImpersonationState): void => {
  try {
    if (state.isImpersonating) {
      localStorage.setItem(IMPERSONATION_STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to save impersonation state:', error);
  }
};

/**
 * Clear impersonation state from localStorage
 */
const clearStoredImpersonation = (): void => {
  try {
    localStorage.removeItem(IMPERSONATION_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear impersonation state:', error);
  }
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
};

interface ImpersonationProviderProps {
  children: React.ReactNode;
}

export const ImpersonationProvider: React.FC<ImpersonationProviderProps> = ({ children }) => {
  const { user } = useAuth();
  // Initialize from localStorage for cross-subdomain support
  const [impersonation, setImpersonation] = useState<ImpersonationState>(() => {
    if (typeof window !== 'undefined') {
      return getStoredImpersonation();
    }
    return defaultState;
  });
  const [isLoading, setIsLoading] = useState(false);
  // Track if initial load from localStorage is complete
  const [isInitialized, setIsInitialized] = useState(() => {
    // If we have stored impersonation, we're already initialized
    if (typeof window !== 'undefined') {
      const stored = getStoredImpersonation();
      return stored.isImpersonating;
    }
    return false;
  });

  /**
   * Check current impersonation status from backend
   */
  const checkImpersonationStatus = useCallback(async () => {
    if (user?.role !== 'superadmin') {
      setImpersonation(defaultState);
      clearStoredImpersonation();
      return;
    }

    // First check localStorage for persisted state
    const storedState = getStoredImpersonation();
    if (storedState.isImpersonating) {
      setImpersonation(storedState);
    }

    try {
      setIsLoading(true);
      const response = await backendApi.get<any>('/superadmin/impersonation/status');

      if (response.success && response.data?.success) {
        const data = response.data.data;
        if (data.isImpersonating && data.impersonation) {
          const newState: ImpersonationState = {
            isImpersonating: true,
            tenantId: data.impersonation.tenantId,
            tenantName: data.impersonation.tenantName,
            tenantSubdomain: data.impersonation.tenantSubdomain,
            sessionId: data.impersonation.sessionId,
            startedAt: data.impersonation.startedAt,
            durationMinutes: data.impersonation.durationMinutes || 0,
            reason: data.impersonation.reason || null,
          };
          setImpersonation(newState);
          saveImpersonation(newState);
        } else {
          setImpersonation(defaultState);
          clearStoredImpersonation();
        }
      }
    } catch (error) {
      console.warn('Failed to check impersonation status:', error);
      // Keep localStorage state if backend check fails
    } finally {
      setIsLoading(false);
    }
  }, [user?.role]);

  /**
   * Start impersonating a tenant
   * Returns a Promise that resolves to true when impersonation is fully active
   * The Promise includes a small delay to ensure state propagation
   */
  const startImpersonation = useCallback(async (tenantId: string, reason?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await backendApi.post<any>(`/superadmin/impersonate/${tenantId}`, { reason });

      if (response.success && response.data?.success) {
        const data = response.data.data;
        const newState: ImpersonationState = {
          isImpersonating: true,
          tenantId: data.impersonation?.tenantId || tenantId,
          tenantName: data.impersonation?.tenantName || data.tenant?.name,
          tenantSubdomain: data.impersonation?.tenantSubdomain || data.tenant?.subdomain,
          sessionId: data.impersonation?.sessionId || null,
          startedAt: data.impersonation?.startedAt || new Date().toISOString(),
          durationMinutes: 0,
          reason: reason || null,
        };
        
        // Save to localStorage FIRST (synchronous, immediately available)
        saveImpersonation(newState);
        
        // Then update React state
        setImpersonation(newState);
        
        // Wait for React state to propagate before returning
        // This ensures ProtectedRoute will see the updated state
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to start impersonation:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * End current impersonation session
   */
  const endImpersonation = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await backendApi.post<any>('/superadmin/end-impersonation');

      if (response.success && response.data?.success) {
        setImpersonation(defaultState);
        clearStoredImpersonation();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to end impersonation:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check impersonation status when user changes (superadmin login)
  useEffect(() => {
    // Only clear impersonation if user is explicitly NOT superadmin
    // Don't clear during initial loading when user is null/undefined
    if (user?.role === 'superadmin') {
      checkImpersonationStatus();
    } else if (user !== null && user !== undefined && user.role !== 'superadmin') {
      // User is loaded but not superadmin - clear impersonation
      setImpersonation(defaultState);
      clearStoredImpersonation();
    }
    // If user is null/undefined (loading), don't do anything - preserve localStorage
  }, [user?.role, checkImpersonationStatus]);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonation,
        isLoading,
        startImpersonation,
        endImpersonation,
        checkImpersonationStatus,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};
