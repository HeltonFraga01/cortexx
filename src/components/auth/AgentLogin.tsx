/**
 * AgentLogin Component
 * 
 * Login form for agents.
 * 
 * Requirements: 6.1
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { login } from '@/services/agent-auth'
import type { LoginResponse } from '@/types/multi-user'

const loginSchema = z.object({
  accountId: z.string().min(1, 'ID da conta é obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

type LoginFormData = z.infer<typeof loginSchema>

interface AgentLoginProps {
  onSuccess?: (response: LoginResponse) => void
  onRegisterClick?: () => void
  defaultAccountId?: string
}

export function AgentLogin({ onSuccess, onRegisterClick, defaultAccountId }: AgentLoginProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      accountId: defaultAccountId || '',
      email: '',
      password: '',
    },
  })

  const handleSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await login({
        accountId: data.accountId,
        email: data.email,
        password: data.password,
      })
      
      toast.success(`Bem-vindo, ${response.agent.name}!`)
      onSuccess?.(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login'
      setError(message)
      
      if (message.includes('bloqueada') || message.includes('locked')) {
        toast.error('Conta temporariamente bloqueada. Tente novamente mais tarde.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Login de Agente</CardTitle>
        <CardDescription className="text-center">
          Entre com suas credenciais para acessar o sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID da Conta</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Digite o ID da conta" 
                      {...field} 
                      disabled={!!defaultAccountId}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="seu@email.com" 
                      autoComplete="email"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="••••••••" 
                        autoComplete="current-password"
                        {...field} 
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      {onRegisterClick && (
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Recebeu um convite?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={onRegisterClick}>
              Registre-se aqui
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

export default AgentLogin
