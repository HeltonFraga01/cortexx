import { Navigate } from 'react-router-dom'
import { useAgentAuth } from '@/contexts/AgentAuthContext'

interface AgentProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: string
}

export default function AgentProtectedRoute({ 
  children, 
  requiredPermission 
}: AgentProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAgentAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/agent/login" replace />
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
          <p className="text-muted-foreground mt-2">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
