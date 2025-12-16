import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CardHeaderWithIcon } from '@/components/ui-custom';
import { useAuth } from '@/contexts/AuthContext';
import { useBrandingConfig } from '@/hooks/useBranding';
import { WuzAPIService } from '@/services/wuzapi';
import { BotSettings } from '@/components/features/chat/settings/BotSettings';
import { WebhookSettings } from '@/components/features/chat/settings/WebhookSettings';
import { LabelManager } from '@/components/features/chat/settings/LabelManager';
import { CannedResponseManager } from '@/components/features/chat/settings/CannedResponseManager';
import { NotificationSettings } from '@/components/features/chat/settings/NotificationSettings';
import { Save, Webhook, Settings as SettingsIcon, Eye, EyeOff, Copy, User as UserIcon, Loader2, AlertCircle, CheckCircle2, Bot, Tags, MessageSquareText, Bell } from 'lucide-react';
import { toast } from 'sonner';

const UserSettings = () => {
  const brandingConfig = useBrandingConfig();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['Message']);
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  
  const { user } = useAuth();
  const wuzapi = new WuzAPIService();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Token copiado!');
    } catch (error) {
      toast.error('Erro ao copiar token');
    }
  };

  // Eventos válidos conforme código fonte do WUZAPI (wmiau.go)
  // Ref: https://github.com/asternic/wuzapi/blob/main/wmiau.go
  const availableEvents = [
    // Mensagens
    { id: 'Message', label: 'Mensagens', description: 'Todas as mensagens recebidas e enviadas', category: 'messages' },
    { id: 'ReadReceipt', label: 'Confirmação de Leitura', description: 'Confirmações de entrega e leitura', category: 'messages' },
    { id: 'UndecryptableMessage', label: 'Mensagens Não Decriptáveis', description: 'Mensagens que não puderam ser decriptadas', category: 'messages' },
    { id: 'MediaRetry', label: 'Retry de Mídia', description: 'Tentativas de reenvio de mídia', category: 'messages' },
    
    // Grupos
    { id: 'GroupInfo', label: 'Info do Grupo', description: 'Atualizações de informações de grupos', category: 'groups' },
    { id: 'JoinedGroup', label: 'Entrou no Grupo', description: 'Quando você entra em um grupo', category: 'groups' },
    
    // Newsletter/Canais
    { id: 'NewsletterJoin', label: 'Entrar Newsletter', description: 'Entrada em canal/newsletter', category: 'newsletter' },
    { id: 'NewsletterLeave', label: 'Sair Newsletter', description: 'Saída de canal/newsletter', category: 'newsletter' },
    { id: 'NewsletterMuteChange', label: 'Silenciar Newsletter', description: 'Mudança no status de silenciar', category: 'newsletter' },
    { id: 'NewsletterLiveUpdate', label: 'Atualização Newsletter', description: 'Atualizações ao vivo de newsletter', category: 'newsletter' },
    { id: 'FBMessage', label: 'Mensagem Facebook', description: 'Mensagens do Facebook/Meta', category: 'newsletter' },
    
    // Presença
    { id: 'Presence', label: 'Presença', description: 'Status online/offline dos contatos', category: 'presence' },
    { id: 'ChatPresence', label: 'Presença em Chats', description: 'Digitando, gravando áudio', category: 'presence' },
    
    // Chamadas
    { id: 'CallOffer', label: 'Oferta de Chamada', description: 'Chamadas recebidas', category: 'calls' },
    { id: 'CallAccept', label: 'Chamada Aceita', description: 'Chamadas aceitas', category: 'calls' },
    { id: 'CallTerminate', label: 'Chamada Encerrada', description: 'Chamadas terminadas', category: 'calls' },
    { id: 'CallOfferNotice', label: 'Aviso de Chamada', description: 'Avisos de ofertas de chamada', category: 'calls' },
    { id: 'CallRelayLatency', label: 'Latência de Chamada', description: 'Latência do relay de chamadas', category: 'calls' },
    
    // Conexão
    { id: 'Connected', label: 'Conectado', description: 'Conexão estabelecida com WhatsApp', category: 'connection' },
    { id: 'Disconnected', label: 'Desconectado', description: 'Desconexão do WhatsApp', category: 'connection' },
    { id: 'ConnectFailure', label: 'Falha de Conexão', description: 'Falhas na conexão', category: 'connection' },
    { id: 'LoggedOut', label: 'Deslogado', description: 'Sessão encerrada', category: 'connection' },
    { id: 'StreamError', label: 'Erro de Stream', description: 'Erros no stream de dados', category: 'connection' },
    { id: 'ClientOutdated', label: 'Cliente Desatualizado', description: 'Cliente precisa atualização', category: 'connection' },
    { id: 'TemporaryBan', label: 'Ban Temporário', description: 'Banimento temporário', category: 'connection' },
    
    // Keep Alive
    { id: 'KeepAliveRestored', label: 'Keep Alive Restaurado', description: 'Conexão keep alive restaurada', category: 'keepalive' },
    { id: 'KeepAliveTimeout', label: 'Timeout Keep Alive', description: 'Timeout do keep alive', category: 'keepalive' },
    
    // Pareamento/QR
    { id: 'PairSuccess', label: 'Pareamento Sucesso', description: 'QR Code escaneado com sucesso', category: 'pairing' },
    { id: 'PairError', label: 'Erro de Pareamento', description: 'Erros no pareamento', category: 'pairing' },
    { id: 'QR', label: 'QR Code', description: 'Novo QR Code gerado', category: 'pairing' },
    { id: 'QRTimeout', label: 'QR Code Expirado', description: 'QR Code expirou', category: 'pairing' },
    
    // Sincronização
    { id: 'HistorySync', label: 'Sincronização de Histórico', description: 'Sincronização do histórico', category: 'sync' },
    { id: 'OfflineSyncPreview', label: 'Preview Sync Offline', description: 'Preview de sincronização offline', category: 'sync' },
    { id: 'OfflineSyncCompleted', label: 'Sync Offline Completo', description: 'Sincronização offline completada', category: 'sync' },
    
    // Perfil e Privacidade
    { id: 'Picture', label: 'Foto de Perfil', description: 'Mudanças de foto de perfil', category: 'profile' },
    { id: 'UserAbout', label: 'Sobre do Usuário', description: 'Mudanças no "sobre"', category: 'profile' },
    { id: 'PrivacySettings', label: 'Config. Privacidade', description: 'Mudanças nas configurações', category: 'profile' },
    { id: 'IdentityChange', label: 'Mudança de Identidade', description: 'Mudanças na identidade', category: 'profile' },
    
    // Bloqueio
    { id: 'BlocklistChange', label: 'Mudança Lista Bloqueio', description: 'Mudanças na lista de bloqueio', category: 'blocklist' },
    { id: 'Blocklist', label: 'Lista de Bloqueio', description: 'Eventos da lista de bloqueio', category: 'blocklist' },
  ];

  // IDs válidos de eventos do WUZAPI (extraídos do código fonte)
  const validEventIds = [
    'Message', 'ReadReceipt', 'UndecryptableMessage', 'MediaRetry',
    'GroupInfo', 'JoinedGroup',
    'NewsletterJoin', 'NewsletterLeave', 'NewsletterMuteChange', 'NewsletterLiveUpdate', 'FBMessage',
    'Presence', 'ChatPresence',
    'CallOffer', 'CallAccept', 'CallTerminate', 'CallOfferNotice', 'CallRelayLatency',
    'Connected', 'Disconnected', 'ConnectFailure', 'LoggedOut', 'StreamError', 'ClientOutdated', 'TemporaryBan',
    'KeepAliveRestored', 'KeepAliveTimeout',
    'PairSuccess', 'PairError', 'QR', 'QRTimeout',
    'HistorySync', 'OfflineSyncPreview', 'OfflineSyncCompleted',
    'Picture', 'UserAbout', 'PrivacySettings', 'IdentityChange',
    'BlocklistChange', 'Blocklist',
    'All'
  ];

  const fetchWebhookConfig = async () => {
    if (!user?.token) return;
    
    try {
      const config = await wuzapi.getWebhook(user.token);
      setWebhookUrl(config.webhook || '');
      
      // Filtrar apenas eventos válidos do WUZAPI
      const rawEvents = config.subscribe || ['Message'];
      const filteredEvents = rawEvents.filter((e: string) => validEventIds.includes(e));
      
      // Se nenhum evento válido, usar Message como padrão
      setSelectedEvents(filteredEvents.length > 0 ? filteredEvents : ['Message']);
    } catch (error) {
      console.error('Error fetching webhook config:', error);
      toast.error('Erro ao carregar configurações do webhook');
    }
  };

  const handleSaveWebhook = async () => {
    if (!user?.token) return;
    
    setLoading(true);
    try {
      let currentWebhookUrl = webhookUrl;
      if (!currentWebhookUrl) {
        try {
          const currentConfig = await wuzapi.getWebhook(user.token);
          currentWebhookUrl = currentConfig.webhook || '';
        } catch (error) {
          console.warn('Não foi possível buscar webhook atual');
        }
      }
      
      await wuzapi.setWebhook(user.token, currentWebhookUrl, selectedEvents);
      toast.success('Webhook configurado com sucesso!');
      await fetchWebhookConfig();
    } catch (error) {
      console.error('Error saving webhook:', error);
      toast.error('Erro ao configurar webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleEventToggle = (eventId: string, checked: boolean) => {
    if (eventId === 'All') {
      if (checked) {
        setSelectedEvents(['All']);
      } else {
        setSelectedEvents(['Message']);
      }
    } else {
      if (checked) {
        const newEvents = selectedEvents.filter(e => e !== 'All');
        setSelectedEvents([...newEvents, eventId]);
      } else {
        const newEvents = selectedEvents.filter(e => e !== eventId);
        setSelectedEvents(newEvents.length > 0 ? newEvents : ['Message']);
      }
    }
  };

  useEffect(() => {
    fetchWebhookConfig();
  }, [user?.token]);


  const eventsByCategory = {
    messages: availableEvents.filter(e => e.category === 'messages'),
    groups: availableEvents.filter(e => e.category === 'groups'),
    newsletter: availableEvents.filter(e => e.category === 'newsletter'),
    presence: availableEvents.filter(e => e.category === 'presence'),
    calls: availableEvents.filter(e => e.category === 'calls'),
    connection: availableEvents.filter(e => e.category === 'connection'),
    keepalive: availableEvents.filter(e => e.category === 'keepalive'),
    pairing: availableEvents.filter(e => e.category === 'pairing'),
    sync: availableEvents.filter(e => e.category === 'sync'),
    profile: availableEvents.filter(e => e.category === 'profile'),
    blocklist: availableEvents.filter(e => e.category === 'blocklist'),
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
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="webhook" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">Webhook</span>
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
          <WebhookSettings />
        </TabsContent>

        {/* Tab: Etiquetas */}
        <TabsContent value="labels" className="space-y-6">
          <LabelManager />
        </TabsContent>

        {/* Tab: Respostas Rápidas */}
        <TabsContent value="canned" className="space-y-6">
          <CannedResponseManager />
        </TabsContent>

        {/* Tab: Configuração de Webhook WUZAPI */}
        <TabsContent value="webhook" className="space-y-6">
          <Card>
            <CardHeaderWithIcon
              icon={Webhook}
              iconColor="text-purple-500"
              title="Configuração de Webhook"
            >
              <p className="text-sm text-muted-foreground">Configure o webhook para receber eventos do WhatsApp em tempo real</p>
            </CardHeaderWithIcon>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="webhook-url">URL do Webhook</Label>
                <Input
                  id="webhook-url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://seu-servidor.com/webhook"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  URL onde os eventos do WhatsApp serão enviados via POST
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Eventos para Receber</Label>
                  <Badge variant="secondary">
                    {selectedEvents.includes('All') ? 'Todos' : `${selectedEvents.length} selecionados`}
                  </Badge>
                </div>
                
                {/* Opção All Events */}
                <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-950">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="All"
                      checked={selectedEvents.includes('All')}
                      onCheckedChange={(checked) => handleEventToggle('All', checked as boolean)}
                    />
                    <div className="grid gap-1.5 leading-none flex-1">
                      <Label
                        htmlFor="All"
                        className="text-sm font-semibold leading-none text-blue-700 dark:text-blue-300 cursor-pointer"
                      >
                        ⭐ Todos os Eventos
                      </Label>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        Receber todos os 50+ tipos de eventos disponíveis automaticamente
                      </p>
                    </div>
                  </div>
                </div>

                {/* Eventos individuais */}
                {!selectedEvents.includes('All') && (
                  <div className="space-y-4 border rounded-lg p-4 max-h-[500px] overflow-y-auto">
                    {/* Mensagens */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>📨</span> Mensagens
                      </h4>
                      <div className="grid gap-2 ml-6">
                        {eventsByCategory.messages.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                            <div className="grid gap-0.5 leading-none flex-1">
                              <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Grupos */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>👥</span> Grupos
                      </h4>
                      <div className="grid gap-2 ml-6">
                        {eventsByCategory.groups.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                            <div className="grid gap-0.5 leading-none flex-1">
                              <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Presença */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>👁️</span> Presença
                      </h4>
                      <div className="grid gap-2 ml-6">
                        {eventsByCategory.presence.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                            <div className="grid gap-0.5 leading-none flex-1">
                              <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Chamadas */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>📞</span> Chamadas
                      </h4>
                      <div className="grid gap-2 ml-6">
                        {eventsByCategory.calls.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                            <div className="grid gap-0.5 leading-none flex-1">
                              <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Conexão */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>🔗</span> Conexão
                      </h4>
                      <div className="grid gap-2 ml-6">
                        {eventsByCategory.connection.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                            <div className="grid gap-0.5 leading-none flex-1">
                              <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Sincronização */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>🔄</span> Sincronização
                      </h4>
                      <div className="grid gap-2 ml-6">
                        {eventsByCategory.sync.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                            <div className="grid gap-0.5 leading-none flex-1">
                              <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Pareamento/QR */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                        <span>📱</span> Pareamento/QR
                      </h4>
                      <div className="grid gap-2 ml-6">
                        {eventsByCategory.pairing.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                            <div className="grid gap-0.5 leading-none flex-1">
                              <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                              <p className="text-xs text-muted-foreground">{event.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Outros (Newsletter, Keep Alive, Perfil, Bloqueio) */}
                    <details className="group">
                      <summary className="cursor-pointer font-semibold text-sm flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <span>⚙️</span> Outros Eventos ({eventsByCategory.newsletter.length + eventsByCategory.keepalive.length + eventsByCategory.profile.length + eventsByCategory.blocklist.length})
                      </summary>
                      <div className="mt-3 space-y-4 ml-6">
                        {/* Newsletter */}
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2">Newsletter/Canais</h5>
                          <div className="grid gap-2">
                            {eventsByCategory.newsletter.map((event) => (
                              <div key={event.id} className="flex items-start space-x-3">
                                <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                                <div className="grid gap-0.5 leading-none flex-1">
                                  <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                                  <p className="text-xs text-muted-foreground">{event.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Keep Alive */}
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2">Keep Alive</h5>
                          <div className="grid gap-2">
                            {eventsByCategory.keepalive.map((event) => (
                              <div key={event.id} className="flex items-start space-x-3">
                                <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                                <div className="grid gap-0.5 leading-none flex-1">
                                  <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                                  <p className="text-xs text-muted-foreground">{event.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Perfil */}
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2">Perfil e Privacidade</h5>
                          <div className="grid gap-2">
                            {eventsByCategory.profile.map((event) => (
                              <div key={event.id} className="flex items-start space-x-3">
                                <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                                <div className="grid gap-0.5 leading-none flex-1">
                                  <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                                  <p className="text-xs text-muted-foreground">{event.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Bloqueio */}
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2">Lista de Bloqueio</h5>
                          <div className="grid gap-2">
                            {eventsByCategory.blocklist.map((event) => (
                              <div key={event.id} className="flex items-start space-x-3">
                                <Checkbox id={event.id} checked={selectedEvents.includes(event.id)} onCheckedChange={(checked) => handleEventToggle(event.id, checked as boolean)} />
                                <div className="grid gap-0.5 leading-none flex-1">
                                  <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">{event.label}</Label>
                                  <p className="text-xs text-muted-foreground">{event.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </div>

              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Webhook configurado
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Seu webhook receberá notificações em tempo real para os eventos selecionados
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-end">
                <Button onClick={handleSaveWebhook} disabled={loading} size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Configurações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserSettings;
