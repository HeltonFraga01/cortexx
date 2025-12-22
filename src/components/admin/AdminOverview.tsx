import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBrandingConfig } from '@/hooks/useBranding';
import { StatsCard } from '@/components/ui-custom/StatsCard';
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton';
import AutomationStatisticsCards from '@/components/admin/AutomationStatisticsCards';
import { AdminDashboardStats } from '@/components/admin/AdminDashboardStats';
import { AdminDashboardAlerts } from '@/components/admin/AdminDashboardAlerts';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

import { HealthStatus, WuzAPIUser } from '@/services/wuzapi';
import { 
  Users, 
  Activity, 
  Wifi, 
  Server, 
  MemoryStick,
  Clock,
  Database,
  HardDrive,
  MessageSquare,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemHealthData {
  status: string;
  message: string;
  timestamp: string;
  environment: string;
  version: string;
  configuration: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  database: {
    type: string;
    status: string;
    path: string;
    file_exists: boolean;
    file_size_bytes: number;
    stats?: {
      tables?: number;
      indexes?: number;
    };
    error?: { message: string; code: string } | null;
  };
  wuzapi: {
    status: string;
    baseUrl: string;
    responseTime?: number;
    lastCheck?: string;
    cached?: boolean;
    error?: string | null;
  };
  session_store: {
    status: string;
    type: string;
    path: string;
  };
  s3_storage: {
    enabled: boolean;
    status: string;
    bucket?: string | null;
    endpoint?: string | null;
    error?: string;
  };
}

const AdminOverview = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [users, setUsers] = useState<WuzAPIUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const brandingConfig = useBrandingConfig();

  // Wait for Supabase session to be ready before making API calls
  useEffect(() => {
    let mounted = true;
    
    const checkSession = async () => {
      try {
        // First check if session exists
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token && mounted) {
          console.debug('[AdminOverview] Session ready, access_token available');
          setSessionReady(true);
          return;
        }
        
        // If no session yet, wait for auth state change
        console.debug('[AdminOverview] No session yet, waiting for auth state change...');
      } catch (error) {
        console.error('[AdminOverview] Error checking session:', error);
      }
    };
    
    // Check immediately
    checkSession();
    
    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.debug('[AdminOverview] Auth state changed:', event, !!session?.access_token);
      if (session?.access_token && mounted) {
        setSessionReady(true);
      }
    });
    
    // Timeout fallback - if session doesn't appear in 3 seconds, try anyway
    const timeout = setTimeout(() => {
      if (mounted && !sessionReady) {
        console.warn('[AdminOverview] Session timeout, proceeding anyway');
        setSessionReady(true);
      }
    }, 3000);
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Fetch dashboard stats and system health in parallel using api client (includes JWT automatically)
      const [dashboardResult, healthResponse] = await Promise.all([
        api.get<{ success: boolean; data: any }>('/api/admin/dashboard-stats'),
        fetch('/health', {
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      if (dashboardResult.status === 401) {
        toast.error('Sessão expirada. Faça login novamente');
        window.location.href = '/login';
        return;
      }

      if (dashboardResult.status !== 200) {
        throw new Error(`Erro ao carregar dados: ${dashboardResult.status}`);
      }

      const dashboardData = dashboardResult.data;
      const healthData = healthResponse.ok ? await healthResponse.json() : null;
      
      if (dashboardData.success && dashboardData.data) {
        const statsData = dashboardData.data;
        
        setHealth({
          status: statsData.systemStatus,
          uptime: statsData.uptime,
          version: statsData.version,
          total_users: statsData.totalUsers,
          connected_users: statsData.connectedUsers,
          logged_in_users: statsData.loggedInUsers,
          active_connections: statsData.activeConnections,
          memory_stats: statsData.memoryStats,
          goroutines: statsData.goroutines,
          timestamp: new Date().toISOString()
        });
        
        setUsers(statsData.users || []);
      }

      if (healthData) {
        setSystemHealth(healthData);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  useEffect(() => {
    // Only fetch data when session is ready
    if (!sessionReady) {
      return;
    }
    
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [sessionReady]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>
          <p className="text-muted-foreground">Carregando dados do sistema...</p>
        </div>
        <LoadingSkeleton variant="stats" />
        <div className="grid gap-4 md:grid-cols-2">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" />
        </div>
      </div>
    );
  }

  const connectedUsers = users.filter(user => user.connected).length;
  const loggedInUsers = users.filter(user => user.loggedIn).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema {brandingConfig.appName}
        </p>
      </div>

      {/* Status Cards - Using StatsCard with gradient backgrounds (Requirements 2.1, 2.2, 2.3, 2.4) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Status do Sistema"
          value={health?.status === 'ok' ? 'Online' : 'Offline'}
          icon={Server}
          variant={health?.status === 'ok' ? 'green' : 'red'}
        />

        <StatsCard
          title="Total de Usuários"
          value={health?.total_users || 0}
          icon={Users}
          variant="blue"
        />

        <StatsCard
          title="Usuários Conectados"
          value={connectedUsers}
          icon={Wifi}
          variant="orange"
        />

        <StatsCard
          title="Conexões Ativas"
          value={health?.active_connections || 0}
          icon={Activity}
          variant="purple"
        />
      </div>

      {/* System Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MemoryStick className="h-5 w-5" />
              <span>Uso de Memória</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Alocada:</span>
              <span className="text-sm font-medium">{health?.memory_stats.alloc_mb} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Sistema:</span>
              <span className="text-sm font-medium">{health?.memory_stats.sys_mb} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Total Alocada:</span>
              <span className="text-sm font-medium">{health?.memory_stats.total_alloc_mb} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">GC Cycles:</span>
              <span className="text-sm font-medium">{health?.memory_stats.num_gc}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Status dos Usuários</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.slice(0, 5).map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      user.loggedIn ? 'bg-green-500' : 
                      user.connected ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">{user.name}</span>
                  </div>
                  <Badge variant={user.loggedIn ? 'default' : user.connected ? 'secondary' : 'outline'}>
                    {user.loggedIn ? 'Logado' : user.connected ? 'Conectado' : 'Offline'}
                  </Badge>
                </div>
              ))}
              {users.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  E mais {users.length - 5} usuários...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Status */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Status dos Serviços</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
                title="Atualizar"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real dos componentes do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Database Status */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
                <Database className={`h-5 w-5 mt-0.5 ${
                  systemHealth.database.status === 'connected' ? 'text-green-500' : 'text-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Banco de Dados</span>
                    {systemHealth.database.status === 'connected' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{systemHealth.database.type}</p>
                  {systemHealth.database.file_size_bytes > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {(systemHealth.database.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </div>
              </div>

              {/* WUZAPI Status */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
                <MessageSquare className={`h-5 w-5 mt-0.5 ${
                  systemHealth.wuzapi.status === 'connected' ? 'text-green-500' : 'text-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">WUZAPI</span>
                    {systemHealth.wuzapi.status === 'connected' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate" title={systemHealth.wuzapi.baseUrl}>
                    {systemHealth.wuzapi.baseUrl?.replace(/^https?:\/\//, '')}
                  </p>
                  {systemHealth.wuzapi.responseTime && (
                    <p className="text-xs text-muted-foreground">
                      {systemHealth.wuzapi.responseTime}ms
                    </p>
                  )}
                </div>
              </div>

              {/* Session Store Status */}
              {systemHealth.session_store && (
                <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
                  <HardDrive className={`h-5 w-5 mt-0.5 ${
                    systemHealth.session_store.status === 'connected' ? 'text-green-500' : 'text-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Sessões</span>
                      {systemHealth.session_store.status === 'connected' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{systemHealth.session_store.type}</p>
                  </div>
                </div>
              )}

              {/* S3 Storage Status */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card">
                <Cloud className={`h-5 w-5 mt-0.5 ${
                  !systemHealth.s3_storage.enabled ? 'text-muted-foreground' :
                  systemHealth.s3_storage.status === 'connected' ? 'text-green-500' : 'text-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">S3 Storage</span>
                    {!systemHealth.s3_storage.enabled ? (
                      <Badge variant="outline" className="text-xs">Desabilitado</Badge>
                    ) : systemHealth.s3_storage.status === 'connected' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {systemHealth.s3_storage.enabled && systemHealth.s3_storage.bucket && (
                    <p className="text-xs text-muted-foreground truncate" title={systemHealth.s3_storage.bucket}>
                      {systemHealth.s3_storage.bucket}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Configuration Warnings */}
            {systemHealth.configuration && (
              (systemHealth.configuration.errors?.length > 0 || systemHealth.configuration.warnings?.length > 0) && (
                <div className="mt-4 space-y-2">
                  {systemHealth.configuration.errors?.map((error, index) => (
                    <div key={`error-${index}`} className="flex items-center space-x-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ))}
                  {systemHealth.configuration.warnings?.map((warning, index) => (
                    <div key={`warning-${index}`} className="flex items-center space-x-2 text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* System Info Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Resumo do Sistema</span>
          </CardTitle>
          <CardDescription>
            Versão {systemHealth?.version || health?.version} • Ambiente: {systemHealth?.environment || 'N/A'} • Uptime: {health?.uptime || 'N/A'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{health?.connected_users}</div>
              <p className="text-sm text-muted-foreground">Usuários Conectados</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{health?.logged_in_users}</div>
              <p className="text-sm text-muted-foreground">Usuários Logados</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{health?.active_connections}</div>
              <p className="text-sm text-muted-foreground">Conexões Ativas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Statistics - Requirements 10.1 */}
      <AutomationStatisticsCards />

      {/* Management Dashboard Stats & Alerts - Requirements 5.1, 5.2, 5.3, 5.5 */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Gestão de Usuários
          </h2>
        </div>
        
        <Tabs defaultValue="stats" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            <TabsTrigger value="alerts">Alertas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="stats" className="space-y-4">
            <AdminDashboardStats />
          </TabsContent>
          
          <TabsContent value="alerts" className="space-y-4">
            <AdminDashboardAlerts />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminOverview;