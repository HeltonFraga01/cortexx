import { useState, useEffect } from 'react';
import { useBrandingConfig } from '@/hooks/useBranding';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardHeaderWithIcon } from '@/components/ui-custom';
import BrandingSettings from './BrandingSettings';
import CustomLinksManager from './CustomLinksManager';
import AdminAutomationSettings from './AdminAutomationSettings';
import ApiSettingsForm from './ApiSettingsForm';

import { Settings, Info, Bot } from 'lucide-react';

const AdminSettings = () => {
  const brandingConfig = useBrandingConfig();
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
      } catch {
        setVersion('1.5.10');
      }
    };
    fetchVersion();
  }, []);

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

      <ApiSettingsForm />

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