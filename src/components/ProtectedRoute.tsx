import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user' | 'superadmin' | 'agent';
}

const ProtectedRoute = ({
  children,
  requiredRole,
}: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

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

  if (requiredRole && user.role !== requiredRole) {
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