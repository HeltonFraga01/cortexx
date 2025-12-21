import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useBrandingConfig } from '@/hooks/useBranding';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import { Loader2, Mail, Lock, User, ArrowLeft, CheckCircle } from 'lucide-react';
import { tenantService } from '@/services/tenant-service';

/**
 * Registration Page
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.5
 */

// Validation schema with Zod
const registerSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z.string()
    .email('Email inválido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const RegisterPage = () => {
  const navigate = useNavigate();
  const brandingConfig = useBrandingConfig();
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  // Form setup
  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Fetch tenant info on mount - Requirement 10.1
  useEffect(() => {
    const fetchTenant = async () => {
      if (tenantService.isLocalhost()) {
        return;
      }
      
      const tenant = await tenantService.getTenantInfo();
      if (tenant) {
        setCurrentTenantId(tenant.id);
      }
    };
    fetchTenant();
  }, []);

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const role = session.user.user_metadata?.role || 'user';
        navigate(role === 'agent' ? '/agent/dashboard' : '/user/dashboard');
      }
    };
    checkSession();
  }, [navigate]);

  // Handle registration - Requirements: 5.1, 5.2, 10.5
  const handleSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Sign up with Supabase Auth - Requirement 5.1
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: {
          data: {
            name: data.name.trim(),
            role: 'user', // Default role - Requirement 10.5
            tenant_id: currentTenantId, // Associate with current tenant - Requirement 10.5
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!authData.user) {
        throw new Error('Falha no cadastro');
      }

      // Show success message - Requirement 5.2
      setSuccess(true);

    } catch (err) {
      // Generic error to prevent email enumeration - Requirement 5.5
      if (err instanceof Error) {
        if (err.message.includes('already registered') || 
            err.message.includes('already exists') ||
            err.message.includes('User already registered')) {
          setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
        } else if (err.message.includes('Password')) {
          setError('Senha muito fraca. Use letras maiúsculas, minúsculas e números.');
        } else {
          setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
        }
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Success state - Requirement 5.2
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-4">
            {brandingConfig.logoUrl ? (
              <div className="flex justify-center">
                <img 
                  src={brandingConfig.logoUrl} 
                  alt={`${brandingConfig.appName} Logo`}
                  className="max-h-16 max-w-48 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <h1 className="text-3xl font-bold">{brandingConfig.appName}</h1>
            )}
          </div>

          <Card>
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Cadastro Realizado!</CardTitle>
              <CardDescription>
                Enviamos um email de confirmação para você
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertDescription>
                  Verifique sua caixa de entrada e clique no link de confirmação para ativar sua conta.
                  O email pode levar alguns minutos para chegar.
                </AlertDescription>
              </Alert>
              
              <Button 
                className="w-full" 
                onClick={() => navigate('/login')}
              >
                Ir para Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-4">
          {brandingConfig.logoUrl ? (
            <div className="flex justify-center">
              <img 
                src={brandingConfig.logoUrl} 
                alt={`${brandingConfig.appName} Logo`}
                className="max-h-16 max-w-48 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <h1 className="text-3xl font-bold">{brandingConfig.appName}</h1>
          )}
          <p className="text-muted-foreground">
            Crie sua conta para começar
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Cadastro</CardTitle>
            <CardDescription>
              Preencha os dados abaixo para criar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            className="pl-10"
                            placeholder="Seu nome completo"
                            disabled={isLoading}
                            autoComplete="name"
                          />
                        </div>
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
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            className="pl-10"
                            placeholder="seu@email.com"
                            disabled={isLoading}
                            autoComplete="email"
                          />
                        </div>
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
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            className="pl-10"
                            placeholder="••••••••"
                            disabled={isLoading}
                            autoComplete="new-password"
                          />
                        </div>
                      </FormControl>
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
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            className="pl-10"
                            placeholder="••••••••"
                            disabled={isLoading}
                            autoComplete="new-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'Criar Conta'
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Já tem conta?{' '}
                    <Link to="/login" className="text-primary hover:underline">
                      Faça login
                    </Link>
                  </p>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate('/login')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao login
        </Button>
      </div>
    </div>
  );
};

export default RegisterPage;
