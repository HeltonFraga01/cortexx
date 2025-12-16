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
import { Loader2 } from 'lucide-react';

const LoginPage = () => {
  const [adminToken, setAdminTokenInput] = useState('');
  const [userToken, setUserToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, user } = useAuth();
  const brandingConfig = useBrandingConfig();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const redirectPath = user.role === 'admin' ? '/admin' : '/user';
      navigate(redirectPath);
    }
  }, [user, navigate]);

  const handleLogin = async (token: string, role: 'admin' | 'user') => {
    if (!token.trim()) {
      toast.error('Por favor, insira o token');
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(token, role);
      if (success) {
        toast.success('Login realizado com sucesso!');
        const redirectPath = role === 'admin' ? '/admin' : '/user';
        navigate(redirectPath);
      } else {
        toast.error('Token inválido ou erro de conexão');
      }
    } catch (error) {
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
              Selecione o tipo de acesso e insira seu token
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
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin(userToken, 'user')}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleLogin(userToken, 'user')}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar como Usuário
                </Button>
              </TabsContent>
              
              <TabsContent value="admin" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-token-input">Token de Administrador</Label>
                  <Input
                    id="admin-token-input"
                    type="password"
                    value={adminToken}
                    onChange={(e) => setAdminTokenInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin(adminToken, 'admin')}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => handleLogin(adminToken, 'admin')}
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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