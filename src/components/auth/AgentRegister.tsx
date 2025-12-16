/**
 * AgentRegister Component
 * 
 * Registration form for invitation links.
 * 
 * Requirements: 2.3, 2.4
 */

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, UserPlus, AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { validateInvitation, register } from '@/services/agent-auth'
import type { LoginResponse, InvitationValidation } from '@/types/multi-user'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type RegisterFormData = z.infer<typeof registerSchema>

interface AgentRegisterProps {
  invitationToken: string
  onSuccess?: (response: LoginResponse) => void
  onLoginClick?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

export function AgentRegister({ invitationToken, onSuccess, onLoginClick }: AgentRegisterProps) {
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [invitation, setInvitation] = useState<InvitationValidation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  useEffect(() => {
    const validate = async () => {
      try {
        setValidating(true)
        const result = await validateInvitation(invitationToken)
        setInvitation(result)
        
        if (result.valid && result.invitation?.email) {
          form.setValue('email', result.invitation.email)
        }
      } catch (err) {
        console.error('Error validating invitation:', err)
        setInvitation({ valid: false })
      } finally {
        setValidating(false)
      }
    }

    validate()
  }, [invitationToken, form])

  const handleSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await register(invitationToken, {
        name: data.name,
        email: data.email,
        password: data.password,
      })
      
      toast.success('Registro concluído com sucesso!')
      onSuccess?.(response)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao registrar'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Validando convite...</p>
        </CardContent>
      </Card>
    )
  }

  if (!invitation?.valid) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <XCircle className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Convite Inválido</CardTitle>
          <CardDescription className="text-center">
            Este link de convite é inválido ou já expirou.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Link expirado ou inválido</AlertTitle>
            <AlertDescription>
              Os links de convite são válidos por 48 horas. Solicite um novo convite ao administrador da conta.
            </AlertDescription>
          </Alert>
        </CardContent>
        {onLoginClick && (
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={onLoginClick}>
              Ir para Login
            </Button>
          </CardFooter>
        )}
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-2">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <CardTitle className="text-2xl font-bold text-center">Complete seu Registro</CardTitle>
        <CardDescription className="text-center">
          Você foi convidado para se juntar à equipe
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Invitation Info */}
        <div className="rounded-lg border bg-muted/50 p-4 mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Conta:</span>
            <span className="text-sm">{invitation.account?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Papel:</span>
            <Badge variant="secondary">
              {ROLE_LABELS[invitation.invitation?.role || 'agent']}
            </Badge>
          </div>
          {invitation.invitation?.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Expira em:</span>
              <span className="text-sm text-muted-foreground">
                {new Date(invitation.invitation.expiresAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome" autoComplete="name" {...field} />
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
                      disabled={!!invitation.invitation?.email}
                      {...field} 
                    />
                  </FormControl>
                  {invitation.invitation?.email && (
                    <FormDescription>
                      Este convite está vinculado a este email.
                    </FormDescription>
                  )}
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
                        autoComplete="new-password"
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
                  <FormDescription>
                    Mínimo 8 caracteres, com maiúscula, minúscula e número.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        placeholder="••••••••" 
                        autoComplete="new-password"
                        {...field} 
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
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
                  Registrando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Conta
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      {onLoginClick && (
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Já tem uma conta?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={onLoginClick}>
              Faça login
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

export default AgentRegister
