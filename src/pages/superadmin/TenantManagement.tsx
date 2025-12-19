import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LoadingSkeleton } from '@/components/ui-custom/LoadingSkeleton';
import { 
  Building2, 
  Plus, 
  Search, 
  Eye, 
  Pencil,
  MoreHorizontal,
  Trash2, 
  Power, 
  PowerOff,
  Users,
  DollarSign,
  Calendar,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  UserCog,
  ChevronDown,
  Key,
  Mail,
  EyeIcon,
  EyeOff,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Helper to get CSRF token
const getCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/auth/csrf-token', {
      credentials: 'include'
    });
    const data = await response.json();
    return data.csrfToken || null;
  } catch {
    return null;
  }
};

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  status: 'active' | 'inactive' | 'suspended';
  accountCount: number;
  mrr: number;
  lastActivity: string;
  createdAt: string;
  ownerSuperadminId: string;
  settings: Record<string, unknown>;
  stripeConnectId?: string;
}

interface CreateTenantData {
  name: string;
  subdomain: string;
  ownerEmail: string;
  settings?: Record<string, unknown>;
}

interface EditTenantData {
  name: string;
  status: 'active' | 'inactive' | 'suspended';
}

interface TenantOwner {
  id: string;
  email: string;
  name: string;
  role: string;
}

/**
 * Tenant Management Page
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3 - CRUD interface for tenants with validation
 */
const TenantManagement = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantData>({
    name: '',
    subdomain: '',
    ownerEmail: '',
    settings: {}
  });
  const [subdomainValidation, setSubdomainValidation] = useState<{
    isValid: boolean;
    message: string;
  }>({ isValid: true, message: '' });

  // Edit modal state
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editData, setEditData] = useState<EditTenantData>({ name: '', status: 'active' });
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation state
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Owner credentials state
  const [tenantOwner, setTenantOwner] = useState<TenantOwner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [ownerCredentials, setOwnerCredentials] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  const navigate = useNavigate();

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/superadmin/tenants', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Session expired. Please login again');
          navigate('/superadmin/login');
          return;
        }
        throw new Error(`Failed to load tenants: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const mappedTenants = (data.data || []).map((tenant: Record<string, unknown>) => ({
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          status: tenant.status,
          accountCount: tenant.account_count || 0,
          mrr: tenant.mrr || 0,
          lastActivity: tenant.last_activity || tenant.updated_at,
          createdAt: tenant.created_at,
          ownerSuperadminId: tenant.owner_superadmin_id,
          settings: tenant.settings || {},
          stripeConnectId: tenant.stripe_connect_id
        }));
        setTenants(mappedTenants);
      } else {
        throw new Error(data.error || 'Failed to load tenants');
      }
      
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };


  const validateSubdomain = async (subdomain: string) => {
    if (!subdomain) {
      setSubdomainValidation({ isValid: false, message: 'Subdomain is required' });
      return;
    }

    const subdomainRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (subdomain.length < 3 || subdomain.length > 63) {
      setSubdomainValidation({ isValid: false, message: 'Subdomain must be 3-63 characters long' });
      return;
    }

    if (!subdomainRegex.test(subdomain) || subdomain.includes('--')) {
      setSubdomainValidation({ isValid: false, message: 'Invalid format. Use lowercase letters, numbers, and hyphens only' });
      return;
    }

    try {
      const response = await fetch(`/api/superadmin/tenants/validate-subdomain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subdomain })
      });

      const data = await response.json();
      
      if (data.success && data.data.valid) {
        setSubdomainValidation({ isValid: true, message: 'Subdomain is available' });
      } else {
        setSubdomainValidation({ isValid: false, message: data.data.error || 'Subdomain is not available' });
      }
    } catch {
      setSubdomainValidation({ isValid: false, message: 'Failed to validate subdomain' });
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.subdomain || !newTenant.ownerEmail || !subdomainValidation.isValid) {
      toast.error('Please fill in all required fields correctly');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newTenant.ownerEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setCreateLoading(true);
      const csrfToken = await getCsrfToken();
      const response = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify(newTenant)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Tenant created successfully');
        setShowCreateDialog(false);
        setNewTenant({ name: '', subdomain: '', ownerEmail: '', settings: {} });
        setSubdomainValidation({ isValid: true, message: '' });
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to create tenant');
      }
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error('Failed to create tenant');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditData({ name: tenant.name, status: tenant.status });
    setOwnerCredentials({ email: '', password: '', confirmPassword: '' });
    setTenantOwner(null);
    setShowPassword(false);
    setShowEditDialog(true);
    // Fetch owner data
    fetchTenantOwner(tenant.id);
  };

  const handleSaveEdit = async () => {
    if (!editingTenant || !editData.name.trim()) {
      toast.error('Tenant name is required');
      return;
    }

    try {
      setEditLoading(true);
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${editingTenant.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify(editData)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Tenant updated successfully');
        setShowEditDialog(false);
        setEditingTenant(null);
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to update tenant');
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error('Failed to update tenant');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${tenantId}/${action}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Tenant ${action}d successfully`);
        fetchTenants();
      } else {
        throw new Error(data.error || `Failed to ${action} tenant`);
      }
    } catch (error) {
      console.error(`Error ${action}ing tenant:`, error);
      toast.error(`Failed to ${action} tenant`);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deletingTenant) return;

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${deletingTenant.id}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include',
        body: JSON.stringify({ confirm: 'DELETE' })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Tenant deleted successfully');
        setShowDeleteDialog(false);
        setDeletingTenant(null);
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to delete tenant');
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Failed to delete tenant');
    }
  };

  const fetchTenantOwner = async (tenantId: string) => {
    try {
      setLoadingOwner(true);
      setTenantOwner(null);
      
      // First get the first account for this tenant
      const accountsResponse = await fetch(`/api/superadmin/tenants/${tenantId}/accounts?limit=1`, {
        credentials: 'include'
      });
      const accountsData = await accountsResponse.json();
      
      if (!accountsData.success || !accountsData.data?.length) {
        setTenantOwner(null);
        return;
      }

      const accountId = accountsData.data[0].id;
      
      // Then get the owner of that account
      const ownerResponse = await fetch(`/api/superadmin/tenants/${tenantId}/accounts/${accountId}/owner`, {
        credentials: 'include'
      });
      const ownerData = await ownerResponse.json();
      
      if (ownerData.success && ownerData.data) {
        setTenantOwner({ ...ownerData.data, accountId });
        setOwnerCredentials({
          email: ownerData.data.email || '',
          password: '',
          confirmPassword: ''
        });
      } else {
        setTenantOwner(null);
      }
    } catch (error) {
      console.error('Error fetching tenant owner:', error);
      setTenantOwner(null);
    } finally {
      setLoadingOwner(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!editingTenant || !tenantOwner) return;

    // Validate
    if (!ownerCredentials.email && !ownerCredentials.password) {
      toast.error('Please provide email or password to update');
      return;
    }

    if (ownerCredentials.password && ownerCredentials.password !== ownerCredentials.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (ownerCredentials.password && ownerCredentials.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setSavingCredentials(true);
      const csrfToken = await getCsrfToken();
      
      const body: { email?: string; password?: string } = {};
      if (ownerCredentials.email && ownerCredentials.email !== tenantOwner.email) {
        body.email = ownerCredentials.email;
      }
      if (ownerCredentials.password) {
        body.password = ownerCredentials.password;
      }

      if (Object.keys(body).length === 0) {
        toast.info('No changes to save');
        return;
      }

      // Get the account ID from tenantOwner (we stored it there)
      const accountId = (tenantOwner as TenantOwner & { accountId?: string }).accountId;
      if (!accountId) {
        toast.error('Account not found');
        return;
      }

      const response = await fetch(
        `/api/superadmin/tenants/${editingTenant.id}/accounts/${accountId}/credentials`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken && { 'CSRF-Token': csrfToken })
          },
          credentials: 'include',
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Credentials updated successfully');
        // Update local state
        if (body.email) {
          setTenantOwner(prev => prev ? { ...prev, email: body.email! } : null);
        }
        setOwnerCredentials(prev => ({ ...prev, password: '', confirmPassword: '' }));
        setShowPassword(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update credentials');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleImpersonateTenant = async (tenantId: string) => {
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/impersonate/${tenantId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        const tenantName = data.data.tenant?.name || data.data.impersonation?.tenantName;
        const subdomain = data.data.tenant?.subdomain || data.data.impersonation?.tenantSubdomain;
        
        toast.success(`Now impersonating ${tenantName}`);
        if (window.location.hostname === 'localhost') {
          toast.info(`Impersonation started for ${subdomain}. In production, you would be redirected to the tenant admin panel.`);
        } else {
          window.location.href = `https://${subdomain}.${window.location.hostname}/admin`;
        }
      } else {
        throw new Error(data.error || 'Failed to start impersonation');
      }
    } catch (error) {
      console.error('Error starting impersonation:', error);
      toast.error('Failed to impersonate tenant');
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.subdomain.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tenant Management</h1>
              <p className="text-muted-foreground">Create and manage platform tenants</p>
            </div>
          </div>
          <div className="h-10 w-36 bg-muted animate-pulse rounded-md" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1 h-10 bg-muted animate-pulse rounded-md" />
              <div className="h-10 w-[180px] bg-muted animate-pulse rounded-md" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                        <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tenant Management</h1>
            <p className="text-muted-foreground">
              Create and manage platform tenants
            </p>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Create a new tenant instance with its own subdomain and branding.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input
                  id="tenant-name"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subdomain">Subdomain</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="subdomain"
                    value={newTenant.subdomain}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase();
                      setNewTenant({ ...newTenant, subdomain: value });
                      if (value) {
                        validateSubdomain(value);
                      } else {
                        setSubdomainValidation({ isValid: true, message: '' });
                      }
                    }}
                  />
                  <span className="text-sm text-muted-foreground">.cortex.online</span>
                </div>
                {subdomainValidation.message && (
                  <div className={`flex items-center space-x-1 text-sm ${
                    subdomainValidation.isValid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {subdomainValidation.isValid ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <span>{subdomainValidation.message}</span>
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="owner-email">Owner Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newTenant.ownerEmail}
                  onChange={(e) => setNewTenant({ ...newTenant, ownerEmail: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  The admin account will be created with this email
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateTenant} 
                disabled={createLoading || !subdomainValidation.isValid}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {createLoading ? 'Creating...' : 'Create Tenant'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Tenants ({filteredTenants.length})</span>
          </CardTitle>
          <CardDescription>
            Manage all platform tenants and their settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 rounded-xl bg-muted mb-4">
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No tenants found</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'Create your first tenant to get started'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button 
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Tenant
                  </Button>
                )}
              </div>
            ) : (
              filteredTenants.map((tenant) => (
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
                        <div className="flex items-center space-x-1">
                          <ExternalLink className="h-3 w-3" />
                          <span>{tenant.subdomain}.cortex.online</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span>{tenant.accountCount} accounts</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-3 w-3" />
                          <span>{formatCurrency(tenant.mrr)} MRR</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Created {formatDate(tenant.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Dropdown Menu for Manage - Requirements 3.1 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreHorizontal className="h-4 w-4 mr-1" />
                          Manage
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditTenant(tenant)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleImpersonateTenant(tenant.id)}
                          disabled={tenant.status !== 'active'}
                        >
                          <UserCog className="h-4 w-4 mr-2" />
                          Impersonate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleTenantStatus(tenant.id, tenant.status)}>
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
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setDeletingTenant(tenant);
                            setShowDeleteDialog(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Tenant Dialog - Requirements 3.2 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
            <DialogDescription>
              Update tenant information and admin credentials.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {/* Tenant Info Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Tenant Information
              </div>
              <div className="grid gap-3 pl-6">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Tenant Name</Label>
                  <Input
                    id="edit-name"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-subdomain">Subdomain</Label>
                  <Input
                    id="edit-subdomain"
                    value={editingTenant?.subdomain || ''}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Subdomain cannot be changed after creation
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select 
                    value={editData.status} 
                    onValueChange={(value: 'active' | 'inactive' | 'suspended') => 
                      setEditData({ ...editData, status: value })
                    }
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t my-2" />

            {/* Admin Credentials Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Key className="h-4 w-4" />
                Admin Credentials
              </div>
              <div className="grid gap-3 pl-6">
                {loadingOwner ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading admin data...</span>
                  </div>
                ) : tenantOwner ? (
                  <>
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      <span className="text-muted-foreground">Current admin:</span>{' '}
                      <span className="font-medium">{tenantOwner.name}</span>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="owner-email" className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </Label>
                      <Input
                        id="owner-email"
                        type="email"
                        placeholder="email@example.com"
                        value={ownerCredentials.email}
                        onChange={(e) => setOwnerCredentials({ ...ownerCredentials, email: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="owner-password" className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5" />
                        New Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="owner-password"
                          type={showPassword ? 'text' : 'password'}
                          value={ownerCredentials.password}
                          onChange={(e) => setOwnerCredentials({ ...ownerCredentials, password: e.target.value })}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Leave empty to keep current password</p>
                    </div>
                    {ownerCredentials.password && (
                      <div className="grid gap-2">
                        <Label htmlFor="owner-confirm-password">Confirm Password</Label>
                        <Input
                          id="owner-confirm-password"
                          type={showPassword ? 'text' : 'password'}
                          value={ownerCredentials.confirmPassword}
                          onChange={(e) => setOwnerCredentials({ ...ownerCredentials, confirmPassword: e.target.value })}
                        />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveCredentials}
                      disabled={savingCredentials || (!ownerCredentials.email && !ownerCredentials.password)}
                      className="w-fit"
                    >
                      {savingCredentials ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4 mr-2" />
                          Update Credentials
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No admin account found for this tenant</p>
                    <p className="text-xs mt-1">Create an account first to manage credentials</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={editLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {editLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog - Requirements 3.4 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTenant?.name}"? This action cannot be undone.
              All accounts, agents, inboxes, and data associated with this tenant will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingTenant(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTenant}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TenantManagement;
