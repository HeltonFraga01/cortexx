import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { authService } from '@/services/auth-service';

/**
 * Force Password Change Page
 * Requirement: 9.5
 * 
 * Displayed when a migrated user logs in with a temporary password
 * and needs to set a new password before accessing the system.
 */

// Validation schema
const passwordSchema = z.object({
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

type PasswordFormData = z.infer<typeof passwordSchema>;

const ForcePasswordChangePage = () => {
  const navigate = useNavigate();
  const brandingConfig = useBrandingConfig();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  // Check if user is authenticated and needs password change
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // Not authenticated, redirect to login
          navigate('/login');
          return;
        }

        // Check if password change is required
        const requiresChange = authService.requiresPasswordChange(session.user);
        
        if (!requiresChange) {
          // No password change needed, redirect to appropriate dashboard
          const role = authService.getUserRole(session.user);
          navigate(authService.getRedirectPath(role));
        }
      } catch (err) {
        console.error('Auth check error:', err);
        navigate('/login');
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // Handle password change - Requirement 9.5
  const handleSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        throw updateError;
      }

      // Remove the requires_password_change flag
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          requires_password_change: false,
        },
      });

      if (metadataError) {
        console.error('Failed to update metadata:', metadataError);
        // Continue anyway, password was changed
      }

      // Get user role and redirect to appropriate dashboard
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = authService.getUserRole(user);
        navigate(authService.getRedirectPath(role));
      } else {
        navigate('/login');
      }

    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('same password')) {
          setError('A nova senha deve ser diferente da senha atual');
        } else {
          setError(err.message);
        }
      } else {
        setError('Erro ao atualizar senha. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-xl">Troca de Senha Obrigatória</CardTitle>
            </div>
            <CardDescription>
              Por segurança, você precisa definir uma nova senha antes de continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Senha</FormLabel>
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
                      <FormLabel>Confirmar Nova Senha</FormLabel>
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

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>A senha deve conter:</p>
                  <ul className="list-disc list-inside">
                    <li>Pelo menos 8 caracteres</li>
                    <li>Uma letra maiúscula</li>
                    <li>Uma letra minúscula</li>
                    <li>Um número</li>
                  </ul>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    'Definir Nova Senha'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleLogout}
                  disabled={isLoading}
                >
                  Sair
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForcePasswordChangePage;
