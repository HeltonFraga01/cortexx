import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton';
import { 
  ArrowLeft,
  Building2, 
  Users,
  DollarSign,
  Calendar,
  ExternalLink,
  Settings,
  Power,
  PowerOff,
  Trash2,
  Globe,
  Mail,
  Palette,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TenantManagePanel } from '@/components/superadmin/TenantManagePanel';
import { backendApi } from '@/services/api-client';

interface TenantBranding {
  app_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color?: string;
}

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: Record<string, any>;
  stripe_connect_id: string | null;
  owner_superadmin_id: string | null;
  created_at: string;
  updated_at: string;
  tenant_branding: TenantBranding | null;
  metrics?: {
    accounts: number;
    agents: number;
    inboxes: number;
    subscriptions: {
      active: number;
      mrr: number;
    };
    usage: {
      messagesLast30Days: number;
    };
  };
}

const TenantDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showManagePanel, setShowManagePanel] = useState(searchParams.get('manage') === 'true');

  const fetchTenant = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      // Include metrics to get account, agent, inbox counts and MRR
      const response = await backendApi.get<any>(`/superadmin/tenants/${id}?includeMetrics=true`);

      if (!response.success) {
        if (response.status === 401) {
          toast.error('Session expired. Please login again');
          navigate('/superadmin/login');
          return;
        }
        if (response.status === 404) {
          toast.error('Tenant not found');
          navigate('/superadmin/tenants');
          return;
        }
        throw new Error(response.error || `Failed to load tenant: ${response.status}`);
      }

      const data = response.data;
      
      if (data?.success) {
        setTenant(data.data);
      } else {
        throw new Error(data?.error || 'Failed to load tenant');
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
      toast.error('Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!tenant) return;
    
    const action = tenant.status === 'active' ? 'deactivate' : 'activate';
    
    try {
      const response = await backendApi.post<any>(`/superadmin/tenants/${tenant.id}/${action}`);
      
      if (response.success && response.data?.success) {
        toast.success(`Tenant ${action}d successfully`);
        fetchTenant();
      } else {
        throw new Error(response.error || response.data?.error || `Failed to ${action} tenant`);
      }
    } catch (error) {
      console.error(`Error ${action}ing tenant:`, error);
      toast.error(`Failed to ${action} tenant`);
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    
    try {
      const response = await backendApi.delete<any>(`/superadmin/tenants/${tenant.id}`, { 
        data: { confirm: 'DELETE' } 
      });
      
      if (response.success && response.data?.success) {
        toast.success('Tenant deleted successfully');
        navigate('/superadmin/tenants');
      } else {
        throw new Error(response.error || response.data?.error || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Failed to delete tenant');
    }
  };

  const handleImpersonate = async () => {
    if (!tenant) return;
    
    try {
      const response = await backendApi.post<any>(`/superadmin/impersonate/${tenant.id}`);
      
      if (response.success && response.data?.success) {
        const data = response.data;
        const tenantName = data.data.tenant?.name || tenant.name;
        const subdomain = data.data.tenant?.subdomain || tenant.subdomain;
        
        toast.success(`Now impersonating ${tenantName}`);
        if (window.location.hostname === 'localhost') {
          toast.info(`Impersonation started for ${subdomain}. In production, you would be redirected.`);
        } else {
          window.location.href = `https://${subdomain}.${window.location.hostname}/admin`;
        }
      } else {
        throw new Error(response.error || response.data?.error || 'Failed to start impersonation');
      }
    } catch (error) {
      console.error('Error starting impersonation:', error);
      toast.error('Failed to impersonate tenant');
    }
  };

  useEffect(() => {
    fetchTenant();
  }, [id]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/superadmin/tenants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </div>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/superadmin/tenants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tenants
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Tenant not found</h3>
              <p className="text-muted-foreground">The requested tenant could not be found.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/superadmin/tenants')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-foreground">{tenant.name}</h1>
                <Badge
                  className={
                    tenant.status === 'active' ? 'bg-green-500 text-white border-0' :
                    tenant.status === 'inactive' ? 'bg-yellow-500 text-white border-0' : 'bg-red-500 text-white border-0'
                  }
                >
                  {tenant.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center space-x-1">
                <Globe className="h-4 w-4" />
                <span>{tenant.subdomain}.cortexx.online</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            className={showManagePanel ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
            variant={showManagePanel ? "default" : "outline"}
            onClick={() => {
              setShowManagePanel(!showManagePanel);
              setSearchParams(showManagePanel ? {} : { manage: 'true' });
            }}
          >
            <Settings className="h-4 w-4 mr-2" />
            {showManagePanel ? 'Hide Panel' : 'Manage'}
            {showManagePanel ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>
          <Button
            variant="outline"
            onClick={handleToggleStatus}
          >
            {tenant.status === 'active' ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{tenant.name}"? This action cannot be undone.
                  All accounts, agents, inboxes, and data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete Tenant
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Accounts</p>
                <p className="text-2xl font-bold text-foreground">{tenant.metrics?.accounts || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-500/10 to-green-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">MRR</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(tenant.metrics?.subscriptions?.mrr || 0)}</p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/20">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Agents</p>
                <p className="text-2xl font-bold text-foreground">{tenant.metrics?.agents || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Inboxes</p>
                <p className="text-2xl font-bold text-foreground">{tenant.metrics?.inboxes || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500/20">
                <Mail className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Tenant Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tenant ID</p>
                <p className="font-mono text-sm">{tenant.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subdomain</p>
                <p className="font-medium">{tenant.subdomain}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm">{formatDate(tenant.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm">{formatDate(tenant.updated_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stripe Connect</p>
                <p className="text-sm">{tenant.stripe_connect_id || 'Not connected'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owner</p>
                <p className="text-sm">{tenant.owner_superadmin_id || 'System'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Palette className="h-5 w-5" />
              <span>Branding</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant.tenant_branding ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">App Name</p>
                  <p className="font-medium">{tenant.tenant_branding.app_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Primary Color</p>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: tenant.tenant_branding.primary_color }}
                    />
                    <span className="font-mono text-sm">{tenant.tenant_branding.primary_color}</span>
                  </div>
                </div>
                {tenant.tenant_branding.secondary_color && (
                  <div>
                    <p className="text-sm text-muted-foreground">Secondary Color</p>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: tenant.tenant_branding.secondary_color }}
                      />
                      <span className="font-mono text-sm">{tenant.tenant_branding.secondary_color}</span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Logo</p>
                  {tenant.tenant_branding.logo_url ? (
                    <img 
                      src={tenant.tenant_branding.logo_url} 
                      alt="Tenant logo" 
                      className="h-12 mt-2"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No logo uploaded</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No branding configured</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Management Panel */}
      {showManagePanel && (
        <TenantManagePanel 
          tenant={tenant} 
          onClose={() => {
            setShowManagePanel(false);
            setSearchParams({});
          }}
        />
      )}
    </div>
  );
};

export default TenantDetails;
