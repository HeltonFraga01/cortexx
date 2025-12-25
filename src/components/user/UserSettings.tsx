import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CardHeaderWithIcon } from '@/components/ui-custom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import { BotSettings } from '@/components/features/chat/settings/BotSettings';
import { WebhookSettings } from '@/components/features/chat/settings/WebhookSettings';
import { LabelManager } from '@/components/features/chat/settings/LabelManager';
import { CannedResponseManager } from '@/components/features/chat/settings/CannedResponseManager';
import { NotificationSettings } from '@/components/features/chat/settings/NotificationSettings';
import { InboxProvider } from '@/contexts/InboxContext';
import { Webhook, Settings as SettingsIcon, Eye, EyeOff, Copy, User as UserIcon, AlertCircle, Bot, Tags, MessageSquareText, Bell, CreditCard } from 'lucide-react';
import { SubscriptionManager } from '@/components/user/billing/SubscriptionManager';
import { toast } from 'sonner';

const UserSettings = () => {
  const brandingConfig = useBrandingConfig();
  const [showToken, setShowToken] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  
  const { user } = useAuth();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Token copiado!');
    } catch (error) {
      toast.error('Erro ao copiar token');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferências e configurações do WhatsApp
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Conta</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Assinatura</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="bots" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">Bots</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks-chat" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Integração Chat</span>
          </TabsTrigger>
          <TabsTrigger value="labels" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            <span className="hidden sm:inline">Etiquetas</span>
          </TabsTrigger>
          <TabsTrigger value="canned" className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4" />
            <span className="hidden sm:inline">Respostas</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Informações da Conta */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeaderWithIcon
              icon={SettingsIcon}
              iconColor="text-blue-500"
              title="Informações da Conta"
            >
              <p className="text-sm text-muted-foreground">Detalhes da sua instância {brandingConfig.appName}</p>
            </CardHeaderWithIcon>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Nome da Instância</Label>
                  <p className="text-base font-medium">{user?.name}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">ID do Usuário</Label>
                  <p className="text-base font-medium font-mono">{user?.id}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Tipo de Conta</Label>
                  <Badge variant="outline" className="capitalize">
                    {user?.role}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">API Backend</Label>
                  <p className="text-sm text-muted-foreground break-all">
                    Proxy seguro via backend
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Token de Autenticação</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-md overflow-x-auto">
                    {showToken ? user?.token : `${user?.token?.substring(0, 20)}...`}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(user?.token || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use este token para autenticar suas requisições à API {brandingConfig.appName}
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Mantenha seu token seguro
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Não compartilhe seu token de autenticação. Ele fornece acesso completo à sua instância do WhatsApp.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Assinatura */}
        <TabsContent value="subscription" className="space-y-6">
          <SubscriptionManager />
        </TabsContent>

        {/* Tab: Notificações */}
        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
        </TabsContent>

        {/* Tab: Bots */}
        <TabsContent value="bots" className="space-y-6">
          <BotSettings />
        </TabsContent>

        {/* Tab: Webhooks de Chat */}
        <TabsContent value="webhooks-chat" className="space-y-6">
          <InboxProvider>
            <WebhookSettings />
          </InboxProvider>
        </TabsContent>

        {/* Tab: Etiquetas */}
        <TabsContent value="labels" className="space-y-6">
          <LabelManager />
        </TabsContent>

        {/* Tab: Respostas Rápidas */}
        <TabsContent value="canned" className="space-y-6">
          <CannedResponseManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserSettings;
