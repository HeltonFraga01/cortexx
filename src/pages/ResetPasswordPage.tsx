import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBrandingConfig } from '@/hooks/useBranding';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import { Loader2, Lock, CheckCircle } from 'lucide-react';

/**
 * Reset Password Page
 * 
 * This page handles the password reset flow after user clicks the link in their email.
 * Supabase Auth automatically handles the token verification.
 */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const brandingConfig = useBrandingConfig();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  // Check if user has a valid recovery session
  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // User should have a session from the recovery link
        if (session?.user) {
          setHasValidSession(true);
        } else {
          setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setError('Erro ao verificar sessão. Tente novamente.');
      } finally {
        setCheckingSession(false);
      }
    };

    checkRecoverySession();
  }, []);

  // Listen for password recovery event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Por favor, insira uma nova senha');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);

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

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-semibold">Senha Atualizada!</h2>
                <p className="text-muted-foreground">
                  Sua senha foi atualizada com sucesso. Você será redirecionado para o login em instantes...
                </p>
                <Button onClick={() => navigate('/login')} className="w-full">
                  Ir para Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
            <CardTitle className="text-2xl flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Nova Senha
            </CardTitle>
            <CardDescription>
              Digite sua nova senha abaixo
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasValidSession ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={() => navigate('/login')} className="w-full">
                  Voltar ao Login
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Precisa de um novo link?{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => navigate('/login')}
                  >
                    Solicitar novo email
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 8 caracteres
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
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
                    'Atualizar Senha'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
