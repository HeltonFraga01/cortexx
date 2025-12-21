import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import { Loader2, Shield } from 'lucide-react';

/**
 * Superadmin Login Page
 * Uses Supabase Auth for authentication
 * Requirements: 1.1 - Superadmin authentication
 */
const SuperadminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if already logged in as superadmin
    if (isAuthenticated && user?.role === 'superadmin') {
      navigate('/superadmin/dashboard', { replace: true });
    }
  }, [user, isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      setError('Por favor, insira email e senha');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Check if password change is required
        if (result.requiresPasswordChange) {
          navigate('/force-password-change', { replace: true });
          return;
        }
        
        // Wait for auth state to update and verify role
        // The useEffect will handle the redirect once user state is updated
        toast.success('Login realizado com sucesso!');
        
        // Small delay to allow auth state to propagate
        setTimeout(() => {
          navigate('/superadmin/dashboard', { replace: true });
        }, 100);
      } else {
        setError(result.error || 'Credenciais inválidas');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Falha no login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Shield className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Portal Superadmin</h1>
          <p className="text-muted-foreground">
            Administração e gerenciamento da plataforma
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Login Superadmin</CardTitle>
            <CardDescription>
              Insira suas credenciais para acessar a administração
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                type="submit"
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Não é superadmin?
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Ir para Login Regular
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperadminLogin;
