import { useState, useEffect } from 'react';
import { useBrandingConfig } from '@/hooks/useBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardHeaderWithIcon } from '@/components/ui-custom';
import BrandingSettings from './BrandingSettings';
import CustomLinksManager from './CustomLinksManager';
import AdminAutomationSettings from './AdminAutomationSettings';

import { Save, TestTube, CheckCircle, XCircle, AlertCircle, Settings, Info, Bot } from 'lucide-react';
import { toast } from 'sonner';

const AdminSettings = () => {
  const brandingConfig = useBrandingConfig();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testDetails, setTestDetails] = useState<string>('');
  const [version, setVersion] = useState<string>('...');

  // Buscar versão do sistema
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch('/api/version');
        if (response.ok) {
          const data = await response.json();
          setVersion(data.version);
        }
      } catch (error) {
        console.error('Erro ao buscar versão:', error);
        setVersion('1.5.10');
      }
    };
    fetchVersion();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestDetails('');
    
    try {
      console.log('Iniciando teste de conexão...');
      
      // Criar um controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos
      
      // Testar através do backend local (evita problemas de CORS)
      // O backend fará proxy para a API WUZAPI externa
      console.log('Fazendo requisição para /api/admin/users...');
      const adminResponse = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('Status da resposta:', adminResponse.status);
      
      if (adminResponse.ok) {
        const data = await adminResponse.json();
        const userCount = data.data?.length || data.filtered_data?.length || 0;
        setTestResult('success');
        setTestDetails(`${userCount} usuário(s) conectado(s)`);
        toast.success(`Conexão OK! ${userCount} usuário(s) encontrado(s)`);
        console.log('Teste de conexão bem-sucedido:', data);
      } else {
        const errorData = await adminResponse.json().catch(() => ({}));
        setTestResult('error');
        
        let errorMessage = '';
        if (adminResponse.status === 401) {
          errorMessage = errorData.code === 'TOKEN_MISSING' 
            ? 'Token de administrador não encontrado na sessão. Faça login novamente.'
            : 'Token de administrador inválido ou expirado';
        } else if (adminResponse.status === 403) {
          errorMessage = 'Acesso negado - verifique as permissões de administrador';
        } else if (adminResponse.status === 504) {
          errorMessage = 'Timeout: A API WUZAPI não respondeu a tempo (mais de 15 segundos)';
        } else if (adminResponse.status === 503) {
          errorMessage = 'Serviço WUZAPI temporariamente indisponível';
        } else if (adminResponse.status === 502) {
          errorMessage = 'Erro de comunicação com a API WUZAPI';
        } else {
          errorMessage = errorData.error || `Erro ${adminResponse.status}: ${adminResponse.statusText}`;
        }
        
        setTestDetails(errorMessage);
        toast.error(errorMessage);
        console.error('Erro no teste de conexão:', errorData);
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      setTestResult('error');
      
      let errorMessage = '';
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout: A requisição demorou mais de 15 segundos';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Erro de conexão: Verifique se o servidor backend está rodando na porta 3001';
      } else {
        errorMessage = `Erro: ${error.message}`;
      }
      
      setTestDetails(errorMessage);
      toast.error(errorMessage);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Configure as definições do sistema
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="automation">
            <Bot className="h-4 w-4 mr-2" />
            Automações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <BrandingSettings />

      <CustomLinksManager />

      <Card>
        <CardHeaderWithIcon
          icon={Settings}
          iconColor="text-blue-500"
          title="Configurações da API"
        >
          <p className="text-sm text-muted-foreground">Configurações atuais da API WUZAPI (definidas no arquivo .env)</p>
        </CardHeaderWithIcon>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Autenticação</Label>
            <Input
              type="password"
              value="••••••••••••••••••••••••"
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Token de administrador gerenciado via sessão segura HTTP-only
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Button onClick={handleTest} disabled={testing} variant="outline">
                {testing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>
              
              {testResult && (
                <div className="flex items-center space-x-1">
                  {testResult === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm ${
                    testResult === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {testResult === 'success' ? 'Conexão OK' : 'Falha na conexão'}
                  </span>
                </div>
              )}
            </div>
            
            {testDetails && (
              <Alert variant={testResult === 'success' ? 'default' : 'destructive'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{testDetails}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeaderWithIcon
          icon={Info}
          iconColor="text-purple-500"
          title="Informações do Sistema"
        >
          <p className="text-sm text-muted-foreground">Informações sobre a configuração atual</p>
        </CardHeaderWithIcon>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Autenticação</Label>
              <p className="text-sm text-muted-foreground">
                Sessão segura baseada em cookies HTTP-only
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">API Backend</Label>
              <p className="text-sm text-muted-foreground">
                Proxy seguro para WUZAPI via backend
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeaderWithIcon
          icon={Info}
          iconColor="text-green-500"
          title="Sobre o Sistema"
        >
          <p className="text-sm text-muted-foreground">Informações sobre o {brandingConfig.appName} Manager</p>
        </CardHeaderWithIcon>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Versão:</span>
            <span className="text-sm font-medium">{version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Desenvolvido por:</span>
            <span className="text-sm font-medium">{brandingConfig.appName} Team</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm">Licença:</span>
            <span className="text-sm font-medium">MIT</span>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="automation">
          <AdminAutomationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;