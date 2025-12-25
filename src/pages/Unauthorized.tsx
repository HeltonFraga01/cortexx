/**
 * Unauthorized Page
 * 
 * Displayed when a user tries to access a resource they don't have permission for.
 */

import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldX, Home, LogIn, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function Unauthorized() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleGoHome = () => {
    // Redirect based on user role
    if (user?.role === 'admin' || user?.role === 'owner' || user?.role === 'tenant_admin') {
      navigate('/admin')
    } else if (user?.role === 'user') {
      navigate('/user')
    } else if (user?.role === 'superadmin') {
      navigate('/superadmin')
    } else {
      navigate('/')
    }
  }

  const handleLogin = async () => {
    // Logout and redirect to login
    await logout()
    navigate('/login')
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acesso Negado</CardTitle>
          <CardDescription className="text-base">
            Você não tem permissão para acessar esta página.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {user 
              ? `Você está logado como ${user.email || user.name || 'usuário'}, mas não possui as permissões necessárias para acessar este recurso.`
              : 'Faça login com uma conta que tenha as permissões necessárias.'}
          </p>
          
          <div className="flex flex-col gap-2">
            <Button onClick={handleGoHome} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Ir para o Início
            </Button>
            
            <Button variant="outline" onClick={handleGoBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            
            {user && (
              <Button variant="ghost" onClick={handleLogin} className="w-full">
                <LogIn className="mr-2 h-4 w-4" />
                Fazer Login com Outra Conta
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
