/**
 * Auth Error Boundary Component (Task 12)
 * 
 * Handles authentication failures gracefully with user-friendly error messages.
 * Clears corrupted session data and redirects to login.
 */

import { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackPath?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    
    // Log error with context for debugging
    console.error('[AuthErrorBoundary] Authentication error caught:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    })

    // Check if this is an auth-related error
    const isAuthError = this.isAuthenticationError(error)
    
    if (isAuthError) {
      this.clearCorruptedSession()
    }
  }

  private isAuthenticationError(error: Error): boolean {
    const authErrorPatterns = [
      'unauthorized',
      'unauthenticated',
      'session expired',
      'invalid token',
      'jwt expired',
      'token invalid',
      'not authenticated',
      '401',
      '403'
    ]
    
    const errorMessage = error.message.toLowerCase()
    return authErrorPatterns.some(pattern => errorMessage.includes(pattern))
  }

  private clearCorruptedSession() {
    try {
      // Clear auth-related localStorage items
      const authKeys = [
        'authToken',
        'userToken',
        'adminToken',
        'sessionToken',
        'user',
        'userRole',
        'accountId'
      ]
      
      authKeys.forEach(key => {
        localStorage.removeItem(key)
      })
      
      // Clear sessionStorage as well
      sessionStorage.clear()
      
      console.info('[AuthErrorBoundary] Cleared corrupted session data')
    } catch (e) {
      console.error('[AuthErrorBoundary] Failed to clear session:', e)
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  private handleLogin = () => {
    this.clearCorruptedSession()
    const { fallbackPath = '/login' } = this.props
    window.location.href = fallbackPath
  }

  render() {
    if (this.state.hasError) {
      const isAuthError = this.state.error && this.isAuthenticationError(this.state.error)
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>
                {isAuthError ? 'Sessão Expirada' : 'Algo deu errado'}
              </CardTitle>
              <CardDescription>
                {isAuthError 
                  ? 'Sua sessão expirou ou é inválida. Por favor, faça login novamente.'
                  : 'Ocorreu um erro inesperado. Tente novamente ou faça login.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Button onClick={this.handleLogin} className="w-full">
                  <LogIn className="mr-2 h-4 w-4" />
                  Fazer Login
                </Button>
                {!isAuthError && (
                  <Button variant="outline" onClick={this.handleRetry} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Tentar Novamente
                  </Button>
                )}
              </div>
              
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-foreground">
                    Detalhes do erro (dev only)
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-32">
                    {this.state.error.message}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default AuthErrorBoundary
