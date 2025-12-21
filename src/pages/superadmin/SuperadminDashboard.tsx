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
          totalAgents: 0, // Not provided by API yet
          totalInboxes: 0, // Not provided by API yet
          totalMessages: 0, // Not provided by API yet
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
              accountCount: 0,
              mrr: 0,
              lastActivity: t.updated_at || t.created_at,
              createdAt: t.created_at
            })));
          }
        } catch (tenantError) {
          console.warn('Failed to fetch tenants list:', tenantError);
        }
      } else {
        throw new Error(data?.error || 'Falha ao carregar dados do dashboard');
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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
      const response = await backendApi.post<any>(`/superadmin/impersonate/${tenantId}`);

      if (!response.success) {
        throw new Error(response.error || 'Falha ao iniciar impersonação');
      }

      const data = response.data;
      
      if (data?.success) {
        const tenantName = data.data.tenant?.name || data.data.impersonation?.tenantName;
        const subdomain = data.data.tenant?.subdomain || data.data.impersonation?.tenantSubdomain;
        
        toast.success(`Agora impersonando ${tenantName}`);
        // In localhost, just show a message since subdomains don't work
        if (window.location.hostname === 'localhost') {
          toast.info(`Impersonação iniciada para ${subdomain}. Em produção, você seria redirecionado para o painel admin do tenant.`);
        } else {
          window.location.href = `https://${subdomain}.${window.location.hostname}/admin`;
        }
      } else {
        throw new Error(data?.error || 'Falha ao iniciar impersonação');
      }
    } catch (error) {
      console.error('Error starting impersonation:', error);
      toast.error('Falha ao impersonar tenant');
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 5 minutes
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
              <h1 className="text-2xl font-bold text-foreground">Superadmin Dashboard</h1>
              <p className="text-muted-foreground">Platform overview and tenant management</p>
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Superadmin Dashboard</h1>
            <p className="text-muted-foreground">
              Platform overview and tenant management
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
            Refresh
          </Button>
          <Button
            onClick={() => navigate('/superadmin/tenants/new')}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Tenant
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total MRR"
          value={formatCurrency(metrics?.totalMRR || 0)}
          icon={DollarSign}
          variant="green"
        />

        <StatsCard
          title="Total Tenants"
          value={`${metrics?.totalTenants || 0} (${metrics?.activeTenants || 0} active)`}
          icon={Building2}
          variant="blue"
        />

        <StatsCard
          title="Total Accounts"
          value={`${metrics?.totalAccounts || 0}`}
          icon={Users}
          variant="purple"
        />

        <StatsCard
          title="Platform Activity"
          value={`${metrics?.totalMessages || 0} messages`}
          icon={Activity}
          variant="orange"
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalAgents || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all tenants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inboxes</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalInboxes || 0}</div>
            <p className="text-xs text-muted-foreground">
              WhatsApp connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.tenantGrowth ? formatGrowth(metrics.tenantGrowth) : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Tenant growth this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-5 w-5" />
                <span>Tenant Overview</span>
              </CardTitle>
              <CardDescription>
                Manage and monitor all platform tenants
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/superadmin/tenants')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View All
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
                <h3 className="text-lg font-medium text-foreground">No tenants yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Create your first tenant to get started
                </p>
                <Button 
                  onClick={() => navigate('/superadmin/tenants/new')}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tenant
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
                          {tenant.status}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{tenant.subdomain}.cortexx.online</span>
                        <span>•</span>
                        <span>{tenant.accountCount} accounts</span>
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
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImpersonateTenant(tenant.id)}
                      disabled={tenant.status !== 'active'}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Manage
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
                  View All {tenants.length} Tenants
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Health Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Platform Health</span>
          </CardTitle>
          <CardDescription>
            Overall platform status and performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics?.activeTenants || 0}
              </div>
              <p className="text-sm text-muted-foreground">Active Tenants</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {metrics?.activeAccounts || 0}
              </div>
              <p className="text-sm text-muted-foreground">Active Accounts</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {metrics?.totalAgents || 0}
              </div>
              <p className="text-sm text-muted-foreground">Total Agents</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(metrics?.totalMRR || 0)}
              </div>
              <p className="text-sm text-muted-foreground">Monthly Revenue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperadminDashboard;