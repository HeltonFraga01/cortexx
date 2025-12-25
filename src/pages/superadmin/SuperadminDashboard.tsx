import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/ui-custom/StatsCard';
import { 
  Building2, 
  Users, 
  DollarSign, 
  Activity,
  TrendingUp,
  Server,
  Database,
  RefreshCw,
  Plus,
  Eye,
  Settings,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { backendApi } from '@/services/api-client';
import { useImpersonation } from '@/contexts/ImpersonationContext';

interface DashboardMetrics {
  totalMRR: number;
  totalTenants: number;
  activeTenants: number;
  totalAccounts: number;
  activeAccounts: number;
  totalAgents: number;
  totalInboxes: number;
  totalMessages: number;
  revenueGrowth: number;
  tenantGrowth: number;
}

interface TenantSummary {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended';
  accountCount: number;
  mrr: number;
  lastActivity: string;
  createdAt: string;
}

/**
 * Superadmin Dashboard
 * Requirements: 3.1, 3.2 - Display total MRR, tenant count, active accounts
 */
const SuperadminDashboard = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { startImpersonation, isLoading: isImpersonating } = useImpersonation();

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await backendApi.get<any>('/superadmin/dashboard');

      if (!response.success) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Faça login novamente.');
          navigate('/superadmin/login');
          return;
        }
        throw new Error(response.error || `Falha ao carregar dados: ${response.status}`);
      }

      const data = response.data;
      
      if (data?.success) {
        // Map API response to expected metrics format
        const apiData = data.data;
        const mappedMetrics: DashboardMetrics = {
          totalMRR: apiData.revenue?.totalMRR || 0,
          totalTenants: apiData.tenants?.total || 0,
          activeTenants: apiData.tenants?.active || 0,
          totalAccounts: apiData.accounts?.total || 0,
          activeAccounts: apiData.accounts?.total || 0,
          totalAgents: apiData.agents?.total || 0,
          totalInboxes: apiData.inboxes?.total || 0,
          totalMessages: apiData.messages?.last30Days || 0,
          revenueGrowth: 0, // Not provided by API yet
          tenantGrowth: apiData.tenants?.newLast30Days || 0
        };
        setMetrics(mappedMetrics);
        
        // Fetch tenants list separately if needed
        try {
          const tenantsResponse = await backendApi.get<any>('/superadmin/tenants');
          if (tenantsResponse.success && tenantsResponse.data?.success && Array.isArray(tenantsResponse.data.data)) {
            setTenants(tenantsResponse.data.data.map((t: any) => ({
              id: t.id,
              name: t.name,
              subdomain: t.subdomain,
              status: t.status,
              accountCount: t.accountCount || 0,
              mrr: t.mrr || 0,
              lastActivity: t.updated_at || t.created_at,
              createdAt: t.created_at
            })));
          }
        } catch (tenantError) {
          console.warn('Falha ao buscar lista de tenants:', tenantError);
        }
      } else {
        throw new Error(data?.error || 'Falha ao carregar dados do dashboard');
      }
      
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      toast.error('Falha ao carregar dados do dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleImpersonateTenant = async (tenantId: string) => {
    try {
      const success = await startImpersonation(tenantId);

      if (success) {
        const tenant = tenants.find(t => t.id === tenantId);
        toast.success(`Agora gerenciando ${tenant?.name || 'tenant'}`);
        
        // Check if running in local development (localhost or *.localhost)
        const isLocalDev = window.location.hostname === 'localhost' || 
                          window.location.hostname.endsWith('.localhost');
        
        if (isLocalDev) {
          toast.info(`Gerenciamento iniciado para ${tenant?.subdomain}. Em produção, você seria redirecionado para o painel admin do tenant.`);
          navigate('/admin/dashboard');
        } else {
          const protocol = window.location.protocol;
          const baseDomain = window.location.hostname.split('.').slice(-2).join('.');
          window.location.href = `${protocol}//${tenant?.subdomain}.${baseDomain}/admin`;
        }
      } else {
        throw new Error('Falha ao iniciar gerenciamento');
      }
    } catch (error) {
      console.error('Erro ao iniciar gerenciamento:', error);
      toast.error('Falha ao gerenciar tenant');
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh a cada 5 minutos
    const interval = setInterval(() => fetchDashboardData(true), 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Painel Superadmin</h1>
              <p className="text-muted-foreground">Visão geral da plataforma e gestão de tenants</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-32 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden border-0 bg-gradient-to-br from-muted/50 to-muted/30">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-7 w-24 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="h-11 w-11 bg-muted animate-pulse rounded-xl" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'ativo';
      case 'inactive': return 'inativo';
      case 'suspended': return 'suspenso';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel Superadmin</h1>
            <p className="text-muted-foreground">
              Visão geral da plataforma e gestão de tenants
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={() => navigate('/superadmin/tenants/new')}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Tenant
          </Button>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Receita Mensal (MRR)"
          value={formatCurrency(metrics?.totalMRR || 0)}
          icon={DollarSign}
          variant="green"
        />

        <StatsCard
          title="Total de Tenants"
          value={`${metrics?.totalTenants || 0} (${metrics?.activeTenants || 0} ativos)`}
          icon={Building2}
          variant="blue"
        />

        <StatsCard
          title="Total de Contas"
          value={`${metrics?.totalAccounts || 0}`}
          icon={Users}
          variant="purple"
        />

        <StatsCard
          title="Atividade da Plataforma"
          value={`${metrics?.totalMessages || 0} mensagens`}
          icon={Activity}
          variant="orange"
        />
      </div>

      {/* Métricas Adicionais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Agentes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalAgents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Em todos os tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Caixas</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalInboxes || 0}</div>
            <p className="text-xs text-muted-foreground">
              Conexões WhatsApp
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Crescimento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.tenantGrowth ? formatGrowth(metrics.tenantGrowth) : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Crescimento de tenants este mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Tenants */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Visão Geral dos Tenants</span>
              </CardTitle>
              <CardDescription>
                Gerencie e monitore todos os tenants da plataforma
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/superadmin/tenants')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Ver Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-xl bg-muted mb-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Nenhum tenant ainda</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Crie seu primeiro tenant para começar
                </p>
                <Button 
                  onClick={() => navigate('/superadmin/tenants/new')}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Tenant
                </Button>
              </div>
            ) : (
              tenants.slice(0, 10).map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-foreground">{tenant.name}</span>
                        <Badge
                          className={
                            tenant.status === 'active' 
                              ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                              : tenant.status === 'inactive' 
                                ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' 
                                : 'bg-red-500/10 text-red-600 border-red-500/20'
                          }
                        >
                          {getStatusLabel(tenant.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{tenant.subdomain}.cortexx.online</span>
                        <span>•</span>
                        <span>{tenant.accountCount} {tenant.accountCount === 1 ? 'conta' : 'contas'}</span>
                        <span>•</span>
                        <span>{formatCurrency(tenant.mrr)} MRR</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImpersonateTenant(tenant.id)}
                      disabled={tenant.status !== 'active' || isImpersonating}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Gerenciar
                    </Button>
                  </div>
                </div>
              ))
            )}
            
            {tenants.length > 10 && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/superadmin/tenants')}
                >
                  Ver Todos os {tenants.length} Tenants
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo de Saúde da Plataforma */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Saúde da Plataforma</span>
          </CardTitle>
          <CardDescription>
            Status geral e desempenho da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics?.activeTenants || 0}
              </div>
              <p className="text-sm text-muted-foreground">Tenants Ativos</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {metrics?.activeAccounts || 0}
              </div>
              <p className="text-sm text-muted-foreground">Contas Ativas</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {metrics?.totalAgents || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total de Agentes</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(metrics?.totalMRR || 0)}
              </div>
              <p className="text-sm text-muted-foreground">Receita Mensal</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperadminDashboard;
