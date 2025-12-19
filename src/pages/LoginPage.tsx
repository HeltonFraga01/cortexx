import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import ThemeToggle from '@/components/ui-custom/ThemeToggle';
import { Loader2, Shield } from 'lucide-react';
import { loginAgent, setAgentToken, setAgentData } from '@/services/agent-auth';

const LoginPage = () => {
  const [userToken, setUserToken] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, loginSuperadmin, loginAsAdmin, user } = useAuth();
  const brandingConfig = useBrandingConfig();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'superadmin') {
        navigate('/superadmin/dashboard');
      } else if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    }
  }, [user, navigate]);

  const handleUserLogin = async () => {
    if (!userToken.trim()) {
      toast.error('Por favor, insira o token');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(userToken, 'user');
      if (success) {
        toast.success('Login realizado com sucesso!');
        navigate('/user');
      } else {
        toast.error('Token inválido ou erro de conexão');
      }
    } catch (error) {
      toast.error('Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    if (!adminEmail.trim() || !adminPassword.trim()) {
      toast.error('Por favor, insira email e senha');
      return;
    }

    setIsLoading(true);
    try {
      // Try admin login first (creates HTTP-only session for /admin routes)
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Admin login successful - session created on server
        // Update AuthContext with user data
        loginAsAdmin({
          id: data.user.id,
          name: data.user.name,
          token: data.user.token
        });
        
        // Refresh CSRF token after login
        try {
          const { backendApi } = await import('@/services/api-client');
          await backendApi.refreshCsrfToken();
        } catch (csrfError) {
          console.error('Erro ao renovar CSRF (não crítico):', csrfError);
        }
        
        toast.success(`Bem-vindo, ${data.user.name}!`);
        navigate('/admin');
        return;
      }

      // If admin login fails with NOT_ADMIN, try agent login for regular agents
      if (data.code === 'NOT_ADMIN') {
        try {
          const result = await loginAgent(adminEmail, adminPassword);
          toast.success(`Bem-vindo, ${result.agent.name}!`);
          navigate('/agent');
          return;
        } catch {
          toast.error('Credenciais inválidas');
          return;
        }
      }

      // If admin login fails, try superadmin login
      try {
        const success = await loginSuperadmin(adminEmail, adminPassword);
        if (success) {
          toast.success('Login realizado com sucesso!');
          navigate('/superadmin/dashboard');
        } else {
          toast.error('Credenciais inválidas');
        }
      } catch {
        toast.error('Credenciais inválidas');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      toast.error('Erro ao fazer login');
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
            Faça login para acessar o painel de controle
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Selecione o tipo de acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="user" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="user">Usuário</TabsTrigger>
                <TabsTrigger value="admin">Administrador</TabsTrigger>
              </TabsList>
              
              <TabsContent value="user" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user-token">Token de Usuário</Label>
                  <Input
                    id="user-token"
                    type="password"
                    value={userToken}
                    onChange={(e) => setUserToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUserLogin()}
                    placeholder="Insira seu token de acesso"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleUserLogin}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar como Usuário
                </Button>
              </TabsContent>
              
              <TabsContent value="admin" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    placeholder="admin@exemplo.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Senha</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleAdminLogin}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Shield className="mr-2 h-4 w-4" />
                  Entrar como Administrador
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                É um agente da equipe?
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/agent/login')}
              >
                Login de Agente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;