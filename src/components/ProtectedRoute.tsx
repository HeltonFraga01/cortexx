import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

const IMPERSONATION_STORAGE_KEY = 'wuzapi_impersonation';

/**
 * Get impersonation state from localStorage (synchronous fallback)
 * This ensures we can check impersonation even if React state hasn't updated yet
 */
const getStoredImpersonation = (): { isImpersonating: boolean; tenantId: string | null } => {
  try {
    const stored = localStorage.getItem(IMPERSONATION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        isImpersonating: parsed.isImpersonating === true,
        tenantId: parsed.tenantId || null,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { isImpersonating: false, tenantId: null };
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user' | 'superadmin' | 'agent';
}

const ProtectedRoute = ({
  children,
  requiredRole,
}: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const { impersonation } = useImpersonation();
  const location = useLocation();

  // Check both React state AND localStorage for impersonation
  // This handles the race condition where navigation happens before state updates
  const storedImpersonation = getStoredImpersonation();
  const isImpersonating = impersonation.isImpersonating || storedImpersonation.isImpersonating;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // Redirecionar para login apropriado baseado na rota
    const loginPath = location.pathname.startsWith('/superadmin') ? '/superadmin/login' : '/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  // Check if superadmin is impersonating and trying to access admin routes
  const isSuperadminImpersonating = user.role === 'superadmin' && isImpersonating;
  
  if (requiredRole && user.role !== requiredRole) {
    // Allow superadmin to access admin routes when impersonating
    if (requiredRole === 'admin' && isSuperadminImpersonating) {
      return <>{children}</>;
    }
    
    // Redirecionar para o dashboard apropriado baseado no role
    let redirectPath = '/user/dashboard';
    if (user.role === 'admin') redirectPath = '/admin';
    if (user.role === 'superadmin') redirectPath = '/superadmin/dashboard';
    if (user.role === 'agent') redirectPath = '/agent/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;