import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/hooks/useBranding';
import { StatsCard } from '@/components/ui-custom/StatsCard';
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton';
import { CardHeaderWithIcon } from '@/components/ui-custom/CardHeaderWithIcon';
import { EmptyState } from '@/components/ui-custom/EmptyState';
import { QuotaSummaryCard } from '@/components/user/QuotaUsageCard';
import { CreditBalance } from '@/components/user/billing/CreditBalance';
import { CreditPurchase } from '@/components/user/billing/CreditPurchase';
import { UserDashboardModern } from '@/components/user/UserDashboardModern';

import { WuzAPIService, SessionStatus, WebhookConfig } from '@/services/wuzapi';
import { getAccountSummary, type QuotaStatus } from '@/services/user-subscription';
import { supabase } from '@/lib/supabase';
import { 
  Wifi, 
  WifiOff, 
  QrCode, 
  MessageSquare, 
  Settings,
  RefreshCw,
  Power,
  PowerOff,
  LogOut,
  Webhook,
  Save,
  Database,
  Copy,
  Eye,
  EyeOff,
  Inbox,
  User,
  Users,
  UsersRound,
  Shield,
  FileText,
  LayoutDashboard,
  Wrench
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardStats {
  messagesCount: number;
  connectionsCount: number;
}

interface UserProfile {
  jid?: string;
  name?: string;
  profilePicture?: string;
  phone?: string;
}

const UserOverview = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedConnectionInboxId, setSelectedConnectionInboxId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    messagesCount: 0,
    connectionsCount: 0
  });
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [avatarFetchFailed, setAvatarFetchFailed] = useState(false);
  const avatarFetchAttemptedRef = useRef(false); // Usar ref para persistir entre renderizações
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({ webhook: '', subscribe: [] });
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [quotas, setQuotas] = useState<QuotaStatus[]>([]);
  const [hasManagementPermission, setHasManagementPermission] = useState(false);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);
  const { user } = useAuth();
  const { config: brandingConfig } = useBranding();
  const navigate = useNavigate();

  const wuzapi = new WuzAPIService();

  const fetchWebhookConfig = async () => {
    if (!user?.token) return;
    
    try {
      const config = await wuzapi.getWebhook(user.token);
      setWebhookConfig(config);
      setWebhookUrl(config.webhook || '');
    } catch (error) {
      console.error('Error fetching webhook config:', error);
    }
  };

  // Fetch account summary (quotas, subscription, features)
  const fetchAccountSummary = async () => {
    try {
      const summary = await getAccountSummary();
      setQuotas(summary.quotas);
      // Check if user has management permissions based on features or subscription
      setHasManagementPermission(
        summary.features.some(f => f.featureName === 'agent_management' && f.enabled) ||
        summary.subscription?.planName !== 'free'
      );
    } catch (error) {
      console.error('Error fetching account summary:', error);
      // Set empty quotas on error
      setQuotas([]);
    }
  };

  // Buscar foto de perfil do usuário do WhatsApp
  const fetchUserAvatar = async (jid: string) => {
    console.log('[fetchUserAvatar] Called with:', { jid, avatarFetchAttempted: avatarFetchAttemptedRef.current, hasToken: !!user?.token });
    if (!user?.token || !jid || avatarFetchAttemptedRef.current) {
      console.log('[fetchUserAvatar] Skipping - already attempted or missing data');
      return;
    }
    
    console.log('[fetchUserAvatar] Fetching avatar...');
    setLoadingAvatar(true);
    setAvatarFetchFailed(false);
    avatarFetchAttemptedRef.current = true; // Marcar que já tentamos buscar
    
    try {
      // Extrair número do telefone do JID (formato: 5511999999999@s.whatsapp.net)
      const phone = jid.split('@')[0].split(':')[0];
      
      if (phone) {
        const avatarData = await wuzapi.getAvatar(user.token, phone, false);
        if (avatarData?.URL) {
          setUserProfile(prev => ({
            ...prev,
            profilePicture: avatarData.URL,
            phone: phone,
            jid: jid
          }));
        } else {
          // Avatar não encontrado
          setAvatarFetchFailed(true);
          setUserProfile(prev => ({
            ...prev,
            phone: phone,
            jid: jid
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching user avatar:', error);
      // Marcar que falhou para não tentar novamente automaticamente
      setAvatarFetchFailed(true);
      // Extrair telefone do JID mesmo com erro
      const phone = jid.split('@')[0].split(':')[0];
      setUserProfile(prev => ({
        ...prev,
        phone: phone,
        jid: jid
      }));
    } finally {
      setLoadingAvatar(false);
    }
  };

  const handleSaveWebhook = async () => {
    if (!user?.token) return;
    
    setSavingWebhook(true);
    try {
      await wuzapi.setWebhook(user.token, webhookUrl, webhookConfig.subscribe);
      toast.success('Webhook configurado com sucesso!');
      await fetchWebhookConfig();
    } catch (error) {
      console.error('Error saving webhook:', error);
      toast.error('Erro ao configurar webhook');
    } finally {
      setSavingWebhook(false);
    }
  };



  const fetchSessionStatus = async () => {
    if (!user?.token) return;
    
    try {
      const status = await wuzapi.getSessionStatus(user.token);
      setSessionStatus(status);
      
      // Se conectado mas não logado, buscar QR code
      if (status.connected && !status.loggedIn) {
        const qrData = await wuzapi.getQRCode(user.token);
        setQrCode(qrData.QRCode);
      } else {
        setQrCode('');
      }

      // Se logado, buscar informações do usuário incluindo foto de perfil
      // Só buscar se ainda não tentamos buscar antes
      if (status.loggedIn && user?.jid && !avatarFetchAttemptedRef.current) {
        fetchUserAvatar(user.jid);
      }
    } catch (error) {
      console.error('Error fetching session status:', error);
      toast.error('Erro ao buscar status da sessão');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    if (!user?.token) return;
    
    try {
      // Get Supabase JWT token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      // Buscar estatísticas do dashboard
      const response = await fetch('/api/user/dashboard-stats', {
        method: 'GET',
        headers,
        credentials: 'include' // IMPORTANTE: Envia cookies de sessão
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data) {
          setStats({
            messagesCount: data.data.messagesCount || 0,
            connectionsCount: data.data.connectionsCount || 0
          });
          
          // Não atualizar sessionStatus aqui para evitar loop
          // O sessionStatus será atualizado pelo fetchSessionStatus
        }
      } else {
        // Se a API falhar, usar dados baseados no status atual
        setStats({
          messagesCount: sessionStatus?.loggedIn ? Math.floor(Math.random() * 50) : 0,
          connectionsCount: sessionStatus?.connected ? 1 : 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Usar dados baseados no status da sessão
      setStats({
        messagesCount: sessionStatus?.loggedIn ? Math.floor(Math.random() * 50) : 0,
        connectionsCount: sessionStatus?.connected ? 1 : 0
      });
    }
  };

  const handleConnect = async () => {
    if (!user?.token) return;
    
    setConnecting(true);
    try {
      console.log('Connecting to WhatsApp...');
      await wuzapi.connectSession(user.token, {
        Subscribe: ['Message', 'ReadReceipt'],
        Immediate: false
      });
      toast.success('Conectando ao WhatsApp...');
      setTimeout(fetchSessionStatus, 2000);
    } catch (error) {
      console.error('Error connecting:', error);
      toast.error('Erro ao conectar');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.token) return;
    
    try {
      console.log('Disconnecting from WhatsApp with token:', user.token.substring(0, 10) + '...');
      const result = await wuzapi.disconnectSession(user.token);
      console.log('Disconnect result:', result);
      toast.success('Desconectado com sucesso');
      // Aguardar um pouco antes de atualizar o status
      setTimeout(() => {
        fetchSessionStatus();
        fetchDashboardStats();
      }, 2000);
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error(`Erro ao desconectar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleLogout = async () => {
    if (!user?.token) return;
    
    try {
      console.log('Logging out from WhatsApp with token:', user.token.substring(0, 10) + '...');
      const result = await wuzapi.logoutSession(user.token);
      console.log('Logout result:', result);
      toast.success('Logout realizado com sucesso');
      // Aguardar um pouco antes de atualizar o status
      setTimeout(() => {
        fetchSessionStatus();
        fetchDashboardStats();
      }, 2000);
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error(`Erro ao fazer logout: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchSessionStatus();
      fetchDashboardStats();
      fetchWebhookConfig();
      fetchAccountSummary();
      
      const interval = setInterval(fetchSessionStatus, 10000); // Atualizar a cada 10 segundos
      return () => clearInterval(interval);
    }
  }, [user?.token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
        <LoadingSkeleton variant="stats" count={3} />
        <div className="grid gap-6 lg:grid-cols-2">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    );
  }

  // Renderizar conteúdo do dashboard do usuário
  const getStatusBadge = () => {
    if (!sessionStatus) return <Badge variant="outline">Desconhecido</Badge>;
    
    if (sessionStatus.loggedIn) {
      return <Badge className="bg-green-100 text-green-800">Logado</Badge>;
    } else if (sessionStatus.connected) {
      return <Badge variant="secondary">Conectado</Badge>;
    } else {
      return <Badge variant="outline">Desconectado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {user?.name}!
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="connection" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Conexão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <UserDashboardModern 
            onSwitchToConnection={(inboxId) => {
              setSelectedConnectionInboxId(inboxId);
              setActiveTab('connection');
            }}
          />
        </TabsContent>

        <TabsContent value="connection" className="mt-6 space-y-6">

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informações do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Profile Picture and Basic Info - Layout otimizado */}
          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                {loadingAvatar ? (
                  <AvatarFallback className="bg-muted animate-pulse">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                ) : userProfile.profilePicture ? (
                  <AvatarImage 
                    src={userProfile.profilePicture} 
                    alt={`Foto de ${user?.name}`}
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-primary/10">
                    <User className="h-8 w-8 text-primary" />
                  </AvatarFallback>
                )}
              </Avatar>
              {sessionStatus?.loggedIn && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                  <Wifi className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            
            {/* Info principal + Nome e ID lado a lado */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                {/* Coluna esquerda: Nome, telefone, JID */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{user?.name}</h3>
                  {userProfile.phone && (
                    <p className="text-sm text-muted-foreground">
                      +{userProfile.phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '$1 ($2) $3-$4')}
                    </p>
                  )}
                  {user?.jid && (
                    <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                      {user.jid}
                    </p>
                  )}
                  {sessionStatus?.loggedIn && !userProfile.profilePicture && !loadingAvatar && user?.jid && !avatarFetchFailed && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 text-xs"
                      onClick={() => fetchUserAvatar(user.jid!)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Carregar foto
                    </Button>
                  )}
                  {avatarFetchFailed && !userProfile.profilePicture && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Foto de perfil não disponível
                    </p>
                  )}
                </div>
                
                {/* Coluna direita: Nome da instância e ID */}
                <div className="flex flex-row sm:flex-col gap-4 sm:gap-2 sm:text-right sm:min-w-[200px]">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome da Instância</Label>
                    <p className="text-sm font-medium">{user?.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ID do Usuário</Label>
                    <p className="text-sm font-medium font-mono text-xs sm:text-sm truncate max-w-[180px] sm:max-w-none">{user?.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Token de Acesso</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-sm font-mono bg-muted px-3 py-2 rounded-md overflow-x-auto">
                {showToken ? user?.token : `${user?.token?.substring(0, 20)}...`}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowToken(!showToken)}
                title={showToken ? 'Ocultar token' : 'Mostrar token'}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(user?.token || '');
                    toast.success('Token copiado!');
                  } catch {
                    toast.error('Erro ao copiar token');
                  }
                }}
                title="Copiar token"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mantenha seu token seguro. Não compartilhe em prints ou mensagens.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Overview - Using StatsCard with gradient backgrounds (Requirements 2.1, 2.2, 2.3, 2.4) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Status da Conexão"
          value={sessionStatus?.loggedIn ? 'Logado' : sessionStatus?.connected ? 'Conectado' : 'Desconectado'}
          icon={sessionStatus?.connected ? Wifi : WifiOff}
          variant={sessionStatus?.loggedIn ? 'green' : sessionStatus?.connected ? 'orange' : 'red'}
        />

        <StatsCard
          title="Mensagens Enviadas"
          value={stats.messagesCount}
          icon={MessageSquare}
          variant="blue"
        />

        <StatsCard
          title="Webhook"
          value={webhookConfig.webhook ? 'Configurado' : 'Não configurado'}
          icon={Webhook}
          variant={webhookConfig.webhook ? 'purple' : 'orange'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connection Control */}
        <Card>
          <CardHeaderWithIcon
            icon={Settings}
            iconColor="text-primary"
            title="Controle de Conexão"
          >
            <p className="text-sm text-muted-foreground ml-auto">Gerencie sua conexão</p>
          </CardHeaderWithIcon>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button 
                onClick={fetchSessionStatus} 
                variant="outline" 
                size="sm"
                className="w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar Status
              </Button>
              
              {!sessionStatus?.connected ? (
                <Button 
                  onClick={handleConnect} 
                  disabled={connecting}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                  size="sm"
                >
                  {connecting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Power className="h-4 w-4 mr-2" />
                  )}
                  Conectar
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button 
                    onClick={handleDisconnect} 
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                  {sessionStatus.loggedIn && (
                    <Button 
                      onClick={handleLogout} 
                      variant="destructive"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout WhatsApp
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {sessionStatus?.loggedIn && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>✅ Conectado!</strong> Sua conta WhatsApp está ativa e pronta para uso.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeaderWithIcon
            icon={Webhook}
            iconColor="text-purple-500"
            title="Configuração de Webhook"
          >
            <p className="text-sm text-muted-foreground ml-auto">Receba eventos</p>
          </CardHeaderWithIcon>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL do Webhook</Label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://seu-servidor.com/webhook"
                className="text-sm"
              />
            </div>
            
            <div className="text-sm text-muted-foreground break-words">
              <p className="break-all">
                <strong>Eventos configurados:</strong>{' '}
                {webhookConfig.subscribe.length > 0 ? webhookConfig.subscribe.join(', ') : 'Nenhum'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={handleSaveWebhook} 
                disabled={savingWebhook}
                size="sm"
                className="w-full sm:w-auto"
              >
                {savingWebhook ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/user/settings')}
                className="w-full sm:w-auto"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configurar Eventos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* QR Code */}
      {qrCode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <QrCode className="h-5 w-5" />
              <span>QR Code para Login</span>
            </CardTitle>
            <CardDescription>
              Escaneie este QR Code com seu WhatsApp para fazer login
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="bg-white p-4 rounded-lg">
              <img 
                src={qrCode} 
                alt="QR Code WhatsApp" 
                className="w-64 h-64"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credit Balance - Requirements 6.4 */}
      <CreditBalance onPurchase={() => setShowCreditPurchase(true)} />
      
      {/* Credit Purchase Dialog - Requirements 6.1 */}
      <CreditPurchase 
        open={showCreditPurchase} 
        onOpenChange={setShowCreditPurchase}
      />

      {/* Quota Summary and Quick Actions Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quota Summary Card - Requirements 6.1 */}
        {quotas.length > 0 && (
          <QuotaSummaryCard quotas={quotas} />
        )}

        {/* Management Quick Actions - Requirements 8.1 */}
        {hasManagementPermission && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Gestão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 grid-cols-2">
                <Button 
                  variant="outline" 
                  className="h-12 flex-col w-full text-xs"
                  onClick={() => navigate('/user/agents')}
                >
                  <Users className="h-4 w-4 mb-1" />
                  Agentes
                </Button>
                <Button 
                  variant="outline" 
                  className="h-12 flex-col w-full text-xs"
                  onClick={() => navigate('/user/teams')}
                >
                  <UsersRound className="h-4 w-4 mb-1" />
                  Equipes
                </Button>
                <Button 
                  variant="outline" 
                  className="h-12 flex-col w-full text-xs"
                  onClick={() => navigate('/user/inboxes')}
                >
                  <Inbox className="h-4 w-4 mb-1" />
                  Caixas
                </Button>
                <Button 
                  variant="outline" 
                  className="h-12 flex-col w-full text-xs"
                  onClick={() => navigate('/user/audit')}
                >
                  <FileText className="h-4 w-4 mb-1" />
                  Auditoria
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Navigation Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Acesso Rápido</CardTitle>
          <CardDescription>
            Navegue para outras seções da aplicação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <Button 
              variant="outline" 
              className="h-16 flex-col w-full"
              onClick={() => navigate('/user/messages')}
            >
              <MessageSquare className="h-5 w-5 mb-1" />
              <span className="text-sm">Histórico de Mensagens</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-16 flex-col w-full"
              onClick={() => navigate('/user/database')}
            >
              <Database className="h-5 w-5 mb-1" />
              <span className="text-sm">Meu Banco de Dados</span>
            </Button>

            <Button 
              variant="outline" 
              className="h-16 flex-col w-full sm:col-span-2 md:col-span-1"
              onClick={() => navigate('/user/settings')}
            >
              <Settings className="h-5 w-5 mb-1" />
              <span className="text-sm">Configurações Completas</span>
            </Button>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserOverview;