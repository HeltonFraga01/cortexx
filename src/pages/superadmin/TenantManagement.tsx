import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  Loader2,
  X,
  Check,
  User
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
  ownerName: string;
  ownerPassword: string;
  confirmPassword: string;
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
  accountId?: string;
}

const TenantManagement = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Inline create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newTenant, setNewTenant] = useState<CreateTenantData>({
    name: '',
    subdomain: '',
    ownerEmail: '',
    ownerName: '',
    ownerPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [subdomainValidation, setSubdomainValidation] = useState<{
    isValid: boolean;
    message: string;
  }>({ isValid: true, message: '' });

  // Inline edit state
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditTenantData>({ name: '', status: 'active' });
  const [editLoading, setEditLoading] = useState(false);
  const [tenantOwner, setTenantOwner] = useState<TenantOwner | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [ownerCredentials, setOwnerCredentials] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Delete confirmation state
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
    // Validate all fields
    if (!newTenant.name || !newTenant.subdomain || !subdomainValidation.isValid) {
      toast.error('Please fill in tenant name and a valid subdomain');
      return;
    }

    if (!newTenant.ownerEmail || !newTenant.ownerName || !newTenant.ownerPassword) {
      toast.error('Please fill in all admin account fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newTenant.ownerEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (newTenant.ownerPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newTenant.ownerPassword !== newTenant.confirmPassword) {
      toast.error('Passwords do not match');
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
        body: JSON.stringify({
          name: newTenant.name,
          subdomain: newTenant.subdomain,
          ownerEmail: newTenant.ownerEmail,
          ownerName: newTenant.ownerName,
          ownerPassword: newTenant.ownerPassword
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Tenant created successfully! Admin can now login.');
        setShowCreateForm(false);
        setNewTenant({ name: '', subdomain: '', ownerEmail: '', ownerName: '', ownerPassword: '', confirmPassword: '' });
        setSubdomainValidation({ isValid: true, message: '' });
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to create tenant');
      }
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tenant');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleStartEdit = (tenant: Tenant) => {
    setEditingTenantId(tenant.id);
    setEditData({ name: tenant.name, status: tenant.status });
    setOwnerCredentials({ email: '', password: '', confirmPassword: '' });
    setTenantOwner(null);
    setShowEditPassword(false);
    fetchTenantOwner(tenant.id);
  };

  const handleCancelEdit = () => {
    setEditingTenantId(null);
    setTenantOwner(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTenantId || !editData.name.trim()) {
      toast.error('Tenant name is required');
      return;
    }

    try {
      setEditLoading(true);
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/superadmin/tenants/${editingTenantId}`, {
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
        setEditingTenantId(null);
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

  const fetchTenantOwner = async (tenantId: string) => {
    try {
      setLoadingOwner(true);
      setTenantOwner(null);
      
      const accountsResponse = await fetch(`/api/superadmin/tenants/${tenantId}/accounts?limit=1`, {
        credentials: 'include'
      });
      const accountsData = await accountsResponse.json();
      
      if (!accountsData.success || !accountsData.data?.length) {
        setTenantOwner(null);
        return;
      }

      const accountId = accountsData.data[0].id;
      
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
      }
    } catch (error) {
      console.error('Error fetching tenant owner:', error);
    } finally {
      setLoadingOwner(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!editingTenantId || !tenantOwner) return;

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

      const accountId = tenantOwner.accountId;
      if (!accountId) {
        toast.error('Account not found');
        return;
      }

      const response = await fetch(
        `/api/superadmin/tenants/${editingTenantId}/accounts/${accountId}/credentials`,
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
        if (body.email) {
          setTenantOwner(prev => prev ? { ...prev, email: body.email! } : null);
        }
        setOwnerCredentials(prev => ({ ...prev, password: '', confirmPassword: '' }));
        setShowEditPassword(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update credentials');
    } finally {
      setSavingCredentials(false);
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
          toast.info(`Impersonation started for ${subdomain}. In production, you would be redirected.`);
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
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
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
      {/* Header */}
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
        {!showCreateForm && (
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Tenant
          </Button>
        )}
      </div>

      {/* Inline Create Form */}
      {showCreateForm && (
        <Card className="border-2 border-orange-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Create New Tenant
            </CardTitle>
            <CardDescription>
              Create a new tenant with admin account for login access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tenant Info Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                <Building2 className="h-4 w-4" />
                Tenant Information
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tenant-name">Tenant Name *</Label>
                  <Input
                    id="tenant-name"
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdomain">Subdomain *</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="subdomain"
                      value={newTenant.subdomain}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase();
                        setNewTenant({ ...newTenant, subdomain: value });
                        if (value) validateSubdomain(value);
                        else setSubdomainValidation({ isValid: true, message: '' });
                      }}
                      disabled={createLoading}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">.cortex.online</span>
                  </div>
                  {subdomainValidation.message && (
                    <div className={`flex items-center gap-1 text-sm ${subdomainValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {subdomainValidation.isValid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      <span>{subdomainValidation.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Account Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                <User className="h-4 w-4" />
                Admin Account (for login at /login)
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Admin Name *</Label>
                  <Input
                    id="owner-name"
                    value={newTenant.ownerName}
                    onChange={(e) => setNewTenant({ ...newTenant, ownerName: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-email">Admin Email *</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    placeholder="admin@example.com"
                    value={newTenant.ownerEmail}
                    onChange={(e) => setNewTenant({ ...newTenant, ownerEmail: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="owner-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newTenant.ownerPassword}
                      onChange={(e) => setNewTenant({ ...newTenant, ownerPassword: e.target.value })}
                      disabled={createLoading}
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
                  <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password *</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newTenant.confirmPassword}
                    onChange={(e) => setNewTenant({ ...newTenant, confirmPassword: e.target.value })}
                    disabled={createLoading}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewTenant({ name: '', subdomain: '', ownerEmail: '', ownerName: '', ownerPassword: '', confirmPassword: '' });
                  setSubdomainValidation({ isValid: true, message: '' });
                }}
                disabled={createLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleCreateTenant}
                disabled={createLoading || !subdomainValidation.isValid}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {createLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Tenant
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                {!searchTerm && statusFilter === 'all' && !showCreateForm && (
                  <Button 
                    onClick={() => setShowCreateForm(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Tenant
                  </Button>
                )}
              </div>
            ) : (
              filteredTenants.map((tenant) => (
                <div key={tenant.id}>
                  {editingTenantId === tenant.id ? (
                    // Inline Edit Form
                    <Card className="border-2 border-primary/50">
                      <CardContent className="pt-6 space-y-6">
                        {/* Tenant Info */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                            <Building2 className="h-4 w-4" />
                            Tenant Information
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Tenant Name</Label>
                              <Input
                                value={editData.name}
                                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Subdomain</Label>
                              <Input value={tenant.subdomain} disabled className="bg-muted" />
                              <p className="text-xs text-muted-foreground">Cannot be changed</p>
                            </div>
                            <div className="space-y-2">
                              <Label>Status</Label>
                              <Select 
                                value={editData.status} 
                                onValueChange={(value: 'active' | 'inactive' | 'suspended') => 
                                  setEditData({ ...editData, status: value })
                                }
                              >
                                <SelectTrigger>
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

                        {/* Admin Credentials */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                            <Key className="h-4 w-4" />
                            Admin Credentials
                          </div>
                          {loadingOwner ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              <span className="ml-2 text-sm text-muted-foreground">Loading admin data...</span>
                            </div>
                          ) : tenantOwner ? (
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label>Current Admin</Label>
                                <div className="p-2 rounded bg-muted text-sm">{tenantOwner.name}</div>
                              </div>
                              <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                  type="email"
                                  value={ownerCredentials.email}
                                  onChange={(e) => setOwnerCredentials({ ...ownerCredentials, email: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>New Password</Label>
                                <div className="relative">
                                  <Input
                                    type={showEditPassword ? 'text' : 'password'}
                                    value={ownerCredentials.password}
                                    onChange={(e) => setOwnerCredentials({ ...ownerCredentials, password: e.target.value })}
                                    className="pr-10"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                    onClick={() => setShowEditPassword(!showEditPassword)}
                                  >
                                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">Leave empty to keep current</p>
                              </div>
                              {ownerCredentials.password && (
                                <div className="space-y-2">
                                  <Label>Confirm Password</Label>
                                  <Input
                                    type={showEditPassword ? 'text' : 'password'}
                                    value={ownerCredentials.confirmPassword}
                                    onChange={(e) => setOwnerCredentials({ ...ownerCredentials, confirmPassword: e.target.value })}
                                  />
                                </div>
                              )}
                              <div className="flex items-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSaveCredentials}
                                  disabled={savingCredentials || (!ownerCredentials.email && !ownerCredentials.password)}
                                >
                                  {savingCredentials ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                                  Update Credentials
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                              <p>No admin account found for this tenant</p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-4 border-t">
                          <Button variant="outline" onClick={handleCancelEdit}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button onClick={handleSaveEdit} disabled={editLoading}>
                            {editLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                            Save Changes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    // Normal Row View
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
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
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4 mr-1" />
                            Manage
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartEdit(tenant)}>
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
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
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
